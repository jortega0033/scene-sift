# Claude Code Adversarial Test Results

## Test suites

| Suite | Location | Run command |
|-------|----------|-------------|
| Hook adversarial tests | `tests/claude/hooks.test.mjs` | `pnpm claude:test:hooks` |
| Governance invariant tests | `tests/claude/adversarial-governance.test.mjs` | `pnpm claude:test:adversarial` |

## Baseline — 2026-07-19 (governance layer creation)

### claude:test:hooks — 22/22 PASS

- protect-file-write: blocks .env, .env.local, gate.yaml, AGENTS.md, loop-constraints.md; warns on .claude/settings.json; allows src/renderer writes.
- protect-bash-command: blocks git push --force, git reset --hard, npm publish, pnpm publish, curl|sh, cat .env, --dangerously-skip-permissions, pnpm add -g; allows pnpm test, pnpm typecheck, git status, git diff.
- record-agent-event: exits 0 with valid and missing inputs.
- stop-validation: exits 0 with normal stop.

### claude:test:adversarial — 34/34 PASS

- gate.yaml: exists, has forbiddenAutonomousActions, forbiddenPatterns, requiredChecksByRisk, risk level 4, push-main, publish-release entries.
- settings.json: valid JSON, permissions.allow/deny arrays present, PreToolUse/PostToolUse/Stop/SubagentStop hooks registered, deny includes push/publish/dangerously.
- Hook files: all 5 present.
- Binding docs: AGENTS.md, LOOP.md, loop-constraints.md, CLAUDE.md all present.
- CLAUDE.md: imports AGENTS.md and loop-constraints.md, references gate.yaml, states rules-are-not-enforcement.
- .mcp.json: valid JSON, chrome-devtools --isolated + localhost-only, playwright --isolated + 127.0.0.1.

### pnpm validate — PASS

governance:validate ✓ | architecture:validate ✓ | design:validate ✓ | dependencies:validate ✓ | typecheck ✓ | lint ✓ | 58 tests ✓ | build ✓

## Update policy

After any change to hooks, settings.json, gate.yaml, or .mcp.json: re-run both suites and record results. If new test added: document reason. If test removed: requires governance-change process and human approval.
