// @vitest-environment node
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { DatabaseService } from '@main/services/database/databaseService';
import { ClipCueService } from '@main/services/ai/clipCueService';
import { AppError } from '@main/utils/errors';
import type { SubtitleCue } from '@shared/schemas/subtitle';

const createDbPath = () => {
  const dir = mkdtempSync(join(tmpdir(), 'scenesift-cues-'));
  return {
    dir,
    dbPath: join(dir, 'app.sqlite'),
    migrationsFolder: join(process.cwd(), 'src', 'database', 'migrations'),
  };
};

async function buildDb(dbPath: string, migrationsFolder: string) {
  const db = new DatabaseService(dbPath, migrationsFolder);
  await db.initialize();
  const project = db.createProject({
    name: 'Test Project',
    video: { path: '/tmp/video.mp4', name: 'video.mp4', extension: '.mp4' },
    subtitle: undefined,
    outputDirectory: undefined,
  });
  db.updateProjectInspection(project.id, {
    status: 'ready',
    mediaMetadata: {
      durationSeconds: 600,
      width: 1920,
      height: 1080,
      videoCodec: 'h264',
      fps: 24,
      bitRateBps: 8_000_000,
      fileSizeBytes: 500_000_000,
      inspectedAt: Date.now(),
    },
    inspectionError: null,
  });
  return { db, projectId: project.id };
}

function buildCandidateRow(db: DatabaseService, projectId: string, candidateId: string, startMs = 10_000, endMs = 30_000) {
  const now = Date.now();
  db.clearAndInsertCandidates(projectId, [
    {
      id: candidateId,
      projectId,
      generationId: randomUUID(),
      candidateStatus: 'approved',
      startMs,
      endMs,
      title: 'Test candidate',
      reason: 'Good',
      scoreRaw: 0.9,
      sortOrder: 0,
      modelId: 'test',
      promptVersion: '1',
      notes: null,
      createdAt: now,
      updatedAt: now,
    },
  ]);
}

function buildSubtitleDoc(db: DatabaseService, projectId: string, cues: SubtitleCue[]) {
  const now = Date.now();
  db.setProjectSubtitlePath(projectId, '/tmp/subs.srt');
  db.persistSubtitleResult(
    projectId,
    '/tmp/subs.srt',
    {
      subtitleStatus: 'ready',
      cueCount: cues.length,
      lastCueEndMs: cues.at(-1)?.endMs ?? 0,
      parseError: null,
      parsedAt: now,
    },
    {
      schemaVersion: 1,
      sourceFormat: 'srt',
      sourceEncoding: 'utf-8',
      cues,
      warnings: [],
      summary: {
        cueCount: cues.length,
        firstCueStartMs: cues[0]?.startMs ?? 0,
        lastCueEndMs: cues.at(-1)?.endMs ?? 0,
        totalTextLength: cues.reduce((s, c) => s + c.text.length, 0),
        warningCount: 0,
      },
      parsedAt: now,
    },
  );
}

const TEST_CUES: SubtitleCue[] = [
  { index: 0, startMs: 0, endMs: 5_000, text: 'Before clip' },
  { index: 1, startMs: 5_000, endMs: 15_000, text: 'Straddles start' },
  { index: 2, startMs: 12_000, endMs: 20_000, text: 'Fully inside' },
  { index: 3, startMs: 25_000, endMs: 35_000, text: 'Straddles end' },
  { index: 4, startMs: 32_000, endMs: 40_000, text: 'After clip' },
];

