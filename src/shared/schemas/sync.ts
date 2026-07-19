import { z } from 'zod';

export const SyncWarningCode = {
  CUES_OUTSIDE_VIDEO_RANGE: 'CUES_OUTSIDE_VIDEO_RANGE',
  SUBTITLE_SPAN_SHORT: 'SUBTITLE_SPAN_SHORT',
  SUBTITLE_SPAN_LONG: 'SUBTITLE_SPAN_LONG',
  LARGE_TAIL_GAP: 'LARGE_TAIL_GAP',
  LATE_SUBTITLE_START: 'LATE_SUBTITLE_START',
} as const;

export type SyncWarningCode = (typeof SyncWarningCode)[keyof typeof SyncWarningCode];

export const SyncStatus = {
  NOT_AVAILABLE: 'not_available',
  READY_TO_CHECK: 'ready_to_check',
  TIMING_OK: 'timing_ok',
  NEEDS_REVIEW: 'needs_review',
  CHECK_FAILED: 'check_failed',
  // 'stale' is a display-only computed state — never written to DB
} as const;

export type SyncStatus = (typeof SyncStatus)[keyof typeof SyncStatus];

export const syncWarningSchema = z.object({
  code: z.enum([
    SyncWarningCode.CUES_OUTSIDE_VIDEO_RANGE,
    SyncWarningCode.SUBTITLE_SPAN_SHORT,
    SyncWarningCode.SUBTITLE_SPAN_LONG,
    SyncWarningCode.LARGE_TAIL_GAP,
    SyncWarningCode.LATE_SUBTITLE_START,
  ]),
  outOfRangeCount: z.number().int().optional(),
  spanRatio: z.number().optional(),
  gapMs: z.number().optional(),
  startRatio: z.number().optional(),
});

export type SyncWarning = z.infer<typeof syncWarningSchema>;

export const syncCheckForProjectInputSchema = z.object({
  projectId: z.string().uuid(),
});

export const syncCheckForProjectOutputSchema = z.object({
  syncStatus: z.enum([
    SyncStatus.NOT_AVAILABLE,
    SyncStatus.READY_TO_CHECK,
    SyncStatus.TIMING_OK,
    SyncStatus.NEEDS_REVIEW,
    SyncStatus.CHECK_FAILED,
  ]),
  syncWarnings: z.array(syncWarningSchema),
  syncCheckedAt: z.number().nullable(),
  syncAnalysisVersion: z.number().nullable(),
});

export type SyncCheckResult = z.infer<typeof syncCheckForProjectOutputSchema>;
