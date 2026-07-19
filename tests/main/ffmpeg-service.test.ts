// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { checkFfmpegAvailability } from '@main/services/ffmpeg/ffmpegService';
import type { CommandResult } from '@main/services/process/runCommand';

describe('ffmpeg service', () => {
  it('returns available binaries when versions resolve', async () => {
    const runner = async (binaryPath: string, args: string[]): Promise<CommandResult> => {
      expect(args).toEqual(['-version']);
      if (binaryPath.includes('ffmpeg')) {
        return { stdout: 'ffmpeg version 7.0', stderr: '', exitCode: 0 };
      }

      return { stdout: 'ffprobe version 7.0', stderr: '', exitCode: 0 };
    };

    const result = await checkFfmpegAvailability(
      {
        ffmpegPathOverride: null,
        ffprobePathOverride: null,
        defaultOutputDirectory: null,
        preferredTheme: 'system',
        developmentDiagnosticsEnabled: false,
      },
      runner,
    );

    expect(result.ffmpegAvailable).toBe(true);
    expect(result.ffprobeAvailable).toBe(true);
  });

  it('returns unavailable when binaries fail', async () => {
    const runner = async (): Promise<CommandResult> => ({
      stdout: '',
      stderr: 'not found',
      exitCode: 1,
    });

    const result = await checkFfmpegAvailability(
      {
        ffmpegPathOverride: null,
        ffprobePathOverride: null,
        defaultOutputDirectory: null,
        preferredTheme: 'system',
        developmentDiagnosticsEnabled: false,
      },
      runner,
    );

    expect(result.ffmpegAvailable).toBe(false);
    expect(result.ffprobeAvailable).toBe(false);
    expect(result.error).toContain('FFmpeg available: false');
  });

  it('ignores unsafe override executable names', async () => {
    const calledBinaries: string[] = [];
    const runner = async (binaryPath: string): Promise<CommandResult> => {
      calledBinaries.push(binaryPath);
      return { stdout: '', stderr: '', exitCode: 1 };
    };

    await checkFfmpegAvailability(
      {
        ffmpegPathOverride: '/tmp/evil',
        ffprobePathOverride: '/tmp/evil',
        defaultOutputDirectory: null,
        preferredTheme: 'system',
        developmentDiagnosticsEnabled: false,
      },
      runner,
    );

    expect(calledBinaries.some((path) => path.includes('/tmp/evil'))).toBe(false);
  });
});
