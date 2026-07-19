import { open } from 'node:fs/promises';
import { resolve } from 'node:path';
import { AppError } from '@main/utils/errors';

const MAX_SUBTITLE_BYTES = 2_097_152; // 2 MB

const UTF8_BOM = '﻿';

export interface SubtitleReadResult {
  content: string;
  resolvedPath: string;
}

export async function readSubtitleFile(rawPath: string): Promise<SubtitleReadResult> {
  const resolvedPath = resolve(rawPath);
  let fh: Awaited<ReturnType<typeof open>> | null = null;

  try {
    try {
      fh = await open(resolvedPath, 'r');
    } catch {
      throw new AppError('SUBTITLE_FILE_NOT_FOUND', 'Subtitle file could not be opened.');
    }

    const stat = await fh.stat();

    if (!stat.isFile()) {
      throw new AppError('SUBTITLE_FILE_NOT_FOUND', 'Subtitle path does not resolve to a file.');
    }

    if (stat.size > MAX_SUBTITLE_BYTES) {
      throw new AppError('SUBTITLE_FILE_TOO_LARGE', 'Subtitle file exceeds the 2 MB size limit.');
    }

    const buf = Buffer.allocUnsafe(MAX_SUBTITLE_BYTES + 1);
    const { bytesRead } = await fh.read(buf, 0, MAX_SUBTITLE_BYTES + 1, 0);

    if (bytesRead > MAX_SUBTITLE_BYTES) {
      throw new AppError('SUBTITLE_FILE_TOO_LARGE', 'Subtitle file grew beyond limit during read.');
    }

    let content = buf.subarray(0, bytesRead).toString('utf-8');

    // Strip UTF-8 BOM
    if (content.startsWith(UTF8_BOM)) {
      content = content.slice(1);
    }

    // Normalize line endings: CRLF → LF, bare CR → LF
    content = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    return { content, resolvedPath };
  } finally {
    await fh?.close();
  }
}
