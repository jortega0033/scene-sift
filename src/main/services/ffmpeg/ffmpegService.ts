import { access } from 'node:fs/promises';
import { stat } from 'node:fs/promises';
import { basename, join, resolve as resolvePath } from 'node:path';
import type { AppSettings } from '@shared/schemas/settings';
import type { FfmpegCapabilities } from '@shared/schemas/ffmpeg';
import type { MediaMetadata } from '@shared/schemas/project';
import { runCommand, type CommandResult, type RunCommandOptions } from '@main/services/process/runCommand';

type CommandRunner = (
  binaryPath: string,
  args: string[],
  options?: RunCommandOptions,
) => Promise<CommandResult>;

type BinaryInfo = {
  available: boolean;
  path?: string;
  version?: string;
  error?: string;
};

export type InspectionOutcome = {
  status: 'ready' | 'inspection_failed';
  mediaMetadata: MediaMetadata | null;
  inspectionError: string | null;
};

const INSPECT_TIMEOUT_MS = 15_000;

const isWindows = process.platform === 'win32';
const ffmpegExecutable = isWindows ? 'ffmpeg.exe' : 'ffmpeg';
const ffprobeExecutable = isWindows ? 'ffprobe.exe' : 'ffprobe';

const isSafeOverridePath = (overridePath: string | null, expectedBinaryName: string): boolean => {
  if (!overridePath) {
    return false;
  }

  return basename(overridePath).toLowerCase() === expectedBinaryName.toLowerCase();
};

const getCandidatePaths = (overridePath: string | null, binaryName: string): string[] => {
  const resourcesPath =
    typeof process.resourcesPath === 'string' ? process.resourcesPath : process.cwd();
  const bundledPath = join(resourcesPath, 'ffmpeg', binaryName);
  const safeOverride = isSafeOverridePath(overridePath, binaryName) ? overridePath : null;
  const candidates = [safeOverride, bundledPath, binaryName];
  return candidates.filter((candidate): candidate is string => Boolean(candidate));
};

const canAccessPath = async (candidate: string): Promise<boolean> => {
  try {
    if (candidate === ffmpegExecutable || candidate === ffprobeExecutable) {
      return true;
    }

    await access(candidate);
    return true;
  } catch {
    return false;
  }
};

const parseVersion = (text: string): string | undefined => {
  const [firstLine] = text.split('\n');
  return firstLine?.trim() || undefined;
};

const checkBinary = async (candidates: string[], runner: CommandRunner): Promise<BinaryInfo> => {
  for (const candidate of candidates) {
    if (!(await canAccessPath(candidate))) {
      continue;
    }

    const result = await runner(candidate, ['-version']);
    const output = `${result.stdout}\n${result.stderr}`.trim();
    if (
      result.exitCode === 0 ||
      output.includes('ffmpeg version') ||
      output.includes('ffprobe version')
    ) {
      const version = parseVersion(output);
      return {
        available: true,
        path: candidate,
        ...(version ? { version } : {}),
      };
    }
  }

  return {
    available: false,
    error: 'Binary not found or failed to execute.',
  };
};

export const checkFfmpegAvailability = async (
  settings: AppSettings,
  runner: CommandRunner = runCommand,
): Promise<FfmpegCapabilities> => {
  const ffmpegCandidates = getCandidatePaths(settings.ffmpegPathOverride, ffmpegExecutable);
  const ffprobeCandidates = getCandidatePaths(settings.ffprobePathOverride, ffprobeExecutable);

  const [ffmpegResult, ffprobeResult] = await Promise.all([
    checkBinary(ffmpegCandidates, runner),
    checkBinary(ffprobeCandidates, runner),
  ]);

  return {
    ffmpegAvailable: ffmpegResult.available,
    ffprobeAvailable: ffprobeResult.available,
    ffmpegPath: ffmpegResult.path,
    ffprobePath: ffprobeResult.path,
    ffmpegVersion: ffmpegResult.version,
    ffprobeVersion: ffprobeResult.version,
    error:
      ffmpegResult.available && ffprobeResult.available
        ? undefined
        : `FFmpeg available: ${ffmpegResult.available}, FFprobe available: ${ffprobeResult.available}`,
  };
};

