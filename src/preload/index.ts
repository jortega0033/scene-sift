import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS } from '@shared/ipc/channels';
import type { SceneSiftApi } from './api';
import type { AiSetApiKeyInput } from '@shared/schemas/ai';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const sceneSiftApi: SceneSiftApi = {
  app: {
    getVersion: () => ipcRenderer.invoke(IPC_CHANNELS.APP_GET_VERSION),
    getPlatform: () => ipcRenderer.invoke(IPC_CHANNELS.APP_GET_PLATFORM),
  },
  dialog: {
    selectVideoFile: () => ipcRenderer.invoke(IPC_CHANNELS.DIALOG_SELECT_VIDEO_FILE),
    selectSubtitleFile: () => ipcRenderer.invoke(IPC_CHANNELS.DIALOG_SELECT_SUBTITLE_FILE),
    selectOutputDirectory: () => ipcRenderer.invoke(IPC_CHANNELS.DIALOG_SELECT_OUTPUT_DIRECTORY),
  },
  system: {
    getCapabilities: () => ipcRenderer.invoke(IPC_CHANNELS.SYSTEM_GET_CAPABILITIES),
  },
  ffmpeg: {
    checkAvailability: () => ipcRenderer.invoke(IPC_CHANNELS.FFMPEG_CHECK_AVAILABILITY),
  },
  database: {
    getHealth: () => ipcRenderer.invoke(IPC_CHANNELS.DATABASE_GET_HEALTH),
  },
  projects: {
    create: (input) => ipcRenderer.invoke(IPC_CHANNELS.PROJECT_CREATE, input),
    list: () => ipcRenderer.invoke(IPC_CHANNELS.PROJECT_LIST),
    get: (projectId) => ipcRenderer.invoke(IPC_CHANNELS.PROJECT_GET, { projectId }),
    delete: (projectId) => ipcRenderer.invoke(IPC_CHANNELS.PROJECT_DELETE, { projectId }),
    inspect: (projectId) => ipcRenderer.invoke(IPC_CHANNELS.PROJECT_INSPECT, { projectId }),
  },
  queue: {
    list: () => ipcRenderer.invoke(IPC_CHANNELS.QUEUE_LIST),
    createDemoJob: (projectId) =>
      ipcRenderer.invoke(IPC_CHANNELS.QUEUE_CREATE_DEMO_JOB, { projectId }),
  },
  settings: {
    get: () => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_GET),
    update: (input) => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_UPDATE, input),
    selectFfmpegPath: () => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_SELECT_FFMPEG_PATH),
    selectFfprobePath: () => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_SELECT_FFPROBE_PATH),
  },
  subtitle: {
    selectForProject: (projectId: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.SUBTITLE_SELECT_FOR_PROJECT, { projectId }),
    parseForProject: (projectId: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.SUBTITLE_PARSE_FOR_PROJECT, { projectId }),
    clearForProject: (projectId: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.SUBTITLE_CLEAR_FOR_PROJECT, { projectId }),
  },
  sync: {
    checkForProject: (projectId: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.SYNC_CHECK_FOR_PROJECT, { projectId }),
  },
  video: {
    getPlaybackUrl: (projectId: string) => {
      if (typeof projectId !== 'string' || !projectId)
        throw new TypeError('projectId must be a non-empty string');
      return ipcRenderer.invoke(IPC_CHANNELS.VIDEO_GET_PLAYBACK_URL, { projectId });
    },
    getCues: (projectId: string) => {
      if (typeof projectId !== 'string' || !projectId)
        throw new TypeError('projectId must be a non-empty string');
      return ipcRenderer.invoke(IPC_CHANNELS.VIDEO_GET_CUES, { projectId });
    },
  },
  transcript: {
    generateForProject: (input: { projectId: string; gapThresholdMs?: number }) => {
      if (typeof input?.projectId !== 'string' || !input.projectId)
        return Promise.reject(new Error('Invalid projectId'));
      if (!UUID_RE.test(input.projectId))
        return Promise.reject(new Error('Invalid projectId: must be a UUID'));
      return ipcRenderer.invoke(IPC_CHANNELS.TRANSCRIPT_GENERATE_FOR_PROJECT, {
        projectId: input.projectId.trim(),
        gapThresholdMs: input.gapThresholdMs ?? 500,
      });
    },
    exportForProject: (input: {
      projectId: string;
      gapThresholdMs?: number;
      format: 'txt' | 'json';
    }) => {
      if (typeof input?.projectId !== 'string' || !input.projectId)
        return Promise.reject(new Error('Invalid projectId'));
      if (!UUID_RE.test(input.projectId))
        return Promise.reject(new Error('Invalid projectId: must be a UUID'));
      if (input.format !== 'txt' && input.format !== 'json')
        return Promise.reject(new Error('Invalid format'));
      return ipcRenderer.invoke(IPC_CHANNELS.TRANSCRIPT_EXPORT_FOR_PROJECT, {
        projectId: input.projectId.trim(),
        gapThresholdMs: input.gapThresholdMs ?? 500,
        format: input.format,
      });
    },
  },
  ai: {
    getConfigurationStatus: () =>
      ipcRenderer.invoke(IPC_CHANNELS.AI_GET_CONFIGURATION_STATUS),
    setApiKey: (input: AiSetApiKeyInput) => {
      if (typeof input?.apiKey !== 'string' || input.apiKey.length < 1 || input.apiKey.length > 512)
        return Promise.reject(new TypeError('apiKey must be a non-empty string (max 512 chars)'));
      if (input.baseUrl !== undefined && (typeof input.baseUrl !== 'string' || input.baseUrl.length > 2048))
        return Promise.reject(new TypeError('baseUrl must be a string (max 2048 chars)'));
      if (input.model !== undefined && (typeof input.model !== 'string' || input.model.length < 1 || input.model.length > 128))
        return Promise.reject(new TypeError('model must be a non-empty string (max 128 chars)'));
      return ipcRenderer.invoke(IPC_CHANNELS.AI_SET_API_KEY, {
        apiKey: input.apiKey,
        ...(input.baseUrl !== undefined ? { baseUrl: input.baseUrl } : {}),
        ...(input.model !== undefined ? { model: input.model } : {}),
      });
    },
    testConnection: () =>
      ipcRenderer.invoke(IPC_CHANNELS.AI_TEST_CONNECTION),
    cancelTest: () =>
      ipcRenderer.invoke(IPC_CHANNELS.AI_CANCEL_TEST),
    clearConfiguration: () =>
      ipcRenderer.invoke(IPC_CHANNELS.AI_CLEAR_CONFIGURATION),
    recordConsent: () =>
      ipcRenderer.invoke(IPC_CHANNELS.AI_RECORD_CONSENT),
    generateCandidates: (projectId: string) => {
      if (!UUID_RE.test(projectId))
        return Promise.reject(new TypeError('projectId must be a UUID'));
      return ipcRenderer.invoke(IPC_CHANNELS.AI_GENERATE_CANDIDATES, { projectId });
    },
    cancelGeneration: (projectId: string) => {
      if (!UUID_RE.test(projectId))
        return Promise.reject(new TypeError('projectId must be a UUID'));
      return ipcRenderer.invoke(IPC_CHANNELS.AI_CANCEL_GENERATION, { projectId });
    },
    listCandidates: (projectId: string) => {
      if (!UUID_RE.test(projectId))
        return Promise.reject(new TypeError('projectId must be a UUID'));
      return ipcRenderer.invoke(IPC_CHANNELS.AI_LIST_CANDIDATES, { projectId });
    },
    updateCandidateStatus: (candidateId: string, status: 'approved' | 'rejected' | 'skipped') => {
      if (!UUID_RE.test(candidateId))
        return Promise.reject(new TypeError('candidateId must be a UUID'));
      if (status !== 'approved' && status !== 'rejected' && status !== 'skipped')
        return Promise.reject(new TypeError('status must be approved, rejected, or skipped'));
      return ipcRenderer.invoke(IPC_CHANNELS.AI_UPDATE_CANDIDATE_STATUS, { candidateId, status });
    },
    updateCandidateNotes: (candidateId: string, notes: string | null) => {
      if (!UUID_RE.test(candidateId))
        return Promise.reject(new TypeError('candidateId must be a UUID'));
      if (notes !== null && (typeof notes !== 'string' || notes.length > 1000))
        return Promise.reject(new TypeError('notes must be a string (max 1000 chars) or null'));
      return ipcRenderer.invoke(IPC_CHANNELS.AI_UPDATE_CANDIDATE_NOTES, { candidateId, notes });
    },
  },
};

contextBridge.exposeInMainWorld('sceneSift', sceneSiftApi);
