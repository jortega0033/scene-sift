import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
import Database from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { asc, desc, eq } from 'drizzle-orm';
import type { AppSettings } from '@shared/schemas/settings';
import type { ProjectRecord, MediaMetadata } from '@shared/schemas/project';
import type { CreateProjectInput } from '@shared/schemas/project';
import { appSettingsTable, projectsTable, renderJobsTable, subtitleDocumentsTable, aiProviderConfigTable, clipCandidatesTable } from '@database/schema';
import type { CandidateGenerationStatus, CandidateStatus, ClipCandidate } from '@shared/schemas/candidates';
import { AppError } from '@main/utils/errors';
import type { QueueStatus } from '@shared/types/common';
import type { InspectionOutcome } from '@main/services/ffmpeg/ffmpegService';
import type { SubtitleDocument, SubtitlePersistOutcome } from '@shared/schemas/subtitle';
import type { SyncWarning } from '@shared/schemas/sync';

type SyncStatusUpdate = {
  syncStatus: string | null;
  syncWarnings: SyncWarning[];
  syncCheckedAt: number | null;
  syncAnalysisVersion: number | null;
};

const SETTINGS_ID = 'default';
const AI_CONFIG_ID = 'default';
const AI_SECRETS_ID = 'ai_provider';

export type AiProviderConfigRow = {
  id: string;
  providerType: string;
  baseUrl: string;
  model: string;
  isConfigured: boolean;
  consentRecordedAt: number | null;
  lastTestStatus: string | null;
  lastTestAt: number | null;
  createdAt: number;
  updatedAt: number;
};

