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

### role-gate.mjs (PreToolUse: Bash|PowerShell, and SubagentStop)

Added 2026-11-22 (GD-007). Copied from the owner's SDLC kit; the only local changes are the gate role names and the playbook path in its message.
- `record` (SubagentStop): appends the finished role and a timestamp to `.claude/state/role-runs.jsonl` (git-ignored).
- `check` (PreToolUse): blocks `gh pr create` and `gh pr ready` with exit code 2 unless `architecture-reviewer` and `governance-verifier` both ran after the newest change to a code file on the branch. Changes to documentation, `.claude/` and `.github/` only pass without a review. A ticket that changes only hooks, settings or workflows (risk 3 here) therefore passes this hook without either gate; the guards left are `governance-verifier`'s own rules and the `next-ticket` "Never" list.
- Reads its input from file descriptor 0, so it works on Windows and POSIX.
- The owner can switch it off for one session by starting Claude Code with `ROLE_GATE=off`.
- Test: `node .claude/hooks/role-gate.mjs --self-test` (builds a throwaway repository in the temp directory). It is not part of `pnpm claude:test:hooks`.

## Modifying hooks

Risk 3. Requires:
1. `/governance-change` skill invocation
2. Human approval before change
3. `tests/claude/hooks.test.mjs` updated for new behavior
4. `pnpm claude:test:hooks` passing
5. governance-verifier independent review

## Hook failures

If a hook blocks an action you believe should be allowed, investigate the hook first. Do not bypass hooks to make progress. If the block is a false positive, follow the governance-change process to update the hook.
