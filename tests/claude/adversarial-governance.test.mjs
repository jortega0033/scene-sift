/**
 * Adversarial governance tests.
 * Verifies gate.yaml structure and critical protection invariants.
 *
 * Run: node tests/claude/adversarial-governance.test.mjs
 * Or:  pnpm claude:test:adversarial
 */

import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');

let passed = 0;
let failed = 0;

function assert(name, condition, detail = '') {
  if (condition) {
    console.log(`  PASS: ${name}`);
    passed++;
  } else {
    console.error(`  FAIL: ${name}${detail ? ' — ' + detail : ''}`);
    failed++;
  }
}

// --- gate.yaml invariants ---
console.log('\n=== gate.yaml structure ===');
const gateYamlPath = join(ROOT, 'gate.yaml');
assert('gate.yaml exists', existsSync(gateYamlPath));

let gateContent = '';
if (existsSync(gateYamlPath)) {
  gateContent = readFileSync(gateYamlPath, 'utf-8');
}

assert('gate.yaml has forbiddenAutonomousActions', gateContent.includes('forbiddenAutonomousActions'));
assert('gate.yaml has forbiddenPatterns', gateContent.includes('forbiddenPatterns'));
assert('gate.yaml has requiredChecksByRisk', gateContent.includes('requiredChecksByRisk'));
assert('gate.yaml has risk level 4', /level.*4|4.*level|critical-forbidden/i.test(gateContent));
assert('gate.yaml forbids push-main', gateContent.includes('push-main'));
assert('gate.yaml forbids publish-release', gateContent.includes('publish-release'));
assert('gate.yaml forbids publish (pattern or action)', /publish/i.test(gateContent));

// --- settings.json invariants ---
console.log('\n=== .claude/settings.json structure ===');
const settingsPath = join(ROOT, '.claude', 'settings.json');
assert('.claude/settings.json exists', existsSync(settingsPath));

let settings = {};
if (existsSync(settingsPath)) {
  try {
    settings = JSON.parse(readFileSync(settingsPath, 'utf-8'));
  } catch (e) {
    assert('settings.json is valid JSON', false, e.message);
  }
}

assert('settings.json has permissions.allow', Array.isArray(settings.permissions?.allow));
assert('settings.json has permissions.deny', Array.isArray(settings.permissions?.deny));
assert('settings.json has hooks.PreToolUse', Array.isArray(settings.hooks?.PreToolUse));
assert('settings.json has hooks.PostToolUse', Array.isArray(settings.hooks?.PostToolUse));

const denyRules = settings.permissions?.deny ?? [];
assert('deny rules include git push', denyRules.some(r => r.includes('push') || r.includes('Bash(git push')));
assert('deny rules include publish', denyRules.some(r => r.includes('publish')));
assert('deny rules include --dangerously-skip-permissions', denyRules.some(r => r.includes('dangerously')));

// --- Hook files exist ---
console.log('\n=== hook file existence ===');
const hooks = [
  '.claude/hooks/protect-file-write.mjs',
  '.claude/hooks/protect-bash-command.mjs',
  '.claude/hooks/validate-config-change.mjs',
  '.claude/hooks/stop-validation.mjs',
  '.claude/hooks/record-agent-event.mjs',
];
for (const h of hooks) {
  assert(`${h} exists`, existsSync(join(ROOT, h)));
}

// --- Critical binding docs exist ---
console.log('\n=== binding document existence ===');
const bindingDocs = ['AGENTS.md', 'LOOP.md', 'loop-constraints.md', 'CLAUDE.md'];
for (const doc of bindingDocs) {
  assert(`${doc} exists`, existsSync(join(ROOT, doc)));
}

// --- CLAUDE.md references binding docs ---
console.log('\n=== CLAUDE.md content invariants ===');
const claudeMdPath = join(ROOT, 'CLAUDE.md');
if (existsSync(claudeMdPath)) {
  const claudeContent = readFileSync(claudeMdPath, 'utf-8');
  assert('CLAUDE.md imports AGENTS.md', claudeContent.includes('@AGENTS.md'));
  assert('CLAUDE.md imports loop-constraints.md', claudeContent.includes('@loop-constraints.md'));
  assert('CLAUDE.md references gate.yaml', claudeContent.includes('gate.yaml'));
  assert('CLAUDE.md states rules are not enforcement', /context.*not.*enforcement|not.*enforcement.*context/i.test(claudeContent));
}

// --- .mcp.json security invariants ---
console.log('\n=== .mcp.json security ===');
const mcpPath = join(ROOT, '.mcp.json');
assert('.mcp.json exists', existsSync(mcpPath));

let mcp = {};
if (existsSync(mcpPath)) {
  try {
    mcp = JSON.parse(readFileSync(mcpPath, 'utf-8'));
  } catch (e) {
    assert('.mcp.json is valid JSON', false, e.message);
  }
}

const cdtArgs = mcp.mcpServers?.['chrome-devtools']?.args ?? [];
assert('chrome-devtools uses --isolated', cdtArgs.includes('--isolated'));
assert('chrome-devtools restricts to localhost', cdtArgs.some(a => a.includes('127.0.0.1') || a.includes('localhost')));

const pwArgs = mcp.mcpServers?.playwright?.args ?? [];
assert('playwright uses --isolated', pwArgs.includes('--isolated'));
assert('playwright bound to 127.0.0.1', pwArgs.includes('127.0.0.1'));

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
process.exit(failed > 0 ? 1 : 0);
