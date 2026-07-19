import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
import Database from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { desc, eq } from 'drizzle-orm';
import type { AppSettings } from '@shared/schemas/settings';
import type { ProjectRecord, MediaMetadata } from '@shared/schemas/project';
import type { CreateProjectInput } from '@shared/schemas/project';
import { appSettingsTable, projectsTable, renderJobsTable } from '@database/schema';
import { AppError } from '@main/utils/errors';
import type { QueueStatus } from '@shared/types/common';
import type { InspectionOutcome } from '@main/services/ffmpeg/ffmpegService';

const SETTINGS_ID = 'default';

type DbHealth = {
  ok: boolean;
  dbPath: string;
  migrationsApplied: boolean;
};

type RenderJobRecord = {
  id: string;
  projectId: string;
  status: QueueStatus;
  progress: number;
  outputPath: string | null;
  errorMessage: string | null;
  createdAt: number;
  updatedAt: number;
};

export class DatabaseService {
  private db?: Database.Database;
  private orm?: BetterSQLite3Database;
  private migrationsApplied = false;

  constructor(
    private readonly dbPath: string,
    private readonly migrationsFolder: string,
  ) {}

  public initialize(): void {
    mkdirSync(dirname(this.dbPath), { recursive: true });

    this.db = new Database(this.dbPath);
    this.orm = drizzle(this.db);
    migrate(this.orm, {
      migrationsFolder: this.migrationsFolder,
    });
    this.migrationsApplied = true;

    this.ensureDefaultSettings();
  }

  public close(): void {
    this.db?.close();
  }

  public getHealth(): DbHealth {
    return {
      ok: Boolean(this.db && this.orm),
      dbPath: this.dbPath,
      migrationsApplied: this.migrationsApplied,
    };
  }

  public listProjects(): ProjectRecord[] {
    const orm = this.ensureOrm();
    return orm
      .select()
      .from(projectsTable)
      .orderBy(desc(projectsTable.updatedAt))
      .all()
      .map((row) => this.mapProject(row));
  }

  public createProject(input: CreateProjectInput): ProjectRecord {
    const orm = this.ensureOrm();
    const now = Date.now();
    const id = randomUUID();

    orm
      .insert(projectsTable)
      .values({
        id,
        name: input.name,
        videoPath: input.video.path,
        subtitlePath: input.subtitle?.path ?? null,
        outputDirectory: input.outputDirectory?.path ?? null,
        status: 'draft',
        createdAt: now,
        updatedAt: now,
      })
      .run();

    const project = orm.select().from(projectsTable).where(eq(projectsTable.id, id)).get();
    if (!project) {
      throw new AppError('PROJECT_CREATE_FAILED', 'Project was not persisted.');
    }

    return this.mapProject(project);
  }

  public getProject(projectId: string): ProjectRecord | null {
    const orm = this.ensureOrm();
    const project = orm.select().from(projectsTable).where(eq(projectsTable.id, projectId)).get();
    if (!project) {
      return null;
    }

    return this.mapProject(project);
  }

  public updateProjectInspection(projectId: string, outcome: InspectionOutcome): ProjectRecord {
    const orm = this.ensureOrm();
    const now = Date.now();
    const meta = outcome.mediaMetadata;

    orm
      .update(projectsTable)
      .set({
        status: outcome.status,
        durationSeconds: meta?.durationSeconds ?? null,
        width: meta?.width ?? null,
        height: meta?.height ?? null,
        videoCodec: meta?.videoCodec ?? null,
        fps: meta?.fps ?? null,
        bitRateBps: meta?.bitRateBps ?? null,
        fileSizeBytes: meta?.fileSizeBytes ?? null,
        inspectedAt: meta?.inspectedAt ?? null,
        inspectionError: outcome.inspectionError,
        updatedAt: now,
      })
      .where(eq(projectsTable.id, projectId))
      .run();

    const project = orm.select().from(projectsTable).where(eq(projectsTable.id, projectId)).get();
    if (!project) {
      throw new AppError('PROJECT_NOT_FOUND', 'Project not found after inspection update.');
    }

    return this.mapProject(project);
  }

  public deleteProject(projectId: string): boolean {
    const orm = this.ensureOrm();
    orm.delete(renderJobsTable).where(eq(renderJobsTable.projectId, projectId)).run();
    const result = orm.delete(projectsTable).where(eq(projectsTable.id, projectId)).run();
    return result.changes > 0;
  }

  public listQueue(): RenderJobRecord[] {
    const orm = this.ensureOrm();
    return orm
      .select()
      .from(renderJobsTable)
      .orderBy(desc(renderJobsTable.updatedAt))
      .all()
      .map((job) => ({
        id: job.id,
        projectId: job.projectId,
        status: job.status as QueueStatus,
        progress: job.progress,
        outputPath: job.outputPath ?? null,
        errorMessage: job.errorMessage ?? null,
        createdAt: job.createdAt,
        updatedAt: job.updatedAt,
      }));
  }

