import { access } from 'node:fs/promises';
import { basename, join } from 'node:path';
import type { AppSettings } from '@shared/schemas/settings';
import type { FfmpegCapabilities } from '@shared/schemas/ffmpeg';
import { runCommand, type CommandResult } from '@main/services/process/runCommand';

type CommandRunner = (binaryPath: string, args: string[]) => Promise<CommandResult>;

type BinaryInfo = {
  available: boolean;
  path?: string;
  version?: string;
  error?: string;
};

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
