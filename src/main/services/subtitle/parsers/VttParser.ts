import type { SubtitleCue, ParseWarning } from '@shared/schemas/subtitle';

const MAX_CUES = 10_000;
const MAX_TOTAL_TEXT = 1_048_576;
const MAX_CUE_TEXT = 2_048;

// HH:MM:SS.mmm or MM:SS.mmm (hours optional in VTT)
const VTT_TS_LONG_RE = /^(\d+):(\d{2}):(\d{2})\.(\d{3})/;
const VTT_TS_SHORT_RE = /^(\d{2}):(\d{2})\.(\d{3})/;
const TAG_STRIP_RE = /<[^>]{0,128}>/g;
// Strip VTT timestamp tags like <00:00:01.000>
const VTT_TIMESTAMP_TAG_RE = /<\d{2}:\d{2}[:.]\d{2,3}(?:\.\d{3})?>/g;

function parseSide(raw: string): number | null {
  const trimmed = raw.trim();
  const longMatch = trimmed.match(VTT_TS_LONG_RE);
  if (longMatch) {
    return (
      parseInt(longMatch[1]!) * 3_600_000 +
      parseInt(longMatch[2]!) * 60_000 +
      parseInt(longMatch[3]!) * 1_000 +
      parseInt(longMatch[4]!)
    );
  }
  const shortMatch = trimmed.match(VTT_TS_SHORT_RE);
  if (shortMatch) {
    return (
      parseInt(shortMatch[1]!) * 60_000 +
      parseInt(shortMatch[2]!) * 1_000 +
      parseInt(shortMatch[3]!)
    );
  }
  return null;
}

export interface VttParseResult {
  cues: SubtitleCue[];
  warnings: ParseWarning[];
}

export function parseVtt(content: string): VttParseResult {
  const cues: SubtitleCue[] = [];
  const warnings: ParseWarning[] = [];
  let totalTextLength = 0;
  let autoIndex = 0;
  let warnedStyle = false;
  let warnedRegion = false;

  const blocks = content.split(/\n{2,}/);

  // First block must start with WEBVTT optionally followed by space, tab, newline, or nothing (W3C spec).
  const firstBlock = (blocks[0] ?? '').trim();
  if (!firstBlock.startsWith('WEBVTT') || (firstBlock.length > 6 && firstBlock[6] !== ' ' && firstBlock[6] !== '\t' && firstBlock[6] !== '\n')) {
    throw new Error('SUBTITLE_INVALID_FORMAT');
  }

  // Skip first block (WEBVTT header + optional metadata)
  for (let blockIdx = 1; blockIdx < blocks.length; blockIdx++) {
    if (cues.length >= MAX_CUES) {
      warnings.push({ code: 'CUES_TRUNCATED', message: 'Cue limit of 10,000 reached; remaining cues skipped.' });
      break;
    }
    if (totalTextLength > MAX_TOTAL_TEXT) {
      warnings.push({ code: 'CUES_TRUNCATED', message: 'Total text exceeded 1 MB; remaining cues skipped.' });
      break;
    }

    const rawBlock = (blocks[blockIdx] ?? '').trim();
    if (rawBlock.length === 0) continue;

    const lines = rawBlock.split('\n').map((l) => l.trim());
    if (lines.length === 0) continue;

    const firstLine = lines[0] ?? '';

    // NOTE block
    if (firstLine.startsWith('NOTE')) continue;

    // STYLE block
    if (firstLine.startsWith('STYLE')) {
      if (!warnedStyle) {
        warnings.push({ code: 'UNSUPPORTED_VTT_FEATURE', message: 'STYLE blocks are not supported; styling discarded.' });
        warnedStyle = true;
      }
      continue;
    }

    // REGION block
    if (firstLine.startsWith('REGION')) {
      if (!warnedRegion) {
        warnings.push({ code: 'UNSUPPORTED_VTT_FEATURE', message: 'REGION blocks are not supported; region definitions discarded.' });
        warnedRegion = true;
      }
      continue;
    }

    // Cue block: find timestamp line (contains '-->')
    let lineIdx = 0;

    // Optional cue identifier (does not contain '-->')
    if (!firstLine.includes('-->')) {
      lineIdx = 1;
    }

    const timestampLine = lines[lineIdx] ?? '';
    if (!timestampLine.includes('-->')) continue;

    const arrowIdx = timestampLine.indexOf('-->');
    const leftRaw = timestampLine.slice(0, arrowIdx);
    // Strip any cue settings after end timestamp (first whitespace after end ts)
    const rightAndSettings = timestampLine.slice(arrowIdx + 3).trimStart();
    const rightRaw = rightAndSettings.split(/\s/)[0] ?? rightAndSettings;

    const startMs = parseSide(leftRaw);
    const endMs = parseSide(rightRaw);

    if (startMs === null || endMs === null) {
      autoIndex++;
      warnings.push({
        code: 'RECOVERABLE_TIMESTAMP_ERROR',
        message: `Unparseable VTT timestamp in block ${autoIndex}; cue skipped.`,
        cueIndex: autoIndex,
      });
      continue;
    }

    autoIndex++;
    const cueIndex = autoIndex;

    const textLines = lines.slice(lineIdx + 1);
    const strippedLines = textLines
      .map((l) =>
        l
          .replace(VTT_TIMESTAMP_TAG_RE, '')
          .replace(TAG_STRIP_RE, '')
          .trim()
      )
      .filter((l) => l.length > 0);

    let text = strippedLines.join('\n');

    if (text.length === 0) {
      warnings.push({ code: 'EMPTY_CUE_TEXT', message: `Cue ${cueIndex} has empty text after stripping.`, cueIndex });
    }

    if (text.length > MAX_CUE_TEXT) {
      text = text.slice(0, MAX_CUE_TEXT);
      warnings.push({ code: 'CUE_TEXT_TRUNCATED', message: `Cue ${cueIndex} text truncated to ${MAX_CUE_TEXT} chars.`, cueIndex });
    }

    totalTextLength += text.length;

    cues.push({
      index: cueIndex,
      startMs,
      endMs,
      text,
      lines: text.split('\n'),
    });
  }

  return { cues, warnings };
}
