import type { RenderJob, SceneSiftApi, SystemCapabilities } from '@shared/api/sceneSiftApi';
import type { AppSettings } from '@shared/schemas/settings';
import type { MediaMetadata, ProjectRecord } from '@shared/schemas/project';

export const QA_FIXTURE_QUERY_KEY = 'fixture';

export const qaFixtureNames = [
  'no-projects',
  'one-new-project',
  'multiple-projects',
  'project-video-no-subtitle',
  'project-video-with-subtitle',
  'empty-queue',
  'queue-mixed',
  'ffmpeg-unavailable',
  'database-error',
  'settings-defaults',
  'settings-custom-output',
  'settings-save-failure',
  'dark-multiple-projects',
  'inspection-failed-project',
  'subtitle-not-selected',
  'subtitle-selected',
  'subtitle-ready',
  'subtitle-ready-with-warnings',
  'subtitle-parse-failed',
  'subtitle-missing',
  'subtitle-unsupported',
  'sync-not-available',
  'sync-ready-to-check',
  'sync-timing-ok',
  'sync-needs-review',
  'sync-check-failed',
  'sync-stale',
  'preview-not-available',
  'preview-ready',
  'preview-no-cues',
  'transcript-not-available',
  'transcript-ready',
  'transcript-ready-with-warnings',
] as const;

export type QaFixtureName = (typeof qaFixtureNames)[number];

export type QaFixtureState = {
  name: QaFixtureName;
  projects: ProjectRecord[];
  queue: RenderJob[];
  settings: AppSettings;
  capabilities: SystemCapabilities;
  subtitleSelection: Awaited<ReturnType<SceneSiftApi['dialog']['selectSubtitleFile']>>;
};

const now = Date.UTC(2026, 6, 18, 12, 0, 0);

const projectAMediaMetadata: MediaMetadata = {
  durationSeconds: 2847.6,
  width: 1920,
  height: 1080,
  videoCodec: 'h264',
  fps: 23.976,
  bitRateBps: 8_500_000,
  fileSizeBytes: 3_021_000_000,
  inspectedAt: now - 20_000,
};

const projectA: ProjectRecord = {
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Episode 04 — Candidate Review',
  videoPath: '/fixtures/sample-episode.mp4',
  subtitlePath: '/fixtures/sample-subtitles.srt',
  outputDirectory: '/fixtures/exports',
  status: 'ready',
  createdAt: now - 100_000,
  updatedAt: now - 20_000,
  mediaMetadata: projectAMediaMetadata,
  inspectionError: null,
  subtitleStatus: null,
  subtitleCueCount: null,
  subtitleLastCueEndMs: null,
  subtitleParseError: null,
  subtitleParsedAt: null,
  syncStatus: null,
  syncCheckedAt: null,
  syncWarningsJson: null,
  syncAnalysisVersion: null,
};

const projectB: ProjectRecord = {
  id: '22222222-2222-4222-8222-222222222222',
  name: 'Very Long Project Name For Scan Testing In Compact Windows',
  videoPath:
    '/fixtures/very-long-video-filename-that-should-truncate-safely-without-breaking-layout-episode-cut-v3-master.mp4',
  subtitlePath: null,
  outputDirectory: '/fixtures/exports',
  status: 'draft',
  createdAt: now - 90_000,
  updatedAt: now - 30_000,
  mediaMetadata: null,
  inspectionError: null,
  subtitleStatus: null,
  subtitleCueCount: null,
  subtitleLastCueEndMs: null,
  subtitleParseError: null,
  subtitleParsedAt: null,
  syncStatus: null,
  syncCheckedAt: null,
  syncWarningsJson: null,
  syncAnalysisVersion: null,
};

const projectC: ProjectRecord = {
  id: '33333333-3333-4333-8333-333333333333',
  name: 'Unicode Subtitle Check',
  videoPath: '/fixtures/sample-episode.mp4',
  subtitlePath: '/fixtures/字幕_日本語.srt',
  outputDirectory: '/fixtures/exports',
  status: 'archived',
  createdAt: now - 70_000,
  updatedAt: now - 40_000,
  mediaMetadata: null,
  inspectionError: null,
  subtitleStatus: null,
  subtitleCueCount: null,
  subtitleLastCueEndMs: null,
  subtitleParseError: null,
  subtitleParsedAt: null,
  syncStatus: null,
  syncCheckedAt: null,
  syncWarningsJson: null,
  syncAnalysisVersion: null,
};

