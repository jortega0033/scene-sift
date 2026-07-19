import type { SubtitleCue, ParseWarning } from '@shared/schemas/subtitle';

export interface NormalizeResult {
  cues: SubtitleCue[];
  warnings: ParseWarning[];
}

export function normalizeSubtitleCues(rawCues: SubtitleCue[], existingWarnings: ParseWarning[]): NormalizeResult {
  const warnings: ParseWarning[] = [...existingWarnings];
  let warnedOutOfOrder = false;
  let warnedOverlapping = false;

  for (let i = 0; i < rawCues.length; i++) {
    const cue = rawCues[i]!;

    if (cue.endMs <= cue.startMs) {
      if (cue.endMs === cue.startMs) {
        warnings.push({ code: 'ZERO_DURATION_CUE', message: `Cue ${cue.index} has zero duration.`, cueIndex: cue.index });
      } else {
        warnings.push({ code: 'NEGATIVE_DURATION_CUE', message: `Cue ${cue.index} has negative duration.`, cueIndex: cue.index });
      }
    }

    if (i > 0) {
      const prev = rawCues[i - 1]!;

      if (!warnedOutOfOrder && cue.startMs < prev.startMs) {
        warnedOutOfOrder = true;
        warnings.push({ code: 'OUT_OF_ORDER_CUES', message: 'Cue timestamps are not in ascending order.' });
      }

      if (!warnedOverlapping && cue.startMs < prev.endMs) {
        warnedOverlapping = true;
        warnings.push({ code: 'OVERLAPPING_CUES', message: 'Overlapping cue timestamps detected.' });
      }
    }
  }

  return { cues: rawCues, warnings };
}
