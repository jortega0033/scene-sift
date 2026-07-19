import { spawn } from 'node:child_process';

export type CommandResult = {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  error?: string;
};

export const runCommand = async (binaryPath: string, args: string[]): Promise<CommandResult> =>
  new Promise((resolve) => {
    const child = spawn(binaryPath, args, {
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString();
    });

    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    child.on('error', (error: Error) => {
      resolve({
        stdout,
        stderr,
        exitCode: null,
        error: error.message,
      });
    });

    child.on('close', (exitCode) => {
      resolve({
        stdout,
        stderr,
        exitCode,
      });
    });
  });
