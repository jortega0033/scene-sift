import fs from 'node:fs';
import path from 'node:path';

export interface CIPinningViolation {
  file: string;
  line: number;
  action: string;
  pinType: 'floating-tag' | 'branch';
}

const SHA_PATTERN = /^[a-f0-9]{40}$/;
const USES_PATTERN = /^\s*-?\s*uses:\s*(.+?)\s*(#.*)?$/;

export function validateCIPinning(rootDir: string): CIPinningViolation[] {
  const violations: CIPinningViolation[] = [];
  const workflowDir = path.join(rootDir, '.github', 'workflows');

  if (!fs.existsSync(workflowDir)) return violations;

  const files = fs
    .readdirSync(workflowDir)
    .filter((f) => f.endsWith('.yml') || f.endsWith('.yaml'))
    .map((f) => path.join(workflowDir, f));

  for (const file of files) {
    const lines = fs.readFileSync(file, 'utf-8').split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line) continue;
      const match = line.match(USES_PATTERN);
      if (!match) continue;
      const uses = (match[1] ?? '').trim();
      if (!uses) continue;

      // Local composite actions are exempt
      if (uses.startsWith('./')) continue;
      // Docker actions are exempt
      if (uses.startsWith('docker://')) continue;

      // Extract the pin portion after '@'
      const atIdx = uses.lastIndexOf('@');
      if (atIdx === -1) continue;
      const pin = uses.slice(atIdx + 1).trim();

      if (SHA_PATTERN.test(pin)) continue;

      // Determine violation type
      const pinType = pin.startsWith('v') ? 'floating-tag' : 'branch';
      violations.push({ file, line: i + 1, action: uses, pinType });
    }
  }

  return violations;
}

function main(): void {
  const repoRoot = process.cwd();
  const violations = validateCIPinning(repoRoot);
  if (violations.length > 0) {
    console.error('CI action SHA pinning validation failed:');
    for (const v of violations) {
      console.error(`  ${path.relative(repoRoot, v.file)}:${v.line} — ${v.action} (${v.pinType})`);
    }
    process.exit(1);
  }
  console.log('CI action SHA pinning: all actions pinned to immutable SHAs.');
}

main();
