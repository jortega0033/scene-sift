/**
 * Tests for scripts/claude/validate-agents.mjs
 *
 * Run: node tests/claude/validate-agents.test.mjs
 * Or:  pnpm claude:test:agents
 */

import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SCRIPT = join(ROOT, 'scripts', 'claude', 'validate-agents.mjs');

let passed = 0;
let failed = 0;

function check(name, files, expectExit, expectOutput = null) {
  const dir = mkdtempSync(join(tmpdir(), 'scenesift-agents-'));
  try {
    mkdirSync(dir, { recursive: true });
    for (const [file, content] of Object.entries(files)) writeFileSync(join(dir, file), content);
    const result = spawnSync('node', [SCRIPT, dir], { encoding: 'utf-8', cwd: ROOT });
    const output = `${result.stdout}${result.stderr}`;
    const ok = result.status === expectExit && (expectOutput === null || output.includes(expectOutput));
    if (ok) {
      console.log(`  PASS: ${name}`);
      passed++;
    } else {
      console.error(`  FAIL: ${name}\n    exit ${result.status}, expected ${expectExit}\n    output: ${output}`);
      failed++;
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const role = (front) => `---\n${front}\n---\n\n# Role\n`;

console.log('\n=== validate-agents.mjs ===');
check('Accepts a role with a quoted description', { 'a.md': role('name: a\ndescription: "Use when: reviewing"') }, 0);
check('Accepts CRLF frontmatter', { 'a.md': role('name: a\ndescription: fine').replace(/\n/g, '\r\n') }, 0);
check(
  'Rejects an unquoted colon in the description (invalid YAML)',
  { 'a.md': role('name: a\ndescription: Use when: reviewing') },
  1, 'not valid YAML',
);
check('Rejects a role without a name', { 'a.md': role('description: fine') }, 1, "missing non-empty 'name'");
check('Rejects a role without a description', { 'a.md': role('name: a') }, 1, "missing non-empty 'description'");
check('Rejects an empty description', { 'a.md': role('name: a\ndescription: ""') }, 1, "missing non-empty 'description'");
check('Rejects a role without frontmatter', { 'a.md': '# Role\n' }, 1, 'missing YAML frontmatter');
check(
  'A name mentioned only in the body does not count',
  { 'a.md': '---\ndescription: fine\n---\nname: a\n' },
  1, "missing non-empty 'name'",
);

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
process.exit(failed > 0 ? 1 : 0);
