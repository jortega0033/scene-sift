import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { runDesignValidation } from '../../scripts/quality/design-validate';

const tempRoots: string[] = [];

const writeFile = (root: string, relPath: string, content: string) => {
  const absPath = path.join(root, relPath);
  fs.mkdirSync(path.dirname(absPath), { recursive: true });
  fs.writeFileSync(absPath, content, 'utf8');
};

const createFixtureRepo = () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'scenesift-design-'));
  tempRoots.push(root);
  writeFile(
    root,
    'src/renderer/styles/globals.css',
    `
:root {
  --background: 0 0% 0%;
  --foreground: 0 0% 100%;
  --card: 0 0% 100%;
  --border: 0 0% 50%;
  --muted: 0 0% 90%;
  --focus-ring: 0 0% 25%;
  --radius-sm: 2px;
  --radius-md: 4px;
  --control-height: 36px;
  --sidebar-width: 220px;
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --font-size-xs: 11px;
  --font-size-sm: 13px;
  --font-size-base: 14px;
  --font-size-mono-path: 12px;
  --font-size-dot: 9px;
  --tracking-label: 0.06em;
  --tracking-heading: 0.08em;
  --tracking-brand: 0.12em;
  --layout-content-max: 1280px;
  --z-overlay: 30;
  --motion-fast: 100ms;
  --icon-size-sm: 14px;
}
`,
  );
  writeFile(root, 'src/shared/x.ts', 'export const x = 1;');
  writeFile(root, 'package.json', JSON.stringify({ dependencies: { 'lucide-react': '^0.1.0' } }));
  return root;
};

afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

describe('design validator', () => {
  it('passes on valid monochrome baseline files', () => {
    const root = createFixtureRepo();
    writeFile(root, 'src/renderer/App.tsx', 'export const App = () => null;');
    const violations = runDesignValidation(root);
    expect(violations).toEqual([]);
  });

  it('fails on gradients and raw color literals', () => {
    const root = createFixtureRepo();
    writeFile(
      root,
      'src/renderer/Bad.tsx',
      'const x = "linear-gradient(red, blue)"; const y = "#ff00aa";',
    );
    const violations = runDesignValidation(root);
    expect(violations.some((v) => v.rule === 'gradient-prohibited')).toBe(true);
    expect(violations.some((v) => v.rule === 'raw-hex-color')).toBe(true);
  });
});
