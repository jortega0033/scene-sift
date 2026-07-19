import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { runDependencyValidation } from '../../scripts/quality/dependencies-validate';

const tempRoots: string[] = [];

const writeFile = (root: string, relPath: string, content: string) => {
  const absPath = path.join(root, relPath);
  fs.mkdirSync(path.dirname(absPath), { recursive: true });
  fs.writeFileSync(absPath, content, 'utf8');
};

const createFixtureRepo = (packageJson: Record<string, unknown>) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'scenesift-deps-'));
  tempRoots.push(root);
  writeFile(root, 'package.json', JSON.stringify(packageJson, null, 2));
  writeFile(root, 'src/main/index.ts', 'export const x = 1;');
  writeFile(root, 'tests/sample.test.ts', 'export {}');
  writeFile(root, 'scripts/sample.ts', 'export {}');
  return root;
};

afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

describe('dependency validator', () => {
  it('fails when critical MCP packages are unpinned', () => {
    const root = createFixtureRepo({
      dependencies: { react: '^19.0.0' },
      devDependencies: {
        '@playwright/mcp': '^0.0.78',
        'chrome-devtools-mcp': '^1.6.0',
      },
    });
    const violations = runDependencyValidation(root);
    expect(violations.some((v) => v.rule === 'unpinned-critical-dependency')).toBe(true);
  });

  it('fails when duplicate icon stacks are installed', () => {
    const root = createFixtureRepo({
      dependencies: {
        react: '^19.0.0',
        'lucide-react': '^0.1.0',
        'react-icons': '^5.0.0',
      },
      devDependencies: {
        '@playwright/mcp': '0.0.78',
        'chrome-devtools-mcp': '1.6.0',
      },
    });
    writeFile(
      root,
      'src/main/use.ts',
      'import "react"; import "lucide-react"; import "react-icons";',
    );
    const violations = runDependencyValidation(root);
    expect(violations.some((v) => v.rule === 'duplicate-dependency-category')).toBe(true);
  });
});
