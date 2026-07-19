import { spawn } from 'node:child_process';
import { resolve } from 'node:path';

const electronBin = resolve(
  'node_modules',
  '.bin',
  process.platform === 'win32' ? 'electron.cmd' : 'electron',
);
const timeoutMs = 10_000;

const child = spawn(electronBin, ['.', '--smoke-test'], {
  cwd: process.cwd(),
  stdio: 'pipe',
  shell: false,
  env: {
    ...process.env,
    NODE_ENV: 'test',
  },
});

let output = '';
child.stdout.on('data', (chunk) => {
  output += chunk.toString();
});
child.stderr.on('data', (chunk) => {
  output += chunk.toString();
});

const timeout = setTimeout(() => {
  child.kill('SIGTERM');
  console.error('[SceneSift] Smoke test timed out.');
  process.exit(1);
}, timeoutMs);

child.on('close', (code) => {
  clearTimeout(timeout);
  if (code === 0) {
    console.log('[SceneSift] Electron smoke test passed.');
    process.exit(0);
  }

  console.error(output);
  process.exit(code ?? 1);
});
