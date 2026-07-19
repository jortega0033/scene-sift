#!/usr/bin/env node
// SubagentStop hook: fires when a subagent completes.
// Records agent name, completion status, and timestamp to loop-run-log.md.

import { readFileSync, appendFileSync } from 'node:fs';

let input;
try {
  input = JSON.parse(readFileSync('/dev/stdin', 'utf-8'));
} catch {
  process.exit(0);
}

const agentName = input?.agent_name ?? 'unknown-agent';
const stopReason = input?.stop_reason ?? 'unknown';
const timestamp = new Date().toISOString();

const logEntry = `${timestamp} | subagent=${agentName} | stop_reason=${stopReason}\n`;

try {
  appendFileSync('loop-run-log.md', logEntry, 'utf-8');
} catch {
  // Non-fatal — if log file absent, emit to stderr for visibility.
  process.stderr.write(`[record-agent-event] ${logEntry.trim()}\n`);
}

process.exit(0);
