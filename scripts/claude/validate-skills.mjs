#!/usr/bin/env node
/**
 * Validates .claude/skills/ — each skill dir must have a SKILL.md.
 */

import { existsSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SKILLS_DIR = join(ROOT, '.claude', 'skills');
let errors = 0;

function fail(msg) { console.error(`  FAIL: ${msg}`); errors++; }
function pass(msg) { console.log(`  PASS: ${msg}`); }

const REQUIRED_SKILLS = [
  'governed-task',
  'verify-change',
  'architecture-review',
  'visual-qa',
  'dependency-review',
  'governance-change',
  'baseline-update',
  'memory-audit',
  'incident-response',
];

console.log('\nValidating .claude/skills/ ...');

if (!existsSync(SKILLS_DIR)) {
  fail('.claude/skills/ directory not found');
  process.exit(1);
}

const dirs = readdirSync(SKILLS_DIR).filter(f => statSync(join(SKILLS_DIR, f)).isDirectory());

for (const required of REQUIRED_SKILLS) {
  if (!dirs.includes(required)) {
    fail(`Missing required skill directory: ${required}`);
    continue;
  }
  const skillFile = join(SKILLS_DIR, required, 'SKILL.md');
  if (!existsSync(skillFile)) {
    fail(`${required}/SKILL.md not found`);
  } else {
    pass(`${required}/SKILL.md exists`);
  }
}

console.log(`\n${errors === 0 ? 'PASS' : 'FAIL'}: ${errors} error(s)\n`);
process.exit(errors > 0 ? 1 : 0);
