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
import type { VideoService } from '@main/services/video/videoService';
import {
  videoGetPlaybackUrlInputSchema,
  videoGetPlaybackUrlOutputSchema,
  videoGetCuesInputSchema,
  videoGetCuesOutputSchema,
} from '@shared/schemas/video';
import {
  transcriptGenerateInputSchema,
  transcriptGenerateOutputSchema,
  transcriptExportInputSchema,
  transcriptExportOutputSchema,
} from '@shared/schemas/transcript';
import {
  selectOutputDirectory,
  selectSubtitleFile,
  selectVideoFile,
  selectBinaryPath,
  showTranscriptExportDialog,
} from '@main/services/files/dialogService';
import { transcriptService } from '@main/services/transcript/transcriptService';
import { checkFfmpegAvailability, inspectMediaFile } from '@main/services/ffmpeg/ffmpegService';
import { AppError } from '@main/utils/errors';
import { JobService } from '@main/services/jobs/jobService';
import { SubtitleService } from '@main/services/subtitle/subtitleService';
import { SynchronizationService } from '@main/services/synchronization/SynchronizationService';
import type { AiService } from '@main/services/ai/aiService';
import type { AiConfigurationService } from '@main/services/ai/aiConfigurationService';
import { ClipCandidateService } from '@main/services/ai/clipCandidateService';
import { ClipCueService } from '@main/services/ai/clipCueService';
import {
  aiConfigurationStatusResponseSchema,
  aiSetApiKeyInputSchema,
  aiSetApiKeyOutputSchema,
  aiTestConnectionOutputSchema,
  aiCancelTestOutputSchema,
  aiClearConfigurationOutputSchema,
  aiRecordConsentOutputSchema,
  AI_ERROR_MESSAGES,
} from '@shared/schemas/ai';
import {
  generateCandidatesInputSchema,
  generateCandidatesOutputSchema,
  cancelGenerationInputSchema,
  cancelGenerationOutputSchema,
  listCandidatesInputSchema,
  listCandidatesOutputSchema,
  updateCandidateStatusInputSchema,
  updateCandidateStatusOutputSchema,
  updateCandidateNotesInputSchema,
  updateCandidateNotesOutputSchema,
  updateCandidateTimingInputSchema,
  updateCandidateTimingOutputSchema,
} from '@shared/schemas/candidates';
import {
  generateClipCuesInputSchema,
  generateClipCuesOutputSchema,
  listClipCuesInputSchema,
  listClipCuesOutputSchema,
  updateClipCueInputSchema,
  updateClipCueOutputSchema,
  deleteClipCueInputSchema,
  deleteClipCueOutputSchema,
  addClipCueInputSchema,
  addClipCueOutputSchema,
} from '@shared/schemas/clipCues';
import {
  subtitleSelectInputSchema,
  subtitleParseInputSchema,
  subtitleClearInputSchema,
} from '@shared/schemas/subtitle';
import {
  syncCheckForProjectInputSchema,
  syncCheckForProjectOutputSchema,
} from '@shared/schemas/sync';

type RegisterIpcDeps = {
  databaseService: DatabaseService;
  videoService: VideoService;
  aiService: AiService;
  aiConfigurationService: AiConfigurationService;
};

