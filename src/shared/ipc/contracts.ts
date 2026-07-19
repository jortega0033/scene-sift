import { z } from 'zod';
import { appSettingsSchema, appStatusSchema } from '@shared/schemas/settings';
import {
  createProjectInputSchema,
  deleteProjectInputSchema,
  getProjectInputSchema,
  inspectProjectInputSchema,
  mediaInspectionResultSchema,
  projectSchema,
  selectedDirectorySchema,
  selectedSubtitleSchema,
  selectedVideoSchema,
} from '@shared/schemas/project';
import { ffmpegCapabilitiesSchema } from '@shared/schemas/ffmpeg';
import { createDemoJobInputSchema, renderJobSchema } from '@shared/schemas/queue';

export const databaseHealthSchema = z.object({
  ok: z.boolean(),
  dbPath: z.string(),
  migrationsApplied: z.boolean(),
});

export const systemCapabilitiesSchema = z.object({
  app: appStatusSchema,
  ffmpeg: ffmpegCapabilitiesSchema,
  database: databaseHealthSchema,
});

export const ipcContracts = {
  app: {
    getVersion: {
      input: z.void(),
      output: z.string(),
    },
    getPlatform: {
      input: z.void(),
      output: z.string(),
    },
  },
  dialog: {
    selectVideoFile: {
      input: z.void(),
      output: selectedVideoSchema.nullable(),
    },
    selectSubtitleFile: {
      input: z.void(),
      output: selectedSubtitleSchema.nullable(),
    },
    selectOutputDirectory: {
      input: z.void(),
      output: selectedDirectorySchema.nullable(),
    },
  },
  system: {
    getCapabilities: {
      input: z.void(),
      output: systemCapabilitiesSchema,
    },
  },
  ffmpeg: {
    checkAvailability: {
      input: z.void(),
      output: ffmpegCapabilitiesSchema,
    },
  },
  database: {
    getHealth: {
      input: z.void(),
      output: databaseHealthSchema,
    },
  },
  project: {
    create: {
      input: createProjectInputSchema,
      output: projectSchema,
    },
    list: {
      input: z.void(),
      output: z.array(projectSchema),
    },
    get: {
      input: getProjectInputSchema,
      output: projectSchema.nullable(),
    },
    delete: {
      input: deleteProjectInputSchema,
      output: z.object({ deleted: z.boolean() }),
    },
    inspect: {
      input: inspectProjectInputSchema,
      output: mediaInspectionResultSchema,
    },
  },
  settings: {
    get: {
      input: z.void(),
      output: appSettingsSchema,
    },
    update: {
      input: appSettingsSchema.partial(),
      output: appSettingsSchema,
    },
    selectFfmpegPath: {
      input: z.void(),
      output: z.string().nullable(),
    },
    selectFfprobePath: {
      input: z.void(),
      output: z.string().nullable(),
    },
  },
  queue: {
    list: {
      input: z.void(),
      output: z.array(renderJobSchema),
    },
    createDemoJob: {
      input: createDemoJobInputSchema,
      output: renderJobSchema,
    },
  },
};
