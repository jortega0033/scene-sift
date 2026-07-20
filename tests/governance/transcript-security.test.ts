// @vitest-environment node
import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

const SRC = path.resolve(__dirname, '../../src');
const readFile = (rel: string) => fs.readFileSync(path.join(SRC, rel), 'utf-8');

describe('transcript security constraints', () => {
  it('transcriptService uses bounded quantifiers in TAG_PATTERN', () => {
    const src = readFile('main/services/transcript/transcriptService.ts');
    expect(src).toContain('{0,255}');
    expect(src).toContain('{0,256}');
  });

  it('transcriptService uses same-directory tmp path (no os.tmpdir)', () => {
    const src = readFile('main/services/transcript/transcriptService.ts');
    expect(src).toContain('path.dirname(filePath)');
    expect(src).not.toContain('os.tmpdir');
  });

  it('transcriptService writeExport uses renameSync (atomic write)', () => {
    const src = readFile('main/services/transcript/transcriptService.ts');
    expect(src).toContain('renameSync');
  });

  it('transcript IPC handlers use registerValidatedHandler not raw ipcMain.handle', () => {
    const src = readFile('main/ipc/registerIpcHandlers.ts');
    const transcriptBlock = src.slice(src.indexOf('TRANSCRIPT_GENERATE_FOR_PROJECT'));
    expect(transcriptBlock).not.toContain('ipcMain.handle');
  });

  it('transcript preload validates projectId before forwarding', () => {
    const src = readFile('preload/index.ts');
    expect(src).toContain("typeof input?.projectId !== 'string'");
  });

  it('transcript preload validates format before forwarding', () => {
    const src = readFile('preload/index.ts');
    expect(src).toContain("input.format !== 'txt' && input.format !== 'json'");
  });

  it('transcript preload validates projectId is UUID format before forwarding', () => {
    const src = readFile('preload/index.ts');
    expect(src).toContain('UUID_RE.test(input.projectId)');
  });

  it('transcript files do not use shell: true', () => {
    const transcriptSrc = readFile('main/services/transcript/transcriptService.ts');
    const preloadSrc = readFile('preload/index.ts');
    expect(transcriptSrc).not.toContain('shell: true');
    expect(preloadSrc).not.toContain('shell: true');
  });
});