  public createDemoJob(projectId: string): RenderJobRecord {
    const orm = this.ensureOrm();
    const project = orm
      .select({ id: projectsTable.id })
      .from(projectsTable)
      .where(eq(projectsTable.id, projectId))
      .get();
    if (!project) {
      throw new AppError('PROJECT_NOT_FOUND', 'Project not found for queue job.');
    }

    const now = Date.now();
    const id = randomUUID();
    orm
      .insert(renderJobsTable)
      .values({
        id,
        projectId,
        status: 'queued',
        progress: 0,
        outputPath: null,
        errorMessage: null,
        createdAt: now,
        updatedAt: now,
      })
      .run();

    const created = orm.select().from(renderJobsTable).where(eq(renderJobsTable.id, id)).get();
    if (!created) {
      throw new AppError('QUEUE_CREATE_FAILED', 'Queue job was not persisted.');
    }

    return {
      id: created.id,
      projectId: created.projectId,
      status: created.status as QueueStatus,
      progress: created.progress,
      outputPath: created.outputPath ?? null,
      errorMessage: created.errorMessage ?? null,
      createdAt: created.createdAt,
      updatedAt: created.updatedAt,
    };
  }

  public getSettings(): AppSettings {
    const orm = this.ensureOrm();
    const settings = orm
      .select()
      .from(appSettingsTable)
      .where(eq(appSettingsTable.id, SETTINGS_ID))
      .get();

    if (!settings) {
      throw new AppError('SETTINGS_NOT_FOUND', 'Default settings not found.');
    }

    return {
      ffmpegPathOverride: settings.ffmpegPathOverride ?? null,
      ffprobePathOverride: settings.ffprobePathOverride ?? null,
      defaultOutputDirectory: settings.defaultOutputDirectory ?? null,
      preferredTheme: settings.preferredTheme as AppSettings['preferredTheme'],
      developmentDiagnosticsEnabled: settings.developmentDiagnosticsEnabled,
    };
  }

  public updateSettings(input: Partial<AppSettings>): AppSettings {
    const orm = this.ensureOrm();
    const existing = this.getSettings();
    const now = Date.now();

    orm
      .update(appSettingsTable)
      .set({
        ffmpegPathOverride: input.ffmpegPathOverride ?? existing.ffmpegPathOverride,
        ffprobePathOverride: input.ffprobePathOverride ?? existing.ffprobePathOverride,
        defaultOutputDirectory: input.defaultOutputDirectory ?? existing.defaultOutputDirectory,
        preferredTheme: input.preferredTheme ?? existing.preferredTheme,
        developmentDiagnosticsEnabled:
          input.developmentDiagnosticsEnabled ?? existing.developmentDiagnosticsEnabled,
        updatedAt: now,
      })
      .where(eq(appSettingsTable.id, SETTINGS_ID))
      .run();

    return this.getSettings();
  }

  private mapProject(row: typeof projectsTable.$inferSelect): ProjectRecord {
    const mediaMetadata: MediaMetadata | null =
      row.inspectedAt != null
        ? {
            durationSeconds: row.durationSeconds ?? null,
            width: row.width ?? null,
            height: row.height ?? null,
            videoCodec: row.videoCodec ?? null,
            fps: row.fps ?? null,
            bitRateBps: row.bitRateBps ?? null,
            fileSizeBytes: row.fileSizeBytes ?? null,
            inspectedAt: row.inspectedAt,
          }
        : null;

    return {
      id: row.id,
      name: row.name,
      videoPath: row.videoPath,
      subtitlePath: row.subtitlePath ?? null,
      outputDirectory: row.outputDirectory ?? null,
      status: row.status as ProjectRecord['status'],
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      mediaMetadata,
      inspectionError: row.inspectionError ?? null,
    };
  }

  private ensureOrm(): BetterSQLite3Database {
    if (!this.orm) {
      throw new AppError('DATABASE_NOT_INITIALIZED', 'Database service is not initialized.');
    }

    return this.orm;
  }

  private ensureDefaultSettings(): void {
    const orm = this.ensureOrm();
    const existing = orm
      .select({ id: appSettingsTable.id })
      .from(appSettingsTable)
      .where(eq(appSettingsTable.id, SETTINGS_ID))
      .get();

    if (existing) {
      return;
    }

    const now = Date.now();
    orm
      .insert(appSettingsTable)
      .values({
        id: SETTINGS_ID,
        ffmpegPathOverride: null,
        ffprobePathOverride: null,
        defaultOutputDirectory: null,
        preferredTheme: 'system',
        developmentDiagnosticsEnabled: false,
        createdAt: now,
        updatedAt: now,
      })
      .run();
  }
}
