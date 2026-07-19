import type { SubtitleCue, ParseWarning } from '@shared/schemas/subtitle';

const MAX_CUES = 10_000;
const MAX_TOTAL_TEXT = 1_048_576;
const MAX_CUE_TEXT = 2_048;

const SRT_TIMESTAMP_RE =
  /^(\d{2,}):(\d{2}):(\d{2}),(\d{3})\s*-->\s*(\d{2,}):(\d{2}):(\d{2}),(\d{3})/;
const TAG_STRIP_RE = /<[^>]{0,128}>/g;

function toMs(h: string, m: string, s: string, ms: string): number {
  return parseInt(h) * 3_600_000 + parseInt(m) * 60_000 + parseInt(s) * 1_000 + parseInt(ms);
}

export interface SrtParseResult {
  cues: SubtitleCue[];
  warnings: ParseWarning[];
}

export function parseSrt(content: string): SrtParseResult {
  const cues: SubtitleCue[] = [];
  const warnings: ParseWarning[] = [];
  const seenIndices = new Set<number>();
  let totalTextLength = 0;
  let autoIndex = 0;

  const blocks = content.split(/\n{2,}/);

  for (const rawBlock of blocks) {
    if (cues.length >= MAX_CUES) {
      warnings.push({ code: 'CUES_TRUNCATED', message: 'Cue limit of 10,000 reached; remaining cues skipped.' });
      break;
    }
    if (totalTextLength > MAX_TOTAL_TEXT) {
      warnings.push({ code: 'CUES_TRUNCATED', message: 'Total text exceeded 1 MB; remaining cues skipped.' });
      break;
    }

    const lines = rawBlock
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
    if (lines.length === 0) continue;

    let lineIdx = 0;

    // Optional index line: a line that is purely an integer
    let cueIndex: number;
    const firstLine = lines[lineIdx] ?? '';
    const parsedIdx = parseInt(firstLine, 10);
    if (!isNaN(parsedIdx) && parsedIdx > 0 && String(parsedIdx) === firstLine) {
      cueIndex = parsedIdx;
      lineIdx++;
    } else {
      autoIndex++;
      cueIndex = autoIndex;
    }

    if (seenIndices.has(cueIndex)) {
      warnings.push({ code: 'DUPLICATE_CUE_INDEX', message: `Duplicate cue index ${cueIndex}.`, cueIndex });
    }
    seenIndices.add(cueIndex);
    autoIndex = Math.max(autoIndex, cueIndex);

    const timestampLine = lines[lineIdx] ?? '';
    lineIdx++;

    const tsMatch = timestampLine.match(SRT_TIMESTAMP_RE);
    if (!tsMatch) {
      warnings.push({
        code: 'RECOVERABLE_TIMESTAMP_ERROR',
        message: `Unparseable SRT timestamp near cue ${cueIndex}; cue skipped.`,
        cueIndex,
      });
      continue;
    }

    const startMs = toMs(tsMatch[1]!, tsMatch[2]!, tsMatch[3]!, tsMatch[4]!);
    const endMs = toMs(tsMatch[5]!, tsMatch[6]!, tsMatch[7]!, tsMatch[8]!);

    const textLines = lines.slice(lineIdx).map((l) => l.replace(TAG_STRIP_RE, '').trim());
    const nonEmpty = textLines.filter((l) => l.length > 0);

    let text = nonEmpty.join('\n');

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
