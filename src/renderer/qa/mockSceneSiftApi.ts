import type { SceneSiftApi } from '@shared/api/sceneSiftApi';
import type { CreateProjectInput, ProjectRecord } from '@shared/schemas/project';
import type { AppSettings } from '@shared/schemas/settings';
import { fixtureMap, resolveFixtureName } from './fixtures';
import type { SyncCheckResult } from '@shared/schemas/sync';

const delay = async (ms = 8): Promise<void> =>
  new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });

export const createMockSceneSiftApi = (): SceneSiftApi => {
  const fixture = fixtureMap[resolveFixtureName(window.location.search)];
  let settings: AppSettings = { ...fixture.settings };
  let projects = [...fixture.projects];
  let queue = [...fixture.queue];

  const findProject = (projectId: string) => projects.find((item) => item.id === projectId) ?? null;

  const dialogFallbackVideo: CreateProjectInput['video'] = {
    path: '/fixtures/sample-episode.mp4',
    name: 'sample-episode.mp4',
    extension: '.mp4',
  };

  const dialogFallbackDirectory = {
    path: '/fixtures/exports',
    name: 'exports',
  };

  return {
    app: {
      getVersion: async () => '0.1.0',
      getPlatform: async () => 'darwin',
    },
    dialog: {
      selectVideoFile: async () => dialogFallbackVideo,
      selectSubtitleFile: async () => fixture.subtitleSelection,
      selectOutputDirectory: async () => dialogFallbackDirectory,
    },
    system: {
      getCapabilities: async () => ({ ...fixture.capabilities }),
    },
    ffmpeg: {
      checkAvailability: async () => ({ ...fixture.capabilities.ffmpeg }),
    },
    database: {
      getHealth: async () => ({ ...fixture.capabilities.database }),
    },
    projects: {
      create: async (input) => {
        await delay();
        if (projects.some((project) => project.name.toLowerCase() === input.name.toLowerCase())) {
          throw new Error('A project with this name already exists.');
        }
        const now = Date.now();
        const created: ProjectRecord = {
          id: crypto.randomUUID(),
          name: input.name,
          videoPath: input.video.path,
          subtitlePath: input.subtitle?.path ?? null,
          outputDirectory: input.outputDirectory?.path ?? null,
          status: 'draft',
          createdAt: now,
          updatedAt: now,
          mediaMetadata: null,
          inspectionError: null,
          subtitleStatus: input.subtitle?.path ? 'selected' : null,
          subtitleCueCount: null,
          subtitleLastCueEndMs: null,
          subtitleParseError: null,
          subtitleParsedAt: null,
          syncStatus: null,
          syncCheckedAt: null,
          syncWarningsJson: null,
          syncAnalysisVersion: null,
        };
        projects = [created, ...projects];
        return created;
      },
      list: async () => {
        await delay();
        return [...projects];
      },
      get: async (projectId) => {
        await delay();
        return findProject(projectId);
      },
      delete: async (projectId) => {
        await delay();
        const before = projects.length;
        projects = projects.filter((project) => project.id !== projectId);
        queue = queue.filter((item) => item.projectId !== projectId);
        return { deleted: before !== projects.length };
      },
      inspect: async (projectId) => {
        await delay(200);
        const project = findProject(projectId);
        if (!project) throw new Error('Project not found.');
        const now = Date.now();
        const mediaMetadata = {
          durationSeconds: 2847.6,
          width: 1920,
          height: 1080,
          videoCodec: 'h264',
          fps: 23.976,
          bitRateBps: 8_500_000,
          fileSizeBytes: 3_021_000_000,
          inspectedAt: now,
        };
        projects = projects.map((p) =>
          p.id === projectId
            ? { ...p, status: 'ready' as const, mediaMetadata, inspectionError: null }
            : p,
        );
        return { projectId, status: 'ready' as const, mediaMetadata, inspectionError: null };
      },
    },
    queue: {
      list: async () => {
        await delay();
        return [...queue];
      },
      createDemoJob: async (projectId) => {
        await delay();
        if (!findProject(projectId)) {
          throw new Error('Project not found.');
        }
        const now = Date.now();
        const job = {
          id: crypto.randomUUID(),
          projectId,
          status: 'queued',
          progress: 0,
          outputPath: null,
          errorMessage: null,
          createdAt: now,
          updatedAt: now,
        } as const;
        queue = [job, ...queue];
        return job;
      },
    },
    settings: {
      get: async () => {
        await delay();
        return { ...settings };
      },
      update: async (input) => {
        await delay();
        if (fixture.name === 'settings-save-failure') {
          throw new Error('Unable to save settings in this fixture.');
        }
        settings = {
          ...settings,
          ...input,
        };
        return { ...settings };
      },
      selectFfmpegPath: async () => '/fixtures/bin/ffmpeg',
      selectFfprobePath: async () => '/fixtures/bin/ffprobe',
    },
    subtitle: {
      selectForProject: async (projectId) => {
        await delay();
        const project = findProject(projectId);
        if (!project) return null;
        const updated = {
          ...project,
          subtitlePath: '/fixtures/sample.srt',
          subtitleStatus: 'selected' as const,
          subtitleCueCount: null,
          subtitleLastCueEndMs: null,
          subtitleParseError: null,
          subtitleParsedAt: null,
        };
        projects = projects.map((p) => (p.id === projectId ? updated : p));
        return updated;
      },
      parseForProject: async (projectId) => {
        await delay(200);
        const project = findProject(projectId);
        if (!project) throw new Error('Project not found.');
        const now = Date.now();
        const updated = {
          ...project,
          subtitleStatus: 'ready' as const,
          subtitleCueCount: 42,
          subtitleLastCueEndMs: 300_000,
          subtitleParseError: null,
          subtitleParsedAt: now,
        };
        projects = projects.map((p) => (p.id === projectId ? updated : p));
        return updated;
      },
      clearForProject: async (projectId) => {
        await delay();
        const project = findProject(projectId);
        if (!project) throw new Error('Project not found.');
        const updated = {
          ...project,
          subtitlePath: null,
          subtitleStatus: 'not_selected' as const,
          subtitleCueCount: null,
          subtitleLastCueEndMs: null,
          subtitleParseError: null,
          subtitleParsedAt: null,
        };
        projects = projects.map((p) => (p.id === projectId ? updated : p));
        return updated;
      },
    },
    video: {
      getPlaybackUrl: async () => ({
        url: 'data:video/mp4;base64,AAAAIGZ0eXBpc29tAAACAGlzb21pc28yYXZjMW1wNDE=',
      }),
      getCues: async () => {
        if (fixture.name === 'preview-ready') {
          return {
            cues: [
              { index: 0, startMs: 1_000, endMs: 3_000, text: 'Previously on SceneSift…' },
              { index: 1, startMs: 5_000, endMs: 8_000, text: 'The quick brown fox\njumped over the lazy dog.' },
              { index: 2, startMs: 10_000, endMs: 12_000, text: 'End of clip.' },
            ],
          };
        }
        return { cues: [] };
      },
    },
    transcript: {
      generateForProject: async () => {
        if (
          fixture.name === 'transcript-ready' ||
          fixture.name === 'transcript-ready-with-warnings'
        ) {
          return {
            entries: [
              { startMs: 1_000, endMs: 3_000, text: 'Previously on SceneSift…' },
              {
                startMs: 5_000,
                endMs: 12_000,
                text: 'The quick brown fox jumped over the lazy dog.',
              },
            ],
            subtitleStatus:
              fixture.name === 'transcript-ready-with-warnings'
                ? ('ready_with_warnings' as const)
                : ('ready' as const),
          };
        }
        return { entries: [], subtitleStatus: null };
      },
      exportForProject: async () => ({ exported: true, path: '/mock/transcript.txt' }),
    },
    sync: {
      checkForProject: async (projectId: string): Promise<SyncCheckResult> => {
        await delay(200);
        const project = findProject(projectId);
        if (!project) {
          return {
            syncStatus: 'not_available',
            syncWarnings: [],
            syncCheckedAt: null,
            syncAnalysisVersion: null,
          };
        }

        const prerequisitesMet =
          project.status === 'ready' &&
          (project.subtitleStatus === 'ready' || project.subtitleStatus === 'ready_with_warnings');

        if (!prerequisitesMet) {
          return {
            syncStatus: 'not_available',
            syncWarnings: [],
            syncCheckedAt: null,
            syncAnalysisVersion: null,
          };
        }

        const now = Date.now();
        const result: SyncCheckResult = {
          syncStatus: 'timing_ok',
          syncWarnings: [],
          syncCheckedAt: now,
          syncAnalysisVersion: 1,
        };

        projects = projects.map((p) =>
          p.id === projectId
            ? {
                ...p,
                syncStatus: result.syncStatus,
                syncCheckedAt: result.syncCheckedAt,
                syncWarningsJson:
                  result.syncWarnings.length > 0 ? JSON.stringify(result.syncWarnings) : null,
                syncAnalysisVersion: result.syncAnalysisVersion,
              }
            : p,
        );

        return result;
      },
    },
    ai: {
      getConfigurationStatus: async () => {
        if (fixture.name === 'ai-provider-available') {
          return {
            configurationStatus: 'available' as const,
            maskedEndpoint: 'https://api',
            model: 'gpt-4o-mini',
            providerType: 'openai_compatible' as const,
            lastTestedAt: null,
            lastTestError: null,
            consentRecordedAt: 1_000_000,
          };
        }
        return {
          configurationStatus: 'unconfigured' as const,
          maskedEndpoint: null,
          model: 'gpt-4o-mini',
          providerType: 'openai_compatible' as const,
          lastTestedAt: null,
          lastTestError: null,
          consentRecordedAt: null,
        };
      },
      setApiKey: async () => ({ ok: true as const }),
      testConnection: async () => ({ ok: true as const }),
      cancelTest: async () => ({ cancelled: true as const }),
      clearConfiguration: async () => ({ cleared: true as const }),
      recordConsent: async () => ({ ok: true as const }),
    },
  };
};
