// @vitest-environment node
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { DatabaseService } from '@main/services/database/databaseService';
import type { InspectionOutcome } from '@main/services/ffmpeg/ffmpegService';
import type { SubtitleDocument, SubtitlePersistOutcome } from '@shared/schemas/subtitle';

const createDbPath = () => {
  const dir = mkdtempSync(join(tmpdir(), 'scenesift-db-'));
  return {
    dir,
    dbPath: join(dir, 'app.sqlite'),
    migrationsFolder: join(process.cwd(), 'src', 'database', 'migrations'),
  };
};

describe('database service', () => {
  it('initializes and reports health', () => {
    const { dir, dbPath, migrationsFolder } = createDbPath();
    const service = new DatabaseService(dbPath, migrationsFolder);
    service.initialize();

    const health = service.getHealth();
    expect(health.ok).toBe(true);
    expect(health.migrationsApplied).toBe(true);

    service.close();
    rmSync(dir, { recursive: true, force: true });
  });

  it('supports project CRUD and settings persistence', () => {
    const { dir, dbPath, migrationsFolder } = createDbPath();
    const service = new DatabaseService(dbPath, migrationsFolder);
    service.initialize();

    const created = service.createProject({
      name: 'Episode 2',
      video: { path: '/tmp/video.mp4', name: 'video.mp4', extension: '.mp4' },
      subtitle: undefined,
      outputDirectory: undefined,
    });
    expect(created.id).toBeDefined();

    const list = service.listProjects();
    expect(list).toHaveLength(1);

    const fetched = service.getProject(created.id);
    expect(fetched?.name).toBe('Episode 2');

    const updatedSettings = service.updateSettings({
      preferredTheme: 'dark',
      developmentDiagnosticsEnabled: true,
    });
    expect(updatedSettings.preferredTheme).toBe('dark');
    expect(updatedSettings.developmentDiagnosticsEnabled).toBe(true);

    const deleted = service.deleteProject(created.id);
    expect(deleted).toBe(true);
    expect(service.listProjects()).toHaveLength(0);

    service.close();
    rmSync(dir, { recursive: true, force: true });
  });
});

const FULL_METADATA_OUTCOME: InspectionOutcome = {
  status: 'ready',
  mediaMetadata: {
    durationSeconds: 2847.6,
    width: 1920,
    height: 1080,
    videoCodec: 'h264',
    fps: 23.976,
    bitRateBps: 8_500_000,
    fileSizeBytes: 3_021_000_000,
    inspectedAt: 1_700_000_000_000,
  },
  inspectionError: null,
};

describe('updateProjectInspection', () => {
  it('updates status to ready with full metadata', () => {
    const { dir, dbPath, migrationsFolder } = createDbPath();
    const service = new DatabaseService(dbPath, migrationsFolder);
    service.initialize();

    const created = service.createProject({
      name: 'Test',
      video: { path: '/tmp/v.mp4', name: 'v.mp4', extension: '.mp4' },
      subtitle: undefined,
      outputDirectory: undefined,
    });

    const result = service.updateProjectInspection(created.id, FULL_METADATA_OUTCOME);

    expect(result.status).toBe('ready');
    expect(result.inspectionError).toBeNull();
    expect(result.mediaMetadata).not.toBeNull();
    expect(result.mediaMetadata?.durationSeconds).toBeCloseTo(2847.6);
    expect(result.mediaMetadata?.width).toBe(1920);
    expect(result.mediaMetadata?.height).toBe(1080);
    expect(result.mediaMetadata?.videoCodec).toBe('h264');
    expect(result.mediaMetadata?.fps).toBeCloseTo(23.976);
    expect(result.mediaMetadata?.bitRateBps).toBe(8_500_000);
    expect(result.mediaMetadata?.fileSizeBytes).toBe(3_021_000_000);
    expect(result.mediaMetadata?.inspectedAt).toBe(1_700_000_000_000);

    service.close();
    rmSync(dir, { recursive: true, force: true });
  });

  it('updates status to inspection_failed with null metadata and error code', () => {
    const { dir, dbPath, migrationsFolder } = createDbPath();
    const service = new DatabaseService(dbPath, migrationsFolder);
    service.initialize();

    const created = service.createProject({
      name: 'Test',
      video: { path: '/tmp/v.mp4', name: 'v.mp4', extension: '.mp4' },
      subtitle: undefined,
      outputDirectory: undefined,
    });

    const outcome: InspectionOutcome = {
      status: 'inspection_failed',
      mediaMetadata: null,
      inspectionError: 'FFPROBE_ERROR',
    };
    const result = service.updateProjectInspection(created.id, outcome);

    expect(result.status).toBe('inspection_failed');
    expect(result.mediaMetadata).toBeNull();
    expect(result.inspectionError).toBe('FFPROBE_ERROR');

    service.close();
    rmSync(dir, { recursive: true, force: true });
  });

  it('replaces previous inspection data on second call', () => {
    const { dir, dbPath, migrationsFolder } = createDbPath();
    const service = new DatabaseService(dbPath, migrationsFolder);
    service.initialize();

    const created = service.createProject({
      name: 'Test',
      video: { path: '/tmp/v.mp4', name: 'v.mp4', extension: '.mp4' },
      subtitle: undefined,
      outputDirectory: undefined,
    });

    service.updateProjectInspection(created.id, FULL_METADATA_OUTCOME);

    const failedOutcome: InspectionOutcome = {
      status: 'inspection_failed',
      mediaMetadata: null,
      inspectionError: 'PARSE_ERROR',
    };
    const result = service.updateProjectInspection(created.id, failedOutcome);

    expect(result.status).toBe('inspection_failed');
    expect(result.mediaMetadata).toBeNull();
    expect(result.inspectionError).toBe('PARSE_ERROR');

    service.close();
    rmSync(dir, { recursive: true, force: true });
  });

  it('throws for a nonexistent projectId', () => {
    const { dir, dbPath, migrationsFolder } = createDbPath();
    const service = new DatabaseService(dbPath, migrationsFolder);
    service.initialize();

    expect(() =>
      service.updateProjectInspection(randomUUID(), FULL_METADATA_OUTCOME),
    ).toThrow();

    service.close();
    rmSync(dir, { recursive: true, force: true });
  });
});

