#!/usr/bin/env node
/**
 * Validates .claude/settings.json and .mcp.json structure and required invariants.
 * Exit 0 = pass, 1 = fail.
 */

import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
let errors = 0;

function fail(msg) {
  console.error(`  FAIL: ${msg}`);
  errors++;
}
function pass(msg) {
  console.log(`  PASS: ${msg}`);
}
function check(label, condition, failMsg) {
  if (condition) {
    pass(label);
  } else {
    fail(failMsg ?? label);
  }
}

// --- .claude/settings.json ---
console.log('\nValidating .claude/settings.json ...');
const settingsPath = join(ROOT, '.claude', 'settings.json');
if (!existsSync(settingsPath)) {
  fail('.claude/settings.json not found');
} else {
  let s;
  try {
    s = JSON.parse(readFileSync(settingsPath, 'utf-8'));
    pass('settings.json is valid JSON');
  } catch (e) {
    fail(`settings.json parse error: ${e.message}`);
    s = null;
  }
  if (s) {
    check('has permissions.allow array', Array.isArray(s.permissions?.allow));
    check('has permissions.deny array', Array.isArray(s.permissions?.deny));
    check('has hooks.PreToolUse', Array.isArray(s.hooks?.PreToolUse));
    check('has hooks.PostToolUse', Array.isArray(s.hooks?.PostToolUse));
    check('has hooks.Stop', Array.isArray(s.hooks?.Stop));
    check('has hooks.SubagentStop', Array.isArray(s.hooks?.SubagentStop));

    const deny = s.permissions?.deny ?? [];
    check('deny includes git push', deny.some(r => /push/.test(r)), 'deny rules must include git push');
    check('deny includes publish', deny.some(r => /publish/.test(r)), 'deny rules must include publish');
    check('deny includes --dangerously-skip-permissions',
      deny.some(r => /dangerously/.test(r)),
      'deny rules must include --dangerously-skip-permissions');

    const preToolUse = s.hooks?.PreToolUse ?? [];
    const hookFiles = [
      '.claude/hooks/protect-file-write.mjs',
      '.claude/hooks/protect-bash-command.mjs',
    ];
    for (const hf of hookFiles) {
      const registered = preToolUse.some(h => JSON.stringify(h).includes(hf));
      check(`PreToolUse hook ${hf} registered`, registered);
    }
  }
}

// --- hook files exist ---
console.log('\nValidating hook files exist ...');
const hooks = [
  '.claude/hooks/protect-file-write.mjs',
  '.claude/hooks/protect-bash-command.mjs',
  '.claude/hooks/validate-config-change.mjs',
  '.claude/hooks/stop-validation.mjs',
  '.claude/hooks/record-agent-event.mjs',
];
for (const h of hooks) {
  check(h, existsSync(join(ROOT, h)), `${h} not found`);
}

// --- .mcp.json ---
console.log('\nValidating .mcp.json ...');
const mcpPath = join(ROOT, '.mcp.json');
if (!existsSync(mcpPath)) {
  fail('.mcp.json not found');
} else {
  let mcp;
  try {
    mcp = JSON.parse(readFileSync(mcpPath, 'utf-8'));
    pass('.mcp.json is valid JSON');
  } catch (e) {
    fail(`mcp.json parse error: ${e.message}`);
    mcp = null;
  }
  if (mcp) {
    const cdtArgs = mcp.mcpServers?.['chrome-devtools']?.args ?? [];
    check('chrome-devtools --isolated', cdtArgs.includes('--isolated'));
    check('chrome-devtools localhost-only',
      cdtArgs.some(a => a.includes('127.0.0.1') || a.includes('localhost')));

    const pwArgs = mcp.mcpServers?.playwright?.args ?? [];
    check('playwright --isolated', pwArgs.includes('--isolated'));
    check('playwright --host 127.0.0.1', pwArgs.includes('127.0.0.1'));
  }
}

console.log(`\n${errors === 0 ? 'PASS' : 'FAIL'}: ${errors} error(s)\n`);
process.exit(errors > 0 ? 1 : 0);
