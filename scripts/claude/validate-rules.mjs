#!/usr/bin/env node
/**
 * Validates .claude/rules/*.md have globs frontmatter.
 */

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const RULES_DIR = join(ROOT, '.claude', 'rules');
let errors = 0;

function fail(msg) { console.error(`  FAIL: ${msg}`); errors++; }
function pass(msg) { console.log(`  PASS: ${msg}`); }

const REQUIRED_RULES = [
  'governance.md',
  'architecture.md',
  'electron-main.md',
  'preload-ipc.md',
  'renderer.md',
  'media-pipeline.md',
  'database.md',
  'runtime-ai.md',
  'tests.md',
  'design-system.md',
  'documentation.md',
];

console.log('\nValidating .claude/rules/ ...');

if (!existsSync(RULES_DIR)) {
  fail('.claude/rules/ directory not found');
  process.exit(1);
}

const files = readdirSync(RULES_DIR).filter(f => f.endsWith('.md'));

for (const required of REQUIRED_RULES) {
  if (!files.includes(required)) {
    fail(`Missing required rule: ${required}`);
  }
}

for (const file of files) {
  const content = readFileSync(join(RULES_DIR, file), 'utf-8');
  if (!content.startsWith('---')) {
    fail(`${file}: missing frontmatter`);
    continue;
  }
  const fmEnd = content.indexOf('---', 3);
  const fm = content.slice(3, fmEnd);
  if (!fm.includes('globs:')) fail(`${file}: frontmatter missing 'globs'`);
  else pass(`${file}: has globs`);
}

console.log(`\n${errors === 0 ? 'PASS' : 'FAIL'}: ${errors} error(s)\n`);
process.exit(errors > 0 ? 1 : 0);