it('persists all inspection fields across close and reopen', () => {
  const { dir, dbPath, migrationsFolder } = createDbPath();
  const service = new DatabaseService(dbPath, migrationsFolder);
  service.initialize();

  const created = service.createProject({
    name: 'Persist Test',
    video: { path: '/tmp/v.mp4', name: 'v.mp4', extension: '.mp4' },
    subtitle: undefined,
    outputDirectory: undefined,
  });

  service.updateProjectInspection(created.id, FULL_METADATA_OUTCOME);
  service.close();

  const service2 = new DatabaseService(dbPath, migrationsFolder);
  service2.initialize();

  const projects = service2.listProjects();
  const project = projects.find((p) => p.id === created.id);

  expect(project).toBeDefined();
  expect(project?.status).toBe('ready');
  expect(project?.inspectionError).toBeNull();
  expect(project?.mediaMetadata).not.toBeNull();
  expect(project?.mediaMetadata?.durationSeconds).toBeCloseTo(2847.6);
  expect(project?.mediaMetadata?.width).toBe(1920);
  expect(project?.mediaMetadata?.height).toBe(1080);
  expect(project?.mediaMetadata?.videoCodec).toBe('h264');
  expect(project?.mediaMetadata?.fps).toBeCloseTo(23.976);
  expect(project?.mediaMetadata?.bitRateBps).toBe(8_500_000);
  expect(project?.mediaMetadata?.fileSizeBytes).toBe(3_021_000_000);
  expect(project?.mediaMetadata?.inspectedAt).toBe(1_700_000_000_000);

  service2.close();
  rmSync(dir, { recursive: true, force: true });
});

const makeProject = (service: DatabaseService) =>
  service.createProject({
    name: 'Test Project',
    video: { path: '/tmp/v.mp4', name: 'v.mp4', extension: '.mp4' },
    subtitle: undefined,
    outputDirectory: undefined,
  });

const readyOutcome: SubtitlePersistOutcome = {
  subtitleStatus: 'ready',
  cueCount: 42,
  lastCueEndMs: 300_000,
  parseError: null,
  parsedAt: 1_700_000_000_000,
};

const sampleDoc: SubtitleDocument = {
  schemaVersion: 1,
  sourceFormat: 'srt',
  sourceEncoding: 'utf-8',
  cues: [
    { index: 1, startMs: 0, endMs: 1000, text: 'Hello', lines: ['Hello'] },
    { index: 2, startMs: 2000, endMs: 3000, text: 'World', lines: ['World'] },
  ],
  warnings: [],
  summary: {
    cueCount: 2,
    firstCueStartMs: 0,
    lastCueEndMs: 3000,
    totalTextLength: 10,
    warningCount: 0,
  },
  parsedAt: 1_700_000_000_000,
};

