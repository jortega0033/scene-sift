export type AppPlatform = string;

export type SafeError = {
  code: string;
  message: string;
  details?: string;
};

export type SelectedFile = {
  path: string;
  name: string;
  extension: string;
};

export type SelectedDirectory = {
  path: string;
  name: string;
};

export type QueueStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
