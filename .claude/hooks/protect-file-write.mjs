#!/usr/bin/env node
// PreToolUse hook: Write|Edit|NotebookEdit
// Blocks writes to protected paths. Input: JSON on stdin.

import { readFileSync } from 'node:fs';

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

let input;
try {
  input = JSON.parse(readFileSync('/dev/stdin', 'utf-8'));
} catch {
  process.exit(0);
}

const filePath = input?.tool_input?.file_path ?? input?.tool_input?.path ?? '';

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
