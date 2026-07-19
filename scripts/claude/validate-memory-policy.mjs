#!/usr/bin/env node
/**
 * Scans Claude Code memory files for policy violations.
 * Flags entries containing secrets, credentials, or forbidden content.
 * Exit 0 = clean, 1 = violations found.
 */

import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

const FORBIDDEN_PATTERNS = [
  { label: 'API key', pattern: /api[_-]?key\s*[:=]\s*[^\s]{8,}/i },
  { label: 'Secret', pattern: /secret\s*[:=]\s*[^\s]{8,}/i },
  { label: 'Token', pattern: /token\s*[:=]\s*[^\s]{16,}/i },
  { label: 'Password', pattern: /password\s*[:=]\s*[^\s]{4,}/i },
  { label: 'Bearer token', pattern: /bearer\s+[a-zA-Z0-9._-]{20,}/i },
  { label: 'AWS key', pattern: /AKIA[0-9A-Z]{16}/i },
  { label: 'Approved override claim', pattern: /approved.*override|override.*approved/i },
];

let errors = 0;

function fail(msg) { console.error(`  VIOLATION: ${msg}`); errors++; }
function pass(msg) { console.log(`  CLEAN: ${msg}`); }

function scanDir(dir) {
  if (!existsSync(dir)) return;
  const entries = readdirSync(dir);
  for (const entry of entries) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      scanDir(full);
    } else if (entry.endsWith('.md') || entry.endsWith('.json')) {
      const content = readFileSync(full, 'utf-8');
      let clean = true;
      for (const { label, pattern } of FORBIDDEN_PATTERNS) {
        if (pattern.test(content)) {
          fail(`${full}: contains ${label}`);
          clean = false;
        }
      }
      if (clean) pass(entry);
    }
  }
}

// Scan project-local memory (relative to repo root)
const localMemory = join(ROOT, '.claude', 'projects');
console.log(`\nScanning ${localMemory} ...`);
if (existsSync(localMemory)) {
  scanDir(localMemory);
} else {
  console.log('  (no local memory directory found — skipping)');
}

// Also scan the session memory path if it exists
const sessionMemory = join(homedir(), '.claude', 'projects');
if (existsSync(sessionMemory)) {
  console.log(`\nScanning ${sessionMemory} for project memory ...`);
  // Only scan subdirs matching this project
  const projectSlug = ROOT.replace(/\//g, '-').replace(/^-/, '');
  const projectMemory = join(sessionMemory, projectSlug, 'memory');
  if (existsSync(projectMemory)) {
    scanDir(projectMemory);
  } else {
    console.log('  (no project memory at session path — skipping)');
  }
}

console.log(`\n${errors === 0 ? 'PASS' : 'FAIL'}: ${errors} violation(s)\n`);
process.exit(errors > 0 ? 1 : 0);
