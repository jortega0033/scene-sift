#!/usr/bin/env node
/**
 * Validates .claude/agents/*.md frontmatter: it must be valid YAML and carry a
 * non-empty `name` and `description`. A role whose frontmatter does not parse is
 * silently not loaded by Claude Code, so a string search for `name:` is not enough.
 *
 * Usage: node scripts/claude/validate-agents.mjs [agents-directory]
 */

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const AGENTS_DIR = process.argv[2] ? resolve(process.argv[2]) : join(ROOT, '.claude', 'agents');
const CHECK_REQUIRED = !process.argv[2];
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

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/;

console.log(`\nValidating ${AGENTS_DIR} ...`);

if (!existsSync(AGENTS_DIR)) {
  fail(`${AGENTS_DIR} not found`);
  process.exit(1);
}

const files = readdirSync(AGENTS_DIR).filter(f => f.endsWith('.md'));

if (CHECK_REQUIRED) {
  for (const required of REQUIRED_AGENTS) {
    if (!files.includes(required)) {
      fail(`Missing required agent: ${required}`);
    }
  }
}

for (const file of files) {
  const content = readFileSync(join(AGENTS_DIR, file), 'utf-8').replace(/^\uFEFF/, '');
  const match = FRONTMATTER.exec(content);
  if (!match) {
    fail(`${file}: missing YAML frontmatter (a block between two --- lines at the top)`);
    continue;
  }
  let data;
  try {
    data = parse(match[1]);
  } catch (err) {
    fail(`${file}: frontmatter is not valid YAML (${String(err.message).split('\n')[0]})`);
    continue;
  }
  if (data === null || typeof data !== 'object' || Array.isArray(data)) {
    fail(`${file}: frontmatter is not a YAML mapping`);
    continue;
  }
  for (const field of ['name', 'description']) {
    if (typeof data[field] !== 'string' || data[field].trim() === '') {
      fail(`${file}: frontmatter missing non-empty '${field}'`);
    } else {
      pass(`${file}: has ${field}`);
    }
  }
}

console.log(`\n${errors === 0 ? 'PASS' : 'FAIL'}: ${errors} error(s)\n`);
process.exit(errors > 0 ? 1 : 0);
