// @vitest-environment node
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { DatabaseService } from '@main/services/database/databaseService';
import { ClipCandidateService } from '@main/services/ai/clipCandidateService';
import type { AiService, StructuredResult } from '@main/services/ai/aiService';
import type { AiCandidatesOutput } from '@shared/schemas/candidates';
import { AppError } from '@main/utils/errors';

const createDbPath = () => {
  const dir = mkdtempSync(join(tmpdir(), 'scenesift-candidate-'));
  return {
    dir,
    dbPath: join(dir, 'app.sqlite'),
    migrationsFolder: join(process.cwd(), 'src', 'database', 'migrations'),
  };
};

const VALID_UUID = '11111111-1111-4111-8111-111111111111';

const makeAiServiceMock = (
  result?: AiCandidatesOutput | Error,
  configStatus = 'available',
): AiService => ({
  getConfigurationStatus: vi.fn().mockReturnValue(configStatus),
  testConnection: vi.fn(),
  cancelTestConnection: vi.fn(),
  cancelRequest: vi.fn(),
  executeStructuredRequest: vi.fn(async () => {
    if (result instanceof Error) throw result;
    const data = result ?? {
      candidates: [
        { startMs: 1000, endMs: 10000, title: 'Test clip', reason: 'Good moment', score: 0.8 },
      ],
    };
    return { data, usage: { promptTokens: null, completionTokens: null, totalTokens: null } } satisfies StructuredResult<AiCandidatesOutput>;
  }),
});

const setupDb = () => {
  const { dir, dbPath, migrationsFolder } = createDbPath();
  const db = new DatabaseService(dbPath, migrationsFolder);
  db.initialize();
  return { db, dir };
};

const createProjectWithSubtitle = (db: DatabaseService) => {
  const project = db.createProject({
    name: 'Test Project',
    video: { path: '/tmp/video.mp4', name: 'video.mp4', extension: '.mp4' },
    subtitle: undefined,
    outputDirectory: undefined,
  });

  db.setProjectSubtitlePath(project.id, '/tmp/subs.srt');
  db.persistSubtitleResult(
    project.id,
    '/tmp/subs.srt',
    {
      subtitleStatus: 'ready',
      cueCount: 3,
      lastCueEndMs: 30_000,
      parseError: null,
      parsedAt: Date.now(),
    },
    {
      schemaVersion: 1,
      sourceFormat: 'srt',
      sourceEncoding: 'utf-8',
      cues: [
        { startMs: 0, endMs: 5000, text: 'Hello world' },
        { startMs: 5500, endMs: 10000, text: 'This is a test' },
        { startMs: 11000, endMs: 15000, text: 'Final cue' },
      ],
      warnings: [],
      summary: { cueCount: 3, firstCueStartMs: 0, lastCueEndMs: 15000, totalTextLength: 35, warningCount: 0 },
      parsedAt: Date.now(),
    },
  );
  return project;
};