const projectD: ProjectRecord = {
  id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  name: 'Corrupted Source File',
  videoPath: '/fixtures/corrupted-file.mp4',
  subtitlePath: null,
  outputDirectory: null,
  status: 'inspection_failed',
  createdAt: now - 50_000,
  updatedAt: now - 10_000,
  mediaMetadata: null,
  inspectionError: 'FFPROBE_ERROR',
  subtitleStatus: null,
  subtitleCueCount: null,
  subtitleLastCueEndMs: null,
  subtitleParseError: null,
  subtitleParsedAt: null,
  syncStatus: null,
  syncCheckedAt: null,
  syncWarningsJson: null,
  syncAnalysisVersion: null,
};

const baseSettings: AppSettings = {
  ffmpegPathOverride: null,
  ffprobePathOverride: null,
  defaultOutputDirectory: null,
  preferredTheme: 'light',
  developmentDiagnosticsEnabled: true,
};

const baseCapabilities: SystemCapabilities = {
  app: {
    version: '0.1.0',
    platform: 'darwin',
    diagnosticsEnabled: true,
  },
  ffmpeg: {
    ffmpegAvailable: true,
    ffprobeAvailable: true,
  },
  database: {
    ok: true,
    dbPath: '/fixtures/scenesift.sqlite',
    migrationsApplied: true,
  },
};

const queueJobs: RenderJob[] = [
  {
    id: '44444444-4444-4444-8444-444444444444',
    projectId: projectA.id,
    status: 'queued',
    progress: 0,
    outputPath: null,
    errorMessage: null,
    createdAt: now - 20_000,
    updatedAt: now - 20_000,
  },
  {
    id: '55555555-5555-4555-8555-555555555555',
    projectId: projectA.id,
    status: 'running',
    progress: 54,
    outputPath: null,
    errorMessage: null,
    createdAt: now - 16_000,
    updatedAt: now - 10_000,
  },
  {
    id: '66666666-6666-4666-8666-666666666666',
    projectId: projectB.id,
    status: 'completed',
    progress: 100,
    outputPath: '/fixtures/exports/episode-04-clip-01.mp4',
    errorMessage: null,
    createdAt: now - 13_000,
    updatedAt: now - 5_000,
  },
  {
    id: '77777777-7777-4777-8777-777777777777',
    projectId: projectC.id,
    status: 'failed',
    progress: 12,
    outputPath: null,
    errorMessage:
      'Render failed while preparing filter graph. Ensure subtitle timing and output path are valid.',
    createdAt: now - 11_000,
    updatedAt: now - 3_000,
  },
  {
    id: '88888888-8888-4888-8888-888888888888',
    projectId: projectB.id,
    status: 'cancelled',
    progress: 33,
    outputPath: null,
    errorMessage: 'Cancelled by user before render start.',
    createdAt: now - 9_000,
    updatedAt: now - 2_500,
  },
];

