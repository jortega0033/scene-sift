# Claude Code Hooks

## Overview

Hooks are Node.js .mjs scripts that enforce safety invariants at the tool-call level. They supplement `settings.json` deny rules by inspecting full command content.

## Hook inventory

### protect-file-write.mjs (PreToolUse: Write|Edit|NotebookEdit)

Blocks writes to:
- `.env*` files and any path containing `.env.`
- `.github/workflows/`
- `.github/copilot-instructions.md`
- `gate.yaml`
- `loop-constraints.md`
- `AGENTS.md`, `LOOP.md`
- `signing/`, `certs/`, `credentials/`, `secrets/` directories

Warns (but allows) writes to `.claude/settings.json` and `.claude/hooks/` — these require human authorization via governance-change skill.

### protect-bash-command.mjs (PreToolUse: Bash)

Blocks commands matching patterns for:
- `git push --force`, `git reset --hard`, `git clean -f`
- `npm publish`, `pnpm publish`, `electron-builder --publish`
- `firebase deploy`, `vercel deploy`, `gh pr merge`, `gh release create`
- `npm install -g`, `pnpm add -g`
- `cat .env`, `printenv SECRET/KEY/TOKEN/PASSWORD`
- `curl|sh`, `wget|sh`
- `--dangerously-skip-permissions`
- `chmod 777`
- `rm -rf` (except `/tmp`, `.qa/`, `node_modules`)

### validate-config-change.mjs (PostToolUse: Write|Edit)

After writing a config file, runs the corresponding validator:
- `.claude/settings.json` → `pnpm claude:validate:settings` (if present)
- `.mcp.json` → `pnpm claude:validate:mcp` (if present)
- `gate.yaml` → `pnpm governance:validate`
- `package.json` → `pnpm validate:package` (if present)

Exit non-zero emits a warning but does not block (file already written). Investigate the warning before proceeding.

### stop-validation.mjs (Stop)

On session end: checks `loop-run-log.md` for open RUNNING/IN_PROGRESS entries. Emits warning if found. Logs stop reason.

### record-agent-event.mjs (SubagentStop)

Appends to `loop-run-log.md`: timestamp, agent name, stop reason.

## Modifying hooks

Risk 3. Requires:
1. `/governance-change` skill invocation
2. Human approval before change
3. `tests/claude/hooks.test.mjs` updated for new behavior
4. `pnpm claude:test:hooks` passing
5. governance-verifier independent review

## Hook failures

If a hook blocks an action you believe should be allowed, investigate the hook first. Do not bypass hooks to make progress. If the block is a false positive, follow the governance-change process to update the hook.
