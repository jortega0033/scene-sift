import { z } from 'zod';

export const subtitleStatusSchema = z.enum([
  'not_selected',
  'selected',
  'parse_failed',
  'unsupported',
  'missing',
  'ready',
  'ready_with_warnings',
]);

export const parseWarningCodeSchema = z.enum([
  'ZERO_DURATION_CUE',
  'NEGATIVE_DURATION_CUE',
  'OUT_OF_ORDER_CUES',
  'OVERLAPPING_CUES',
  'EMPTY_CUE_TEXT',
  'DUPLICATE_CUE_INDEX',
  'CUE_TEXT_TRUNCATED',
  'CUES_TRUNCATED',
  'UNSUPPORTED_VTT_FEATURE',
  'RECOVERABLE_TIMESTAMP_ERROR',
]);

export const parseWarningSchema = z.object({
  code: parseWarningCodeSchema,
  message: z.string(),
  cueIndex: z.number().int().optional(),
});

export const subtitleCueSchema = z.object({
  index: z.number().int(),
  startMs: z.number().int(),
  endMs: z.number().int(),
  text: z.string(),
  lines: z.array(z.string()),
});

export const subtitleSummarySchema = z.object({
  cueCount: z.number().int(),
  firstCueStartMs: z.number().int().nullable(),
  lastCueEndMs: z.number().int().nullable(),
  totalTextLength: z.number().int(),
  warningCount: z.number().int(),
});

export const subtitleDocumentSchema = z.object({
  schemaVersion: z.literal(1),
  sourceFormat: z.enum(['srt', 'vtt']),
  sourceEncoding: z.string(),
  cues: z.array(subtitleCueSchema),
  warnings: z.array(parseWarningSchema),
  summary: subtitleSummarySchema,
  parsedAt: z.number().int(),
});

export const subtitleSelectInputSchema = z.object({
  projectId: z.string().uuid(),
});

export const subtitleParseInputSchema = z.object({
  projectId: z.string().uuid(),
});

export const subtitleClearInputSchema = z.object({
  projectId: z.string().uuid(),
});

export const subtitlePersistOutcomeSchema = z.object({
  subtitleStatus: subtitleStatusSchema,
  cueCount: z.number().int().nullable(),
  lastCueEndMs: z.number().int().nullable(),
  parseError: z.string().max(64).nullable(),
  parsedAt: z.number().int(),
});

export type SubtitleStatus = z.infer<typeof subtitleStatusSchema>;
export type ParseWarningCode = z.infer<typeof parseWarningCodeSchema>;
export type ParseWarning = z.infer<typeof parseWarningSchema>;
export type SubtitleCue = z.infer<typeof subtitleCueSchema>;
export type SubtitleSummary = z.infer<typeof subtitleSummarySchema>;
export type SubtitleDocument = z.infer<typeof subtitleDocumentSchema>;
export type SubtitlePersistOutcome = z.infer<typeof subtitlePersistOutcomeSchema>;