describe('setProjectSubtitlePath', () => {
  it('sets subtitlePath and transitions to selected', () => {
    const { dir, dbPath, migrationsFolder } = createDbPath();
    const service = new DatabaseService(dbPath, migrationsFolder);
    service.initialize();
    const created = makeProject(service);

    const result = service.setProjectSubtitlePath(created.id, '/tmp/sample.srt');
    expect(result.subtitlePath).toBe('/tmp/sample.srt');
    expect(result.subtitleStatus).toBe('selected');
    expect(result.subtitleCueCount).toBeNull();
    expect(result.subtitleParseError).toBeNull();

    service.close();
    rmSync(dir, { recursive: true, force: true });
  });

  it('clears path and transitions to not_selected when null passed', () => {
    const { dir, dbPath, migrationsFolder } = createDbPath();
    const service = new DatabaseService(dbPath, migrationsFolder);
    service.initialize();
    const created = makeProject(service);
    service.setProjectSubtitlePath(created.id, '/tmp/sample.srt');

    const result = service.setProjectSubtitlePath(created.id, null);
    expect(result.subtitlePath).toBeNull();
    expect(result.subtitleStatus).toBe('not_selected');

    service.close();
    rmSync(dir, { recursive: true, force: true });
  });
});

describe('persistSubtitleResult', () => {
  it('persists outcome and document when path matches', () => {
    const { dir, dbPath, migrationsFolder } = createDbPath();
    const service = new DatabaseService(dbPath, migrationsFolder);
    service.initialize();
    const created = makeProject(service);
    service.setProjectSubtitlePath(created.id, '/tmp/sample.srt');

    const result = service.persistSubtitleResult(
      created.id,
      '/tmp/sample.srt',
      readyOutcome,
      sampleDoc,
    );

    expect(result.subtitleStatus).toBe('ready');
    expect(result.subtitleCueCount).toBe(42);
    expect(result.subtitleLastCueEndMs).toBe(300_000);
    expect(result.subtitleParseError).toBeNull();

    const doc = service.getSubtitleDocument(created.id);
    expect(doc).not.toBeNull();
    expect(doc?.cues).toHaveLength(2);
    expect(doc?.summary.cueCount).toBe(2);

    service.close();
    rmSync(dir, { recursive: true, force: true });
  });

  it('aborts and returns current row when path no longer matches (TOCTOU)', () => {
    const { dir, dbPath, migrationsFolder } = createDbPath();
    const service = new DatabaseService(dbPath, migrationsFolder);
    service.initialize();
    const created = makeProject(service);
    service.setProjectSubtitlePath(created.id, '/tmp/original.srt');
    // Simulate clearForProject running concurrently — path changed
    service.setProjectSubtitlePath(created.id, null);

    const result = service.persistSubtitleResult(
      created.id,
      '/tmp/original.srt',
      readyOutcome,
      sampleDoc,
    );

    // Abort-on-mismatch: returns current (not_selected) state, does not apply parse result
    expect(result.subtitleStatus).toBe('not_selected');
    expect(result.subtitleCueCount).toBeNull();
    expect(service.getSubtitleDocument(created.id)).toBeNull();

    service.close();
    rmSync(dir, { recursive: true, force: true });
  });

  it('persists parse_failed outcome with null document', () => {
    const { dir, dbPath, migrationsFolder } = createDbPath();
    const service = new DatabaseService(dbPath, migrationsFolder);
    service.initialize();
    const created = makeProject(service);
    service.setProjectSubtitlePath(created.id, '/tmp/bad.srt');

    const failOutcome: SubtitlePersistOutcome = {
      subtitleStatus: 'parse_failed',
      cueCount: null,
      lastCueEndMs: null,
      parseError: 'SUBTITLE_PARSE_ERROR',
      parsedAt: 1_700_000_000_000,
    };

    const result = service.persistSubtitleResult(created.id, '/tmp/bad.srt', failOutcome, null);

    expect(result.subtitleStatus).toBe('parse_failed');
    expect(result.subtitleParseError).toBe('SUBTITLE_PARSE_ERROR');
    expect(service.getSubtitleDocument(created.id)).toBeNull();

    service.close();
    rmSync(dir, { recursive: true, force: true });
  });

  it('deletes stale subtitle document when reparse fails', () => {
    const { dir, dbPath, migrationsFolder } = createDbPath();
    const service = new DatabaseService(dbPath, migrationsFolder);
    service.initialize();
    const created = makeProject(service);
    service.setProjectSubtitlePath(created.id, '/tmp/sample.srt');
    service.persistSubtitleResult(created.id, '/tmp/sample.srt', readyOutcome, sampleDoc);

    // Confirm document exists after successful parse
    expect(service.getSubtitleDocument(created.id)).not.toBeNull();

    const failOutcome: SubtitlePersistOutcome = {
      subtitleStatus: 'parse_failed',
      cueCount: null,
      lastCueEndMs: null,
      parseError: 'SUBTITLE_PARSE_ERROR',
      parsedAt: 1_700_000_001_000,
    };
    service.persistSubtitleResult(created.id, '/tmp/sample.srt', failOutcome, null);

    // Old document must be gone after failed reparse
    expect(service.getSubtitleDocument(created.id)).toBeNull();

    service.close();
    rmSync(dir, { recursive: true, force: true });
  });
});

