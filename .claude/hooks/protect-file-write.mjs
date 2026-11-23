#!/usr/bin/env node
// PreToolUse hook: Write|Edit|NotebookEdit
// Blocks writes to protected paths. Input: JSON on stdin.

import { readFileSync } from 'node:fs';
import { posix } from 'node:path';

const PROTECTED_PATTERNS = [
  /^\.env(\.|$)/,
  /\/\.env(\.|$)/,
  /^\.github\/workflows\//,
  /^\.github\/copilot-instructions\.md$/,
  /^gate\.yaml$/,
  /^loop-constraints\.md$/,
  /^AGENTS\.md$/,
  /^LOOP\.md$/,
  /signing\//,
  /certs?\//,
  /credentials?\//,
  /secrets?\//,
];

const GOVERNANCE_PATTERNS = [
  /^\.claude\/settings\.json$/,
  /^\.claude\/hooks\//,
  /^\.claude\/rules\//,
];

/**
 * Claude Code passes absolute paths (backslashes on Windows); the patterns above are
 * written for repository-relative paths with forward slashes. Normalize before matching.
 * A path outside the repository stays absolute (forward slashes) and is matched as such.
 */
function toRepoRelative(p, root) {
  const slash = (v) => String(v).replace(/\\/g, '/').replace(/\/{2,}/g, '/');
  const isAbs = (v) => v.startsWith('/') || /^[A-Za-z]:\//.test(v);
  let rel = slash(p);
  const base = slash(root).replace(/\/$/, '');
  if (isAbs(rel) && base) {
    const driveStyle = /^[A-Za-z]:\//.test(rel) || /^[A-Za-z]:\//.test(base);
    const a = driveStyle ? rel.toLowerCase() : rel;
    const b = driveStyle ? base.toLowerCase() : base;
    if (a === b || a.startsWith(b + '/')) rel = rel.slice(base.length).replace(/^\//, '');
  }
  return posix.normalize(rel).replace(/^\.\//, '');
}

let input;
try {
  input = JSON.parse(readFileSync(0, 'utf-8'));
} catch {
  // Fail closed: input that cannot be read or parsed is blocked, not waved through.
  process.stderr.write(
    '[protect-file-write] BLOCKED: hook input could not be read or parsed, so the write cannot be checked.\n'
  );
  process.exit(1);
}

const rawPath = input?.tool_input?.file_path ?? input?.tool_input?.path ?? '';
const filePath = toRepoRelative(rawPath, process.env.CLAUDE_PROJECT_DIR || input?.cwd || process.cwd());

for (const pattern of PROTECTED_PATTERNS) {
  if (pattern.test(filePath)) {
    process.stderr.write(
      `[protect-file-write] BLOCKED: ${filePath} matches protected path pattern ${pattern}. ` +
      `Credentials, signing assets, env files, and core governance files are write-protected. ` +
      `Human authorization required.\n`
    );
    process.exit(1);
  }
}

for (const pattern of GOVERNANCE_PATTERNS) {
  if (pattern.test(filePath)) {
    process.stderr.write(
      `[protect-file-write] GOVERNANCE WARNING: ${filePath} is a governance control file. ` +
      `Invoke /governance-change skill and obtain human approval before modifying.\n`
    );
    // Warn but allow — humans may legitimately update governance files in controlled sessions.
    // Hard block is enforced by settings.json deny rules for forbidden patterns.
    process.exit(0);
  }
}

process.exit(0);
