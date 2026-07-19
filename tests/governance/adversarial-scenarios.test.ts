import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { evaluateChangeSet, loadGateConfig } from '../../scripts/governance/gate';
import { runArchitectureValidation } from '../../scripts/quality/architecture-validate';
import { runDesignValidation } from '../../scripts/quality/design-validate';
import { runDependencyValidation } from '../../scripts/quality/dependencies-validate';

const repoRoot = process.cwd();
const gateConfig = loadGateConfig(repoRoot);

const tempRoots: string[] = [];

const writeFile = (root: string, relPath: string, content: string) => {
  const absPath = path.join(root, relPath);
  fs.mkdirSync(path.dirname(absPath), { recursive: true });
  fs.writeFileSync(absPath, content, 'utf8');
};

const createArchitectureFixture = () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'scenesift-governance-'));
  tempRoots.push(root);
  writeFile(
    root,
    'src/main/ipc/registerIpcHandlers.ts',
    'import { IPC_CHANNELS } from "@shared/ipc/channels"; IPC_CHANNELS.APP_GET_VERSION;',
  );
  writeFile(root, 'src/main/services/database/databaseService.ts', 'export const db = true;');
  writeFile(
    root,
    'src/shared/ipc/channels.ts',
    "export const IPC_CHANNELS = { APP_GET_VERSION: 'x' } as const;",
  );
  writeFile(
    root,
    'src/renderer/styles/globals.css',
    `
:root {
  --background: 0 0% 97%;
  --foreground: 0 0% 8%;
  --card: 0 0% 100%;
  --border: 0 0% 78%;
  --muted: 0 0% 94%;
  --focus-ring: 0 0% 20%;
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
  --layout-content-max: 1280px;
  --z-overlay: 30;
  --motion-fast: 120ms;
  --icon-size-sm: 14px;
}
`,
  );
  writeFile(
    root,
    'package.json',
    JSON.stringify(
      {
        dependencies: { react: '^19.2.0', 'lucide-react': '^0.542.0' },
        devDependencies: { '@playwright/mcp': '0.0.78', 'chrome-devtools-mcp': '1.6.0' },
      },
      null,
      2,
    ),
  );
  return root;
};

afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