describe('ClipCandidateService', () => {
  describe('generateCandidates', () => {
    it('stores candidates on success', async () => {
      const { db, dir } = setupDb();
      const project = createProjectWithSubtitle(db);
      const ai = makeAiServiceMock();
      const svc = new ClipCandidateService(db, ai);

      const result = await svc.generateCandidates(project.id);

      expect(result.ok).toBe(true);
      expect(result.candidateCount).toBe(1);
      expect(typeof result.generationId).toBe('string');

      const listed = svc.listCandidates(project.id);
      expect(listed.candidates).toHaveLength(1);
      expect(listed.candidates[0].title).toBe('Test clip');
      expect(listed.generationStatus).toBe('done');
      expect(listed.generationError).toBeNull();

      db.close();
      rmSync(dir, { recursive: true, force: true });
    });

    it('sets generation status to failed on AI error', async () => {
      const { db, dir } = setupDb();
      const project = createProjectWithSubtitle(db);
      const ai = makeAiServiceMock(new AppError('AI_INTERNAL_ERROR', 'Test error'));
      const svc = new ClipCandidateService(db, ai);

      await expect(svc.generateCandidates(project.id)).rejects.toThrow();

      const listed = svc.listCandidates(project.id);
      expect(listed.generationStatus).toBe('failed');
      expect(listed.generationError).toBe('AI_INTERNAL_ERROR');
      expect(listed.candidates).toHaveLength(0);

      db.close();
      rmSync(dir, { recursive: true, force: true });
    });

    it('throws PROJECT_NOT_FOUND for unknown projectId', async () => {
      const { db, dir } = setupDb();
      const ai = makeAiServiceMock();
      const svc = new ClipCandidateService(db, ai);

      await expect(svc.generateCandidates(randomUUID())).rejects.toMatchObject({
        code: 'PROJECT_NOT_FOUND',
      });

      db.close();
      rmSync(dir, { recursive: true, force: true });
    });

    it('throws AI_NOT_CONFIGURED when AI not configured', async () => {
      const { db, dir } = setupDb();
      const project = createProjectWithSubtitle(db);
      const ai = makeAiServiceMock(undefined, 'unconfigured');
      const svc = new ClipCandidateService(db, ai);

      await expect(svc.generateCandidates(project.id)).rejects.toMatchObject({
        code: 'AI_NOT_CONFIGURED',
      });

      db.close();
      rmSync(dir, { recursive: true, force: true });
    });

    it('throws AI_PROVIDER_UNAVAILABLE when AI not available', async () => {
      const { db, dir } = setupDb();
      const project = createProjectWithSubtitle(db);
      const ai = makeAiServiceMock(undefined, 'unavailable');
      const svc = new ClipCandidateService(db, ai);

      await expect(svc.generateCandidates(project.id)).rejects.toMatchObject({
        code: 'AI_PROVIDER_UNAVAILABLE',
      });

      db.close();
      rmSync(dir, { recursive: true, force: true });
    });

    it('filters candidates with endMs exceeding video duration', async () => {
      const { db, dir } = setupDb();
      const project = createProjectWithSubtitle(db);
      const ai = makeAiServiceMock({
        candidates: [
          { startMs: 0, endMs: 5000, title: 'Valid', reason: 'ok', score: 0.9 },
          { startMs: 14000, endMs: 20000, title: 'Exceeds duration', reason: 'bad', score: 0.8 },
        ],
      });
      const svc = new ClipCandidateService(db, ai);

      const result = await svc.generateCandidates(project.id);
      expect(result.candidateCount).toBe(1);
      const listed = svc.listCandidates(project.id);
      expect(listed.candidates[0].title).toBe('Valid');

      db.close();
      rmSync(dir, { recursive: true, force: true });
    });

    it('throws SUBTITLE_NOT_READY when subtitle not parsed', async () => {
      const { db, dir } = setupDb();
      const project = db.createProject({
        name: 'No subtitle',
        video: { path: '/tmp/v.mp4', name: 'v.mp4', extension: '.mp4' },
        subtitle: undefined,
        outputDirectory: undefined,
      });
      const ai = makeAiServiceMock();
      const svc = new ClipCandidateService(db, ai);

      await expect(svc.generateCandidates(project.id)).rejects.toMatchObject({
        code: 'SUBTITLE_NOT_READY',
      });

      db.close();
      rmSync(dir, { recursive: true, force: true });
    });

    it('throws GENERATION_ALREADY_IN_PROGRESS if called twice concurrently', async () => {
      const { db, dir } = setupDb();
      const project = createProjectWithSubtitle(db);

      let resolveFirst!: (v: StructuredResult<AiCandidatesOutput>) => void;
      const firstResult: StructuredResult<AiCandidatesOutput> = {
        data: { candidates: [{ startMs: 0, endMs: 5000, title: 'x', reason: 'y', score: 0.5 }] },
        usage: { promptTokens: null, completionTokens: null, totalTokens: null },
      };
      const slowAi: AiService = {
        getConfigurationStatus: vi.fn().mockReturnValue('available'),
        testConnection: vi.fn(),
        cancelTestConnection: vi.fn(),
        cancelRequest: vi.fn(),
        executeStructuredRequest: vi.fn(() => new Promise((res) => { resolveFirst = res; })),
      };
      const svc = new ClipCandidateService(db, slowAi);

      const first = svc.generateCandidates(project.id);
      await expect(svc.generateCandidates(project.id)).rejects.toMatchObject({
        code: 'GENERATION_ALREADY_IN_PROGRESS',
      });

      resolveFirst(firstResult);
      await first;

      db.close();
      rmSync(dir, { recursive: true, force: true });
    });

    it('clears previous candidates when regenerating', async () => {
      const { db, dir } = setupDb();
      const project = createProjectWithSubtitle(db);
      const twoClipsAi = makeAiServiceMock({
        candidates: [
          { startMs: 0, endMs: 5000, title: 'Clip A', reason: 'r', score: 0.9 },
          { startMs: 5000, endMs: 10000, title: 'Clip B', reason: 'r2', score: 0.7 },
        ],
      });
      const svc = new ClipCandidateService(db, twoClipsAi);

      await svc.generateCandidates(project.id);
      expect(svc.listCandidates(project.id).candidates).toHaveLength(2);

      const oneClipAi = makeAiServiceMock({
        candidates: [{ startMs: 0, endMs: 5000, title: 'Only clip', reason: 'r', score: 0.6 }],
      });
      const svc2 = new ClipCandidateService(db, oneClipAi);
      await svc2.generateCandidates(project.id);

      const listed = svc2.listCandidates(project.id);
      expect(listed.candidates).toHaveLength(1);
      expect(listed.candidates[0].title).toBe('Only clip');

      db.close();
      rmSync(dir, { recursive: true, force: true });
    });
  });

  describe('cancelGeneration', () => {
    it('returns cancelled:false when no generation active', () => {
      const { db, dir } = setupDb();
      const ai = makeAiServiceMock();
      const svc = new ClipCandidateService(db, ai);

      expect(svc.cancelGeneration(VALID_UUID)).toEqual({ cancelled: false });

      db.close();
      rmSync(dir, { recursive: true, force: true });
    });
  });

  describe('updateCandidateStatus', () => {
    it('updates candidate status to approved', async () => {
      const { db, dir } = setupDb();
      const project = createProjectWithSubtitle(db);
      const svc = new ClipCandidateService(db, makeAiServiceMock());

      await svc.generateCandidates(project.id);
      const { candidates } = svc.listCandidates(project.id);
      const candidateId = candidates[0].id;

      svc.updateCandidateStatus(candidateId, 'approved');

      const updated = svc.listCandidates(project.id);
      expect(updated.candidates[0].candidateStatus).toBe('approved');

      db.close();
      rmSync(dir, { recursive: true, force: true });
    });

    it('updates candidate status to rejected', async () => {
      const { db, dir } = setupDb();
      const project = createProjectWithSubtitle(db);
      const svc = new ClipCandidateService(db, makeAiServiceMock());

      await svc.generateCandidates(project.id);
      const { candidates } = svc.listCandidates(project.id);

      svc.updateCandidateStatus(candidates[0].id, 'rejected');

      const updated = svc.listCandidates(project.id);
      expect(updated.candidates[0].candidateStatus).toBe('rejected');

      db.close();
      rmSync(dir, { recursive: true, force: true });
    });

    it('updates candidate status to skipped', async () => {
      const { db, dir } = setupDb();
      const project = createProjectWithSubtitle(db);
      const svc = new ClipCandidateService(db, makeAiServiceMock());

      await svc.generateCandidates(project.id);
      const { candidates } = svc.listCandidates(project.id);

      svc.updateCandidateStatus(candidates[0].id, 'skipped');

      const updated = svc.listCandidates(project.id);
      expect(updated.candidates[0].candidateStatus).toBe('skipped');

      db.close();
      rmSync(dir, { recursive: true, force: true });
    });
  });

  describe('updateCandidateNotes', () => {
    it('sets notes on a candidate', async () => {
      const { db, dir } = setupDb();
      const project = createProjectWithSubtitle(db);
      const svc = new ClipCandidateService(db, makeAiServiceMock());

      await svc.generateCandidates(project.id);
      const { candidates } = svc.listCandidates(project.id);
      const candidateId = candidates[0].id;

      svc.updateCandidateNotes(candidateId, 'Great moment');

      const updated = svc.listCandidates(project.id);
      expect(updated.candidates[0].notes).toBe('Great moment');

      db.close();
      rmSync(dir, { recursive: true, force: true });
    });

    it('clears notes when set to null', async () => {
      const { db, dir } = setupDb();
      const project = createProjectWithSubtitle(db);
      const svc = new ClipCandidateService(db, makeAiServiceMock());

      await svc.generateCandidates(project.id);
      const { candidates } = svc.listCandidates(project.id);
      const candidateId = candidates[0].id;

      svc.updateCandidateNotes(candidateId, 'temp');
      svc.updateCandidateNotes(candidateId, null);

      const updated = svc.listCandidates(project.id);
      expect(updated.candidates[0].notes).toBeNull();

      db.close();
      rmSync(dir, { recursive: true, force: true });
    });

    it('notes persist across service restart', async () => {
      const { dir, dbPath, migrationsFolder } = createDbPath();
      const db = new DatabaseService(dbPath, migrationsFolder);
      db.initialize();

      const project = createProjectWithSubtitle(db);
      const svc = new ClipCandidateService(db, makeAiServiceMock());
      await svc.generateCandidates(project.id);
      const { candidates } = svc.listCandidates(project.id);
      const candidateId = candidates[0].id;

      svc.updateCandidateNotes(candidateId, 'Persistent note');
      db.close();

      const db2 = new DatabaseService(dbPath, migrationsFolder);
      db2.initialize();
      const svc2 = new ClipCandidateService(db2, makeAiServiceMock());
      const updated = svc2.listCandidates(project.id);
      expect(updated.candidates[0].notes).toBe('Persistent note');

      db2.close();
      rmSync(dir, { recursive: true, force: true });
    });
  });

  describe('updateCandidateTiming', () => {
    it('updates startMs and endMs on a candidate', async () => {
      const { db, dir } = setupDb();
      const project = createProjectWithSubtitle(db);
      const svc = new ClipCandidateService(db, makeAiServiceMock());

      await svc.generateCandidates(project.id);
      const { candidates } = svc.listCandidates(project.id);
      const candidateId = candidates[0].id;

      svc.updateCandidateTiming(candidateId, 1000, 5000);

      const updated = svc.listCandidates(project.id);
      expect(updated.candidates[0].startMs).toBe(1000);
      expect(updated.candidates[0].endMs).toBe(5000);

      db.close();
      rmSync(dir, { recursive: true, force: true });
    });

    it('timing persists across service restart', async () => {
      const { dir, dbPath, migrationsFolder } = createDbPath();
      const db = new DatabaseService(dbPath, migrationsFolder);
      db.initialize();

      const project = createProjectWithSubtitle(db);
      const svc = new ClipCandidateService(db, makeAiServiceMock());
      await svc.generateCandidates(project.id);
      const { candidates } = svc.listCandidates(project.id);
      const candidateId = candidates[0].id;

      svc.updateCandidateTiming(candidateId, 2000, 8000);
      db.close();

      const db2 = new DatabaseService(dbPath, migrationsFolder);
      db2.initialize();
      const svc2 = new ClipCandidateService(db2, makeAiServiceMock());
      const updated = svc2.listCandidates(project.id);
      expect(updated.candidates[0].startMs).toBe(2000);
      expect(updated.candidates[0].endMs).toBe(8000);

      db2.close();
      rmSync(dir, { recursive: true, force: true });
    });
  });

  describe('listCandidates', () => {
    it('returns null generationStatus before any generation', () => {
      const { db, dir } = setupDb();
      const project = createProjectWithSubtitle(db);
      const svc = new ClipCandidateService(db, makeAiServiceMock());

      const result = svc.listCandidates(project.id);
      expect(result.generationStatus).toBeNull();
      expect(result.candidates).toHaveLength(0);

      db.close();
      rmSync(dir, { recursive: true, force: true });
    });

    it('throws PROJECT_NOT_FOUND for unknown projectId', () => {
      const { db, dir } = setupDb();
      const svc = new ClipCandidateService(db, makeAiServiceMock());

      expect(() => svc.listCandidates(randomUUID())).toThrow();

      db.close();
      rmSync(dir, { recursive: true, force: true });
    });
  });
});
