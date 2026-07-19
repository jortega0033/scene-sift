import { spawn } from 'node:child_process';

export type CommandResult = {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  error?: string;
};

export type RunCommandOptions = {
  timeoutMs?: number;
  maxOutputBytes?: number;
};

export const runCommand = async (
  binaryPath: string,
  args: string[],
  options?: RunCommandOptions,
): Promise<CommandResult> =>
  new Promise((resolve) => {
    const child = spawn(binaryPath, args, {
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    let timedOut = false;
    let outputExceeded = false;
    let totalOutputBytes = 0;

    const timer =
      options?.timeoutMs != null
        ? setTimeout(() => {
            timedOut = true;
            child.kill();
          }, options.timeoutMs)
        : null;

    const onData = (chunk: Buffer, append: (s: string) => void): void => {
      if (options?.maxOutputBytes != null) {
        totalOutputBytes += chunk.length;
        if (!outputExceeded && totalOutputBytes > options.maxOutputBytes) {
          outputExceeded = true;
          child.kill();
        }
      }
      if (!outputExceeded) append(chunk.toString());
    };

    child.stdout.on('data', (chunk: Buffer) => onData(chunk, (s) => { stdout += s; }));
    child.stderr.on('data', (chunk: Buffer) => onData(chunk, (s) => { stderr += s; }));

    child.on('error', (error: Error) => {
      if (timer != null) clearTimeout(timer);
      resolve({ stdout, stderr, exitCode: null, error: error.message });
    });

    child.on('close', (exitCode) => {
      if (timer != null) clearTimeout(timer);
      if (outputExceeded) {
        resolve({ stdout, stderr, exitCode: null, error: 'PROCESS_OUTPUT_LIMIT_EXCEEDED' });
      } else {
        resolve({
          stdout,
          stderr,
          exitCode: timedOut ? null : exitCode,
          ...(timedOut ? { error: 'PROCESS_TIMEOUT' } : {}),
        });
      }
    });
  });
