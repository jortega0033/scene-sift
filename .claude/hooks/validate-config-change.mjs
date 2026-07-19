#!/usr/bin/env node
// PostToolUse hook: Write|Edit
// After writing a config file, runs relevant validation.

import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const CONFIG_VALIDATORS = {
  '.claude/settings.json': 'pnpm --if-present claude:validate:settings',
  '.mcp.json': 'pnpm --if-present claude:validate:mcp',
  'gate.yaml': 'pnpm --if-present governance:validate',
  'package.json': 'pnpm --if-present validate:package',
};

let input;
try {
  input = JSON.parse(readFileSync('/dev/stdin', 'utf-8'));
} catch {
  process.exit(0);
}

const filePath = input?.tool_input?.file_path ?? input?.tool_input?.path ?? '';

for (const [configPath, validatorCmd] of Object.entries(CONFIG_VALIDATORS)) {
  if (filePath.endsWith(configPath)) {
    try {
      execSync(validatorCmd, {
        cwd: process.env.PWD ?? process.cwd(),
        stdio: 'pipe',
        timeout: 30_000,
      });
      process.stderr.write(`[validate-config-change] ${configPath} validation passed.\n`);
    } catch (err) {
      const stderr = err.stderr?.toString() ?? '';
      const stdout = err.stdout?.toString() ?? '';
      process.stderr.write(
        `[validate-config-change] WARNING: ${configPath} validation returned non-zero.\n` +
        `Command: ${validatorCmd}\n` +
        `Output: ${stdout}${stderr}\n` +
        `Verify this config is still valid before proceeding.\n`
      );
      // Warning only — do not block post-write (file already written).
    }
    break;
  }
}

process.exit(0);
