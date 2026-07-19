import { z } from 'zod';

export const queueStatusSchema = z.enum(['queued', 'running', 'completed', 'failed', 'cancelled']);

export const renderJobSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  status: queueStatusSchema,
  progress: z.number().min(0).max(100),
  outputPath: z.string().nullable(),
  errorMessage: z.string().nullable(),
  createdAt: z.number().int(),
  updatedAt: z.number().int(),
});

export const createDemoJobInputSchema = z.object({
  projectId: z.string().uuid(),
});
