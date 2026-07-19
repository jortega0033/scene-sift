export const IPC_CHANNELS = {
  APP_GET_VERSION: 'app:getVersion',
  APP_GET_PLATFORM: 'app:getPlatform',
  DIALOG_SELECT_VIDEO_FILE: 'dialog:selectVideoFile',
  DIALOG_SELECT_SUBTITLE_FILE: 'dialog:selectSubtitleFile',
  DIALOG_SELECT_OUTPUT_DIRECTORY: 'dialog:selectOutputDirectory',
  SYSTEM_GET_CAPABILITIES: 'system:getCapabilities',
  FFMPEG_CHECK_AVAILABILITY: 'ffmpeg:checkAvailability',
  DATABASE_GET_HEALTH: 'database:getHealth',
  PROJECT_CREATE: 'project:create',
  PROJECT_LIST: 'project:list',
  PROJECT_GET: 'project:get',
  PROJECT_DELETE: 'project:delete',
  SETTINGS_GET: 'settings:get',
  SETTINGS_UPDATE: 'settings:update',
  SETTINGS_SELECT_FFMPEG_PATH: 'settings:selectFfmpegPath',
  SETTINGS_SELECT_FFPROBE_PATH: 'settings:selectFfprobePath',
  QUEUE_LIST: 'queue:list',
  QUEUE_CREATE_DEMO_JOB: 'queue:createDemoJob',
} as const;

export const ALL_IPC_CHANNELS = Object.values(IPC_CHANNELS);
