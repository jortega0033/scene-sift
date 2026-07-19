import { app } from 'electron';
import { stat } from 'node:fs/promises';
import { basename, resolve as resolvePath } from 'node:path';
import { z } from 'zod';
import { IPC_CHANNELS } from '@shared/ipc/channels';
import { databaseHealthSchema, systemCapabilitiesSchema } from '@shared/ipc/contracts';
import {
  appSettingsSchema,
  appStatusSchema,
  updateSettingsInputSchema,
} from '@shared/schemas/settings';
import type { AppSettings } from '@shared/schemas/settings';
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
import { createDemoJobInputSchema, renderJobSchema } from '@shared/schemas/queue';
import { ffmpegCapabilitiesSchema } from '@shared/schemas/ffmpeg';
import { registerValidatedHandler } from '@main/ipc/createIpcHandler';
import type { DatabaseService } from '@main/services/database/databaseService';
import {
  selectOutputDirectory,
  selectSubtitleFile,
  selectVideoFile,
  selectBinaryPath,
} from '@main/services/files/dialogService';
import { checkFfmpegAvailability, inspectMediaFile } from '@main/services/ffmpeg/ffmpegService';
import { AppError } from '@main/utils/errors';
import { JobService } from '@main/services/jobs/jobService';
import { SubtitleService } from '@main/services/subtitle/subtitleService';
import {
  subtitleSelectInputSchema,
  subtitleParseInputSchema,
  subtitleClearInputSchema,
} from '@shared/schemas/subtitle';

type RegisterIpcDeps = {
  databaseService: DatabaseService;
};

