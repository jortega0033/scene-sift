/**
 * syncFormatters — pure display helpers for sync panel state.
 * No React, no imports from main or database layers.
 */

import { SyncWarningCode, SyncStatus } from '@shared/schemas/sync';
import type { SyncWarning } from '@shared/schemas/sync';

export function formatSyncStatus(syncStatus: string | null): string {
  switch (syncStatus) {
    case SyncStatus.NOT_AVAILABLE:
      return 'Not available';
    case SyncStatus.READY_TO_CHECK:
      return 'Ready to check';
    case SyncStatus.TIMING_OK:
      return 'Timing OK';
    case SyncStatus.NEEDS_REVIEW:
      return 'Needs review';
    case SyncStatus.CHECK_FAILED:
      return 'Check failed';
    case 'stale':
      return 'Needs recheck';
    default:
      return 'Not checked';
  }
}

export function formatSyncWarning(warning: SyncWarning): string {
  switch (warning.code) {
    case SyncWarningCode.CUES_OUTSIDE_VIDEO_RANGE: {
      const count = warning.outOfRangeCount ?? 1;
      return `${count} cue${count !== 1 ? 's' : ''} fall outside video duration`;
    }
    case SyncWarningCode.SUBTITLE_SPAN_SHORT:
      return `Subtitle span is only ${Math.round((warning.spanRatio ?? 0) * 100)}% of video duration`;
    case SyncWarningCode.SUBTITLE_SPAN_LONG:
      return `Subtitle span is ${Math.round((warning.spanRatio ?? 0) * 100)}% of video duration`;
    case SyncWarningCode.LARGE_TAIL_GAP:
      return `Last cue ends ${Math.round((warning.gapMs ?? 0) / 1000)}s before video end`;
    case SyncWarningCode.LATE_SUBTITLE_START:
      return `First cue starts at ${Math.round((warning.startRatio ?? 0) * 100)}% into video`;
    default:
      return `Timing warning (${warning.code})`;
  }
}

export function formatSyncCheckedAt(syncCheckedAt: number | null): string {
  if (syncCheckedAt === null) return '—';
  return new Date(syncCheckedAt).toLocaleString();
}

/**
 * Compute the display sync status, incorporating the stale check.
 *
 * stale = sync has been run (timing_ok or needs_review) but video was re-inspected
 * or subtitle was re-parsed since the last sync check.
 *
 * The 'stale' value is NEVER written to the DB — it is computed here at display time.
 */
export function computeDisplaySyncStatus(
  syncStatus: string | null,
  syncCheckedAt: number | null,
  inspectedAt: number | null,
  subtitleParsedAt: number | null,
): string {
  if (
    !syncStatus ||
    syncStatus === SyncStatus.NOT_AVAILABLE ||
    syncStatus === SyncStatus.READY_TO_CHECK
  ) {
    return syncStatus ?? SyncStatus.NOT_AVAILABLE;
  }

  // For terminal states (timing_ok, needs_review, check_failed), check staleness
  if (syncCheckedAt !== null) {
    const isStale =
      (inspectedAt !== null && inspectedAt > syncCheckedAt) ||
      (subtitleParsedAt !== null && subtitleParsedAt > syncCheckedAt);
    if (isStale) return 'stale';
  }

  return syncStatus;
}
