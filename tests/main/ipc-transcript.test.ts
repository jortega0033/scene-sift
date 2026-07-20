// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

const handlers = new Map<string, (event: unknown, payload: unknown) => Promise<unknown>>();

vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn((channel: string, fn: (event: unknown, payload: unknown) => Promise<unknown>) => {
      handlers.set(channel, fn);
    }),
  },
  app: { getVersion: vi.fn(() => '0.1.0') },
}));

vi.mock('@main/services/files/dialogService', () => ({
  selectVideoFile: vi.fn(),
  selectSubtitleFile: vi.fn(),
  selectOutputDirectory: vi.fn(),
  selectBinaryPath: vi.fn(),
  showTranscriptExportDialog: vi.fn(),
}));

vi.mock('@main/services/ffmpeg/ffmpegService', () => ({
  checkFfmpegAvailability: vi.fn(() => ({ ffmpegAvailable: true, ffprobeAvailable: true })),
  inspectMediaFile: vi.fn(),
}));

import { registerIpcHandlers } from '@main/ipc/registerIpcHandlers';
import { showTranscriptExportDialog } from '@main/services/files/dialogService';
import { IPC_CHANNELS } from '@shared/ipc/channels';

const PROJECT_ID = '11111111-1111-4111-8111-111111111111';

function makeCue(index: number, startMs: number, endMs: number, text: string) {
  return { index, startMs, endMs, text };
}

function makeProject(overrides: Record<string, unknown> = {}) {
  return {
    id: PROJECT_ID,
    name: 'Test',
    videoPath: '/v.mp4',
    subtitlePath: '/s.srt',
    outputDirectory: null,
    status: 'ready' as const,
    createdAt: 0,
    updatedAt: 0,
    mediaMetadata: null,
    inspectionError: null,
    subtitleStatus: 'ready' as string | null,
    subtitleCueCount: 2,
    subtitleLastCueEndMs: 5000,
    subtitleParseError: null,
    subtitleParsedAt: 0,
    syncStatus: null,
    syncCheckedAt: null,
    syncWarningsJson: null,
    syncAnalysisVersion: null,
    ...overrides,
  };
}

function makeDoc(cues = [makeCue(0, 0, 2000, 'Hello'), makeCue(1, 2500, 4500, 'world')]) {
  return {
    schemaVersion: 1 as const,
    sourceFormat: 'srt' as const,
    sourceEncoding: 'utf-8',
    cues,
    warnings: [],
    summary: {
      cueCount: cues.length,
      firstCueStartMs: cues[0]?.startMs ?? 0,
      lastCueEndMs: cues[cues.length - 1]?.endMs ?? 0,
      totalTextLength: 0,
      warningCount: 0,
    },
    parsedAt: 0,
  };
}

const mockDb = {
  getProject: vi.fn(),
  getSubtitleDocument: vi.fn(),
  createProject: vi.fn(),
  listProjects: vi.fn(() => []),
  deleteProject: vi.fn(() => false),
  updateProjectInspection: vi.fn(),
  getSettings: vi.fn(() => ({
    ffmpegPathOverride: null,
    ffprobePathOverride: null,
    defaultOutputDirectory: null,
    preferredTheme: 'light' as const,
    developmentDiagnosticsEnabled: false,
  })),
  updateSettings: vi.fn(),
  getHealth: vi.fn(() => ({ ok: true, dbPath: ':memory:', migrationsApplied: true })),
  getSubtitlePath: vi.fn(),
  updateSubtitleStatus: vi.fn(),
  getSubtitleDocumentPath: vi.fn(),
  saveSubtitleDocument: vi.fn(),
  clearSubtitleData: vi.fn(),
  updateSyncStatus: vi.fn(),
  createRenderJob: vi.fn(),
  listRenderJobs: vi.fn(() => []),
  updateRenderJob: vi.fn(),
};

const mockVideoService = {
  getPlaybackUrl: vi.fn(),
  getCues: vi.fn(),
};

