export const fixtureUrl = (fixture: string): string => `/?fixture=${fixture}`;

export const FIXTURES = {
  noProjects: 'no-projects',
  oneProject: 'one-new-project',
  multipleProjects: 'multiple-projects',
  projectWithoutSubtitle: 'project-video-no-subtitle',
  projectWithSubtitle: 'project-video-with-subtitle',
  emptyQueue: 'empty-queue',
  queueMixed: 'queue-mixed',
  ffmpegUnavailable: 'ffmpeg-unavailable',
  databaseError: 'database-error',
  settingsDefaults: 'settings-defaults',
  settingsCustomOutput: 'settings-custom-output',
  settingsSaveFailure: 'settings-save-failure',
} as const;
