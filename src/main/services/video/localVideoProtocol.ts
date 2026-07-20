import { protocol } from 'electron';
import { createReadStream } from 'node:fs';
import { lstat } from 'node:fs/promises';
import { Readable } from 'node:stream';
import type { VideoService } from '@main/services/video/videoService';

const UUID_REGEX =
  /^\/video\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;

export function parseRange(
  rangeHeader: string,
  fileSize: number,
): { start: number; end: number } | null {
  const match = rangeHeader.match(/^bytes=(\d+)-(\d*)$/);
  if (!match) return null;
  const start = parseInt(match[1]!, 10);
  const end = match[2] ? parseInt(match[2], 10) : fileSize - 1;
  if (start > end || end >= fileSize || start < 0) return null;
  return { start, end };
}

export async function handleLocalVideoRequest(
  request: Request,
  videoService: VideoService,
): Promise<Response> {
  const url = new URL(request.url);
  const match = url.pathname.match(UUID_REGEX);
  if (!match) {
    return new Response(null, { status: 404 });
  }
  const projectId = match[1]!;

  const videoPath = videoService.resolveVideoPath(projectId);
  if (!videoPath) {
    return new Response(null, { status: 404 });
  }

  let fileStat: Awaited<ReturnType<typeof lstat>>;
  try {
    fileStat = await lstat(videoPath);
  } catch {
    return new Response(null, { status: 404 });
  }

  if (!fileStat.isFile()) {
    return new Response(null, { status: 404 });
  }

  const fileSize = fileStat.size;
  const rangeHeader = request.headers.get('Range');

  if (rangeHeader) {
    const range = parseRange(rangeHeader, fileSize);
    if (!range) {
      return new Response(null, {
        status: 416,
        headers: { 'Content-Range': `bytes */${fileSize}` },
      });
    }
    const { start, end } = range;
    const chunkSize = end - start + 1;
    const nodeStream = createReadStream(videoPath, { start, end });
    const webStream = Readable.toWeb(nodeStream) as ReadableStream<Uint8Array>;
    return new Response(webStream, {
      status: 206,
      headers: {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Content-Length': String(chunkSize),
        'Content-Type': 'video/mp4',
        'Accept-Ranges': 'bytes',
      },
    });
  }

  const nodeStream = createReadStream(videoPath);
  const webStream = Readable.toWeb(nodeStream) as ReadableStream<Uint8Array>;
  return new Response(webStream, {
    status: 200,
    headers: {
      'Content-Length': String(fileSize),
      'Content-Type': 'video/mp4',
      'Accept-Ranges': 'bytes',
    },
  });
}

export const registerLocalVideoProtocol = (videoService: VideoService): void => {
  protocol.handle('local', (request) => handleLocalVideoRequest(request, videoService));
};
