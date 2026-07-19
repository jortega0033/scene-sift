#!/usr/bin/env node
/**
 * Validates .claude/agents/*.md frontmatter (name, description, model).
 */

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const AGENTS_DIR = join(ROOT, '.claude', 'agents');
let errors = 0;

function fail(msg) { console.error(`  FAIL: ${msg}`); errors++; }
function pass(msg) { console.log(`  PASS: ${msg}`); }

const REQUIRED_AGENTS = [
  'scenesift-orchestrator.md',
  'governed-implementer.md',
  'architecture-reviewer.md',
  'electron-security-reviewer.md',
  'design-system-reviewer.md',
  'visual-qa-reviewer.md',
  'dependency-auditor.md',
  'governance-verifier.md',
  'incident-reviewer.md',
];

console.log('\nValidating .claude/agents/ ...');

if (!existsSync(AGENTS_DIR)) {
  fail('.claude/agents/ directory not found');
  process.exit(1);
}

const files = readdirSync(AGENTS_DIR).filter(f => f.endsWith('.md'));

for (const required of REQUIRED_AGENTS) {
  if (!files.includes(required)) {
    fail(`Missing required agent: ${required}`);
  }
}

for (const file of files) {
  const content = readFileSync(join(AGENTS_DIR, file), 'utf-8');
  const hasFrontmatter = content.startsWith('---');
  if (!hasFrontmatter) {
    fail(`${file}: missing YAML frontmatter`);
    continue;
  }
  const fmEnd = content.indexOf('---', 3);
  const fm = content.slice(3, fmEnd);
  if (!fm.includes('name:')) fail(`${file}: frontmatter missing 'name'`);
  else pass(`${file}: has name`);
  if (!fm.includes('description:')) fail(`${file}: frontmatter missing 'description'`);
  else pass(`${file}: has description`);
}

console.log(`\n${errors === 0 ? 'PASS' : 'FAIL'}: ${errors} error(s)\n`);
process.exit(errors > 0 ? 1 : 0);