const parseFps = (avgFrameRate: string | null | undefined): number | null => {
  if (!avgFrameRate) return null;
  const parts = avgFrameRate.split('/');
  if (parts.length === 2) {
    const num = parseFloat(parts[0] ?? '0');
    const den = parseFloat(parts[1] ?? '0');
    if (!isNaN(num) && !isNaN(den) && den !== 0) return num / den;
  }
  const direct = parseFloat(avgFrameRate);
  return isNaN(direct) ? null : direct;
};

export const inspectMediaFile = async (
  videoPath: string,
  ffprobePath: string,
  runner: CommandRunner = runCommand,
): Promise<InspectionOutcome> => {
  const resolved = resolvePath(videoPath);

  try {
    const fileStat = await stat(resolved);
    if (!fileStat.isFile()) {
      return { status: 'inspection_failed', mediaMetadata: null, inspectionError: 'FILE_NOT_FOUND' };
    }
  } catch {
    return { status: 'inspection_failed', mediaMetadata: null, inspectionError: 'FILE_NOT_FOUND' };
  }

  const result = await runner(
    ffprobePath,
    ['-v', 'quiet', '-print_format', 'json', '-show_format', '-show_streams', resolved],
    { timeoutMs: INSPECT_TIMEOUT_MS, maxOutputBytes: 1_048_576 },
  );

  if (result.exitCode !== 0) {
    return { status: 'inspection_failed', mediaMetadata: null, inspectionError: 'FFPROBE_ERROR' };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(result.stdout);
  } catch {
    return { status: 'inspection_failed', mediaMetadata: null, inspectionError: 'PARSE_ERROR' };
  }

  const data = parsed as { streams?: unknown[]; format?: Record<string, unknown> };
  const videoStream = (data.streams ?? []).find(
    (s): s is Record<string, unknown> =>
      typeof s === 'object' && s !== null && (s as Record<string, unknown>)['codec_type'] === 'video',
  ) as Record<string, unknown> | undefined;

  if (!videoStream && !data.format) {
    return { status: 'inspection_failed', mediaMetadata: null, inspectionError: 'NO_VIDEO_STREAM' };
  }

  const rawDuration = data.format?.['duration'];
  const rawBitRate = data.format?.['bit_rate'];
  const rawSize = data.format?.['size'];
  const rawAvgFps = videoStream?.['avg_frame_rate'];

  const durationSeconds =
    rawDuration != null ? parseFloat(String(rawDuration)) : null;
  const bitRateBps =
    rawBitRate != null ? parseInt(String(rawBitRate), 10) : null;
  const fileSizeBytes =
    rawSize != null ? parseInt(String(rawSize), 10) : null;

  const mediaMetadata: MediaMetadata = {
    durationSeconds: durationSeconds != null && !isNaN(durationSeconds) ? durationSeconds : null,
    width: videoStream?.['width'] != null ? Number(videoStream['width']) : null,
    height: videoStream?.['height'] != null ? Number(videoStream['height']) : null,
    videoCodec: typeof videoStream?.['codec_name'] === 'string' ? videoStream['codec_name'] : null,
    fps: parseFps(typeof rawAvgFps === 'string' ? rawAvgFps : null),
    bitRateBps: bitRateBps != null && !isNaN(bitRateBps) ? bitRateBps : null,
    fileSizeBytes: fileSizeBytes != null && !isNaN(fileSizeBytes) ? fileSizeBytes : null,
    inspectedAt: Date.now(),
  };

  return { status: 'ready', mediaMetadata, inspectionError: null };
};
