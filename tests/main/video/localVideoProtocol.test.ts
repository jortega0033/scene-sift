// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Readable } from 'node:stream';

vi.mock('electron', () => ({
  protocol: {
    handle: vi.fn(),
    registerSchemesAsPrivileged: vi.fn(),
  },
}));

vi.mock('node:fs/promises', () => ({
  lstat: vi.fn(),
}));

vi.mock('node:fs', () => ({
  createReadStream: vi.fn(),
}));

import { handleLocalVideoRequest, parseRange } from '@main/services/video/localVideoProtocol';
import { lstat } from 'node:fs/promises';
import { createReadStream } from 'node:fs';

const UUID = '11111111-1111-4111-8111-111111111111';
const VIDEO_URL = `local:///video/${UUID}`;

const mockVideoService = {
  resolveVideoPath: vi.fn(),
};

function makeFileStat(isFile: boolean, size: number) {
  return { isFile: () => isFile, size };
}

function makeStream() {
  return Readable.from(Buffer.alloc(0)) as unknown as ReturnType<typeof createReadStream>;
}

describe('parseRange', () => {
  it('parses valid bytes range', () => {
    expect(parseRange('bytes=0-499', 1000)).toEqual({ start: 0, end: 499 });
  });

  it('parses open-ended range', () => {
    expect(parseRange('bytes=0-', 1000)).toEqual({ start: 0, end: 999 });
  });

  it('returns null for inverted range (start > end)', () => {
    expect(parseRange('bytes=500-100', 1000)).toBeNull();
  });

  it('returns null when end equals fileSize (out of range)', () => {
    expect(parseRange('bytes=0-1000', 1000)).toBeNull();
  });

  it('returns null when end exceeds fileSize', () => {
    expect(parseRange('bytes=0-2000', 1000)).toBeNull();
  });

  it('returns null for suffix range (bytes=-500)', () => {
    expect(parseRange('bytes=-500', 1000)).toBeNull();
  });

  it('returns null for malformed header', () => {
    expect(parseRange('invalid', 1000)).toBeNull();
  });

  it('returns null for non-bytes unit', () => {
    expect(parseRange('kb=0-499', 1000)).toBeNull();
  });
});

describe('handleLocalVideoRequest', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 404 for non-video pathname', async () => {
    const req = new Request('local:///not-video/path');
    const res = await handleLocalVideoRequest(req, mockVideoService as never);
    expect(res.status).toBe(404);
  });

  it('returns 404 when project has no video path', async () => {
    mockVideoService.resolveVideoPath.mockReturnValue(null);
    const req = new Request(VIDEO_URL);
    const res = await handleLocalVideoRequest(req, mockVideoService as never);
    expect(res.status).toBe(404);
  });

  it('returns 404 when file does not exist on disk', async () => {
    mockVideoService.resolveVideoPath.mockReturnValue('/path/video.mp4');
    vi.mocked(lstat).mockRejectedValue(Object.assign(new Error('ENOENT'), { code: 'ENOENT' }));
    const req = new Request(VIDEO_URL);
    const res = await handleLocalVideoRequest(req, mockVideoService as never);
    expect(res.status).toBe(404);
  });

  it('returns 404 for symlink (isFile() = false)', async () => {
    mockVideoService.resolveVideoPath.mockReturnValue('/path/video.mp4');
    vi.mocked(lstat).mockResolvedValue(makeFileStat(false, 1000) as never);
    const req = new Request(VIDEO_URL);
    const res = await handleLocalVideoRequest(req, mockVideoService as never);
    expect(res.status).toBe(404);
  });

  it('returns 200 with headers for full request', async () => {
    mockVideoService.resolveVideoPath.mockReturnValue('/path/video.mp4');
    vi.mocked(lstat).mockResolvedValue(makeFileStat(true, 1000) as never);
    vi.mocked(createReadStream).mockReturnValue(makeStream());
    const req = new Request(VIDEO_URL);
    const res = await handleLocalVideoRequest(req, mockVideoService as never);
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Length')).toBe('1000');
    expect(res.headers.get('Content-Type')).toBe('video/mp4');
    expect(res.headers.get('Accept-Ranges')).toBe('bytes');
  });

  it('returns 206 with range headers for valid Range request', async () => {
    mockVideoService.resolveVideoPath.mockReturnValue('/path/video.mp4');
    vi.mocked(lstat).mockResolvedValue(makeFileStat(true, 1000) as never);
    vi.mocked(createReadStream).mockReturnValue(makeStream());
    const req = new Request(VIDEO_URL, { headers: { Range: 'bytes=0-499' } });
    const res = await handleLocalVideoRequest(req, mockVideoService as never);
    expect(res.status).toBe(206);
    expect(res.headers.get('Content-Range')).toBe('bytes 0-499/1000');
    expect(res.headers.get('Content-Length')).toBe('500');
    expect(res.headers.get('Content-Type')).toBe('video/mp4');
  });

  it('returns 416 for inverted range', async () => {
    mockVideoService.resolveVideoPath.mockReturnValue('/path/video.mp4');
    vi.mocked(lstat).mockResolvedValue(makeFileStat(true, 1000) as never);
    const req = new Request(VIDEO_URL, { headers: { Range: 'bytes=500-100' } });
    const res = await handleLocalVideoRequest(req, mockVideoService as never);
    expect(res.status).toBe(416);
    expect(res.headers.get('Content-Range')).toBe('bytes */1000');
  });

  it('returns 416 for out-of-range end', async () => {
    mockVideoService.resolveVideoPath.mockReturnValue('/path/video.mp4');
    vi.mocked(lstat).mockResolvedValue(makeFileStat(true, 100) as never);
    const req = new Request(VIDEO_URL, { headers: { Range: 'bytes=0-2000' } });
    const res = await handleLocalVideoRequest(req, mockVideoService as never);
    expect(res.status).toBe(416);
  });

  it('returns 416 for malformed Range header', async () => {
    mockVideoService.resolveVideoPath.mockReturnValue('/path/video.mp4');
    vi.mocked(lstat).mockResolvedValue(makeFileStat(true, 1000) as never);
    const req = new Request(VIDEO_URL, { headers: { Range: 'invalid' } });
    const res = await handleLocalVideoRequest(req, mockVideoService as never);
    expect(res.status).toBe(416);
  });

  it('resolveVideoPath called with extracted UUID', async () => {
    mockVideoService.resolveVideoPath.mockReturnValue(null);
    const req = new Request(VIDEO_URL);
    await handleLocalVideoRequest(req, mockVideoService as never);
    expect(mockVideoService.resolveVideoPath).toHaveBeenCalledWith(UUID);
  });
});
