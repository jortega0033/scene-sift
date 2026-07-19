import { app } from 'electron';
import { z } from 'zod';
import { IPC_CHANNELS } from '@shared/ipc/channels';
import { databaseHealthSchema, systemCapabilitiesSchema } from '@shared/ipc/contracts';
import {
  appSettingsSchema,
  appStatusSchema,
  updateSettingsInputSchema,
} from '@shared/schemas/settings';
import {
  createProjectInputSchema,
  deleteProjectInputSchema,
  getProjectInputSchema,
  projectSchema,
} from '@shared/schemas/project';
import { createDemoJobInputSchema, renderJobSchema } from '@shared/schemas/queue';
import { ffmpegCapabilitiesSchema } from '@shared/schemas/ffmpeg';
import { registerValidatedHandler } from './createIpcHandler';

export const registerSmokeIpcHandlers = (): void => {
  let settings = appSettingsSchema.parse({
    ffmpegPathOverride: null,
    ffprobePathOverride: null,
    defaultOutputDirectory: '/fixtures/exports',
    preferredTheme: 'light',
    developmentDiagnosticsEnabled: false,
  });

  const projects = new Map<string, z.infer<typeof projectSchema>>();
  const queue = new Map<string, z.infer<typeof renderJobSchema>>();

  registerValidatedHandler(IPC_CHANNELS.APP_GET_VERSION, z.undefined(), z.string(), () =>
    app.getVersion(),
  );
  registerValidatedHandler(
    IPC_CHANNELS.APP_GET_PLATFORM,
    z.undefined(),
    z.string(),
    () => process.platform,
  );

  registerValidatedHandler(
    IPC_CHANNELS.SYSTEM_GET_CAPABILITIES,
    z.undefined(),
    systemCapabilitiesSchema,
    () => ({
      app: appStatusSchema.parse({
        version: app.getVersion(),
        platform: process.platform,
        diagnosticsEnabled: false,
      }),
      ffmpeg: ffmpegCapabilitiesSchema.parse({
        ffmpegAvailable: false,
        ffprobeAvailable: false,
      }),
      database: databaseHealthSchema.parse({
        ok: true,
        dbPath: 'smoke-in-memory',
        migrationsApplied: true,
      }),
    }),
  );

  registerValidatedHandler(
    IPC_CHANNELS.FFMPEG_CHECK_AVAILABILITY,
    z.undefined(),
    ffmpegCapabilitiesSchema,
    () => ({ ffmpegAvailable: false, ffprobeAvailable: false }),
  );
  registerValidatedHandler(
    IPC_CHANNELS.DATABASE_GET_HEALTH,
    z.undefined(),
    databaseHealthSchema,
    () => ({
      ok: true,
      dbPath: 'smoke-in-memory',
      migrationsApplied: true,
    }),
  );

  registerValidatedHandler(
    IPC_CHANNELS.DIALOG_SELECT_VIDEO_FILE,
    z.undefined(),
    createProjectInputSchema.shape.video.nullable(),
    () => ({
      path: '/fixtures/sample-episode.mp4',
      name: 'sample-episode.mp4',
      extension: '.mp4',
    }),
  );
  registerValidatedHandler(
    IPC_CHANNELS.DIALOG_SELECT_SUBTITLE_FILE,
    z.undefined(),
    createProjectInputSchema.shape.subtitle.nullable(),
    () => ({
      path: '/fixtures/sample-subtitles.srt',
      name: 'sample-subtitles.srt',
      extension: '.srt',
    }),
  );
  registerValidatedHandler(
    IPC_CHANNELS.DIALOG_SELECT_OUTPUT_DIRECTORY,
    z.undefined(),
    createProjectInputSchema.shape.outputDirectory.nullable(),
    () => ({
      path: '/fixtures/exports',
      name: 'exports',
    }),
  );

  registerValidatedHandler(
    IPC_CHANNELS.PROJECT_CREATE,
    createProjectInputSchema,
    projectSchema,
    (input) => {
      const now = Date.now();
      const created = projectSchema.parse({
        id: crypto.randomUUID(),
        name: input.name,
        videoPath: input.video.path,
        subtitlePath: input.subtitle?.path ?? null,
        outputDirectory: input.outputDirectory?.path ?? null,
        status: 'draft',
        createdAt: now,
        updatedAt: now,
      });
      projects.set(created.id, created);
      return created;
    },
  );
  registerValidatedHandler(IPC_CHANNELS.PROJECT_LIST, z.undefined(), z.array(projectSchema), () => [
    ...projects.values(),
  ]);
  registerValidatedHandler(
    IPC_CHANNELS.PROJECT_GET,
    getProjectInputSchema,
    projectSchema.nullable(),
    ({ projectId }) => projects.get(projectId) ?? null,
  );
  registerValidatedHandler(
    IPC_CHANNELS.PROJECT_DELETE,
    deleteProjectInputSchema,
    z.object({ deleted: z.boolean() }),
    ({ projectId }) => ({ deleted: projects.delete(projectId) }),
  );

  registerValidatedHandler(
    IPC_CHANNELS.SETTINGS_GET,
    z.undefined(),
    appSettingsSchema,
    () => settings,
  );
  registerValidatedHandler(
    IPC_CHANNELS.SETTINGS_UPDATE,
    updateSettingsInputSchema,
    appSettingsSchema,
    (input) => {
      settings = appSettingsSchema.parse({ ...settings, ...input });
      return settings;
    },
  );
  registerValidatedHandler(
    IPC_CHANNELS.SETTINGS_SELECT_FFMPEG_PATH,
    z.undefined(),
    z.string().nullable(),
    () => '/fixtures/bin/ffmpeg',
  );
  registerValidatedHandler(
    IPC_CHANNELS.SETTINGS_SELECT_FFPROBE_PATH,
    z.undefined(),
    z.string().nullable(),
    () => '/fixtures/bin/ffprobe',
  );

  registerValidatedHandler(IPC_CHANNELS.QUEUE_LIST, z.undefined(), z.array(renderJobSchema), () => [
    ...queue.values(),
  ]);
  registerValidatedHandler(
    IPC_CHANNELS.QUEUE_CREATE_DEMO_JOB,
    createDemoJobInputSchema,
    renderJobSchema,
    ({ projectId }) => {
      const now = Date.now();
      const job = renderJobSchema.parse({
        id: crypto.randomUUID(),
        projectId,
        status: 'queued',
        progress: 0,
        outputPath: null,
        errorMessage: null,
        createdAt: now,
        updatedAt: now,
      });
      queue.set(job.id, job);
      return job;
    },
  );
};
