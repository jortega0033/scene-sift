#!/usr/bin/env node
// Stop hook: fires when Claude Code session ends or agent task completes.
// Checks for incomplete task states that should not be left unresolved.

import { readFileSync, existsSync } from 'node:fs';

const LOOP_RUN_LOG = 'loop-run-log.md';

let input;
try {
  input = JSON.parse(readFileSync('/dev/stdin', 'utf-8'));
} catch {
  process.exit(0);
}

// Check for open loop entries without completion marker.
if (existsSync(LOOP_RUN_LOG)) {
  try {
    const log = readFileSync(LOOP_RUN_LOG, 'utf-8');
    const lastEntry = log.split('\n').filter(Boolean).pop() ?? '';
    if (lastEntry.includes('RUNNING') || lastEntry.includes('IN_PROGRESS')) {
      process.stderr.write(
        `[stop-validation] WARNING: loop-run-log.md has an open RUNNING/IN_PROGRESS entry. ` +
        `If session ended unexpectedly, update loop-run-log.md with final status.\n`
      );
    }
  } catch {
    // Non-fatal — log read failure should not block session stop.
  }
}

// Emit summary of session scope for audit log.
const stopType = input?.stop_reason ?? 'unknown';
process.stderr.write(`[stop-validation] Session stop. Reason: ${stopType}\n`);

process.exit(0);
