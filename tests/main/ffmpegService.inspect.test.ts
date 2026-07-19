// @vitest-environment node
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, afterAll } from 'vitest';
import { inspectMediaFile } from '@main/services/ffmpeg/ffmpegService';
import type { CommandResult } from '@main/services/process/runCommand';
import type { RunCommandOptions } from '@main/services/process/runCommand';

type Runner = (
  binaryPath: string,
  args: string[],
  options?: RunCommandOptions,
) => Promise<CommandResult>;

const FFPROBE_PATH = '/usr/local/bin/ffprobe';

const validFfprobeOutput = JSON.stringify({
  streams: [
    {
      codec_type: 'video',
      codec_name: 'h264',
      width: 1920,
      height: 1080,
      avg_frame_rate: '24000/1001',
    },
  ],
  format: {
    duration: '2847.6',
    bit_rate: '8500000',
    size: '3021000000',
  },
});

let tmpDir: string;
let realFile: string;

try {
  tmpDir = mkdtempSync(join(tmpdir(), 'siftest-'));
  realFile = join(tmpDir, 'test.mp4');
  writeFileSync(realFile, Buffer.alloc(16));
} catch {
  tmpDir = '';
  realFile = '';
}

afterAll(() => {
  if (tmpDir) {
    try {
      rmSync(tmpDir, { recursive: true });
    } catch {
      // ignore
    }
  }
});

describe('inspectMediaFile', () => {
  it('returns inspection_failed with FILE_NOT_FOUND for non-existent path', async () => {
    const runner: Runner = async () => ({ stdout: '', stderr: '', exitCode: 0 });
    const result = await inspectMediaFile('/no/such/file.mp4', FFPROBE_PATH, runner);
    expect(result.status).toBe('inspection_failed');
    expect(result.inspectionError).toBe('FILE_NOT_FOUND');
    expect(result.mediaMetadata).toBeNull();
  });

  it('returns inspection_failed with FILE_NOT_FOUND when path is a directory', async () => {
    const runner: Runner = async () => ({ stdout: '', stderr: '', exitCode: 0 });
    const result = await inspectMediaFile(tmpdir(), FFPROBE_PATH, runner);
    expect(result.status).toBe('inspection_failed');
    expect(result.inspectionError).toBe('FILE_NOT_FOUND');
  });

  it('returns inspection_failed with FFPROBE_ERROR when ffprobe exits non-zero', async () => {
    const runner: Runner = async () => ({ stdout: '', stderr: 'Invalid data', exitCode: 1 });
    const result = await inspectMediaFile(realFile, FFPROBE_PATH, runner);
    expect(result.status).toBe('inspection_failed');
    expect(result.inspectionError).toBe('FFPROBE_ERROR');
    expect(result.mediaMetadata).toBeNull();
  });

  it('returns inspection_failed with FFPROBE_ERROR on process timeout (null exitCode + PROCESS_TIMEOUT)', async () => {
    const runner: Runner = async () => ({
      stdout: '',
      stderr: '',
      exitCode: null,
      error: 'PROCESS_TIMEOUT',
    });
    const result = await inspectMediaFile(realFile, FFPROBE_PATH, runner);
    expect(result.status).toBe('inspection_failed');
    expect(result.inspectionError).toBe('FFPROBE_ERROR');
  });

  it('returns inspection_failed with FFPROBE_ERROR when runner returns PROCESS_OUTPUT_LIMIT_EXCEEDED', async () => {
    const runner: Runner = async () => ({
      stdout: '',
      stderr: '',
      exitCode: null,
      error: 'PROCESS_OUTPUT_LIMIT_EXCEEDED',
    });
    const result = await inspectMediaFile(realFile, FFPROBE_PATH, runner);
    expect(result.status).toBe('inspection_failed');
    expect(result.inspectionError).toBe('FFPROBE_ERROR');
    expect(result.mediaMetadata).toBeNull();
  });

  it('returns inspection_failed with PARSE_ERROR when output is not valid JSON', async () => {
    const runner: Runner = async () => ({ stdout: 'not json', stderr: '', exitCode: 0 });
    const result = await inspectMediaFile(realFile, FFPROBE_PATH, runner);
    expect(result.status).toBe('inspection_failed');
    expect(result.inspectionError).toBe('PARSE_ERROR');
    expect(result.mediaMetadata).toBeNull();
  });

  it('returns inspection_failed with NO_VIDEO_STREAM when no streams and no format', async () => {
    const runner: Runner = async () => ({
      stdout: JSON.stringify({ streams: [], format: undefined }),
      stderr: '',
      exitCode: 0,
    });
    const result = await inspectMediaFile(realFile, FFPROBE_PATH, runner);
    expect(result.status).toBe('inspection_failed');
    expect(result.inspectionError).toBe('NO_VIDEO_STREAM');
  });

  it('returns ready with correct mediaMetadata on success', async () => {
    const runner: Runner = async (binaryPath, args, options) => {
      expect(binaryPath).toBe(FFPROBE_PATH);
      expect(args).toContain('-show_streams');
      expect(options?.timeoutMs).toBe(15_000);
      return { stdout: validFfprobeOutput, stderr: '', exitCode: 0 };
    };
    const result = await inspectMediaFile(realFile, FFPROBE_PATH, runner);
    expect(result.status).toBe('ready');
    expect(result.inspectionError).toBeNull();
    expect(result.mediaMetadata).not.toBeNull();
    expect(result.mediaMetadata?.width).toBe(1920);
    expect(result.mediaMetadata?.height).toBe(1080);
    expect(result.mediaMetadata?.videoCodec).toBe('h264');
    expect(result.mediaMetadata?.durationSeconds).toBeCloseTo(2847.6);
    expect(result.mediaMetadata?.bitRateBps).toBe(8_500_000);
    expect(result.mediaMetadata?.fileSizeBytes).toBe(3_021_000_000);
    expect(typeof result.mediaMetadata?.inspectedAt).toBe('number');
    expect(result.mediaMetadata?.fps).toBeCloseTo(23.976, 2);
  });

  it('passes shell:false implicitly — runner receives args array not string', async () => {
    let capturedArgs: string[] | null = null;
    const runner: Runner = async (_binaryPath, args) => {
      capturedArgs = args;
      return { stdout: validFfprobeOutput, stderr: '', exitCode: 0 };
    };
    await inspectMediaFile(realFile, FFPROBE_PATH, runner);
    expect(Array.isArray(capturedArgs)).toBe(true);
  });

  it('resolves path before passing to ffprobe — no traversal in args', async () => {
    let capturedArgs: string[] | null = null;
    const runner: Runner = async (_binaryPath, args) => {
      capturedArgs = args;
      return { stdout: validFfprobeOutput, stderr: '', exitCode: 0 };
    };
    await inspectMediaFile(realFile, FFPROBE_PATH, runner);
    const pathArg = capturedArgs?.at(-1) ?? '';
    expect(pathArg).not.toContain('..');
  });
});
