import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { runArchitectureValidation } from '../../scripts/quality/architecture-validate';

const tempRoots: string[] = [];

const writeFile = (root: string, relPath: string, content: string) => {
  const absPath = path.join(root, relPath);
  fs.mkdirSync(path.dirname(absPath), { recursive: true });
  fs.writeFileSync(absPath, content, 'utf8');
};

const createFixtureRepo = () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'scenesift-arch-'));
  tempRoots.push(root);
  writeFile(
    root,
    'src/main/ipc/registerIpcHandlers.ts',
    'import { IPC_CHANNELS } from "@shared/ipc/channels"; IPC_CHANNELS.APP_GET_VERSION;',
  );
  writeFile(root, 'src/main/services/database/databaseService.ts', 'export const x = 1;');
  writeFile(
    root,
    'src/shared/ipc/channels.ts',
    'export const IPC_CHANNELS = { APP_GET_VERSION: "x" } as const;',
  );
  return root;
};

afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

describe('architecture validator', () => {
  it('passes for valid layer imports', () => {
    const root = createFixtureRepo();
    writeFile(
      root,
      'src/renderer/app.tsx',
      'import { IPC_CHANNELS } from "@shared/ipc/channels"; export const App = () => IPC_CHANNELS.APP_GET_VERSION;',
    );
    writeFile(
      root,
      'src/preload/index.ts',
      'import { contextBridge } from "electron"; contextBridge.exposeInMainWorld("x", {});',
    );
    writeFile(
      root,
      'src/main/index.ts',
      'import { IPC_CHANNELS } from "@shared/ipc/channels"; console.log(IPC_CHANNELS.APP_GET_VERSION);',
    );

    const violations = runArchitectureValidation(root);
    expect(violations).toEqual([]);
  });

  it('fails when renderer imports electron', () => {
    const root = createFixtureRepo();
    writeFile(
      root,
      'src/renderer/bad.ts',
      'import { ipcRenderer } from "electron"; console.log(ipcRenderer);',
    );

    const violations = runArchitectureValidation(root);
    expect(violations.some((v) => v.rule === 'renderer-privileged-import')).toBe(true);
  });

  it('fails when shared imports main', () => {
    const root = createFixtureRepo();
    writeFile(
      root,
      'src/shared/leak.ts',
      'import { createMainWindow } from "@main/windows/createMainWindow";',
    );

    const violations = runArchitectureValidation(root);
    expect(violations.some((v) => v.rule === 'shared-layer-leak')).toBe(true);
  });

  it('fails when native exec happens outside approved services', () => {
    const root = createFixtureRepo();
    writeFile(
      root,
      'src/main/services/unsafe.ts',
      'import { spawn } from "node:child_process"; spawn("ls", []);',
    );

    const violations = runArchitectureValidation(root);
    expect(violations.some((v) => v.rule === 'native-exec-boundary')).toBe(true);
  });
});
