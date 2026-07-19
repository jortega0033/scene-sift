// @vitest-environment node
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { DatabaseService } from '@main/services/database/databaseService';
import { SynchronizationService } from '@main/services/synchronization/SynchronizationService';
import type { InspectionOutcome } from '@main/services/ffmpeg/ffmpegService';
import type { SubtitleDocument, SubtitlePersistOutcome } from '@shared/schemas/subtitle';

// ─── Test helpers ────────────────────────────────────────────────────────────

let tmpDir = '';
let dbPath = '';
let migrationsFolder = '';

const createTempDb = () => {
  tmpDir = mkdtempSync(join(tmpdir(), 'scenesift-sync-test-'));
  dbPath = join(tmpDir, 'app.sqlite');
  migrationsFolder = join(process.cwd(), 'src', 'database', 'migrations');
  const service = new DatabaseService(dbPath, migrationsFolder);
  service.initialize();
  return service;
};

const INSPECTION_READY: InspectionOutcome = {
  status: 'ready',
  mediaMetadata: {
    durationSeconds: 3600, // 1 hour = 3,600,000 ms
    width: 1920,
    height: 1080,
    videoCodec: 'h264',
    fps: 23.976,
    bitRateBps: 8_500_000,
    fileSizeBytes: 3_000_000_000,
    inspectedAt: Date.now() - 60_000,
  },
  inspectionError: null,
};

const buildSubtitleDoc = (
  cues: { startMs: number; endMs: number }[],
): SubtitleDocument => ({
  schemaVersion: 1,
  sourceFormat: 'srt',
  sourceEncoding: 'utf-8',
  cues: cues.map((c, i) => ({
    index: i,
    startMs: c.startMs,
    endMs: c.endMs,
    text: `Cue ${i}`,
    lines: [`Cue ${i}`],
  })),
  warnings: [],
  summary: {
    cueCount: cues.length,
    firstCueStartMs: cues[0]?.startMs ?? null,
    lastCueEndMs: cues[cues.length - 1]?.endMs ?? null,
    totalTextLength: cues.reduce((s, _, i) => s + `Cue ${i}`.length, 0),
    warningCount: 0,
  },
  parsedAt: Date.now() - 30_000,
});

const SUBTITLE_READY_OUTCOME: SubtitlePersistOutcome = {
  subtitleStatus: 'ready',
  cueCount: 10,
  lastCueEndMs: 3_500_000,
  parseError: null,
  parsedAt: Date.now() - 30_000,
};

// 10 well-spaced cues in a 1-hour video, last cue ends within 5s of video end → timing_ok
// (prevents LARGE_TAIL_GAP which fires when gap > 10_000ms)
const GOOD_CUES = Array.from({ length: 10 }, (_, i) => ({
  startMs: i * 355_000,
  endMs: i === 9 ? 3_595_000 : i * 355_000 + 300_000,
}));

