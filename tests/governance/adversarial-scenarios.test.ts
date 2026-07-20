import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { evaluateChangeSet, loadGateConfig } from '../../scripts/governance/gate';
import { validateCIPinning } from '../../scripts/governance/validate-ci-pinning';
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

const createCIPinningFixture = (workflows: Record<string, string>) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'scenesift-ci-pinning-'));
  tempRoots.push(root);
  for (const [name, content] of Object.entries(workflows)) {
    writeFile(root, `.github/workflows/${name}`, content);
  }
  return root;
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

  // --- Phase-21 expansion: 20 additional scenarios to reach 54 automated ---

  // Additional forbidden autonomous actions (5 scenarios)
  it('detects forbidden delete-user-media action', () => {
    const assessment = evaluateChangeSet(gateConfig, [], ['delete-user-media'], {});
    expect(assessment.forbiddenActionsHit).toContain('delete-user-media');
  });

  it('detects forbidden change-signing-config action', () => {
    const assessment = evaluateChangeSet(gateConfig, [], ['change-signing-config'], {});
    expect(assessment.forbiddenActionsHit).toContain('change-signing-config');
  });

  it('detects forbidden edit-env-files action', () => {
    const assessment = evaluateChangeSet(gateConfig, [], ['edit-env-files'], {});
    expect(assessment.forbiddenActionsHit).toContain('edit-env-files');
  });

  it('detects forbidden disable-tests action', () => {
    const assessment = evaluateChangeSet(gateConfig, [], ['disable-tests'], {});
    expect(assessment.forbiddenActionsHit).toContain('disable-tests');
  });

  it('detects forbidden disable-security-settings action', () => {
    const assessment = evaluateChangeSet(gateConfig, [], ['disable-security-settings'], {});
    expect(assessment.forbiddenActionsHit).toContain('disable-security-settings');
  });

  // Edge-case forbidden-pattern detection (3 scenarios)
  it('detects command injection via execSync template string', () => {
    const assessment = evaluateChangeSet(gateConfig, ['src/main/services/files/unsafe.ts'], [], {
      'src/main/services/files/unsafe.ts': 'exec(`rm -rf ${userPath}`)',
    });
    expect(
      assessment.forbiddenPatternsHit.some((p) => p.id === 'command-injection-exec-string'),
    ).toBe(true);
  });

  it('detects upload-user-media as forbidden autonomous action', () => {
    const assessment = evaluateChangeSet(gateConfig, [], ['upload-user-media'], {});
    expect(assessment.forbiddenActionsHit).toContain('upload-user-media');
  });

  it('detects renderer process.env secret access with TOKEN suffix', () => {
    const assessment = evaluateChangeSet(gateConfig, ['src/renderer/components/Foo.tsx'], [], {
      'src/renderer/components/Foo.tsx': 'const t = process.env.AI_TOKEN',
    });
    expect(
      assessment.forbiddenPatternsHit.some((p) => p.id === 'renderer-process-env-secrets'),
    ).toBe(true);
  });

  // Architecture fixture tests: database boundary, shared-layer leak, main→renderer import (4 scenarios)
  it('detects database access outside approved boundary', () => {
    const root = createArchitectureFixture();
    writeFile(root, 'src/renderer/unsafe.ts', "import Database from 'better-sqlite3';");
    const violations = runArchitectureValidation(root);
    expect(violations.some((v) => v.rule === 'database-boundary')).toBe(true);
  });

  it('detects shared layer importing renderer implementation', () => {
    const root = createArchitectureFixture();
    writeFile(root, 'src/shared/schemas/bad.ts', 'import { App } from "@renderer/app";');
    const violations = runArchitectureValidation(root);
    expect(violations.some((v) => v.rule === 'shared-layer-leak')).toBe(true);
  });

  it('detects main process importing renderer components', () => {
    const root = createArchitectureFixture();
    writeFile(root, 'src/main/index.ts', 'import { App } from "@renderer/app/App";');
    const violations = runArchitectureValidation(root);
    expect(violations.some((v) => v.rule === 'main-imports-renderer')).toBe(true);
  });

  it('detects QA adapter import from non-main-entry file', () => {
    const root = createArchitectureFixture();
    writeFile(root, 'src/renderer/features/projects/ProjectsPage.tsx', 'import { installBridge } from "@renderer/qa/installBridge";');
    const violations = runArchitectureValidation(root);
    expect(violations.some((v) => v.rule === 'qa-adapter-leak')).toBe(true);
  });

  // Design fixture tests: glassmorphism/blur, raw color function, arbitrary border-radius (3 scenarios)
  it('detects arbitrary Tailwind spacing bracket syntax', () => {
    const root = createArchitectureFixture();
    writeFile(root, 'src/renderer/App.tsx', 'const cls = "mt-[16px] px-[8px]";');
    const violations = runDesignValidation(root);
    expect(violations.some((v) => v.rule === 'arbitrary-spacing-value')).toBe(true);
  });

  it('detects raw rgb() color function in UI source', () => {
    const root = createArchitectureFixture();
    writeFile(root, 'src/renderer/App.tsx', 'const c = "rgb(255, 0, 0)";');
    const violations = runDesignValidation(root);
    expect(violations.some((v) => v.rule === 'raw-color-function')).toBe(true);
  });

  it('detects raw hex color value in CSS', () => {
    const root = createArchitectureFixture();
    writeFile(root, 'src/renderer/styles/override.css', '.btn { color: #ff0000; }');
    const violations = runDesignValidation(root);
    expect(violations.some((v) => v.rule === 'raw-hex-color')).toBe(true);
  });

  // Dependency fixture tests: prohibited SDKs, analytics (3 scenarios)
  it('detects prohibited analytics SDK (posthog)', () => {
    const root = createArchitectureFixture();
    writeFile(
      root,
      'package.json',
      JSON.stringify(
        {
          dependencies: { react: '^19.2.0', 'posthog-js': '^1.0.0', 'lucide-react': '^0.542.0' },
          devDependencies: { '@playwright/mcp': '0.0.78', 'chrome-devtools-mcp': '1.6.0' },
        },
        null,
        2,
      ),
    );
    const violations = runDependencyValidation(root);
    expect(violations.some((v) => v.rule === 'prohibited-telemetry-dependency')).toBe(true);
  });

  it('detects prohibited Sentry browser SDK', () => {
    const root = createArchitectureFixture();
    writeFile(
      root,
      'package.json',
      JSON.stringify(
        {
          dependencies: { react: '^19.2.0', '@sentry/browser': '^7.0.0', 'lucide-react': '^0.542.0' },
          devDependencies: { '@playwright/mcp': '0.0.78', 'chrome-devtools-mcp': '1.6.0' },
        },
        null,
        2,
      ),
    );
    const violations = runDependencyValidation(root);
    expect(violations.some((v) => v.rule === 'prohibited-telemetry-dependency')).toBe(true);
  });

  // Gate.yaml structure completeness (2 scenarios)
  it('gate.yaml has a kill-switch field', () => {
    expect(typeof gateConfig.killSwitch).toBe('object');
    expect(typeof gateConfig.killSwitch.enabled).toBe('boolean');
  });

  it('gate.yaml forbids all required autonomous actions', () => {
    const required = [
      'edit-env-files', 'add-secrets', 'push-main', 'merge-pr', 'publish-release',
      'delete-user-media', 'change-signing-config', 'upload-user-media',
      'disable-security-settings', 'disable-tests',
    ];
    for (const action of required) {
      expect(gateConfig.forbiddenAutonomousActions).toContain(action);
    }
  });

  it('gate.yaml requiredChecksByRisk covers all risk levels 0-4', () => {
    for (const level of ['0', '1', '2', '3', '4']) {
      const checks = gateConfig.requiredChecksByRisk[level];
      expect(Array.isArray(checks)).toBe(true);
      expect(checks.length).toBeGreaterThan(0);
    }
  });

  // --- M6 AI provider adversarial scenarios ---

  it('detects redirect:follow in AI HTTP client code', () => {
    const assessment = evaluateChangeSet(
      gateConfig,
      ['src/main/services/ai/aiHttpClient.ts'],
      [],
      { 'src/main/services/ai/aiHttpClient.ts': "fetch(url, { redirect: 'follow', method: 'POST' })" },
    );
    expect(assessment.forbiddenPatternsHit.some((p) => p.id === 'ai-redirect-follow')).toBe(true);
  });

  it('detects redirect:follow double-quoted variant', () => {
    const assessment = evaluateChangeSet(
      gateConfig,
      ['src/main/services/ai/aiHttpClient.ts'],
      [],
      { 'src/main/services/ai/aiHttpClient.ts': 'fetch(url, { redirect: "follow" })' },
    );
    expect(assessment.forbiddenPatternsHit.some((p) => p.id === 'ai-redirect-follow')).toBe(true);
  });

  it('does NOT flag redirect:manual — correct production setting', () => {
    const assessment = evaluateChangeSet(
      gateConfig,
      ['src/main/services/ai/aiHttpClient.ts'],
      [],
      { 'src/main/services/ai/aiHttpClient.ts': "fetch(url, { redirect: 'manual', method: 'POST' })" },
    );
    expect(assessment.forbiddenPatternsHit.some((p) => p.id === 'ai-redirect-follow')).toBe(false);
  });

  it('classifies AI service files as high risk (risk 3)', () => {
    const assessment = evaluateChangeSet(
      gateConfig,
      ['src/main/services/ai/aiHttpClient.ts'],
      [],
      {},
    );
    expect(assessment.maxRisk).toBe(3);
  });

  it('classifies AI configuration service as high risk', () => {
    const assessment = evaluateChangeSet(
      gateConfig,
      ['src/main/services/ai/aiConfigurationService.ts'],
      [],
      {},
    );
    expect(assessment.maxRisk).toBe(3);
  });

  it('detects forbidden change-ai-retention-policy action', () => {
    const assessment = evaluateChangeSet(gateConfig, [], ['change-ai-retention-policy'], {});
    expect(assessment.forbiddenActionsHit).toContain('change-ai-retention-policy');
  });

  it('production aiHttpClient.ts does not use redirect:follow', () => {
    const aiHttpClientPath = path.join(repoRoot, 'src/main/services/ai/aiHttpClient.ts');
    const content = fs.readFileSync(aiHttpClientPath, 'utf-8');
    expect(content).not.toMatch(/redirect\s*:\s*['"]follow['"]/);
    expect(content).toMatch(/redirect\s*:\s*['"]manual['"]/);
  });

  it('production AiConfigurationStatusResponse schema does not include apiKey field', () => {
    const schemaPath = path.join(repoRoot, 'src/shared/schemas/ai.ts');
    const content = fs.readFileSync(schemaPath, 'utf-8');
    // Match just the Zod object block for the status response schema (stops at closing brace + semicolon)
    const responseSchemaMatch = content.match(
      /aiConfigurationStatusResponseSchema\s*=\s*z\.object\(\{[\s\S]*?\}\)/,
    );
    expect(responseSchemaMatch).not.toBeNull();
    expect(responseSchemaMatch![0]).not.toMatch(/\bapiKey\b/);
  });

  // --- CI SHA pinning validator (6 scenarios) ---

  it('CI pinning validator detects floating @v4 tag', () => {
    const root = createCIPinningFixture({
      'test.yml': 'jobs:\n  build:\n    steps:\n      - uses: actions/checkout@v4\n',
    });
    const violations = validateCIPinning(root);
    expect(violations).toHaveLength(1);
    expect(violations[0].action).toBe('actions/checkout@v4');
    expect(violations[0].pinType).toBe('floating-tag');
  });

  it('CI pinning validator detects @main branch pin', () => {
    const root = createCIPinningFixture({
      'test.yml': 'jobs:\n  build:\n    steps:\n      - uses: some-org/some-action@main\n',
    });
    const violations = validateCIPinning(root);
    expect(violations).toHaveLength(1);
    expect(violations[0].pinType).toBe('branch');
  });

  it('CI pinning validator accepts 40-char SHA pin', () => {
    const root = createCIPinningFixture({
      'test.yml':
        'jobs:\n  build:\n    steps:\n      - uses: actions/checkout@34e114876b0b11c390a56381ad16ebd13914f8d5  # v4\n',
    });
    const violations = validateCIPinning(root);
    expect(violations).toHaveLength(0);
  });

  it('CI pinning validator exempts local composite actions', () => {
    const root = createCIPinningFixture({
      'test.yml': 'jobs:\n  build:\n    steps:\n      - uses: ./.github/actions/setup\n',
    });
    const violations = validateCIPinning(root);
    expect(violations).toHaveLength(0);
  });

  it('CI pinning validator exempts docker:// actions', () => {
    const root = createCIPinningFixture({
      'test.yml': 'jobs:\n  build:\n    steps:\n      - uses: docker://node:18\n',
    });
    const violations = validateCIPinning(root);
    expect(violations).toHaveLength(0);
  });

  it('all project workflow files are SHA-pinned', () => {
    const violations = validateCIPinning(repoRoot);
    expect(violations).toHaveLength(0);
  });

  // --- Memory policy validator (4 scenarios) ---

  it('memory validator passes clean memory files', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scenesift-mem-'));
    tempRoots.push(tmpDir);
    fs.writeFileSync(path.join(tmpDir, 'notes.md'), '# Notes\n\nGeneral project notes.\n', 'utf8');
    const result = spawnSync('node', ['scripts/claude/validate-memory-policy.mjs'], {
      cwd: repoRoot,
      encoding: 'utf-8',
      env: { ...process.env, SCENESIFT_CLAUDE_MEMORY_ROOT: tmpDir },
    });
    expect(result.status).toBe(0);
  });

  it('memory validator flags API key in memory file', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scenesift-mem-'));
    tempRoots.push(tmpDir);
    fs.writeFileSync(path.join(tmpDir, 'creds.md'), 'api_key: sk-abc12345678901234\n', 'utf8');
    const result = spawnSync('node', ['scripts/claude/validate-memory-policy.mjs'], {
      cwd: repoRoot,
      encoding: 'utf-8',
      env: { ...process.env, SCENESIFT_CLAUDE_MEMORY_ROOT: tmpDir },
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('VIOLATION');
  });

  it('memory validator flags bearer token in memory file', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scenesift-mem-'));
    tempRoots.push(tmpDir);
    fs.writeFileSync(
      path.join(tmpDir, 'auth.md'),
      'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.payload\n',
      'utf8',
    );
    const result = spawnSync('node', ['scripts/claude/validate-memory-policy.mjs'], {
      cwd: repoRoot,
      encoding: 'utf-8',
      env: { ...process.env, SCENESIFT_CLAUDE_MEMORY_ROOT: tmpDir },
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('VIOLATION');
  });

  it('memory validator warns when SCENESIFT_CLAUDE_MEMORY_ROOT path does not exist', () => {
    const nonExistentPath = path.join(os.tmpdir(), 'scenesift-mem-nonexistent-xyzzy123');
    const result = spawnSync('node', ['scripts/claude/validate-memory-policy.mjs'], {
      cwd: repoRoot,
      encoding: 'utf-8',
      env: { ...process.env, SCENESIFT_CLAUDE_MEMORY_ROOT: nonExistentPath },
    });
    expect(result.status).toBe(0);
    const combinedOutput = (result.stdout ?? '') + (result.stderr ?? '');
    expect(combinedOutput).toContain('WARNING');
  });
});