export const fixtureMap: Record<QaFixtureName, QaFixtureState> = {
  'no-projects': {
    name: 'no-projects',
    projects: [],
    queue: [],
    settings: baseSettings,
    capabilities: baseCapabilities,
    subtitleSelection: null,
  },
  'one-new-project': {
    name: 'one-new-project',
    projects: [{ ...projectA, status: 'draft', mediaMetadata: null }],
    queue: [],
    settings: baseSettings,
    capabilities: baseCapabilities,
    subtitleSelection: null,
  },
  'multiple-projects': {
    name: 'multiple-projects',
    projects: [projectA, projectB, projectC],
    queue: queueJobs,
    settings: baseSettings,
    capabilities: baseCapabilities,
    subtitleSelection: {
      extension: '.srt',
      name: 'sample-subtitles.srt',
      path: '/fixtures/sample-subtitles.srt',
    },
  },
  'project-video-no-subtitle': {
    name: 'project-video-no-subtitle',
    projects: [{ ...projectA, subtitlePath: null }],
    queue: [],
    settings: baseSettings,
    capabilities: baseCapabilities,
    subtitleSelection: null,
  },
  'project-video-with-subtitle': {
    name: 'project-video-with-subtitle',
    projects: [projectA],
    queue: [],
    settings: baseSettings,
    capabilities: baseCapabilities,
    subtitleSelection: {
      extension: '.srt',
      name: 'sample-subtitles.srt',
      path: '/fixtures/sample-subtitles.srt',
    },
  },
  'empty-queue': {
    name: 'empty-queue',
    projects: [projectA],
    queue: [],
    settings: baseSettings,
    capabilities: baseCapabilities,
    subtitleSelection: null,
  },
  'queue-mixed': {
    name: 'queue-mixed',
    projects: [projectA, projectB, projectC],
    queue: queueJobs,
    settings: baseSettings,
    capabilities: baseCapabilities,
    subtitleSelection: {
      extension: '.srt',
      name: '字幕_日本語.srt',
      path: '/fixtures/字幕_日本語.srt',
    },
  },
  'ffmpeg-unavailable': {
    name: 'ffmpeg-unavailable',
    projects: [projectA],
    queue: [],
    settings: baseSettings,
    capabilities: {
      ...baseCapabilities,
      ffmpeg: {
        ffmpegAvailable: false,
        ffprobeAvailable: false,
      },
    },
    subtitleSelection: null,
  },
  'database-error': {
    name: 'database-error',
    projects: [projectA],
    queue: [],
    settings: baseSettings,
    capabilities: {
      ...baseCapabilities,
      database: {
        ok: false,
        dbPath: '/fixtures/scenesift.sqlite',
        migrationsApplied: false,
      },
    },
    subtitleSelection: null,
  },
  'settings-defaults': {
    name: 'settings-defaults',
    projects: [projectA],
    queue: [],
    settings: baseSettings,
    capabilities: baseCapabilities,
    subtitleSelection: null,
  },
  'settings-custom-output': {
    name: 'settings-custom-output',
    projects: [projectA],
    queue: [],
    settings: {
      ...baseSettings,
      defaultOutputDirectory: '/fixtures/exports/custom',
      ffmpegPathOverride: '/fixtures/bin/ffmpeg',
      ffprobePathOverride: '/fixtures/bin/ffprobe',
    },
    capabilities: baseCapabilities,
    subtitleSelection: null,
  },
  'settings-save-failure': {
    name: 'settings-save-failure',
    projects: [projectA],
    queue: [],
    settings: baseSettings,
    capabilities: baseCapabilities,
    subtitleSelection: null,
  },
  'dark-multiple-projects': {
    name: 'dark-multiple-projects',
    projects: [projectA, projectB, projectC],
    queue: queueJobs,
    settings: { ...baseSettings, preferredTheme: 'dark' },
    capabilities: baseCapabilities,
    subtitleSelection: {
      extension: '.srt',
      name: 'sample-subtitles.srt',
      path: '/fixtures/sample-subtitles.srt',
    },
  },
  'inspection-failed-project': {
    name: 'inspection-failed-project',
    projects: [projectD, projectA],
    queue: [],
    settings: baseSettings,
    capabilities: baseCapabilities,
    subtitleSelection: null,
  },
  'subtitle-not-selected': {
    name: 'subtitle-not-selected',
    projects: [
      {
        ...projectA,
        subtitlePath: null,
        subtitleStatus: 'not_selected',
        subtitleCueCount: null,
        subtitleLastCueEndMs: null,
        subtitleParseError: null,
        subtitleParsedAt: null,
      },
    ],
    queue: [],
    settings: baseSettings,
    capabilities: baseCapabilities,
    subtitleSelection: {
      extension: '.srt',
      name: 'sample-subtitles.srt',
      path: '/fixtures/sample-subtitles.srt',
    },
  },
  'subtitle-selected': {
    name: 'subtitle-selected',
    projects: [
      {
        ...projectA,
        subtitlePath: '/fixtures/sample-subtitles.srt',
        subtitleStatus: 'selected',
        subtitleCueCount: null,
        subtitleLastCueEndMs: null,
        subtitleParseError: null,
        subtitleParsedAt: null,
      },
    ],
    queue: [],
    settings: baseSettings,
    capabilities: baseCapabilities,
    subtitleSelection: null,
  },
  'subtitle-ready': {
    name: 'subtitle-ready',
    projects: [
      {
        ...projectA,
        subtitlePath: '/fixtures/sample-subtitles.srt',
        subtitleStatus: 'ready',
        subtitleCueCount: 842,
        subtitleLastCueEndMs: 2_844_100,
        subtitleParseError: null,
        subtitleParsedAt: now - 5_000,
      },
    ],
    queue: [],
    settings: baseSettings,
    capabilities: baseCapabilities,
    subtitleSelection: null,
  },
  'subtitle-ready-with-warnings': {
    name: 'subtitle-ready-with-warnings',
    projects: [
      {
        ...projectA,
        subtitlePath: '/fixtures/sample-subtitles.srt',
        subtitleStatus: 'ready_with_warnings',
        subtitleCueCount: 317,
        subtitleLastCueEndMs: 1_620_000,
        subtitleParseError: null,
        subtitleParsedAt: now - 8_000,
      },
    ],
    queue: [],
    settings: baseSettings,
    capabilities: baseCapabilities,
    subtitleSelection: null,
  },
  'subtitle-parse-failed': {
    name: 'subtitle-parse-failed',
    projects: [
      {
        ...projectA,
        subtitlePath: '/fixtures/corrupted-subtitles.srt',
        subtitleStatus: 'parse_failed',
        subtitleCueCount: null,
        subtitleLastCueEndMs: null,
        subtitleParseError: 'SUBTITLE_PARSE_ERROR',
        subtitleParsedAt: now - 3_000,
      },
    ],
    queue: [],
    settings: baseSettings,
    capabilities: baseCapabilities,
    subtitleSelection: {
      extension: '.srt',
      name: 'sample-subtitles.srt',
      path: '/fixtures/sample-subtitles.srt',
    },
  },
  'subtitle-missing': {
    name: 'subtitle-missing',
    projects: [
      {
        ...projectA,
        subtitlePath: '/fixtures/deleted-subtitles.srt',
        subtitleStatus: 'missing',
        subtitleCueCount: null,
        subtitleLastCueEndMs: null,
        subtitleParseError: 'SUBTITLE_FILE_NOT_FOUND',
        subtitleParsedAt: now - 6_000,
      },
    ],
    queue: [],
    settings: baseSettings,
    capabilities: baseCapabilities,
    subtitleSelection: {
      extension: '.srt',
      name: 'sample-subtitles.srt',
      path: '/fixtures/sample-subtitles.srt',
    },
  },
  'subtitle-unsupported': {
    name: 'subtitle-unsupported',
    projects: [
      {
        ...projectA,
        subtitlePath: '/fixtures/complex-subtitles.ass',
        subtitleStatus: 'unsupported',
        subtitleCueCount: null,
        subtitleLastCueEndMs: null,
        subtitleParseError: 'SUBTITLE_UNSUPPORTED_FORMAT',
        subtitleParsedAt: now - 2_000,
      },
    ],
    queue: [],
    settings: baseSettings,
    capabilities: baseCapabilities,
    subtitleSelection: {
      extension: '.srt',
      name: 'sample-subtitles.srt',
      path: '/fixtures/sample-subtitles.srt',
    },
  },
  'sync-not-available': {
    name: 'sync-not-available',
    projects: [
      {
        ...projectA,
        status: 'draft',
        mediaMetadata: null,
        subtitleStatus: null,
        syncStatus: null,
        syncCheckedAt: null,
        syncWarningsJson: null,
        syncAnalysisVersion: null,
      },
    ],
    queue: [],
    settings: baseSettings,
    capabilities: baseCapabilities,
    subtitleSelection: null,
  },
  'sync-ready-to-check': {
    name: 'sync-ready-to-check',
    projects: [
      {
        ...projectA,
        subtitleStatus: 'ready',
        subtitleCueCount: 200,
        subtitleLastCueEndMs: 2_844_100,
        subtitleParsedAt: now - 5_000,
        syncStatus: null,
        syncCheckedAt: null,
        syncWarningsJson: null,
        syncAnalysisVersion: null,
      },
    ],
    queue: [],
    settings: baseSettings,
    capabilities: baseCapabilities,
    subtitleSelection: null,
  },
  'sync-timing-ok': {
    name: 'sync-timing-ok',
    projects: [
      {
        ...projectA,
        subtitleStatus: 'ready',
        subtitleCueCount: 200,
        subtitleLastCueEndMs: 2_844_100,
        subtitleParsedAt: now - 60_000,
        syncStatus: 'timing_ok',
        syncCheckedAt: now - 10_000,
        syncWarningsJson: null,
        syncAnalysisVersion: 1,
      },
    ],
    queue: [],
    settings: baseSettings,
    capabilities: baseCapabilities,
    subtitleSelection: null,
  },
  'sync-needs-review': {
    name: 'sync-needs-review',
    projects: [
      {
        ...projectA,
        subtitleStatus: 'ready',
        subtitleCueCount: 200,
        subtitleLastCueEndMs: 2_844_100,
        subtitleParsedAt: now - 60_000,
        syncStatus: 'needs_review',
        syncCheckedAt: now - 10_000,
        syncWarningsJson: JSON.stringify([
          { code: 'LARGE_TAIL_GAP', gapMs: 15_000 },
          { code: 'LATE_SUBTITLE_START', startRatio: 0.18 },
        ]),
        syncAnalysisVersion: 1,
      },
    ],
    queue: [],
    settings: baseSettings,
    capabilities: baseCapabilities,
    subtitleSelection: null,
  },
  'sync-check-failed': {
    name: 'sync-check-failed',
    projects: [
      {
        ...projectA,
        subtitleStatus: 'ready',
        subtitleCueCount: 200,
        subtitleLastCueEndMs: 2_844_100,
        subtitleParsedAt: now - 60_000,
        syncStatus: 'check_failed',
        syncCheckedAt: now - 10_000,
        syncWarningsJson: null,
        syncAnalysisVersion: 1,
      },
    ],
    queue: [],
    settings: baseSettings,
    capabilities: baseCapabilities,
    subtitleSelection: null,
  },
  'sync-stale': {
    name: 'sync-stale',
    projects: [
      {
        ...projectA,
        subtitleStatus: 'ready',
        subtitleCueCount: 200,
        subtitleLastCueEndMs: 2_844_100,
        // subtitle re-parsed AFTER the last sync check → stale
        subtitleParsedAt: now - 5_000,
        syncStatus: 'timing_ok',
        syncCheckedAt: now - 30_000,
        syncWarningsJson: null,
        syncAnalysisVersion: 1,
      },
    ],
    queue: [],
    settings: baseSettings,
    capabilities: baseCapabilities,
    subtitleSelection: null,
  },
  'preview-not-available': {
    name: 'preview-not-available',
    projects: [{ ...projectB }],
    queue: [],
    settings: baseSettings,
    capabilities: baseCapabilities,
    subtitleSelection: null,
  },
  'preview-ready': {
    name: 'preview-ready',
    projects: [
      {
        ...projectA,
        subtitleStatus: 'ready',
        subtitleCueCount: 3,
        subtitleLastCueEndMs: 12_000,
        subtitleParsedAt: now - 5_000,
      },
    ],
    queue: [],
    settings: baseSettings,
    capabilities: baseCapabilities,
    subtitleSelection: null,
  },
  'preview-no-cues': {
    name: 'preview-no-cues',
    projects: [
      {
        ...projectA,
        subtitleStatus: null,
        subtitleCueCount: null,
        subtitleLastCueEndMs: null,
        subtitleParsedAt: null,
      },
    ],
    queue: [],
    settings: baseSettings,
    capabilities: baseCapabilities,
    subtitleSelection: null,
  },
  'transcript-not-available': {
    name: 'transcript-not-available',
    projects: [{ ...projectB }],
    queue: [],
    settings: baseSettings,
    capabilities: baseCapabilities,
    subtitleSelection: null,
  },
  'transcript-ready': {
    name: 'transcript-ready',
    projects: [
      {
        ...projectA,
        subtitleStatus: 'ready',
        subtitleCueCount: 842,
        subtitleLastCueEndMs: 2_844_100,
        subtitleParsedAt: now - 5_000,
      },
    ],
    queue: [],
    settings: baseSettings,
    capabilities: baseCapabilities,
    subtitleSelection: null,
  },
  'transcript-ready-with-warnings': {
    name: 'transcript-ready-with-warnings',
    projects: [
      {
        ...projectA,
        subtitleStatus: 'ready_with_warnings',
        subtitleCueCount: 317,
        subtitleLastCueEndMs: 1_620_000,
        subtitleParsedAt: now - 8_000,
      },
    ],
    queue: [],
    settings: baseSettings,
    capabilities: baseCapabilities,
    subtitleSelection: null,
  },
};

export const resolveFixtureName = (queryString: string): QaFixtureName => {
  const value = new URLSearchParams(queryString).get(QA_FIXTURE_QUERY_KEY);
  if (value && qaFixtureNames.includes(value as QaFixtureName)) {
    return value as QaFixtureName;
  }
  return 'multiple-projects';
};
