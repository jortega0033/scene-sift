// @vitest-environment node
import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, it } from 'vitest';

function grepRecursive(dir: string, extensions: string[]): string[] {
  const results: string[] = [];
  try {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      const stat = statSync(full);
      if (stat.isDirectory()) {
        results.push(...grepRecursive(full, extensions));
      } else if (extensions.some((ext) => entry.endsWith(ext))) {
        results.push(full);
      }
    }
  } catch {
    // ignore unreadable dirs
  }
  return results;
}

describe('subtitle security governance', () => {
  it('no renderer subtitle component uses dangerouslySetInnerHTML', () => {
    const rendererDir = join(process.cwd(), 'src', 'renderer');
    const files = grepRecursive(rendererDir, ['.tsx', '.ts']);

    const violators: string[] = [];
    for (const file of files) {
      const content = readFileSync(file, 'utf8');
      if (content.includes('dangerouslySetInnerHTML')) {
        violators.push(file);
      }
    }

    expect(violators).toHaveLength(0);
  });

  it('SrtParser has no node: or electron imports', () => {
    const content = readFileSync(
      join(process.cwd(), 'src/main/services/subtitle/parsers/SrtParser.ts'),
      'utf8',
    );
    expect(content).not.toMatch(/from ['"]node:/);
    expect(content).not.toMatch(/from ['"]electron/);
  });

  it('VttParser has no node: or electron imports', () => {
    const content = readFileSync(
      join(process.cwd(), 'src/main/services/subtitle/parsers/VttParser.ts'),
      'utf8',
    );
    expect(content).not.toMatch(/from ['"]node:/);
    expect(content).not.toMatch(/from ['"]electron/);
  });

  it('subtitleNormalizer has no node: or electron imports', () => {
    const content = readFileSync(
      join(process.cwd(), 'src/main/services/subtitle/subtitleNormalizer.ts'),
      'utf8',
    );
    expect(content).not.toMatch(/from ['"]node:/);
    expect(content).not.toMatch(/from ['"]electron/);
  });

  it('subtitleReader rejects a path that does not exist with SUBTITLE_FILE_NOT_FOUND', async () => {
    const { readSubtitleFile } = await import('@main/services/subtitle/subtitleReader');
    await expect(
      readSubtitleFile('/tmp/this-path-does-not-exist-scenesift-test-12345.srt'),
    ).rejects.toMatchObject({ code: 'SUBTITLE_FILE_NOT_FOUND' });
  });

  it('subtitleReader rejects a directory path (not a regular file)', async () => {
    const { readSubtitleFile } = await import('@main/services/subtitle/subtitleReader');
    await expect(readSubtitleFile(tmpdir())).rejects.toMatchObject({
      code: 'SUBTITLE_FILE_NOT_FOUND',
    });
  });

  it('subtitleReader rejects a file exceeding MAX_SUBTITLE_BYTES (2 MB)', async () => {
    const { readSubtitleFile } = await import('@main/services/subtitle/subtitleReader');
    const dir = mkdtempSync(join(tmpdir(), 'scenesift-sec-'));
    const filePath = join(dir, 'big.srt');
    writeFileSync(filePath, Buffer.alloc(2_097_153, 'x'));
    try {
      await expect(readSubtitleFile(filePath)).rejects.toMatchObject({
        code: 'SUBTITLE_FILE_TOO_LARGE',
      });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('subtitle IPC channels are wired to projectId-only payloads in preload', () => {
    const content = readFileSync(join(process.cwd(), 'src/preload/index.ts'), 'utf8');
    // All three subtitle channels are referenced via typed constants
    expect(content).toContain('SUBTITLE_SELECT_FOR_PROJECT');
    expect(content).toContain('SUBTITLE_PARSE_FOR_PROJECT');
    expect(content).toContain('SUBTITLE_CLEAR_FOR_PROJECT');
    // Payload is projectId only (no path passthrough to renderer)
    expect(content).toContain('{ projectId }');
    // No channel exposes a generic invoke passthrough
    expect(content).not.toMatch(/exposeInMainWorld\(['"]invoke['"]/);
  });

  it('preload does not expose raw ipcRenderer', () => {
    const content = readFileSync(join(process.cwd(), 'src/preload/index.ts'), 'utf8');
    expect(content).not.toMatch(/exposeInMainWorld\(['"]ipcRenderer['"]/);
    expect(content).not.toMatch(/exposeInMainWorld\(['"]require['"]/);
  });
});