type AiProviderConfigUpdate = Partial<{
  baseUrl: string;
  model: string;
  isConfigured: boolean;
  consentRecordedAt: number | null;
  lastTestStatus: string | null;
  lastTestAt: number | null;
  updatedAt: number;
}>;

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
    this.ensureAiProviderConfigRow();
    this.ensureAiSecretsRow();
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

    const subtitlePath = input.subtitle?.path ?? null;
    orm
      .insert(projectsTable)
      .values({
        id,
        name: input.name,
        videoPath: input.video.path,
        subtitlePath,
        outputDirectory: input.outputDirectory?.path ?? null,
        status: 'draft',
        subtitleStatus: subtitlePath ? 'selected' : null,
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
    const db = this.ensureDb();
    const orm = this.ensureOrm();
    let changes = 0;
    db.transaction(() => {
      this.clearSubtitleDocument(projectId);
      orm.delete(renderJobsTable).where(eq(renderJobsTable.projectId, projectId)).run();
      const result = orm.delete(projectsTable).where(eq(projectsTable.id, projectId)).run();
      changes = result.changes;
    })();
    return changes > 0;
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
      subtitleStatus: (row.subtitleStatus ?? null) as ProjectRecord['subtitleStatus'],
      subtitleCueCount: row.subtitleCueCount ?? null,
      subtitleLastCueEndMs: row.subtitleLastCueEndMs ?? null,
      subtitleParseError: row.subtitleParseError ?? null,
      subtitleParsedAt: row.subtitleParsedAt ?? null,
      syncStatus: (row.syncStatus ?? null) as ProjectRecord['syncStatus'],
      syncCheckedAt: row.syncCheckedAt ?? null,
      syncWarningsJson: row.syncWarningsJson ?? null,
      syncAnalysisVersion: row.syncAnalysisVersion ?? null,
    };
  }

  public setProjectSubtitlePath(projectId: string, subtitlePath: string | null): ProjectRecord {
    const db = this.ensureDb();
    const orm = this.ensureOrm();
    const now = Date.now();

    db.transaction(() => {
      this.clearSubtitleDocument(projectId);
      orm
        .update(projectsTable)
        .set({
          subtitlePath,
          subtitleStatus: subtitlePath ? 'selected' : 'not_selected',
          subtitleCueCount: null,
          subtitleLastCueEndMs: null,
          subtitleParseError: null,
          subtitleParsedAt: null,
          updatedAt: now,
        })
        .where(eq(projectsTable.id, projectId))
        .run();
    })();

    const project = orm.select().from(projectsTable).where(eq(projectsTable.id, projectId)).get();
    if (!project) {
      throw new AppError('PROJECT_NOT_FOUND', 'Project not found after subtitle path update.');
    }
    return this.mapProject(project);
  }

  public updateProjectSubtitleState(projectId: string, outcome: SubtitlePersistOutcome): void {
    const orm = this.ensureOrm();
    const now = Date.now();
    orm
      .update(projectsTable)
      .set({
        subtitleStatus: outcome.subtitleStatus,
        subtitleCueCount: outcome.cueCount,
        subtitleLastCueEndMs: outcome.lastCueEndMs,
        subtitleParseError: outcome.parseError,
        subtitleParsedAt: outcome.parsedAt,
        updatedAt: now,
      })
      .where(eq(projectsTable.id, projectId))
      .run();
  }

  public persistSubtitleResult(
    projectId: string,
    parsedSubtitlePath: string,
    outcome: SubtitlePersistOutcome,
    doc: SubtitleDocument | null,
  ): ProjectRecord {
    const db = this.ensureDb();
    const orm = this.ensureOrm();

    const txn = db.transaction(() => {
      const current = orm
        .select({ subtitlePath: projectsTable.subtitlePath })
        .from(projectsTable)
        .where(eq(projectsTable.id, projectId))
        .get();

      if (!current || current.subtitlePath !== parsedSubtitlePath) {
        // clearForProject ran concurrently — discard stale parse result.
        const row = orm.select().from(projectsTable).where(eq(projectsTable.id, projectId)).get();
        return row ? this.mapProject(row) : null;
      }

      this.updateProjectSubtitleState(projectId, outcome);

      if (doc !== null) {
        this.upsertSubtitleDocument(projectId, doc);
      } else {
        this.clearSubtitleDocument(projectId);
      }

      const updated = orm
        .select()
        .from(projectsTable)
        .where(eq(projectsTable.id, projectId))
        .get();
      return updated ? this.mapProject(updated) : null;
    });

    const result = txn();
    if (!result) {
      throw new AppError('PROJECT_NOT_FOUND', 'Project not found during subtitle result persist.');
    }
    return result;
  }

  public getSubtitleDocument(projectId: string): SubtitleDocument | null {
    const orm = this.ensureOrm();
    const row = orm
      .select()
      .from(subtitleDocumentsTable)
      .where(eq(subtitleDocumentsTable.projectId, projectId))
      .get();

    if (!row) return null;

    const cues = JSON.parse(row.cuesJson) as SubtitleDocument['cues'];
    const warnings = JSON.parse(row.warningsJson) as SubtitleDocument['warnings'];

    const summary: SubtitleDocument['summary'] = {
      cueCount: cues.length,
      firstCueStartMs: cues[0]?.startMs ?? null,
      lastCueEndMs: cues[cues.length - 1]?.endMs ?? null,
      totalTextLength: cues.reduce((sum, c) => sum + c.text.length, 0),
      warningCount: warnings.length,
    };

    return {
      schemaVersion: row.schemaVersion as 1,
      sourceFormat: row.sourceFormat as 'srt' | 'vtt',
      sourceEncoding: row.sourceEncoding,
      cues,
      warnings,
      summary,
      parsedAt: row.parsedAt,
    };
  }

  public updateProjectSyncStatus(projectId: string, data: SyncStatusUpdate): void {
    const orm = this.ensureOrm();
    const now = Date.now();
    orm
      .update(projectsTable)
      .set({
        syncStatus: data.syncStatus,
        syncCheckedAt: data.syncCheckedAt,
        syncWarningsJson: data.syncWarnings.length > 0 ? JSON.stringify(data.syncWarnings) : null,
        syncAnalysisVersion: data.syncAnalysisVersion,
        updatedAt: now,
      })
      .where(eq(projectsTable.id, projectId))
      .run();
  }

  // Internal helper: removes only the subtitle_documents row. Project-row state is managed by the
  // calling transaction (setProjectSubtitlePath, deleteProject, persistSubtitleResult).
  private clearSubtitleDocument(projectId: string): void {
    const orm = this.ensureOrm();
    orm.delete(subtitleDocumentsTable).where(eq(subtitleDocumentsTable.projectId, projectId)).run();
  }

  private upsertSubtitleDocument(projectId: string, doc: SubtitleDocument): void {
    const db = this.ensureDb();
    // Drizzle ORM does not support INSERT OR REPLACE / ON CONFLICT DO UPDATE; raw prepare used.
    db.prepare(
      `INSERT INTO subtitle_documents
        (project_id, schema_version, source_format, source_encoding, cues_json, warnings_json, parsed_at)
       VALUES
        (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(project_id) DO UPDATE SET
        schema_version = excluded.schema_version,
        source_format  = excluded.source_format,
        source_encoding = excluded.source_encoding,
        cues_json      = excluded.cues_json,
        warnings_json  = excluded.warnings_json,
        parsed_at      = excluded.parsed_at`,
    ).run(
      projectId,
      doc.schemaVersion,
      doc.sourceFormat,
      doc.sourceEncoding,
      JSON.stringify(doc.cues),
      JSON.stringify(doc.warnings),
      doc.parsedAt,
    );
  }

  public ensureAiProviderConfigRow(): void {
    const orm = this.ensureOrm();
    const existing = orm
      .select({ id: aiProviderConfigTable.id })
      .from(aiProviderConfigTable)
      .where(eq(aiProviderConfigTable.id, AI_CONFIG_ID))
      .get();
    if (existing) return;
    const now = Date.now();
    orm
      .insert(aiProviderConfigTable)
      .values({
        id: AI_CONFIG_ID,
        providerType: 'openai_compatible',
        baseUrl: 'https://api.openai.com',
        model: 'gpt-4o-mini',
        isConfigured: false,
        createdAt: now,
        updatedAt: now,
      })
      .run();
  }

  public ensureAiSecretsRow(): void {
    const db = this.ensureDb();
    const now = Date.now();
    db.prepare(
      `INSERT OR IGNORE INTO ai_secrets (id, encrypted_key, updated_at) VALUES (?, NULL, ?)`,
    ).run(AI_SECRETS_ID, now);
  }

  public getAiProviderConfig(): AiProviderConfigRow {
    const orm = this.ensureOrm();
    const row = orm
      .select()
      .from(aiProviderConfigTable)
      .where(eq(aiProviderConfigTable.id, AI_CONFIG_ID))
      .get();
    if (!row) {
      throw new AppError('AI_CONFIG_NOT_FOUND', 'AI provider config row not found.');
    }
    return {
      id: row.id,
      providerType: row.providerType,
      baseUrl: row.baseUrl,
      model: row.model,
      isConfigured: Boolean(row.isConfigured),
      consentRecordedAt: row.consentRecordedAt ?? null,
      lastTestStatus: row.lastTestStatus ?? null,
      lastTestAt: row.lastTestAt ?? null,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  public updateAiProviderConfig(update: AiProviderConfigUpdate): void {
    const orm = this.ensureOrm();
    orm
      .update(aiProviderConfigTable)
      .set({ ...update, updatedAt: update.updatedAt ?? Date.now() })
      .where(eq(aiProviderConfigTable.id, AI_CONFIG_ID))
      .run();
  }

  public getAiSecretBlob(): Buffer | null {
    const db = this.ensureDb();
    const row = db
      .prepare(`SELECT encrypted_key FROM ai_secrets WHERE id = ?`)
      .get(AI_SECRETS_ID) as { encrypted_key: Buffer | null } | undefined;
    return row?.encrypted_key ?? null;
  }

  public setAiSecretBlob(
    blob: Buffer,
    config: { baseUrl: string; model: string },
    now: number,
  ): void {
    const db = this.ensureDb();
    db.transaction(() => {
      db.prepare(
        `INSERT INTO ai_secrets (id, encrypted_key, updated_at) VALUES (?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET encrypted_key = excluded.encrypted_key, updated_at = excluded.updated_at`,
      ).run(AI_SECRETS_ID, blob, now);
      db.prepare(
        `UPDATE ai_provider_config SET base_url = ?, model = ?, is_configured = 1,
         last_test_status = NULL, last_test_at = NULL, updated_at = ? WHERE id = ?`,
      ).run(config.baseUrl, config.model, now, AI_CONFIG_ID);
    })();
  }

  public clearAiSecretBlob(): void {
    const db = this.ensureDb();
    const now = Date.now();
    db.transaction(() => {
      db.prepare(`UPDATE ai_secrets SET encrypted_key = NULL, updated_at = ? WHERE id = ?`).run(
        now,
        AI_SECRETS_ID,
      );
      db.prepare(
        `UPDATE ai_provider_config SET is_configured = 0, last_test_status = NULL,
         last_test_at = NULL, consent_recorded_at = NULL, updated_at = ? WHERE id = ?`,
      ).run(now, AI_CONFIG_ID);
    })();
  }

  public updateCandidateGenerationStatus(
    projectId: string,
    update: {
      candidateGenerationStatus: string;
      candidateGenerationError: string | null;
      candidateGeneratedAt: number | null;
    },
  ): void {
    const orm = this.ensureOrm();
    orm
      .update(projectsTable)
      .set({
        candidateGenerationStatus: update.candidateGenerationStatus,
        candidateGenerationError: update.candidateGenerationError,
        candidateGeneratedAt: update.candidateGeneratedAt,
        updatedAt: Date.now(),
      })
      .where(eq(projectsTable.id, projectId))
      .run();
  }

  public clearAndInsertCandidates(
    projectId: string,
    rows: Array<typeof clipCandidatesTable.$inferInsert>,
  ): void {
    const db = this.ensureDb();
    const orm = this.ensureOrm();
    db.transaction(() => {
      orm.delete(clipCandidatesTable).where(eq(clipCandidatesTable.projectId, projectId)).run();
      if (rows.length > 0) {
        orm.insert(clipCandidatesTable).values(rows).run();
      }
    })();
  }

  public listCandidatesForProject(projectId: string): {
    candidates: ClipCandidate[];
    generationStatus: CandidateGenerationStatus | null;
    generationError: string | null;
    generatedAt: number | null;
  } {
    const orm = this.ensureOrm();
    const project = orm
      .select({
        candidateGenerationStatus: projectsTable.candidateGenerationStatus,
        candidateGenerationError: projectsTable.candidateGenerationError,
        candidateGeneratedAt: projectsTable.candidateGeneratedAt,
      })
      .from(projectsTable)
      .where(eq(projectsTable.id, projectId))
      .get();

    if (!project) {
      throw new AppError('PROJECT_NOT_FOUND', 'Project not found.');
    }

    const dbRows = orm
      .select()
      .from(clipCandidatesTable)
      .where(eq(clipCandidatesTable.projectId, projectId))
      .orderBy(asc(clipCandidatesTable.sortOrder))
      .all();

    const candidates: ClipCandidate[] = dbRows.map((r) => ({
      id: r.id,
      projectId: r.projectId,
      generationId: r.generationId,
      candidateStatus: r.candidateStatus as CandidateStatus,
      startMs: r.startMs,
      endMs: r.endMs,
      title: r.title,
      reason: r.reason,
      scoreRaw: r.scoreRaw,
      sortOrder: r.sortOrder,
      modelId: r.modelId,
      promptVersion: r.promptVersion,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }));

    return {
      candidates,
      generationStatus: (project.candidateGenerationStatus ?? null) as CandidateGenerationStatus | null,
      generationError: project.candidateGenerationError ?? null,
      generatedAt: project.candidateGeneratedAt ?? null,
    };
  }

  public updateCandidateStatus(candidateId: string, status: CandidateStatus): void {
    const orm = this.ensureOrm();
    orm
      .update(clipCandidatesTable)
      .set({ candidateStatus: status, updatedAt: Date.now() })
      .where(eq(clipCandidatesTable.id, candidateId))
      .run();
  }

  private ensureDb(): Database.Database {
    if (!this.db) {
      throw new AppError('DATABASE_NOT_INITIALIZED', 'Database service is not initialized.');
    }
    return this.db;
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