describe('SynchronizationService', () => {
  let db: DatabaseService;
  let service: SynchronizationService;

  beforeEach(() => {
    db = createTempDb();
    service = new SynchronizationService(db);
  });

  afterEach(() => {
    db.close();
    rmSync(tmpDir, { recursive: true, force: true });
  });

  // ─── TC-PREREQ-01: Prerequisites not met → not_available ──────────────

  it('returns not_available when project does not exist', async () => {
    const result = await service.checkForProject('00000000-0000-4000-8000-000000000000');
    expect(result.syncStatus).toBe('not_available');
    expect(result.syncWarnings).toHaveLength(0);
    expect(result.syncCheckedAt).toBeNull();
  });

  it('returns not_available when video is not inspected (status = draft)', async () => {
    const project = db.createProject({
      name: 'Draft Project',
      video: { path: '/tmp/v.mp4', name: 'v.mp4', extension: '.mp4' },
      subtitle: undefined,
      outputDirectory: undefined,
    });

    const result = await service.checkForProject(project.id);
    expect(result.syncStatus).toBe('not_available');
  });

  it('returns not_available when subtitle is not ready (status = ready but no subtitle)', async () => {
    const project = db.createProject({
      name: 'No Subtitle Project',
      video: { path: '/tmp/v.mp4', name: 'v.mp4', extension: '.mp4' },
      subtitle: undefined,
      outputDirectory: undefined,
    });
    db.updateProjectInspection(project.id, INSPECTION_READY);

    const result = await service.checkForProject(project.id);
    expect(result.syncStatus).toBe('not_available');
  });

  // ─── TC-PREREQ-02: Prerequisites met, no timing issues → timing_ok ────

  it('returns timing_ok when inspection and subtitle are ready with good cues', async () => {
    const project = db.createProject({
      name: 'Good Project',
      video: { path: '/tmp/v.mp4', name: 'v.mp4', extension: '.mp4' },
      subtitle: { path: '/tmp/s.srt', name: 's.srt', extension: '.srt' },
      outputDirectory: undefined,
    });
    db.updateProjectInspection(project.id, INSPECTION_READY);

    const doc = buildSubtitleDoc(GOOD_CUES);
    db.persistSubtitleResult(project.id, '/tmp/s.srt', SUBTITLE_READY_OUTCOME, doc);

    const result = await service.checkForProject(project.id);
    expect(result.syncStatus).toBe('timing_ok');
    expect(result.syncWarnings).toHaveLength(0);
    expect(result.syncCheckedAt).not.toBeNull();
    expect(result.syncAnalysisVersion).toBe(1);
  });

  // ─── TC-PREREQ-03: Prerequisites met, warnings → needs_review ─────────

  it('returns needs_review when subtitle has timing anomalies', async () => {
    const project = db.createProject({
      name: 'Anomaly Project',
      video: { path: '/tmp/v.mp4', name: 'v.mp4', extension: '.mp4' },
      subtitle: { path: '/tmp/s.srt', name: 's.srt', extension: '.srt' },
      outputDirectory: undefined,
    });
    db.updateProjectInspection(project.id, INSPECTION_READY);

    // Late start: first cue at 50% of 1-hour video
    const lateCues = [
      { startMs: 1_800_001, endMs: 1_900_000 }, // late start (50% > 15%)
      { startMs: 1_900_001, endMs: 2_000_000 },
    ];
    const doc = buildSubtitleDoc(lateCues);
    const outcome: SubtitlePersistOutcome = {
      subtitleStatus: 'ready',
      cueCount: 2,
      lastCueEndMs: 2_000_000,
      parseError: null,
      parsedAt: Date.now() - 30_000,
    };
    db.persistSubtitleResult(project.id, '/tmp/s.srt', outcome, doc);

    const result = await service.checkForProject(project.id);
    expect(result.syncStatus).toBe('needs_review');
    expect(result.syncWarnings.some((w) => w.code === 'LATE_SUBTITLE_START')).toBe(true);
  });

  // ─── TC-GUARD-01: Analyzer guard failure → check_failed ───────────────

  it('returns check_failed when durationSeconds is 0 (analyzer Guard A)', async () => {
    const zeroDurationOutcome: InspectionOutcome = {
      ...INSPECTION_READY,
      mediaMetadata: {
        ...INSPECTION_READY.mediaMetadata!,
        durationSeconds: 0,
      },
    };

    const project = db.createProject({
      name: 'Zero Duration',
      video: { path: '/tmp/v.mp4', name: 'v.mp4', extension: '.mp4' },
      subtitle: { path: '/tmp/s.srt', name: 's.srt', extension: '.srt' },
      outputDirectory: undefined,
    });
    db.updateProjectInspection(project.id, zeroDurationOutcome);

    const doc = buildSubtitleDoc(GOOD_CUES);
    db.persistSubtitleResult(project.id, '/tmp/s.srt', SUBTITLE_READY_OUTCOME, doc);

    const result = await service.checkForProject(project.id);
    expect(result.syncStatus).toBe('check_failed');
  });

  // ─── TC-PER-01: Persistence survives close and reopen ─────────────────

  it('persists sync result — values survive db close and reopen', async () => {
    const project = db.createProject({
      name: 'Persist Test',
      video: { path: '/tmp/v.mp4', name: 'v.mp4', extension: '.mp4' },
      subtitle: { path: '/tmp/s.srt', name: 's.srt', extension: '.srt' },
      outputDirectory: undefined,
    });
    db.updateProjectInspection(project.id, INSPECTION_READY);
    const doc = buildSubtitleDoc(GOOD_CUES);
    db.persistSubtitleResult(project.id, '/tmp/s.srt', SUBTITLE_READY_OUTCOME, doc);

    await service.checkForProject(project.id);

    // Close and reopen
    db.close();
    const db2 = new DatabaseService(dbPath, migrationsFolder);
    db2.initialize();

    const reloaded = db2.getProject(project.id);
    expect(reloaded?.syncStatus).toBe('timing_ok');
    expect(reloaded?.syncCheckedAt).not.toBeNull();
    expect(reloaded?.syncAnalysisVersion).toBe(1);

    db2.close();
  });

  // ─── TC-PREREQ-04: Always re-checks prerequisites regardless of stored sync_status

  it('re-evaluates prerequisites on each call, never trusts stored sync_status', async () => {
    const project = db.createProject({
      name: 'Re-eval Test',
      video: { path: '/tmp/v.mp4', name: 'v.mp4', extension: '.mp4' },
      subtitle: { path: '/tmp/s.srt', name: 's.srt', extension: '.srt' },
      outputDirectory: undefined,
    });
    db.updateProjectInspection(project.id, INSPECTION_READY);
    const doc = buildSubtitleDoc(GOOD_CUES);
    db.persistSubtitleResult(project.id, '/tmp/s.srt', SUBTITLE_READY_OUTCOME, doc);

    // First call: prerequisites met → timing_ok
    const first = await service.checkForProject(project.id);
    expect(first.syncStatus).toBe('timing_ok');

    // Manually clear subtitle (simulating re-parse that fails)
    db.setProjectSubtitlePath(project.id, null);

    // Second call: prerequisites no longer met → not_available
    // Even though stored sync_status was timing_ok, service must re-check
    const second = await service.checkForProject(project.id);
    expect(second.syncStatus).toBe('not_available');
  });
});
