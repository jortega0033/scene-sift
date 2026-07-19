import { describe, it, expect } from 'vitest';
import {
  formatSyncStatus,
  formatSyncWarning,
  formatSyncCheckedAt,
  computeDisplaySyncStatus,
} from '@renderer/features/projects/syncFormatters';
import type { SyncWarning } from '@shared/schemas/sync';

// ─── formatSyncStatus ────────────────────────────────────────────────────────

describe('formatSyncStatus', () => {
  it('formats not_available', () => {
    expect(formatSyncStatus('not_available')).toBe('Not available');
  });

  it('formats ready_to_check', () => {
    expect(formatSyncStatus('ready_to_check')).toBe('Ready to check');
  });

  it('formats timing_ok', () => {
    expect(formatSyncStatus('timing_ok')).toBe('Timing OK');
  });

  it('formats needs_review', () => {
    expect(formatSyncStatus('needs_review')).toBe('Needs review');
  });

  it('formats check_failed', () => {
    expect(formatSyncStatus('check_failed')).toBe('Check failed');
  });

  it('formats stale (display-only state)', () => {
    expect(formatSyncStatus('stale')).toBe('Needs recheck');
  });

  it('formats null as Not checked', () => {
    expect(formatSyncStatus(null)).toBe('Not checked');
  });

  it('formats unknown string as Not checked', () => {
    expect(formatSyncStatus('unknown_state')).toBe('Not checked');
  });
});

// ─── formatSyncWarning ───────────────────────────────────────────────────────

describe('formatSyncWarning', () => {
  it('formats CUES_OUTSIDE_VIDEO_RANGE — singular', () => {
    const warning: SyncWarning = { code: 'CUES_OUTSIDE_VIDEO_RANGE', outOfRangeCount: 1 };
    expect(formatSyncWarning(warning)).toBe('1 cue fall outside video duration');
  });

  it('formats CUES_OUTSIDE_VIDEO_RANGE — plural', () => {
    const warning: SyncWarning = { code: 'CUES_OUTSIDE_VIDEO_RANGE', outOfRangeCount: 3 };
    expect(formatSyncWarning(warning)).toBe('3 cues fall outside video duration');
  });

  it('formats SUBTITLE_SPAN_SHORT', () => {
    const warning: SyncWarning = { code: 'SUBTITLE_SPAN_SHORT', spanRatio: 0.42 };
    expect(formatSyncWarning(warning)).toBe('Subtitle span is only 42% of video duration');
  });

  it('formats SUBTITLE_SPAN_LONG', () => {
    const warning: SyncWarning = { code: 'SUBTITLE_SPAN_LONG', spanRatio: 1.35 };
    expect(formatSyncWarning(warning)).toBe('Subtitle span is 135% of video duration');
  });

  it('formats LARGE_TAIL_GAP', () => {
    const warning: SyncWarning = { code: 'LARGE_TAIL_GAP', gapMs: 15000 };
    expect(formatSyncWarning(warning)).toBe('Last cue ends 15s before video end');
  });

  it('formats LATE_SUBTITLE_START', () => {
    const warning: SyncWarning = { code: 'LATE_SUBTITLE_START', startRatio: 0.3 };
    expect(formatSyncWarning(warning)).toBe('First cue starts at 30% into video');
  });
});

// ─── formatSyncCheckedAt ─────────────────────────────────────────────────────

describe('formatSyncCheckedAt', () => {
  it('returns em-dash for null', () => {
    expect(formatSyncCheckedAt(null)).toBe('—');
  });

  it('returns non-empty string for valid timestamp', () => {
    const ts = Date.now();
    const result = formatSyncCheckedAt(ts);
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
    expect(result).not.toBe('—');
  });
});

// ─── computeDisplaySyncStatus ────────────────────────────────────────────────

describe('computeDisplaySyncStatus', () => {
  const T = 1_000_000;

  it('returns not_available when syncStatus is null', () => {
    expect(computeDisplaySyncStatus(null, null, null, null)).toBe('not_available');
  });

  it('returns not_available when syncStatus is not_available', () => {
    expect(computeDisplaySyncStatus('not_available', null, null, null)).toBe('not_available');
  });

  it('returns ready_to_check unchanged (no stale check)', () => {
    expect(computeDisplaySyncStatus('ready_to_check', null, T + 1000, T + 1000)).toBe(
      'ready_to_check',
    );
  });

  it('returns timing_ok when no more-recent inspection or parse', () => {
    expect(computeDisplaySyncStatus('timing_ok', T, T - 1000, T - 1000)).toBe('timing_ok');
  });

  it('returns stale when inspectedAt > syncCheckedAt', () => {
    expect(computeDisplaySyncStatus('timing_ok', T, T + 1, null)).toBe('stale');
  });

  it('returns stale when subtitleParsedAt > syncCheckedAt', () => {
    expect(computeDisplaySyncStatus('timing_ok', T, null, T + 1)).toBe('stale');
  });

  it('does NOT return stale when inspectedAt === syncCheckedAt (not strictly greater)', () => {
    expect(computeDisplaySyncStatus('timing_ok', T, T, null)).toBe('timing_ok');
  });

  it('does NOT return stale when subtitleParsedAt === syncCheckedAt (not strictly greater)', () => {
    expect(computeDisplaySyncStatus('timing_ok', T, null, T)).toBe('timing_ok');
  });

  it('returns stale for needs_review when subtitle was re-parsed', () => {
    expect(computeDisplaySyncStatus('needs_review', T, null, T + 500)).toBe('stale');
  });

  it('returns check_failed as-is when nothing changed', () => {
    expect(computeDisplaySyncStatus('check_failed', T, T - 1, T - 1)).toBe('check_failed');
  });

  it('returns stale for check_failed when re-inspected after check', () => {
    expect(computeDisplaySyncStatus('check_failed', T, T + 100, null)).toBe('stale');
  });

  it('returns timing_ok when syncCheckedAt is null (never run yet)', () => {
    // Shouldn't happen in practice (timing_ok always has a checkedAt), but guard
    expect(computeDisplaySyncStatus('timing_ok', null, T, T)).toBe('timing_ok');
  });

  it('handles all timestamps null gracefully', () => {
    expect(computeDisplaySyncStatus('timing_ok', null, null, null)).toBe('timing_ok');
  });
});
