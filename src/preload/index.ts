import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS } from '@shared/ipc/channels';
import type { SceneSiftApi } from './api';

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
};

contextBridge.exposeInMainWorld('sceneSift', sceneSiftApi);