describe('extractCuesForClip (via generateClipCues)', () => {
  it('excludes cues entirely before clip', async () => {
    const { dir, dbPath, migrationsFolder } = createDbPath();
    try {
      const { db, projectId } = await buildDb(dbPath, migrationsFolder);
      const candidateId = randomUUID();
      buildCandidateRow(db, projectId, candidateId, 10_000, 30_000);
      buildSubtitleDoc(db, projectId, [{ index: 0, startMs: 0, endMs: 5_000, text: 'Before' }]);
      const svc = new ClipCueService(db);
      const result = svc.generateClipCues(candidateId);
      expect(result.cueCount).toBe(0);
      const { cues } = svc.listClipCues(candidateId);
      expect(cues).toHaveLength(0);
      db.close();
    } finally {
      rmSync(dir, { recursive: true });
    }
  });

  it('excludes cues entirely after clip', async () => {
    const { dir, dbPath, migrationsFolder } = createDbPath();
    try {
      const { db, projectId } = await buildDb(dbPath, migrationsFolder);
      const candidateId = randomUUID();
      buildCandidateRow(db, projectId, candidateId, 10_000, 30_000);
      buildSubtitleDoc(db, projectId, [{ index: 0, startMs: 35_000, endMs: 40_000, text: 'After' }]);
      const svc = new ClipCueService(db);
      expect(svc.generateClipCues(candidateId).cueCount).toBe(0);
      db.close();
    } finally {
      rmSync(dir, { recursive: true });
    }
  });

  it('includes cue fully inside clip, rebased to 0-origin', async () => {
    const { dir, dbPath, migrationsFolder } = createDbPath();
    try {
      const { db, projectId } = await buildDb(dbPath, migrationsFolder);
      const candidateId = randomUUID();
      buildCandidateRow(db, projectId, candidateId, 10_000, 30_000);
      buildSubtitleDoc(db, projectId, [{ index: 0, startMs: 12_000, endMs: 18_000, text: 'Inside' }]);
      const svc = new ClipCueService(db);
      svc.generateClipCues(candidateId);
      const { cues } = svc.listClipCues(candidateId);
      expect(cues).toHaveLength(1);
      expect(cues[0]!.startMs).toBe(2_000);   // 12000-10000
      expect(cues[0]!.endMs).toBe(8_000);     // 18000-10000
      expect(cues[0]!.text).toBe('Inside');
      expect(cues[0]!.sequenceIndex).toBe(1);
      db.close();
    } finally {
      rmSync(dir, { recursive: true });
    }
  });

  it('clamps cue straddling clip start', async () => {
    const { dir, dbPath, migrationsFolder } = createDbPath();
    try {
      const { db, projectId } = await buildDb(dbPath, migrationsFolder);
      const candidateId = randomUUID();
      buildCandidateRow(db, projectId, candidateId, 10_000, 30_000);
      buildSubtitleDoc(db, projectId, [{ index: 0, startMs: 5_000, endMs: 15_000, text: 'Straddles start' }]);
      const svc = new ClipCueService(db);
      svc.generateClipCues(candidateId);
      const { cues } = svc.listClipCues(candidateId);
      expect(cues[0]!.startMs).toBe(0);      // clamped and rebased
      expect(cues[0]!.endMs).toBe(5_000);    // 15000-10000
      db.close();
    } finally {
      rmSync(dir, { recursive: true });
    }
  });

  it('clamps cue straddling clip end', async () => {
    const { dir, dbPath, migrationsFolder } = createDbPath();
    try {
      const { db, projectId } = await buildDb(dbPath, migrationsFolder);
      const candidateId = randomUUID();
      buildCandidateRow(db, projectId, candidateId, 10_000, 30_000);
      buildSubtitleDoc(db, projectId, [{ index: 0, startMs: 25_000, endMs: 35_000, text: 'Straddles end' }]);
      const svc = new ClipCueService(db);
      svc.generateClipCues(candidateId);
      const { cues } = svc.listClipCues(candidateId);
      expect(cues[0]!.startMs).toBe(15_000); // 25000-10000
      expect(cues[0]!.endMs).toBe(20_000);   // capped at clip duration 20000
      db.close();
    } finally {
      rmSync(dir, { recursive: true });
    }
  });

  it('processes multiple cues, assigns sequential indices, correct rebase', async () => {
    const { dir, dbPath, migrationsFolder } = createDbPath();
    try {
      const { db, projectId } = await buildDb(dbPath, migrationsFolder);
      const candidateId = randomUUID();
      buildCandidateRow(db, projectId, candidateId, 10_000, 30_000);
      buildSubtitleDoc(db, projectId, TEST_CUES);
      const svc = new ClipCueService(db);
      svc.generateClipCues(candidateId);
      const { cues } = svc.listClipCues(candidateId);
      // Straddles start (5000-15000), Fully inside (12000-20000), Straddles end (25000-35000)
      expect(cues).toHaveLength(3);
      expect(cues[0]!.sequenceIndex).toBe(1);
      expect(cues[1]!.sequenceIndex).toBe(2);
      expect(cues[2]!.sequenceIndex).toBe(3);
      db.close();
    } finally {
      rmSync(dir, { recursive: true });
    }
  });

  it('clamps cue spanning entire clip (both boundaries clamped)', async () => {
    const { dir, dbPath, migrationsFolder } = createDbPath();
    try {
      const { db, projectId } = await buildDb(dbPath, migrationsFolder);
      const candidateId = randomUUID();
      buildCandidateRow(db, projectId, candidateId, 10_000, 30_000);
      buildSubtitleDoc(db, projectId, [{ index: 0, startMs: 5_000, endMs: 35_000, text: 'Spans clip' }]);
      const svc = new ClipCueService(db);
      svc.generateClipCues(candidateId);
      const { cues } = svc.listClipCues(candidateId);
      expect(cues).toHaveLength(1);
      expect(cues[0]!.startMs).toBe(0);       // clamped to clipStart, rebased to 0
      expect(cues[0]!.endMs).toBe(20_000);    // clamped to clipEnd, rebased to duration
      db.close();
    } finally {
      rmSync(dir, { recursive: true });
    }
  });

  it('excludes cue that becomes zero-duration after clamping', async () => {
    const { dir, dbPath, migrationsFolder } = createDbPath();
    try {
      const { db, projectId } = await buildDb(dbPath, migrationsFolder);
      const candidateId = randomUUID();
      // Clip: 10000–30000. Point-cue (startMs === endMs) inside clip.
      // Passes both boundary checks but clampedEnd === clampedStart → excluded.
      buildCandidateRow(db, projectId, candidateId, 10_000, 30_000);
      buildSubtitleDoc(db, projectId, [{ index: 0, startMs: 15_000, endMs: 15_000, text: 'Point cue' }]);
      const svc = new ClipCueService(db);
      svc.generateClipCues(candidateId);
      const { cues } = svc.listClipCues(candidateId);
      expect(cues).toHaveLength(0);
      db.close();
    } finally {
      rmSync(dir, { recursive: true });
    }
  });

  it('generateClipCues is idempotent — second call replaces first', async () => {
    const { dir, dbPath, migrationsFolder } = createDbPath();
    try {
      const { db, projectId } = await buildDb(dbPath, migrationsFolder);
      const candidateId = randomUUID();
      buildCandidateRow(db, projectId, candidateId, 10_000, 30_000);
      buildSubtitleDoc(db, projectId, [{ index: 0, startMs: 12_000, endMs: 18_000, text: 'Only cue' }]);
      const svc = new ClipCueService(db);
      svc.generateClipCues(candidateId);
      svc.generateClipCues(candidateId);
      const { cues } = svc.listClipCues(candidateId);
      expect(cues).toHaveLength(1);
      db.close();
    } finally {
      rmSync(dir, { recursive: true });
    }
  });

  it('throws CANDIDATE_NOT_FOUND for unknown candidateId', async () => {
    const { dir, dbPath, migrationsFolder } = createDbPath();
    try {
      const { db } = await buildDb(dbPath, migrationsFolder);
      const svc = new ClipCueService(db);
      expect(() => svc.generateClipCues(randomUUID())).toThrow(AppError);
      db.close();
    } finally {
      rmSync(dir, { recursive: true });
    }
  });

  it('throws SUBTITLE_NOT_READY when no subtitle document', async () => {
    const { dir, dbPath, migrationsFolder } = createDbPath();
    try {
      const { db, projectId } = await buildDb(dbPath, migrationsFolder);
      const candidateId = randomUUID();
      buildCandidateRow(db, projectId, candidateId);
      const svc = new ClipCueService(db);
      expect(() => svc.generateClipCues(candidateId)).toThrow(AppError);
      db.close();
    } finally {
      rmSync(dir, { recursive: true });
    }
  });
});

