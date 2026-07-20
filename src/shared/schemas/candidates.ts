import { z } from 'zod';

export const candidateStatusSchema = z.enum(['suggested', 'approved', 'rejected']);

export const clipCandidateSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  generationId: z.string().uuid(),
  candidateStatus: candidateStatusSchema,
  startMs: z.number().int().nonnegative(),
  endMs: z.number().int().positive(),
  title: z.string().max(120),
  reason: z.string().max(500),
  scoreRaw: z.number().min(0).max(1),
  sortOrder: z.number().int().nonnegative(),
  modelId: z.string(),
  promptVersion: z.string(),
  createdAt: z.number().int(),
  updatedAt: z.number().int(),
});

export const candidateGenerationStatusSchema = z.enum([
  'generating',
  'done',
  'failed',
  'cancelled',
]);

export const generateCandidatesInputSchema = z.object({
  projectId: z.string().uuid(),
});

export const generateCandidatesOutputSchema = z.object({
  ok: z.literal(true),
  candidateCount: z.number().int().nonnegative(),
  generationId: z.string().uuid(),
});

export const cancelGenerationInputSchema = z.object({
  projectId: z.string().uuid(),
});

export const cancelGenerationOutputSchema = z.object({
  cancelled: z.boolean(),
});

export const listCandidatesInputSchema = z.object({
  projectId: z.string().uuid(),
});

export const listCandidatesOutputSchema = z.object({
  candidates: z.array(clipCandidateSchema),
  generationStatus: candidateGenerationStatusSchema.nullable(),
  generationError: z.string().nullable(),
  generatedAt: z.number().int().nullable(),
});

export const updateCandidateStatusInputSchema = z.object({
  candidateId: z.string().uuid(),
  status: z.enum(['approved', 'rejected']),
});

export const updateCandidateStatusOutputSchema = z.object({
  ok: z.literal(true),
});

// Schema for AI raw output validation (used by structuredOutputParser)
export const aiCandidateItemSchema = z
  .object({
    startMs: z.number().int().nonnegative(),
    endMs: z.number().int().positive(),
    title: z.string().max(120),
    reason: z.string().max(500),
    score: z.number().min(0).max(1),
  })
  .refine((c) => c.startMs < c.endMs, { message: 'startMs must be less than endMs' })
  .refine((c) => c.endMs - c.startMs >= 5_000, { message: 'Clip duration must be >= 5000ms' })
  .refine((c) => c.endMs - c.startMs <= 180_000, { message: 'Clip duration must be <= 180000ms' });

export const aiCandidatesOutputSchema = z.object({
  candidates: z.array(aiCandidateItemSchema).min(1).max(20),
});

export type CandidateStatus = z.infer<typeof candidateStatusSchema>;
export type ClipCandidate = z.infer<typeof clipCandidateSchema>;
export type CandidateGenerationStatus = z.infer<typeof candidateGenerationStatusSchema>;
export type AiCandidateItem = z.infer<typeof aiCandidateItemSchema>;
export type AiCandidatesOutput = z.infer<typeof aiCandidatesOutputSchema>;
export type ListCandidatesOutput = z.infer<typeof listCandidatesOutputSchema>;
export type GenerateCandidatesOutput = z.infer<typeof generateCandidatesOutputSchema>;
