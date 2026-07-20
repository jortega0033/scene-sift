// @vitest-environment node
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, it, afterEach } from 'vitest';
import { DatabaseService } from '@main/services/database/databaseService';
import { CompositionSettingsService } from '@main/services/compositionSettings/compositionSettingsService';
import { AppError } from '@main/utils/errors';

const VALID_UUID = '11111111-1111-4111-8111-111111111111';
const OTHER_UUID = '22222222-2222-4222-8222-222222222222';

const setupDb = () => {
  const dir = mkdtempSync(join(tmpdir(), 'scenesift-composition-'));
  const dbPath = join(dir, 'app.sqlite');
  const migrationsFolder = join(process.cwd(), 'src', 'database', 'migrations');
  const db = new DatabaseService(dbPath, migrationsFolder);
  db.initialize();
  const svc = new CompositionSettingsService(db);
  return { db, svc, dir };
};

const createProject = (db: DatabaseService) =>
  db.createProject({
    name: 'Composition Test',
    video: { path: '/tmp/video.mp4', name: 'video.mp4', extension: '.mp4' },
    subtitle: undefined,
    outputDirectory: undefined,
  });

let cleanup: () => void;

afterEach(() => {
  cleanup?.();
});

describe('CompositionSettingsService.getForProject', () => {
  it('returns defaults on first call (lazy row creation)', () => {
    const { db, svc, dir } = setupDb();
    cleanup = () => rmSync(dir, { recursive: true });
    const project = createProject(db);
    const result = svc.getForProject(project.id);
    expect(result.projectId).toBe(project.id);
    expect(result.resolution).toBe('1080x1920');
    expect(result.backgroundStyle).toBe('blur');
    expect(result.subtitlePosition).toBe('bottom');
    expect(result.fontFamily).toBe('Arial');
    expect(result.fontSize).toBe(32);
    expect(result.fontColor).toBe('#FFFFFF');
  });

  it('second call returns same row without duplication', () => {
    const { db, svc, dir } = setupDb();
    cleanup = () => rmSync(dir, { recursive: true });
    const project = createProject(db);
    const first = svc.getForProject(project.id);
    const second = svc.getForProject(project.id);
    expect(second.projectId).toBe(first.projectId);
    expect(second.createdAt).toBe(first.createdAt);
  });

  it('throws AppError for nonexistent projectId', () => {
    const { svc, dir } = setupDb();
    cleanup = () => rmSync(dir, { recursive: true });
    expect(() => svc.getForProject(VALID_UUID)).toThrow(AppError);
  });
});

describe('CompositionSettingsService.updateForProject', () => {
  it('updates a single field and returns merged settings', () => {
    const { db, svc, dir } = setupDb();
    cleanup = () => rmSync(dir, { recursive: true });
    const project = createProject(db);
    svc.getForProject(project.id);
    const result = svc.updateForProject(project.id, { fontSize: 48 });
    expect(result.fontSize).toBe(48);
    expect(result.fontFamily).toBe('Arial');
  });

  it('updates multiple fields in one call', () => {
    const { db, svc, dir } = setupDb();
    cleanup = () => rmSync(dir, { recursive: true });
    const project = createProject(db);
    svc.getForProject(project.id);
    const result = svc.updateForProject(project.id, {
      resolution: '720x1280',
      backgroundStyle: 'crop',
      fontColor: '#000000',
    });
    expect(result.resolution).toBe('720x1280');
    expect(result.backgroundStyle).toBe('crop');
    expect(result.fontColor).toBe('#000000');
  });

  it('persists update across a fresh read', () => {
    const { db, svc, dir } = setupDb();
    cleanup = () => rmSync(dir, { recursive: true });
    const project = createProject(db);
    svc.getForProject(project.id);
    svc.updateForProject(project.id, { fontSize: 64 });
    const fresh = svc.getForProject(project.id);
    expect(fresh.fontSize).toBe(64);
  });

  it('throws AppError for nonexistent projectId', () => {
    const { svc, dir } = setupDb();
    cleanup = () => rmSync(dir, { recursive: true });
    expect(() => svc.updateForProject(OTHER_UUID, { fontSize: 48 })).toThrow(AppError);
  });

  it('settings row deleted when project deleted (CASCADE)', () => {
    const { db, svc, dir } = setupDb();
    cleanup = () => rmSync(dir, { recursive: true });
    const project = createProject(db);
    svc.getForProject(project.id);
    db.deleteProject(project.id);
    expect(() => svc.getForProject(project.id)).toThrow(AppError);
  });
});
