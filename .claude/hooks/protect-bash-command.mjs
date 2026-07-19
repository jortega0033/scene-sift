#!/usr/bin/env node
// PreToolUse hook: Bash
// Blocks forbidden commands and patterns before execution.

import { readFileSync } from 'node:fs';

const BLOCKED_EXACT = new Set([
  'sudo',
]);

const BLOCKED_PATTERNS = [
  // Destructive git
  /git\s+push\s+(--force|-f)/,
  /git\s+reset\s+--hard/,
  /git\s+clean\s+-[a-z]*f/,
  /git\s+rebase\s+-i/,
  // Publishing and deployment
  /\bnpm\s+publish\b/,
  /\bpnpm\s+publish\b/,
  /\belectron-builder\b.*--publish/,
  /\bfirebase\s+deploy\b/,
  /\bvercel\s+deploy\b/,
  /\bgh\s+(pr\s+merge|release\s+create)\b/,
  // Global installs
  /\bnpm\s+install\s+-g\b/,
  /\bpnpm\s+add\s+-g\b/,
  // Secret exposure
  /\bcat\s+\.env\b/,
  /\bprintenv\s+(SECRET|KEY|TOKEN|PASSWORD|CREDENTIAL)/i,
  /\becho\s+\$[A-Z_]*(SECRET|KEY|TOKEN|PASSWORD|CREDENTIAL)/i,
  // Dangerous pipe patterns
  /\|\s*sh\b/,
  /\|\s*bash\b/,
  /curl[^|]*\|\s*(sh|bash)\b/,
  /wget[^|]*\|\s*(sh|bash)\b/,
  // Permission bypass
  /--dangerously-skip-permissions/,
  /chmod\s+777/,
  // Recursive delete of non-temp paths
  /rm\s+-[a-z]*r[a-z]*f\s+(?!\/tmp|\.\/\.qa\/|\.\/node_modules)/,
];

let input;
try {
  input = JSON.parse(readFileSync('/dev/stdin', 'utf-8'));
} catch {
  process.exit(0);
}

const command = input?.tool_input?.command ?? '';

for (const blocked of BLOCKED_EXACT) {
  if (command.trim() === blocked || command.trim().startsWith(blocked + ' ')) {
    process.stderr.write(
      `[protect-bash-command] BLOCKED: \`${blocked}\` is forbidden. ` +
      `Review gate.yaml forbidden-actions list.\n`
    );
    process.exit(1);
  }
}

for (const pattern of BLOCKED_PATTERNS) {
  if (pattern.test(command)) {
    process.stderr.write(
      `[protect-bash-command] BLOCKED: Command matches forbidden pattern ${pattern}. ` +
      `Command: ${command.slice(0, 120)}\n`
    );
    process.exit(1);
  }
}

process.exit(0);
