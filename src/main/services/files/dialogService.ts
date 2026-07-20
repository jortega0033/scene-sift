import { basename, extname } from 'node:path';
import { BrowserWindow, dialog, type OpenDialogOptions, type SaveDialogOptions } from 'electron';
import {
  selectedDirectorySchema,
  selectedSubtitleSchema,
  selectedVideoSchema,
} from '@shared/schemas/project';
import { SUBTITLE_EXTENSIONS, VIDEO_EXTENSIONS } from '@shared/constants/files';
import type { SelectedDirectory, SelectedFile } from '@shared/types/common';
import { AppError } from '@main/utils/errors';

const toSelectedFile = (absolutePath: string): SelectedFile => {
  const extension = extname(absolutePath).toLowerCase();
  return {
    path: absolutePath,
    name: basename(absolutePath),
    extension,
  };
};

const toSelectedDirectory = (absolutePath: string): SelectedDirectory => ({
  path: absolutePath,
  name: basename(absolutePath),
});

export const selectVideoFile = async (): Promise<SelectedFile | null> => {
  const browserWindow = BrowserWindow.getFocusedWindow();
  const options: OpenDialogOptions = {
    title: 'Select video file',
    properties: ['openFile'],
    filters: [
      {
        name: 'Video',
        extensions: VIDEO_EXTENSIONS.map((item) => item.replace('.', '')),
      },
    ],
  };
  const result = browserWindow
    ? await dialog.showOpenDialog(browserWindow, options)
    : await dialog.showOpenDialog(options);

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }
  const [selectedPath] = result.filePaths;
  if (!selectedPath) {
    return null;
  }

  const parsed = selectedVideoSchema.safeParse(toSelectedFile(selectedPath));
  if (!parsed.success) {
    throw new AppError('INVALID_VIDEO_FILE', 'Selected file does not match allowed video formats.');
  }

  return parsed.data;
};

export const selectSubtitleFile = async (): Promise<SelectedFile | null> => {
  const browserWindow = BrowserWindow.getFocusedWindow();
  const options: OpenDialogOptions = {
    title: 'Select subtitle file',
    properties: ['openFile'],
    filters: [
      {
        name: 'Subtitles',
        extensions: SUBTITLE_EXTENSIONS.map((item) => item.replace('.', '')),
      },
    ],
  };
  const result = browserWindow
    ? await dialog.showOpenDialog(browserWindow, options)
    : await dialog.showOpenDialog(options);

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }
  const [selectedPath] = result.filePaths;
  if (!selectedPath) {
    return null;
  }

  const parsed = selectedSubtitleSchema.safeParse(toSelectedFile(selectedPath));
  if (!parsed.success) {
    throw new AppError(
      'INVALID_SUBTITLE_FILE',
      'Selected file does not match allowed subtitle formats.',
    );
  }

  return parsed.data;
};

export const selectOutputDirectory = async (): Promise<SelectedDirectory | null> => {
  const browserWindow = BrowserWindow.getFocusedWindow();
  const options: OpenDialogOptions = {
    title: 'Select output directory',
    properties: ['openDirectory', 'createDirectory'],
  };
  const result = browserWindow
    ? await dialog.showOpenDialog(browserWindow, options)
    : await dialog.showOpenDialog(options);

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }
  const [selectedPath] = result.filePaths;
  if (!selectedPath) {
    return null;
  }

  const parsed = selectedDirectorySchema.safeParse(toSelectedDirectory(selectedPath));
  if (!parsed.success) {
    throw new AppError('INVALID_OUTPUT_DIRECTORY', 'Selected output directory is invalid.');
  }

  return parsed.data;
};

export const selectBinaryPath = async (title: string): Promise<string | null> => {
  const browserWindow = BrowserWindow.getFocusedWindow();
  const options: OpenDialogOptions = {
    title,
    properties: ['openFile'],
  };
  const result = browserWindow
    ? await dialog.showOpenDialog(browserWindow, options)
    : await dialog.showOpenDialog(options);

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  const [selectedPath] = result.filePaths;
  return selectedPath ?? null;
};

export const showTranscriptExportDialog = async (
  format: 'txt' | 'json',
): Promise<{ canceled: boolean; filePath?: string }> => {
  const browserWindow = BrowserWindow.getFocusedWindow();
  const options: SaveDialogOptions = {
    title: 'Export Transcript',
    defaultPath: `transcript.${format}`,
    filters: [{ name: format === 'json' ? 'JSON' : 'Text', extensions: [format] }],
  };
  const result = browserWindow
    ? await dialog.showSaveDialog(browserWindow, options)
    : await dialog.showSaveDialog(options);
  return { canceled: result.canceled, filePath: result.filePath };
};