describe('transcript IPC handlers', () => {
  beforeEach(() => {
    handlers.clear();
    vi.clearAllMocks();
    registerIpcHandlers({
      databaseService: mockDb as never,
      videoService: mockVideoService as never,
    });
  });

  const invoke = async (channel: string, payload: unknown) => {
    const handler = handlers.get(channel);
    if (!handler) throw new Error(`No handler for ${channel}`);
    return handler(null, payload);
  };

  describe('transcript:generateForProject', () => {
    it('returns empty entries when project not found', async () => {
      mockDb.getProject.mockReturnValue(null);
      const result = await invoke(IPC_CHANNELS.TRANSCRIPT_GENERATE_FOR_PROJECT, {
        projectId: PROJECT_ID,
        gapThresholdMs: 500,
      });
      expect(result).toEqual({ entries: [], subtitleStatus: null });
    });

    it('returns empty entries when subtitle not ready', async () => {
      mockDb.getProject.mockReturnValue(makeProject({ subtitleStatus: 'selected' }));
      const result = await invoke(IPC_CHANNELS.TRANSCRIPT_GENERATE_FOR_PROJECT, {
        projectId: PROJECT_ID,
        gapThresholdMs: 500,
      });
      expect((result as { entries: unknown[] }).entries).toHaveLength(0);
    });

    it('returns entries when subtitle ready', async () => {
      mockDb.getProject.mockReturnValue(makeProject({ subtitleStatus: 'ready' }));
      mockDb.getSubtitleDocument.mockReturnValue(makeDoc());
      const result = await invoke(IPC_CHANNELS.TRANSCRIPT_GENERATE_FOR_PROJECT, {
        projectId: PROJECT_ID,
        gapThresholdMs: 500,
      });
      expect((result as { entries: unknown[] }).entries.length).toBeGreaterThan(0);
      expect((result as { subtitleStatus: string }).subtitleStatus).toBe('ready');
    });

    it('returns entries when subtitle ready_with_warnings', async () => {
      mockDb.getProject.mockReturnValue(makeProject({ subtitleStatus: 'ready_with_warnings' }));
      mockDb.getSubtitleDocument.mockReturnValue(makeDoc());
      const result = await invoke(IPC_CHANNELS.TRANSCRIPT_GENERATE_FOR_PROJECT, {
        projectId: PROJECT_ID,
        gapThresholdMs: 500,
      });
      expect((result as { subtitleStatus: string }).subtitleStatus).toBe('ready_with_warnings');
    });

    it('returns empty when subtitle document missing', async () => {
      mockDb.getProject.mockReturnValue(makeProject({ subtitleStatus: 'ready' }));
      mockDb.getSubtitleDocument.mockReturnValue(null);
      const result = await invoke(IPC_CHANNELS.TRANSCRIPT_GENERATE_FOR_PROJECT, {
        projectId: PROJECT_ID,
        gapThresholdMs: 500,
      });
      expect(result).toEqual({ entries: [], subtitleStatus: null });
    });

    it('rejects invalid projectId', async () => {
      await expect(
        invoke(IPC_CHANNELS.TRANSCRIPT_GENERATE_FOR_PROJECT, { projectId: 'not-a-uuid' }),
      ).rejects.toThrow();
    });

    it('rejects gapThresholdMs out of range (99999)', async () => {
      await expect(
        invoke(IPC_CHANNELS.TRANSCRIPT_GENERATE_FOR_PROJECT, {
          projectId: PROJECT_ID,
          gapThresholdMs: 99999,
        }),
      ).rejects.toThrow();
    });

    it('applies default gapThresholdMs when not provided', async () => {
      mockDb.getProject.mockReturnValue(makeProject({ subtitleStatus: 'ready' }));
      mockDb.getSubtitleDocument.mockReturnValue(makeDoc());
      const result = await invoke(IPC_CHANNELS.TRANSCRIPT_GENERATE_FOR_PROJECT, {
        projectId: PROJECT_ID,
      });
      expect((result as { entries: unknown[] }).entries).toBeDefined();
    });
  });

  describe('transcript:exportForProject', () => {
    it('returns exported=false when dialog canceled', async () => {
      mockDb.getProject.mockReturnValue(makeProject({ subtitleStatus: 'ready' }));
      mockDb.getSubtitleDocument.mockReturnValue(makeDoc());
      vi.mocked(showTranscriptExportDialog).mockResolvedValue({ canceled: true });
      const result = await invoke(IPC_CHANNELS.TRANSCRIPT_EXPORT_FOR_PROJECT, {
        projectId: PROJECT_ID,
        gapThresholdMs: 500,
        format: 'txt',
      });
      expect(result).toEqual({ exported: false, path: null });
    });

    it('returns exported=false when project not found', async () => {
      mockDb.getProject.mockReturnValue(null);
      const result = await invoke(IPC_CHANNELS.TRANSCRIPT_EXPORT_FOR_PROJECT, {
        projectId: PROJECT_ID,
        gapThresholdMs: 500,
        format: 'txt',
      });
      expect(result).toEqual({ exported: false, path: null });
    });

    it('rejects invalid format', async () => {
      await expect(
        invoke(IPC_CHANNELS.TRANSCRIPT_EXPORT_FOR_PROJECT, {
          projectId: PROJECT_ID,
          gapThresholdMs: 500,
          format: 'csv',
        }),
      ).rejects.toThrow();
    });

    it('returns exported=true and path when export succeeds', async () => {
      const tmpPath = path.join(os.tmpdir(), 'transcript-ipc-success-test.txt');
      mockDb.getProject.mockReturnValue(makeProject({ subtitleStatus: 'ready' }));
      mockDb.getSubtitleDocument.mockReturnValue(makeDoc());
      vi.mocked(showTranscriptExportDialog).mockResolvedValue({
        canceled: false,
        filePath: tmpPath,
      });
      const result = await invoke(IPC_CHANNELS.TRANSCRIPT_EXPORT_FOR_PROJECT, {
        projectId: PROJECT_ID,
        gapThresholdMs: 500,
        format: 'txt',
      });
      expect(result).toEqual({ exported: true, path: tmpPath });
      try { fs.unlinkSync(tmpPath); } catch { /* ignore */ }
    });
  });
});
