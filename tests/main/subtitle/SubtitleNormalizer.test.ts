// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { normalizeSubtitleCues } from '@main/services/subtitle/subtitleNormalizer';
import type { SubtitleCue } from '@shared/schemas/subtitle';

const makeCue = (id: number, startMs: number, endMs: number, text = 'text'): SubtitleCue => ({
  index: id,
  startMs,
  endMs,
  text,
  lines: [text],
});

describe('normalizeSubtitleCues', () => {
  it('returns cues unchanged when all valid', () => {
    const cues = [makeCue(1, 0, 1000), makeCue(2, 1000, 2000)];
    const result = normalizeSubtitleCues(cues, []);
    expect(result.cues).toHaveLength(2);
    expect(result.warnings).toHaveLength(0);
  });

  it('emits ZERO_DURATION_CUE when endMs equals startMs', () => {
    const cues = [makeCue(1, 1000, 1000)];
    const result = normalizeSubtitleCues(cues, []);
    expect(result.warnings.some((w) => w.code === 'ZERO_DURATION_CUE')).toBe(true);
  });

  it('emits NEGATIVE_DURATION_CUE when endMs < startMs', () => {
    const cues = [makeCue(1, 2000, 1000)];
    const result = normalizeSubtitleCues(cues, []);
    expect(result.warnings.some((w) => w.code === 'NEGATIVE_DURATION_CUE')).toBe(true);
  });

  it('emits OUT_OF_ORDER_CUES only once for multiple out-of-order pairs', () => {
    const cues = [makeCue(1, 3000, 4000), makeCue(2, 1000, 2000), makeCue(3, 500, 600)];
    const result = normalizeSubtitleCues(cues, []);
    expect(result.warnings.filter((w) => w.code === 'OUT_OF_ORDER_CUES')).toHaveLength(1);
  });

  it('emits OVERLAPPING_CUES only once for multiple overlaps', () => {
    const cues = [
      makeCue(1, 0, 2000),
      makeCue(2, 1000, 3000),
      makeCue(3, 2000, 4000),
      makeCue(4, 2500, 5000),
    ];
    const result = normalizeSubtitleCues(cues, []);
    expect(result.warnings.filter((w) => w.code === 'OVERLAPPING_CUES')).toHaveLength(1);
  });

  it('does not reorder out-of-order cues', () => {
    const cues = [makeCue(1, 3000, 4000), makeCue(2, 1000, 2000)];
    const result = normalizeSubtitleCues(cues, []);
    expect(result.cues[0].startMs).toBe(3000);
    expect(result.cues[1].startMs).toBe(1000);
  });

  it('appends to existing warnings instead of replacing', () => {
    const existing = [{ code: 'EMPTY_CUE_TEXT' as const, cueIndex: 0, message: 'empty' }];
    const cues = [makeCue(1, 1000, 1000)];
    const result = normalizeSubtitleCues(cues, existing);
    expect(result.warnings).toHaveLength(2);
    expect(result.warnings[0].code).toBe('EMPTY_CUE_TEXT');
    expect(result.warnings[1].code).toBe('ZERO_DURATION_CUE');
  });

  it('handles empty cue array', () => {
    const result = normalizeSubtitleCues([], []);
    expect(result.cues).toHaveLength(0);
    expect(result.warnings).toHaveLength(0);
  });

  it('handles single cue (no sequential pair checks)', () => {
    const cues = [makeCue(1, 0, 1000)];
    const result = normalizeSubtitleCues(cues, []);
    expect(result.cues).toHaveLength(1);
    expect(result.warnings).toHaveLength(0);
  });
});
