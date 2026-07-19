import type { SceneSiftApi } from '@shared/api/sceneSiftApi';
import type { CreateProjectInput } from '@shared/schemas/project';
import type { AppSettings } from '@shared/schemas/settings';
import { fixtureMap, resolveFixtureName } from './fixtures';

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
        const created = {
          id: crypto.randomUUID(),
          name: input.name,
          videoPath: input.video.path,
          subtitlePath: input.subtitle?.path ?? null,
          outputDirectory: input.outputDirectory?.path ?? null,
          status: 'draft',
          createdAt: now,
          updatedAt: now,
        } as const;
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
  };
};