describe('governance adversarial scenarios', () => {
  it('classifies src/main as high risk', () => {
    const assessment = evaluateChangeSet(gateConfig, ['src/main/index.ts'], [], {});
    expect(assessment.maxRisk).toBe(3);
  });

  it('classifies preload IPC paths as high risk', () => {
    const assessment = evaluateChangeSet(gateConfig, ['src/preload/api.ts'], [], {});
    expect(assessment.maxRisk).toBe(3);
  });

  it('classifies migrations as high risk', () => {
    const assessment = evaluateChangeSet(
      gateConfig,
      ['src/database/migrations/0001_x.sql'],
      [],
      {},
    );
    expect(assessment.maxRisk).toBe(3);
  });

  it('classifies docs as risk 0', () => {
    const assessment = evaluateChangeSet(gateConfig, ['docs/ARCHITECTURE.md'], [], {});
    expect(assessment.maxRisk).toBe(0);
  });

  it('classifies tests as risk 1', () => {
    const assessment = evaluateChangeSet(gateConfig, ['tests/main/ipc-contracts.test.ts'], [], {});
    expect(assessment.maxRisk).toBe(1);
  });

  it('classifies renderer features as risk 2', () => {
    const assessment = evaluateChangeSet(
      gateConfig,
      ['src/renderer/features/projects/ProjectsPage.tsx'],
      [],
      {},
    );
    expect(assessment.maxRisk).toBe(2);
  });

  it('detects forbidden shell true pattern', () => {
    const assessment = evaluateChangeSet(
      gateConfig,
      ['src/main/services/process/runCommand.ts'],
      [],
      {
        'src/main/services/process/runCommand.ts': "spawn('x', { shell: true })",
      },
    );
    expect(assessment.forbiddenPatternsHit.some((p) => p.id === 'shell-true')).toBe(true);
  });

  it('detects insecure nodeIntegration flag', () => {
    const assessment = evaluateChangeSet(gateConfig, ['src/main/windows/createMainWindow.ts'], [], {
      'src/main/windows/createMainWindow.ts': 'nodeIntegration: true',
    });
    expect(assessment.forbiddenPatternsHit.some((p) => p.id === 'node-integration-true')).toBe(
      true,
    );
  });

  it('detects insecure contextIsolation=false', () => {
    const assessment = evaluateChangeSet(gateConfig, ['src/main/windows/createMainWindow.ts'], [], {
      'src/main/windows/createMainWindow.ts': 'contextIsolation: false',
    });
    expect(assessment.forbiddenPatternsHit.some((p) => p.id === 'context-isolation-false')).toBe(
      true,
    );
  });

  it('detects disabled web security', () => {
    const assessment = evaluateChangeSet(gateConfig, ['src/main/windows/createMainWindow.ts'], [], {
      'src/main/windows/createMainWindow.ts': 'webSecurity: false',
    });
    expect(assessment.forbiddenPatternsHit.some((p) => p.id === 'web-security-false')).toBe(true);
  });

  it('detects renderer raw ipc exposure', () => {
    const assessment = evaluateChangeSet(gateConfig, ['src/preload/index.ts'], [], {
      'src/preload/index.ts': "contextBridge.exposeInMainWorld('x', { ipcRenderer })",
    });
    expect(assessment.forbiddenPatternsHit.some((p) => p.id === 'raw-ipcrenderer-exposure')).toBe(
      true,
    );
  });

  it('detects process env secret access in renderer', () => {
    const assessment = evaluateChangeSet(gateConfig, ['src/renderer/main.tsx'], [], {
      'src/renderer/main.tsx': 'const x = process.env.OPENAI_API_KEY',
    });
    expect(
      assessment.forbiddenPatternsHit.some((p) => p.id === 'renderer-process-env-secrets'),
    ).toBe(true);
  });

  it('detects production telemetry without consent marker', () => {
    const assessment = evaluateChangeSet(gateConfig, ['src/main/telemetry.ts'], [], {
      'src/main/telemetry.ts': 'const enabled = true; sendTelemetry(event)',
    });
    expect(
      assessment.forbiddenPatternsHit.some((p) => p.id === 'telemetry-without-consent-guard'),
    ).toBe(true);
  });

  it('detects forbidden autonomous merge action', () => {
    const assessment = evaluateChangeSet(gateConfig, [], ['merge-pr'], {});
    expect(assessment.forbiddenActionsHit).toContain('merge-pr');
  });

  it('detects forbidden production release action', () => {
    const assessment = evaluateChangeSet(gateConfig, [], ['publish-release'], {});
    expect(assessment.forbiddenActionsHit).toContain('publish-release');
  });

  it('requires full checks for high risk', () => {
    const assessment = evaluateChangeSet(
      gateConfig,
      ['src/main/ipc/registerIpcHandlers.ts'],
      [],
      {},
    );
    expect(assessment.requiredChecks).toContain('pnpm governance:validate');
    expect(assessment.requiredChecks).toContain('pnpm package:dir');
  });

  it('keeps low-risk checks lighter than high-risk', () => {
    const low = evaluateChangeSet(gateConfig, ['tests/shared/schemas.test.ts'], [], {});
    const high = evaluateChangeSet(gateConfig, ['src/main/index.ts'], [], {});
    expect(low.requiredChecks.length).toBeLessThan(high.requiredChecks.length);
  });

  it('loads gate.yaml successfully', () => {
    const gatePath = path.join(repoRoot, 'gate.yaml');
    expect(fs.existsSync(gatePath)).toBe(true);
    expect(gateConfig.version).toBeGreaterThan(0);
  });

  it('flags added secrets-like files via path classification', () => {
    const assessment = evaluateChangeSet(gateConfig, ['.env.production'], [], {});
    expect(assessment.maxRisk).toBe(4);
  });

  it('flags packaging changes as high risk', () => {
    const assessment = evaluateChangeSet(gateConfig, ['electron-builder.yml'], [], {});
    expect(assessment.maxRisk).toBe(3);
  });

  it('detects generic preload invoke patterns', () => {
    const assessment = evaluateChangeSet(gateConfig, ['src/preload/index.ts'], [], {
      'src/preload/index.ts':
        'const api = { invoke: (channel: string, payload: unknown) => ipcRenderer.invoke(channel, payload) };',
    });
    expect(assessment.forbiddenPatternsHit.some((p) => p.id === 'preload-generic-invoke')).toBe(
      true,
    );
  });

  it('detects shell command interpolation via exec template strings', () => {
    const assessment = evaluateChangeSet(gateConfig, ['src/main/services/files/unsafe.ts'], [], {
      'src/main/services/files/unsafe.ts': 'exec(`ffmpeg -i ${userInput}`)',
    });
    expect(
      assessment.forbiddenPatternsHit.some((p) => p.id === 'command-injection-exec-string'),
    ).toBe(true);
  });

  it('detects hardcoded secret-shaped values', () => {
    const assessment = evaluateChangeSet(gateConfig, ['src/main/config.ts'], [], {
      'src/main/config.ts': "const API_KEY = 'ABCD1234ABCD1234ABCD1234';",
    });
    expect(assessment.forbiddenPatternsHit.some((p) => p.id === 'hardcoded-secret-shape')).toBe(
      true,
    );
  });

  it('detects skipped tests', () => {
    const assessment = evaluateChangeSet(gateConfig, ['tests/e2e/new.spec.ts'], [], {
      'tests/e2e/new.spec.ts': "test.skip('x', () => {})",
    });
    expect(assessment.forbiddenPatternsHit.some((p) => p.id === 'test-skip-usage')).toBe(true);
  });

  it('detects trivial always-true assertions', () => {
    const assessment = evaluateChangeSet(gateConfig, ['tests/unit/x.test.ts'], [], {
      'tests/unit/x.test.ts': 'expect(true).toBe(true)',
    });
    expect(assessment.forbiddenPatternsHit.some((p) => p.id === 'trivial-truthy-assertion')).toBe(
      true,
    );
  });

  it('detects renderer importing node:fs', () => {
    const root = createArchitectureFixture();
    writeFile(root, 'src/renderer/unsafe.ts', 'import fs from "node:fs"; export default fs;');
    const violations = runArchitectureValidation(root);
    expect(violations.some((v) => v.rule === 'renderer-privileged-import')).toBe(true);
  });

  it('detects renderer importing database layer', () => {
    const root = createArchitectureFixture();
    writeFile(root, 'src/renderer/unsafe.ts', 'import { db } from "@database/client";');
    const violations = runArchitectureValidation(root);
    expect(violations.some((v) => v.rule === 'renderer-privileged-import')).toBe(true);
  });

  it('detects preload importing renderer internals', () => {
    const root = createArchitectureFixture();
    writeFile(
      root,
      'src/preload/index.ts',
      'import { App } from "@renderer/app/App"; console.log(App);',
    );
    const violations = runArchitectureValidation(root);
    expect(violations.some((v) => v.rule === 'preload-imports-renderer')).toBe(true);
  });

  it('detects unauthorized native execution site', () => {
    const root = createArchitectureFixture();
    writeFile(
      root,
      'src/main/unsafe.ts',
      'import { spawn } from "node:child_process"; spawn("ls", []);',
    );
    const violations = runArchitectureValidation(root);
    expect(violations.some((v) => v.rule === 'native-exec-boundary')).toBe(true);
  });

  it('detects gradients in renderer UI files', () => {
    const root = createArchitectureFixture();
    writeFile(root, 'src/renderer/App.tsx', 'const css = "linear-gradient(white, black)";');
    const violations = runDesignValidation(root);
    expect(violations.some((v) => v.rule === 'gradient-prohibited')).toBe(true);
  });

  it('detects remote font usage', () => {
    const root = createArchitectureFixture();
    writeFile(
      root,
      'src/renderer/styles/extra.css',
      "@import url('https://fonts.googleapis.com/css2?family=Inter');",
    );
    const violations = runDesignValidation(root);
    expect(violations.some((v) => v.rule === 'remote-font-prohibited')).toBe(true);
  });

  it('detects raw color literals in UI source', () => {
    const root = createArchitectureFixture();
    writeFile(root, 'src/renderer/App.tsx', 'const color = "#00ff00";');
    const violations = runDesignValidation(root);
    expect(violations.some((v) => v.rule === 'raw-hex-color')).toBe(true);
  });

  it('detects duplicate icon library dependencies', () => {
    const root = createArchitectureFixture();
    writeFile(
      root,
      'package.json',
      JSON.stringify(
        {
          dependencies: { react: '^19.2.0', 'lucide-react': '^0.542.0', 'react-icons': '^5.5.0' },
          devDependencies: { '@playwright/mcp': '0.0.78', 'chrome-devtools-mcp': '1.6.0' },
        },
        null,
        2,
      ),
    );
    const violations = runDependencyValidation(root);
    expect(violations.some((v) => v.rule === 'duplicate-dependency-category')).toBe(true);
  });

  it('detects unpinned MCP tool versions', () => {
    const root = createArchitectureFixture();
    writeFile(
      root,
      'package.json',
      JSON.stringify(
        {
          dependencies: { react: '^19.2.0' },
          devDependencies: { '@playwright/mcp': '^0.0.78', 'chrome-devtools-mcp': '~1.6.0' },
        },
        null,
        2,
      ),
    );
    const violations = runDependencyValidation(root);
    expect(violations.some((v) => v.rule === 'unpinned-critical-dependency')).toBe(true);
  });
});