export const registerIpcHandlers = ({ databaseService }: RegisterIpcDeps): void => {
  const jobService = new JobService(databaseService);
  const subtitleService = new SubtitleService(databaseService);
  const sanitizeSettingsUpdate = (payload: {
    ffmpegPathOverride?: string | null | undefined;
    ffprobePathOverride?: string | null | undefined;
    defaultOutputDirectory?: string | null | undefined;
    preferredTheme?: AppSettings['preferredTheme'] | undefined;
    developmentDiagnosticsEnabled?: boolean | undefined;
  }): Partial<AppSettings> => {
    const next: Partial<AppSettings> = {};
    if (payload.defaultOutputDirectory !== undefined) {
      next.defaultOutputDirectory = payload.defaultOutputDirectory;
    }
    if (payload.preferredTheme !== undefined) {
      next.preferredTheme = payload.preferredTheme;
    }
    if (payload.developmentDiagnosticsEnabled !== undefined) {
      next.developmentDiagnosticsEnabled = payload.developmentDiagnosticsEnabled;
    }
    return next;
  };
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
    IPC_CHANNELS.DIALOG_SELECT_VIDEO_FILE,
    z.undefined(),
    selectedVideoSchema.nullable(),
    () => selectVideoFile(),
  );

  registerValidatedHandler(
    IPC_CHANNELS.DIALOG_SELECT_SUBTITLE_FILE,
    z.undefined(),
    selectedSubtitleSchema.nullable(),
    () => selectSubtitleFile(),
  );

  registerValidatedHandler(
    IPC_CHANNELS.DIALOG_SELECT_OUTPUT_DIRECTORY,
    z.undefined(),
    selectedDirectorySchema.nullable(),
    () => selectOutputDirectory(),
  );

  registerValidatedHandler(
    IPC_CHANNELS.FFMPEG_CHECK_AVAILABILITY,
    z.undefined(),
    ffmpegCapabilitiesSchema,
    async () => checkFfmpegAvailability(databaseService.getSettings()),
  );

  registerValidatedHandler(
    IPC_CHANNELS.DATABASE_GET_HEALTH,
    z.undefined(),
    databaseHealthSchema,
    () => databaseService.getHealth(),
  );

  registerValidatedHandler(
    IPC_CHANNELS.SYSTEM_GET_CAPABILITIES,
    z.undefined(),
    systemCapabilitiesSchema,
    async () => ({
      app: appStatusSchema.parse({
        version: app.getVersion(),
        platform: process.platform,
        diagnosticsEnabled: databaseService.getSettings().developmentDiagnosticsEnabled,
      }),
      ffmpeg: await checkFfmpegAvailability(databaseService.getSettings()),
      database: databaseService.getHealth(),
    }),
  );

  registerValidatedHandler(
    IPC_CHANNELS.PROJECT_CREATE,
    createProjectInputSchema,
    projectSchema,
    async (payload) => {
      const resolved = resolvePath(payload.video.path);
      try {
        const fileStat = await stat(resolved);
        if (!fileStat.isFile()) {
          throw new AppError('VIDEO_FILE_NOT_FOUND', 'Video path is not a file.');
        }
      } catch (err) {
        if (err instanceof AppError) throw err;
        throw new AppError('VIDEO_FILE_NOT_FOUND', 'Video path does not exist.');
      }
      return databaseService.createProject(payload);
    },
  );

  registerValidatedHandler(
    IPC_CHANNELS.PROJECT_INSPECT,
    inspectProjectInputSchema,
    mediaInspectionResultSchema,
    async ({ projectId }) => {
      const project = databaseService.getProject(projectId);
      if (!project) {
        throw new AppError('PROJECT_NOT_FOUND', 'Project not found.');
      }

      const caps = await checkFfmpegAvailability(databaseService.getSettings());
      if (!caps.ffprobeAvailable || !caps.ffprobePath) {
        throw new AppError('FFPROBE_NOT_AVAILABLE', 'FFprobe not available.');
      }

      const outcome = await inspectMediaFile(project.videoPath, caps.ffprobePath);
      const updated = databaseService.updateProjectInspection(projectId, outcome);

      return {
        projectId: updated.id,
        status: updated.status,
        mediaMetadata: updated.mediaMetadata,
        inspectionError: updated.inspectionError,
      };
    },
  );

  registerValidatedHandler(IPC_CHANNELS.PROJECT_LIST, z.undefined(), z.array(projectSchema), () =>
    databaseService.listProjects(),
  );

  registerValidatedHandler(
    IPC_CHANNELS.PROJECT_GET,
    getProjectInputSchema,
    projectSchema.nullable(),
    ({ projectId }) => databaseService.getProject(projectId),
  );

  registerValidatedHandler(
    IPC_CHANNELS.PROJECT_DELETE,
    deleteProjectInputSchema,
    z.object({ deleted: z.boolean() }),
    ({ projectId }) => ({ deleted: databaseService.deleteProject(projectId) }),
  );

  registerValidatedHandler(IPC_CHANNELS.SETTINGS_GET, z.undefined(), appSettingsSchema, () =>
    databaseService.getSettings(),
  );

  registerValidatedHandler(
    IPC_CHANNELS.SETTINGS_UPDATE,
    updateSettingsInputSchema,
    appSettingsSchema,
    (payload) => databaseService.updateSettings(sanitizeSettingsUpdate(payload)),
  );

  registerValidatedHandler(
    IPC_CHANNELS.SETTINGS_SELECT_FFMPEG_PATH,
    z.undefined(),
    z.string().nullable(),
    async () => {
      const path = await selectBinaryPath('Select FFmpeg binary');
      if (!path) {
        return null;
      }
      if (
        basename(path).toLowerCase() !== (process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg')
      ) {
        return null;
      }
      databaseService.updateSettings({ ffmpegPathOverride: path });
      return path;
    },
  );

  registerValidatedHandler(
    IPC_CHANNELS.SETTINGS_SELECT_FFPROBE_PATH,
    z.undefined(),
    z.string().nullable(),
    async () => {
      const path = await selectBinaryPath('Select FFprobe binary');
      if (!path) {
        return null;
      }
      if (
        basename(path).toLowerCase() !== (process.platform === 'win32' ? 'ffprobe.exe' : 'ffprobe')
      ) {
        return null;
      }
      databaseService.updateSettings({ ffprobePathOverride: path });
      return path;
    },
  );

  registerValidatedHandler(
    IPC_CHANNELS.SUBTITLE_SELECT_FOR_PROJECT,
    subtitleSelectInputSchema,
    projectSchema.nullable(),
    ({ projectId }) => subtitleService.selectSubtitleForProject(projectId),
  );

  registerValidatedHandler(
    IPC_CHANNELS.SUBTITLE_PARSE_FOR_PROJECT,
    subtitleParseInputSchema,
    projectSchema,
    ({ projectId }) => subtitleService.parseSubtitleForProject(projectId),
  );

  registerValidatedHandler(
    IPC_CHANNELS.SUBTITLE_CLEAR_FOR_PROJECT,
    subtitleClearInputSchema,
    projectSchema,
    ({ projectId }) => subtitleService.clearSubtitleForProject(projectId),
  );

  registerValidatedHandler(IPC_CHANNELS.QUEUE_LIST, z.undefined(), z.array(renderJobSchema), () =>
    jobService.listJobs(),
  );

  registerValidatedHandler(
    IPC_CHANNELS.QUEUE_CREATE_DEMO_JOB,
    createDemoJobInputSchema,
    renderJobSchema,
    ({ projectId }) => jobService.createDemoJob(projectId),
  );
};