describe('getSubtitleDocument', () => {
  it('returns null when no document exists', () => {
    const { dir, dbPath, migrationsFolder } = createDbPath();
    const service = new DatabaseService(dbPath, migrationsFolder);
    service.initialize();
    const created = makeProject(service);

    expect(service.getSubtitleDocument(created.id)).toBeNull();

    service.close();
    rmSync(dir, { recursive: true, force: true });
  });

  it('reconstructs summary from cues_json on load', () => {
    const { dir, dbPath, migrationsFolder } = createDbPath();
    const service = new DatabaseService(dbPath, migrationsFolder);
    service.initialize();
    const created = makeProject(service);
    service.setProjectSubtitlePath(created.id, '/tmp/sample.srt');
    service.persistSubtitleResult(created.id, '/tmp/sample.srt', readyOutcome, sampleDoc);

    const doc = service.getSubtitleDocument(created.id);
    expect(doc?.summary.cueCount).toBe(2);
    expect(doc?.summary.firstCueStartMs).toBe(0);
    expect(doc?.summary.lastCueEndMs).toBe(3000);
    expect(doc?.summary.totalTextLength).toBe(10);
    expect(doc?.summary.warningCount).toBe(0);

    service.close();
    rmSync(dir, { recursive: true, force: true });
  });

  it('persists subtitle document across close and reopen', () => {
    const { dir, dbPath, migrationsFolder } = createDbPath();
    const service = new DatabaseService(dbPath, migrationsFolder);
    service.initialize();
    const created = makeProject(service);
    service.setProjectSubtitlePath(created.id, '/tmp/sample.srt');
    service.persistSubtitleResult(created.id, '/tmp/sample.srt', readyOutcome, sampleDoc);
    service.close();

    const service2 = new DatabaseService(dbPath, migrationsFolder);
    service2.initialize();
    const doc = service2.getSubtitleDocument(created.id);

    expect(doc).not.toBeNull();
    expect(doc?.sourceFormat).toBe('srt');
    expect(doc?.cues).toHaveLength(2);
    expect(doc?.cues[0].text).toBe('Hello');

    service2.close();
    rmSync(dir, { recursive: true, force: true });
  });

  it('persists subtitle project-row columns across close and reopen', () => {
    const { dir, dbPath, migrationsFolder } = createDbPath();
    const service = new DatabaseService(dbPath, migrationsFolder);
    service.initialize();
    const created = makeProject(service);
    service.setProjectSubtitlePath(created.id, '/tmp/sample.srt');
    service.persistSubtitleResult(created.id, '/tmp/sample.srt', readyOutcome, sampleDoc);
    service.close();

    const service2 = new DatabaseService(dbPath, migrationsFolder);
    service2.initialize();
    const project = service2.getProject(created.id);

    expect(project?.subtitleStatus).toBe('ready');
    expect(project?.subtitleCueCount).toBe(42);
    expect(project?.subtitleLastCueEndMs).toBe(300_000);
    expect(project?.subtitleParseError).toBeNull();
    expect(project?.subtitleParsedAt).toBe(1_700_000_000_000);

    service2.close();
    rmSync(dir, { recursive: true, force: true });
  });
});

describe('subtitle document lifecycle (via setProjectSubtitlePath)', () => {
  it('setProjectSubtitlePath(null) atomically clears subtitle document and resets status', () => {
    const { dir, dbPath, migrationsFolder } = createDbPath();
    const service = new DatabaseService(dbPath, migrationsFolder);
    service.initialize();
    const created = makeProject(service);
    service.setProjectSubtitlePath(created.id, '/tmp/sample.srt');
    service.persistSubtitleResult(created.id, '/tmp/sample.srt', readyOutcome, sampleDoc);

    const before = service.getProject(created.id);
    expect(before?.subtitleStatus).toBe('ready');
    expect(service.getSubtitleDocument(created.id)).not.toBeNull();

    const result = service.setProjectSubtitlePath(created.id, null);

    // Both project-row state and cue document cleared atomically
    expect(result.subtitleStatus).toBe('not_selected');
    expect(result.subtitlePath).toBeNull();
    expect(result.subtitleCueCount).toBeNull();
    expect(service.getSubtitleDocument(created.id)).toBeNull();

    service.close();
    rmSync(dir, { recursive: true, force: true });
  });

  it('setProjectSubtitlePath(null) is idempotent when no subtitle document exists', () => {
    const { dir, dbPath, migrationsFolder } = createDbPath();
    const service = new DatabaseService(dbPath, migrationsFolder);
    service.initialize();
    const created = makeProject(service);

    expect(() => service.setProjectSubtitlePath(created.id, null)).not.toThrow();
    expect(service.getSubtitleDocument(created.id)).toBeNull();

    service.close();
    rmSync(dir, { recursive: true, force: true });
  });
});
