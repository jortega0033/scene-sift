/**
 * SynchronizationAnalyzer — pure function, no IO, no Date.now(), no DB calls.
 *
 * Analyzes subtitle timing against video duration to detect structural mismatches.
 * All inputs must be pre-loaded by the caller (SynchronizationService).
 *
 * Algorithm is versioned: any threshold change must increment SYNC_ANALYSIS_VERSION.
 */

import type { SyncWarning } from '@shared/schemas/sync';
import type { SubtitleCue } from '@shared/schemas/subtitle';

// ─── Thresholds ───────────────────────────────────────────────────────────────

export const TAIL_TOLERANCE_MS = 2000;
export const SPAN_SHORT_RATIO = 0.5;
export const SPAN_LONG_RATIO = 1.2;
export const LATE_START_THRESHOLD_RATIO = 0.15;
export const LARGE_TAIL_GAP_MS = 10000;
export const SYNC_ANALYSIS_VERSION = 1;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SyncAnalysisInput {
  durationMs: number;
  cues: Pick<SubtitleCue, 'startMs' | 'endMs'>[];
  analysisVersion: number;
}

export interface SyncAnalysisResult {
  syncStatus: 'timing_ok' | 'needs_review' | 'check_failed';
  syncWarnings: SyncWarning[];
  syncErrorCode?: string;
  syncAnalysisVersion: number;
}

// ─── Analyzer ─────────────────────────────────────────────────────────────────

/**
 * Analyze subtitle cue timing against video duration.
 * Pure function — same input always produces the same output.
 */
export function analyze(input: SyncAnalysisInput): SyncAnalysisResult {
  const { durationMs, cues, analysisVersion } = input;

  try {
    // Guard A: invalid video duration
    if (durationMs <= 0) {
      return {
        syncStatus: 'check_failed',
        syncWarnings: [],
        syncErrorCode: 'INVALID_VIDEO_DURATION',
        syncAnalysisVersion: analysisVersion,
      };
    }

    // Guard B: no cues to analyze
    if (cues.length === 0) {
      return {
        syncStatus: 'check_failed',
        syncWarnings: [],
        syncErrorCode: 'NO_CUES_TO_ANALYZE',
        syncAnalysisVersion: analysisVersion,
      };
    }

    // After Guard B, firstCueStartMs and lastCueEndMs are guaranteed non-null.
    const firstCueStartMs = Math.min(...cues.map((c) => c.startMs));
    const lastCueEndMs = Math.max(...cues.map((c) => c.endMs));

    const syncWarnings: SyncWarning[] = [];

    // Check 1 — Cues outside video range
    // Count cues where endMs > durationMs + TAIL_TOLERANCE_MS OR startMs < 0
    let outOfRangeCount = 0;
    for (const cue of cues) {
      if (cue.endMs > durationMs + TAIL_TOLERANCE_MS || cue.startMs < 0) {
        outOfRangeCount++;
      }
    }
    if (outOfRangeCount > 0) {
      syncWarnings.push({ code: 'CUES_OUTSIDE_VIDEO_RANGE', outOfRangeCount });
    }

    // Check 2 — Subtitle span too short (only if cueCount >= 10)
    if (cues.length >= 10) {
      const subtitleSpanMs = lastCueEndMs - firstCueStartMs;
      const spanRatio = subtitleSpanMs / durationMs;
      if (spanRatio < SPAN_SHORT_RATIO) {
        syncWarnings.push({ code: 'SUBTITLE_SPAN_SHORT', spanRatio });
      }
    }

    // Check 3 — Subtitle span too long (no cueCount guard)
    // Uses lastCueEndMs directly (not span) per M3_ANALYSIS_RULES.md
    if (lastCueEndMs > durationMs * SPAN_LONG_RATIO) {
      const spanRatio = lastCueEndMs / durationMs;
      syncWarnings.push({ code: 'SUBTITLE_SPAN_LONG', spanRatio });
    }

    // Check 4 — Large tail gap
    // Skip if SUBTITLE_SPAN_SHORT was already emitted (redundant signal)
    if (!syncWarnings.some((w) => w.code === 'SUBTITLE_SPAN_SHORT')) {
      const tailGapMs = durationMs - lastCueEndMs;
      if (tailGapMs > LARGE_TAIL_GAP_MS) {
        syncWarnings.push({ code: 'LARGE_TAIL_GAP', gapMs: tailGapMs });
      }
    }

    // Check 5 — Late subtitle start
    const lateStartThresholdMs = durationMs * LATE_START_THRESHOLD_RATIO;
    if (firstCueStartMs > lateStartThresholdMs) {
      const startRatio = firstCueStartMs / durationMs;
      syncWarnings.push({ code: 'LATE_SUBTITLE_START', startRatio });
    }

    // Derive status: any warning → needs_review; none → timing_ok
    const syncStatus = syncWarnings.length === 0 ? 'timing_ok' : 'needs_review';

    return {
      syncStatus,
      syncWarnings,
      syncAnalysisVersion: analysisVersion,
    };
  } catch {
    return {
      syncStatus: 'check_failed',
      syncWarnings: [],
      syncErrorCode: 'SYNC_ANALYZER_INTERNAL_ERROR',
      syncAnalysisVersion: analysisVersion,
    };
  }
}
