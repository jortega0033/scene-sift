import { z } from 'zod';
import { SUBTITLE_EXTENSIONS, VIDEO_EXTENSIONS } from '@shared/constants/files';

const allowedVideoExtension = z.enum(VIDEO_EXTENSIONS);
const allowedSubtitleExtension = z.enum(SUBTITLE_EXTENSIONS);

export const selectedFileSchema = z.object({
  path: z.string().min(1),
  name: z.string().min(1).max(255),
  extension: z.string().min(1),
});

export const selectedDirectorySchema = z.object({
  path: z.string().min(1),
  name: z.string().min(1).max(255),
});

export const selectedVideoSchema = selectedFileSchema.extend({
  extension: allowedVideoExtension,
});

export const selectedSubtitleSchema = selectedFileSchema.extend({
  extension: allowedSubtitleExtension,
});

export const createProjectInputSchema = z.object({
  name: z.string().trim().min(1).max(120),
  video: selectedVideoSchema,
  subtitle: selectedSubtitleSchema.optional(),
  outputDirectory: selectedDirectorySchema.optional(),
});

export const projectStatusSchema = z.enum(['draft', 'active', 'archived']);

export const projectSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  videoPath: z.string(),
  subtitlePath: z.string().nullable(),
  outputDirectory: z.string().nullable(),
  status: projectStatusSchema,
  createdAt: z.number().int(),
  updatedAt: z.number().int(),
});

export const deleteProjectInputSchema = z.object({
  projectId: z.string().uuid(),
});

export const getProjectInputSchema = z.object({
  projectId: z.string().uuid(),
});

export type CreateProjectInput = z.infer<typeof createProjectInputSchema>;
export type ProjectRecord = z.infer<typeof projectSchema>;
