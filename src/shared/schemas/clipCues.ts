import { z } from 'zod';

export const clipCueSchema = z.object({
  id: z.string().uuid(),
  candidateId: z.string().uuid(),
  sequenceIndex: z.number().int().positive(),
  startMs: z.number().int().nonnegative(),
  endMs: z.number().int().positive(),
  text: z.string(),
  createdAt: z.number().int(),
  updatedAt: z.number().int(),
});

export type ClipCue = z.infer<typeof clipCueSchema>;

export const generateClipCuesInputSchema = z.object({
  candidateId: z.string().uuid(),
});
export const generateClipCuesOutputSchema = z.object({
  cueCount: z.number().int().nonnegative(),
});

export const listClipCuesInputSchema = z.object({
  candidateId: z.string().uuid(),
});
export const listClipCuesOutputSchema = z.object({
  cues: z.array(clipCueSchema),
});

export const updateClipCueInputSchema = z.object({
  cueId: z.string().uuid(),
  startMs: z.number().int().nonnegative(),
  endMs: z.number().int().positive().max(86_400_000),
  text: z.string().min(1).max(500),
}).refine((d) => d.endMs > d.startMs, { message: 'endMs must be greater than startMs' });
export const updateClipCueOutputSchema = z.object({ ok: z.literal(true) });

export const deleteClipCueInputSchema = z.object({
  cueId: z.string().uuid(),
});
export const deleteClipCueOutputSchema = z.object({ ok: z.literal(true) });

export const addClipCueInputSchema = z.object({
  candidateId: z.string().uuid(),
  startMs: z.number().int().nonnegative(),
  endMs: z.number().int().positive().max(86_400_000),
  text: z.string().min(1).max(500),
}).refine((d) => d.endMs > d.startMs, { message: 'endMs must be greater than startMs' });
export const addClipCueOutputSchema = z.object({ cue: clipCueSchema });

export type GenerateClipCuesInput = z.infer<typeof generateClipCuesInputSchema>;
export type GenerateClipCuesOutput = z.infer<typeof generateClipCuesOutputSchema>;
export type ListClipCuesInput = z.infer<typeof listClipCuesInputSchema>;
export type ListClipCuesOutput = z.infer<typeof listClipCuesOutputSchema>;
export type UpdateClipCueInput = z.infer<typeof updateClipCueInputSchema>;
export type UpdateClipCueOutput = z.infer<typeof updateClipCueOutputSchema>;
export type DeleteClipCueInput = z.infer<typeof deleteClipCueInputSchema>;
export type DeleteClipCueOutput = z.infer<typeof deleteClipCueOutputSchema>;
export type AddClipCueInput = z.infer<typeof addClipCueInputSchema>;
export type AddClipCueOutput = z.infer<typeof addClipCueOutputSchema>;
