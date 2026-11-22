/**
 * Every repository path and pnpm script that .claude/rules/*.md names in backticks must exist.
 *
 * Run: node tests/claude/rule-references.test.mjs
 * Or:  pnpm claude:test:rules
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const RULES_DIR = join(ROOT, '.claude', 'rules');
const scripts = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf-8')).scripts;

// Named on purpose before the code exists: the rule says so in the same sentence.
const NOT_YET_PRESENT = new Set(['tests/ai/']);

const PATH_TOKEN = /^(?:src|tests|docs|scripts|\.claude|\.github)\/[^\s*{}]*$/;
const PNPM_SCRIPT = /^pnpm ([A-Za-z0-9:_-]+)(?:\s|$)/;
const NATIVE_PNPM = new Set(['exec', 'install', 'rebuild', 'audit', 'add', 'dlx']);

let failed = 0;
let checked = 0;

for (const file of readdirSync(RULES_DIR).filter((f) => f.endsWith('.md'))) {
  const text = readFileSync(join(RULES_DIR, file), 'utf-8');
  for (const [, token] of text.matchAll(/`([^`\n]+)`/g)) {
    const script = PNPM_SCRIPT.exec(token);
    if (script && !NATIVE_PNPM.has(script[1])) {
      checked++;
      if (!(script[1] in scripts)) {
        console.error(`  FAIL: ${file}: \`${token}\` names a pnpm script that does not exist`);
        failed++;
      }
      continue;
    }
    if (PATH_TOKEN.test(token) && !NOT_YET_PRESENT.has(token)) {
      checked++;
      if (!existsSync(join(ROOT, token))) {
        console.error(`  FAIL: ${file}: \`${token}\` does not exist`);
        failed++;
      }
    }
  }
}

console.log(`\n=== rule references: ${checked} checked, ${failed} failed ===\n`);
process.exit(failed > 0 ? 1 : 0);
