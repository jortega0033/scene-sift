// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

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
import { IPC_CHANNELS } from '@shared/ipc/channels';
import type { CompositionSettings } from '@shared/schemas/composition';

const PROJECT_UUID = '11111111-1111-4111-8111-111111111111';

const makeSettings = (overrides: Partial<CompositionSettings> = {}): CompositionSettings => ({
  projectId: PROJECT_UUID,
  resolution: '1080x1920',
  backgroundStyle: 'blur',
  subtitlePosition: 'bottom',
  fontFamily: 'Arial',
  fontSize: 32,
  fontColor: '#FFFFFF',
  createdAt: 1_000_000,
  updatedAt: 1_000_000,
  ...overrides,
});

const makeDb = (settingsOverrides: Partial<CompositionSettings> = {}) => ({
  initialize: vi.fn(),
  createProject: vi.fn(),
  listProjects: vi.fn().mockReturnValue([]),
  getProject: vi.fn().mockReturnValue(null),
  deleteProject: vi.fn().mockReturnValue(false),
  updateProjectInspection: vi.fn(),
  setProjectSubtitlePath: vi.fn(),
  persistSubtitleResult: vi.fn(),
  getSubtitleDocument: vi.fn().mockReturnValue(null),
  updateSyncResult: vi.fn(),
  saveAiConfiguration: vi.fn(),
  getAiConfiguration: vi.fn().mockReturnValue(null),
  clearAiConfiguration: vi.fn(),
  createClipCandidate: vi.fn(),
  listClipCandidates: vi.fn().mockReturnValue([]),
  getClipCandidateGeneration: vi.fn().mockReturnValue(null),
  updateClipCandidateStatus: vi.fn(),
  updateClipCandidateNotes: vi.fn(),
  updateClipCandidateTiming: vi.fn(),
  createClipCue: vi.fn(),
  listClipCues: vi.fn().mockReturnValue([]),
  updateClipCue: vi.fn(),
  deleteClipCue: vi.fn(),
  deleteClipCuesByCandidate: vi.fn(),
  getProjectCompositionSettings: vi.fn().mockReturnValue(makeSettings(settingsOverrides)),
  upsertProjectCompositionSettings: vi.fn().mockReturnValue(makeSettings(settingsOverrides)),
});

const makeDeps = (db: ReturnType<typeof makeDb>) => ({
  databaseService: db as never,
});

describe('composition IPC handlers', () => {
  let db: ReturnType<typeof makeDb>;

  beforeEach(() => {
    handlers.clear();
    db = makeDb();
    registerIpcHandlers(makeDeps(db));
  });

  const invoke = (channel: string, payload: unknown) => {
    const handler = handlers.get(channel);
    if (!handler) throw new Error(`No handler for ${channel}`);
    return handler(null, payload);
  };

  it('composition:getForProject registered', () => {
    expect(handlers.has(IPC_CHANNELS.COMPOSITION_GET_FOR_PROJECT)).toBe(true);
  });

  it('composition:updateForProject registered', () => {
    expect(handlers.has(IPC_CHANNELS.COMPOSITION_UPDATE_FOR_PROJECT)).toBe(true);
  });

  it('getForProject returns settings for valid uuid', async () => {
    const result = await invoke(IPC_CHANNELS.COMPOSITION_GET_FOR_PROJECT, { projectId: PROJECT_UUID });
    expect(result).toMatchObject({ settings: { projectId: PROJECT_UUID, resolution: '1080x1920' } });
  });

  it('getForProject rejects non-uuid projectId', async () => {
    await expect(invoke(IPC_CHANNELS.COMPOSITION_GET_FOR_PROJECT, { projectId: 'not-a-uuid' })).rejects.toThrow();
  });

  it('updateForProject calls upsertProjectCompositionSettings', async () => {
    db = makeDb({ fontSize: 48 });
    handlers.clear();
    registerIpcHandlers(makeDeps(db));
    const result = await invoke(IPC_CHANNELS.COMPOSITION_UPDATE_FOR_PROJECT, { projectId: PROJECT_UUID, fontSize: 48 }) as { settings: CompositionSettings };
    expect(result.settings.fontSize).toBe(48);
    expect(db.upsertProjectCompositionSettings).toHaveBeenCalledWith(
      PROJECT_UUID,
      expect.objectContaining({ fontSize: 48 }),
    );
  });

  it('updateForProject rejects patch with no fields', async () => {
    await expect(invoke(IPC_CHANNELS.COMPOSITION_UPDATE_FOR_PROJECT, { projectId: PROJECT_UUID })).rejects.toThrow();
  });

  it('updateForProject rejects invalid resolution value', async () => {
    await expect(invoke(IPC_CHANNELS.COMPOSITION_UPDATE_FOR_PROJECT, { projectId: PROJECT_UUID, resolution: '4K' })).rejects.toThrow();
  });

  it('updateForProject rejects fontSize out of range', async () => {
    await expect(invoke(IPC_CHANNELS.COMPOSITION_UPDATE_FOR_PROJECT, { projectId: PROJECT_UUID, fontSize: 15 })).rejects.toThrow();
    await expect(invoke(IPC_CHANNELS.COMPOSITION_UPDATE_FOR_PROJECT, { projectId: PROJECT_UUID, fontSize: 73 })).rejects.toThrow();
  });

  it('updateForProject rejects invalid fontColor', async () => {
    await expect(invoke(IPC_CHANNELS.COMPOSITION_UPDATE_FOR_PROJECT, { projectId: PROJECT_UUID, fontColor: 'red' })).rejects.toThrow();
  });
});
