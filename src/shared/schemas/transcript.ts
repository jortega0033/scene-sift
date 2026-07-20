import { z } from 'zod';
import { subtitleStatusSchema } from './subtitle';

export const transcriptEntrySchema = z.object({
  startMs: z.number().int().nonnegative(),
  endMs: z.number().int().nonnegative(),
  text: z.string(),
});

export const transcriptGenerateInputSchema = z.object({
  projectId: z.string().uuid(),
  gapThresholdMs: z.number().int().min(0).max(10000).default(500),
});

export const transcriptGenerateOutputSchema = z.object({
  entries: z.array(transcriptEntrySchema),
  subtitleStatus: subtitleStatusSchema.nullable(),
});

export const transcriptExportInputSchema = z.object({
  projectId: z.string().uuid(),
  gapThresholdMs: z.number().int().min(0).max(10000).default(500),
  format: z.enum(['txt', 'json']),
});

export const transcriptExportOutputSchema = z.object({
  exported: z.boolean(),
  path: z.string().nullable(),
});

export type TranscriptEntry = z.infer<typeof transcriptEntrySchema>;
export type TranscriptGenerateInput = z.infer<typeof transcriptGenerateInputSchema>;
export type TranscriptGenerateOutput = z.infer<typeof transcriptGenerateOutputSchema>;
export type TranscriptExportInput = z.infer<typeof transcriptExportInputSchema>;
export type TranscriptExportOutput = z.infer<typeof transcriptExportOutputSchema>;
