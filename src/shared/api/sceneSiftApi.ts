import type { AppSettings } from '@shared/schemas/settings';
import type { FfmpegCapabilities } from '@shared/schemas/ffmpeg';
import type { ProjectRecord, CreateProjectInput, MediaInspectionResult } from '@shared/schemas/project';
import type { SelectedDirectory } from '@shared/types/common';
import type { SafeError } from '@shared/types/common';
import type { QueueStatus } from '@shared/types/common';
import type { SyncCheckResult } from '@shared/schemas/sync';
import type { VideoCueItem } from '@shared/schemas/video';
import type {
  TranscriptGenerateOutput,
  TranscriptExportOutput,
} from '@shared/schemas/transcript';
import type {
  AiConfigurationStatusResponse,
  AiSetApiKeyInput,
} from '@shared/schemas/ai';
import type {
  GenerateCandidatesOutput,
  ListCandidatesOutput,
} from '@shared/schemas/candidates';

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
  subtitle: {
    selectForProject: (projectId: string) => Promise<ProjectRecord | null>;
    parseForProject: (projectId: string) => Promise<ProjectRecord>;
    clearForProject: (projectId: string) => Promise<ProjectRecord>;
  };
  sync: {
    checkForProject: (projectId: string) => Promise<SyncCheckResult>;
  };
  video: {
    getPlaybackUrl: (projectId: string) => Promise<{ url: string }>;
    getCues: (projectId: string) => Promise<{ cues: VideoCueItem[] }>;
  };
  transcript: {
    generateForProject: (input: {
      projectId: string;
      gapThresholdMs?: number;
    }) => Promise<TranscriptGenerateOutput>;
    exportForProject: (input: {
      projectId: string;
      gapThresholdMs?: number;
      format: 'txt' | 'json';
    }) => Promise<TranscriptExportOutput>;
  };
  ai: {
    getConfigurationStatus: () => Promise<AiConfigurationStatusResponse>;
    setApiKey: (input: AiSetApiKeyInput) => Promise<{ ok: true }>;
    testConnection: () => Promise<{ ok: true }>;
    cancelTest: () => Promise<{ cancelled: true }>;
    clearConfiguration: () => Promise<{ cleared: true }>;
    recordConsent: () => Promise<{ ok: true }>;
    generateCandidates: (projectId: string) => Promise<GenerateCandidatesOutput>;
    cancelGeneration: (projectId: string) => Promise<{ cancelled: boolean }>;
    listCandidates: (projectId: string) => Promise<ListCandidatesOutput>;
    updateCandidateStatus: (
      candidateId: string,
      status: 'approved' | 'rejected',
    ) => Promise<{ ok: true }>;
  };
};

export type { SyncCheckResult };

export type SerializedIpcError = SafeError;
