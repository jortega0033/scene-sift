// @vitest-environment node
import { execPath } from 'node:process';
import { describe, expect, it } from 'vitest';
import { runCommand } from '@main/services/process/runCommand';

describe('runCommand', () => {
  it('returns stdout and exitCode 0 on success', async () => {
    const result = await runCommand(execPath, ['-e', 'process.stdout.write("hello")']);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe('hello');
    expect(result.error).toBeUndefined();
  });

  it('kills process and returns PROCESS_OUTPUT_LIMIT_EXCEEDED when output exceeds cap', async () => {
    const result = await runCommand(
      execPath,
      ['-e', 'process.stdout.write(Buffer.alloc(200, 120).toString())'],
      { maxOutputBytes: 100 },
    );
    expect(result.error).toBe('PROCESS_OUTPUT_LIMIT_EXCEEDED');
    expect(result.exitCode).toBeNull();
  });

  it('succeeds when output equals maxOutputBytes exactly', async () => {
    const result = await runCommand(
      execPath,
      ['-e', 'process.stdout.write(Buffer.alloc(100, 120).toString())'],
      { maxOutputBytes: 100 },
    );
    expect(result.exitCode).toBe(0);
    expect(result.error).toBeUndefined();
  });

  it('does not apply cap when maxOutputBytes is omitted', async () => {
    const result = await runCommand(execPath, [
      '-e',
      'process.stdout.write(Buffer.alloc(10000, 120).toString())',
    ]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout.length).toBe(10000);
  });

  it('counts stdout and stderr bytes combined toward the cap', async () => {
    const result = await runCommand(
      execPath,
      [
        '-e',
        'process.stdout.write(Buffer.alloc(60, 97).toString()); process.stderr.write(Buffer.alloc(60, 98).toString())',
      ],
      { maxOutputBytes: 100 },
    );
    expect(result.error).toBe('PROCESS_OUTPUT_LIMIT_EXCEEDED');
    expect(result.exitCode).toBeNull();
  });
});