export const registerIpcHandlers = ({ databaseService, videoService, aiService, aiConfigurationService }: RegisterIpcDeps): void => {
  const jobService = new JobService(databaseService);
  const subtitleService = new SubtitleService(databaseService);
  const synchronizationService = new SynchronizationService(databaseService);
  const clipCandidateService = new ClipCandidateService(databaseService, aiService, aiConfigurationService);
  const clipCueService = new ClipCueService(databaseService);
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

  registerValidatedHandler(
    IPC_CHANNELS.SYNC_CHECK_FOR_PROJECT,
    syncCheckForProjectInputSchema,
    syncCheckForProjectOutputSchema,
    ({ projectId }) => synchronizationService.checkForProject(projectId),
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

  registerValidatedHandler(
    IPC_CHANNELS.VIDEO_GET_PLAYBACK_URL,
    videoGetPlaybackUrlInputSchema,
    videoGetPlaybackUrlOutputSchema,
    ({ projectId }) => videoService.getPlaybackUrl(projectId),
  );

  registerValidatedHandler(
    IPC_CHANNELS.VIDEO_GET_CUES,
    videoGetCuesInputSchema,
    videoGetCuesOutputSchema,
    ({ projectId }) => videoService.getCues(projectId),
  );

  registerValidatedHandler(
    IPC_CHANNELS.TRANSCRIPT_GENERATE_FOR_PROJECT,
    transcriptGenerateInputSchema,
    transcriptGenerateOutputSchema,
    async (input) => {
      const { projectId, gapThresholdMs } = input;
      const project = databaseService.getProject(projectId);
      if (!project) return { entries: [], subtitleStatus: null };
      if (
        project.subtitleStatus !== 'ready' &&
        project.subtitleStatus !== 'ready_with_warnings'
      ) {
        return { entries: [], subtitleStatus: project.subtitleStatus };
      }
      const document = databaseService.getSubtitleDocument(projectId);
      if (!document) return { entries: [], subtitleStatus: null };
      const entries = transcriptService.generateTranscript(document.cues, { gapThresholdMs });
      return { entries, subtitleStatus: project.subtitleStatus };
    },
  );

  registerValidatedHandler(
    IPC_CHANNELS.AI_GET_CONFIGURATION_STATUS,
    z.undefined(),
    aiConfigurationStatusResponseSchema,
    () => aiConfigurationService.getConfigurationStatus(),
  );

  registerValidatedHandler(
    IPC_CHANNELS.AI_SET_API_KEY,
    aiSetApiKeyInputSchema,
    aiSetApiKeyOutputSchema,
    (input) => {
      aiConfigurationService.setApiKey(input);
      return { ok: true as const };
    },
  );

  registerValidatedHandler(
    IPC_CHANNELS.AI_TEST_CONNECTION,
    z.undefined(),
    aiTestConnectionOutputSchema,
    async () => {
      const result = await aiService.testConnection();
      if (!result.success) {
        const code = result.errorCode!;
        throw new AppError(code, AI_ERROR_MESSAGES[code]);
      }
      return { ok: true as const };
    },
  );

  registerValidatedHandler(
    IPC_CHANNELS.AI_CANCEL_TEST,
    z.undefined(),
    aiCancelTestOutputSchema,
    () => {
      aiService.cancelTestConnection();
      return { cancelled: true as const };
    },
  );

  registerValidatedHandler(
    IPC_CHANNELS.AI_CLEAR_CONFIGURATION,
    z.undefined(),
    aiClearConfigurationOutputSchema,
    () => {
      aiConfigurationService.clearConfiguration();
      return { cleared: true as const };
    },
  );

  registerValidatedHandler(
    IPC_CHANNELS.AI_RECORD_CONSENT,
    z.undefined(),
    aiRecordConsentOutputSchema,
    () => {
      aiConfigurationService.recordConsent();
      return { ok: true as const };
    },
  );

  registerValidatedHandler(
    IPC_CHANNELS.AI_GENERATE_CANDIDATES,
    generateCandidatesInputSchema,
    generateCandidatesOutputSchema,
    ({ projectId }) => clipCandidateService.generateCandidates(projectId),
  );

  registerValidatedHandler(
    IPC_CHANNELS.AI_CANCEL_GENERATION,
    cancelGenerationInputSchema,
    cancelGenerationOutputSchema,
    ({ projectId }) => clipCandidateService.cancelGeneration(projectId),
  );

  registerValidatedHandler(
    IPC_CHANNELS.AI_LIST_CANDIDATES,
    listCandidatesInputSchema,
    listCandidatesOutputSchema,
    ({ projectId }) => clipCandidateService.listCandidates(projectId),
  );

  registerValidatedHandler(
    IPC_CHANNELS.AI_UPDATE_CANDIDATE_STATUS,
    updateCandidateStatusInputSchema,
    updateCandidateStatusOutputSchema,
    ({ candidateId, status }) => clipCandidateService.updateCandidateStatus(candidateId, status),
  );

  registerValidatedHandler(
    IPC_CHANNELS.AI_UPDATE_CANDIDATE_NOTES,
    updateCandidateNotesInputSchema,
    updateCandidateNotesOutputSchema,
    ({ candidateId, notes }) => clipCandidateService.updateCandidateNotes(candidateId, notes),
  );

  registerValidatedHandler(
    IPC_CHANNELS.AI_UPDATE_CANDIDATE_TIMING,
    updateCandidateTimingInputSchema,
    updateCandidateTimingOutputSchema,
    ({ candidateId, startMs, endMs }) =>
      clipCandidateService.updateCandidateTiming(candidateId, startMs, endMs),
  );

  registerValidatedHandler(
    IPC_CHANNELS.AI_GENERATE_CLIP_CUES,
    generateClipCuesInputSchema,
    generateClipCuesOutputSchema,
    ({ candidateId }) => clipCueService.generateClipCues(candidateId),
  );

  registerValidatedHandler(
    IPC_CHANNELS.AI_LIST_CLIP_CUES,
    listClipCuesInputSchema,
    listClipCuesOutputSchema,
    ({ candidateId }) => clipCueService.listClipCues(candidateId),
  );

  registerValidatedHandler(
    IPC_CHANNELS.AI_UPDATE_CLIP_CUE,
    updateClipCueInputSchema,
    updateClipCueOutputSchema,
    ({ cueId, startMs, endMs, text }) => clipCueService.updateClipCue(cueId, startMs, endMs, text),
  );

  registerValidatedHandler(
    IPC_CHANNELS.AI_DELETE_CLIP_CUE,
    deleteClipCueInputSchema,
    deleteClipCueOutputSchema,
    ({ cueId }) => clipCueService.deleteClipCue(cueId),
  );

  registerValidatedHandler(
    IPC_CHANNELS.AI_ADD_CLIP_CUE,
    addClipCueInputSchema,
    addClipCueOutputSchema,
    ({ candidateId, startMs, endMs, text }) =>
      clipCueService.addClipCue(candidateId, startMs, endMs, text),
  );

  registerValidatedHandler(
    IPC_CHANNELS.TRANSCRIPT_EXPORT_FOR_PROJECT,
    transcriptExportInputSchema,
    transcriptExportOutputSchema,
    async (input) => {
      const { projectId, gapThresholdMs, format } = input;
      const project = databaseService.getProject(projectId);
      if (!project) return { exported: false, path: null };
      if (
        project.subtitleStatus !== 'ready' &&
        project.subtitleStatus !== 'ready_with_warnings'
      ) {
        return { exported: false, path: null };
      }
      const document = databaseService.getSubtitleDocument(projectId);
      if (!document) return { exported: false, path: null };
      const entries = transcriptService.generateTranscript(document.cues, { gapThresholdMs });
      const dialogResult = await showTranscriptExportDialog(format);
      if (dialogResult.canceled || !dialogResult.filePath) return { exported: false, path: null };
      try {
        transcriptService.writeExport(entries, format, dialogResult.filePath);
        return { exported: true, path: dialogResult.filePath };
      } catch {
        return { exported: false, path: null };
      }
    },
  );
};
