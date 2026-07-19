// @vitest-environment node
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, it } from 'vitest';
import { DatabaseService } from '@main/services/database/databaseService';

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
