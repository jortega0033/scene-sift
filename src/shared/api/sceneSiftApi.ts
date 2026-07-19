import type { AppSettings } from '@shared/schemas/settings';
import type { FfmpegCapabilities } from '@shared/schemas/ffmpeg';
import type { ProjectRecord, CreateProjectInput, MediaInspectionResult } from '@shared/schemas/project';
import type { SelectedDirectory } from '@shared/types/common';
import type { SafeError } from '@shared/types/common';
import type { QueueStatus } from '@shared/types/common';

export type DatabaseHealth = {
  ok: boolean;
  dbPath: string;
  migrationsApplied: boolean;
};

export type RenderJob = {
  id: string;
  projectId: string;
  status: QueueStatus;
  progress: number;
  outputPath: string | null;
  errorMessage: string | null;
  createdAt: number;
  updatedAt: number;
};

export type SystemCapabilities = {
  app: {
    version: string;
    platform: string;
    diagnosticsEnabled: boolean;
  };
  ffmpeg: FfmpegCapabilities;
  database: DatabaseHealth;
};

export type SceneSiftApi = {
  app: {
    getVersion: () => Promise<string>;
    getPlatform: () => Promise<string>;
  };
  dialog: {
    selectVideoFile: () => Promise<CreateProjectInput['video'] | null>;
    selectSubtitleFile: () => Promise<NonNullable<CreateProjectInput['subtitle']> | null>;
    selectOutputDirectory: () => Promise<SelectedDirectory | null>;
  };
  system: {
    getCapabilities: () => Promise<SystemCapabilities>;
  };
  ffmpeg: {
    checkAvailability: () => Promise<FfmpegCapabilities>;
  };
  database: {
    getHealth: () => Promise<DatabaseHealth>;
  };
  projects: {
    create: (input: CreateProjectInput) => Promise<ProjectRecord>;
    list: () => Promise<ProjectRecord[]>;
    get: (projectId: string) => Promise<ProjectRecord | null>;
    delete: (projectId: string) => Promise<{ deleted: boolean }>;
    inspect: (projectId: string) => Promise<MediaInspectionResult>;
  };
  queue: {
    list: () => Promise<RenderJob[]>;
    createDemoJob: (projectId: string) => Promise<RenderJob>;
  };
  settings: {
    get: () => Promise<AppSettings>;
    update: (input: Partial<AppSettings>) => Promise<AppSettings>;
    selectFfmpegPath: () => Promise<string | null>;
    selectFfprobePath: () => Promise<string | null>;
  };
};

export type SerializedIpcError = SafeError;
