#!/usr/bin/env node
/**
 * Scans Claude Code memory files for policy violations.
 * Flags entries containing secrets, credentials, or forbidden content.
 * Exit 0 = clean, 1 = violations found.
 *
 * Override scan path for testing: SCENESIFT_CLAUDE_MEMORY_ROOT=<dir>
 * When set, that directory is scanned directly instead of the computed
 * ~/.claude/projects/<slug>/memory path.
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

// Scan the session memory path
// SCENESIFT_CLAUDE_MEMORY_ROOT overrides the computed path (used in tests).
if (process.env.SCENESIFT_CLAUDE_MEMORY_ROOT) {
  const overridePath = process.env.SCENESIFT_CLAUDE_MEMORY_ROOT;
  console.log(`\nScanning ${overridePath} (SCENESIFT_CLAUDE_MEMORY_ROOT override) ...`);
  if (existsSync(overridePath)) {
    scanDir(overridePath);
  } else {
    console.warn(`  WARNING: override path does not exist — no secrets scan performed`);
    console.warn(`  Expected: ${overridePath}`);
  }
} else {
  const sessionMemory = join(homedir(), '.claude', 'projects');
  if (existsSync(sessionMemory)) {
    console.log(`\nScanning ${sessionMemory} for project memory ...`);
    // Derive slug: replace every '/' with '-' (leading '/' becomes leading '-', matching Claude's convention)
    const projectSlug = ROOT.replace(/\//g, '-');
    const projectMemory = join(sessionMemory, projectSlug, 'memory');
    if (existsSync(projectMemory)) {
      scanDir(projectMemory);
    } else {
      console.warn(`  WARNING: project memory directory not found at computed path — no secrets scan performed`);
      console.warn(`  Expected: ${projectMemory}`);
    }
  }
}

console.log(`\n${errors === 0 ? 'PASS' : 'FAIL'}: ${errors} violation(s)\n`);
process.exit(errors > 0 ? 1 : 0);