describe('ClipCueService CRUD', () => {
  it('updateClipCue persists text and timing', async () => {
    const { dir, dbPath, migrationsFolder } = createDbPath();
    try {
      const { db, projectId } = await buildDb(dbPath, migrationsFolder);
      const candidateId = randomUUID();
      buildCandidateRow(db, projectId, candidateId);
      buildSubtitleDoc(db, projectId, [{ index: 0, startMs: 12_000, endMs: 18_000, text: 'Original' }]);
      const svc = new ClipCueService(db);
      svc.generateClipCues(candidateId);
      const before = svc.listClipCues(candidateId).cues[0]!;
      svc.updateClipCue(before.id, 1_000, 4_000, 'Updated');
      const after = svc.listClipCues(candidateId).cues[0]!;
      expect(after.startMs).toBe(1_000);
      expect(after.endMs).toBe(4_000);
      expect(after.text).toBe('Updated');
      db.close();
    } finally {
      rmSync(dir, { recursive: true });
    }
  });

  it('deleteClipCue removes cue', async () => {
    const { dir, dbPath, migrationsFolder } = createDbPath();
    try {
      const { db, projectId } = await buildDb(dbPath, migrationsFolder);
      const candidateId = randomUUID();
      buildCandidateRow(db, projectId, candidateId);
      buildSubtitleDoc(db, projectId, [
        { index: 0, startMs: 12_000, endMs: 18_000, text: 'A' },
        { index: 1, startMs: 19_000, endMs: 22_000, text: 'B' },
      ]);
      const svc = new ClipCueService(db);
      svc.generateClipCues(candidateId);
      const cueId = svc.listClipCues(candidateId).cues[0]!.id;
      svc.deleteClipCue(cueId);
      expect(svc.listClipCues(candidateId).cues).toHaveLength(1);
      db.close();
    } finally {
      rmSync(dir, { recursive: true });
    }
  });

  it('addClipCue inserts with next sequence index', async () => {
    const { dir, dbPath, migrationsFolder } = createDbPath();
    try {
      const { db, projectId } = await buildDb(dbPath, migrationsFolder);
      const candidateId = randomUUID();
      buildCandidateRow(db, projectId, candidateId);
      buildSubtitleDoc(db, projectId, [{ index: 0, startMs: 12_000, endMs: 18_000, text: 'Existing' }]);
      const svc = new ClipCueService(db);
      svc.generateClipCues(candidateId);
      const { cue } = svc.addClipCue(candidateId, 500, 2_000, 'New cue');
      expect(cue.sequenceIndex).toBe(2);
      expect(cue.startMs).toBe(500);
      expect(cue.endMs).toBe(2_000);
      expect(cue.text).toBe('New cue');
      db.close();
    } finally {
      rmSync(dir, { recursive: true });
    }
  });

  it('addClipCue on empty list starts at sequenceIndex 1', async () => {
    const { dir, dbPath, migrationsFolder } = createDbPath();
    try {
      const { db, projectId } = await buildDb(dbPath, migrationsFolder);
      const candidateId = randomUUID();
      buildCandidateRow(db, projectId, candidateId);
      const svc = new ClipCueService(db);
      const { cue } = svc.addClipCue(candidateId, 0, 1_000, 'First');
      expect(cue.sequenceIndex).toBe(1);
      db.close();
    } finally {
      rmSync(dir, { recursive: true });
    }
  });

  it('cues persist across DatabaseService close and reopen', async () => {
    const { dir, dbPath, migrationsFolder } = createDbPath();
    try {
      const { db, projectId } = await buildDb(dbPath, migrationsFolder);
      const candidateId = randomUUID();
      buildCandidateRow(db, projectId, candidateId);
      buildSubtitleDoc(db, projectId, [{ index: 0, startMs: 12_000, endMs: 18_000, text: 'Persistent' }]);
      const svc = new ClipCueService(db);
      svc.generateClipCues(candidateId);
      db.close();

      const db2 = new DatabaseService(dbPath, migrationsFolder);
      await db2.initialize();
      const svc2 = new ClipCueService(db2);
      const { cues } = svc2.listClipCues(candidateId);
      expect(cues).toHaveLength(1);
      expect(cues[0]!.text).toBe('Persistent');
      db2.close();
    } finally {
      rmSync(dir, { recursive: true });
    }
  });
});
