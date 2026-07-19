#!/usr/bin/env node
/**
 * Master Claude Code validation runner.
 * Runs all .claude/ validators and reports aggregate result.
 * Exit 0 = all pass, 1 = any fail.
 */

import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPTS = join(dirname(fileURLToPath(import.meta.url)));

const VALIDATORS = [
  { label: 'Config (settings.json + .mcp.json)', script: 'validate-config.mjs' },
  { label: 'Agents', script: 'validate-agents.mjs' },
  { label: 'Rules', script: 'validate-rules.mjs' },
  { label: 'Skills', script: 'validate-skills.mjs' },
  { label: 'Memory policy', script: 'validate-memory-policy.mjs' },
];

let allPassed = true;

console.log('\n======================================');
console.log('  Claude Code Governance Validation');
console.log('======================================\n');

for (const { label, script } of VALIDATORS) {
  console.log(`--- ${label} ---`);
  const result = spawnSync('node', [join(SCRIPTS, script)], { stdio: 'inherit' });
  if (result.status !== 0) {
    allPassed = false;
    console.error(`  ^^^ FAILED: ${label}\n`);
  }
}

console.log('\n======================================');
console.log(allPassed ? '  RESULT: ALL PASSED' : '  RESULT: FAILED — see errors above');
console.log('======================================\n');

process.exit(allPassed ? 0 : 1);
