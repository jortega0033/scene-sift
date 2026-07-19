// @vitest-environment node
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { DatabaseService } from '@main/services/database/databaseService';
import type { InspectionOutcome } from '@main/services/ffmpeg/ffmpegService';

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
