import { z } from 'zod';
import { SUBTITLE_EXTENSIONS, VIDEO_EXTENSIONS } from '@shared/constants/files';
import { subtitleStatusSchema } from '@shared/schemas/subtitle';
import { syncCheckForProjectOutputSchema } from '@shared/schemas/sync';

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

export const projectStatusSchema = z.enum(['draft', 'ready', 'inspection_failed', 'archived']);

export const mediaMetadataSchema = z.object({
  durationSeconds: z.number().nullable(),
  width: z.number().int().nullable(),
  height: z.number().int().nullable(),
  videoCodec: z.string().nullable(),
  fps: z.number().nullable(),
  bitRateBps: z.number().int().nullable(),
  fileSizeBytes: z.number().int().nullable(),
  inspectedAt: z.number().int(),
});

export const projectSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  videoPath: z.string(),
  subtitlePath: z.string().nullable(),
  outputDirectory: z.string().nullable(),
  status: projectStatusSchema,
  createdAt: z.number().int(),
  updatedAt: z.number().int(),
  mediaMetadata: mediaMetadataSchema.nullable(),
  inspectionError: z.string().max(64).nullable(),
  subtitleStatus: subtitleStatusSchema.nullable(),
  subtitleCueCount: z.number().int().nullable(),
  subtitleLastCueEndMs: z.number().int().nullable(),
  subtitleParseError: z.string().max(64).nullable(),
  subtitleParsedAt: z.number().int().nullable(),
  syncStatus: syncCheckForProjectOutputSchema.shape.syncStatus.nullable(),
  syncCheckedAt: z.number().int().nullable(),
  syncWarningsJson: z.string().nullable(),
  syncAnalysisVersion: z.number().int().nullable(),
});

export const deleteProjectInputSchema = z.object({
  projectId: z.string().uuid(),
});

export const getProjectInputSchema = z.object({
  projectId: z.string().uuid(),
});

export const inspectProjectInputSchema = z.object({
  projectId: z.string().uuid(),
});

export const mediaInspectionResultSchema = z.object({
  projectId: z.string().uuid(),
  status: projectStatusSchema,
  mediaMetadata: mediaMetadataSchema.nullable(),
  inspectionError: z.string().max(64).nullable(),
});

export type CreateProjectInput = z.infer<typeof createProjectInputSchema>;
export type ProjectRecord = z.infer<typeof projectSchema>;
export type MediaMetadata = z.infer<typeof mediaMetadataSchema>;
export type MediaInspectionResult = z.infer<typeof mediaInspectionResultSchema>;
