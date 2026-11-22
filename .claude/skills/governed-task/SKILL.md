# Governed Task Skill

Invoke: `/governed-task <task description>`

Standard implementation pipeline for risk 0–2 tasks; risk 3 continues only with the owner's approval in the session, with the risk 3 maker and threat analysis named in `docs/governance/CLAUDE_CODE_AGENT_MATRIX.md` (`governed-implementer` is capped at risk 2). It is also the ticket playbook that `/next-ticket` runs for one issue of epic #8 (`.claude/skills/next-ticket/SKILL.md`).

## Steps

1. **Classify** — Read `gate.yaml`. Apply risk level. If risk 3+, stop and escalate: for risk 3, present the plan to the owner and continue only with explicit owner approval in the session, along the risk 3 path in `docs/governance/CLAUDE_CODE_AGENT_MATRIX.md`; risk 4 is never executed autonomously.
2. **Read rules** — Read `.claude/rules/` files matching target paths.
3. **Read context** — Read relevant source files before touching them.
4. **Implement** — Maximum 3 attempts. Follow architecture rules.
5. **Test** — Run targeted test suite for changed layer. Run `pnpm typecheck`. Run `pnpm lint`.
6. **Report** — State: files changed, tests run, results, risk level, attempt count.

## Roles on every ticket

The roles run automatically: each role's `description` says when. This table is the order.

| When | Role | Runs on |
|---|---|---|
| Before coding | `scenesift-orchestrator` | Every ticket: risk from `gate.yaml`, makers, specialists and gates for this ticket |
| Before coding | `codebase-onboarding-engineer` | A code area not yet mapped in the session (read-only) |
| Before coding | `software-architect` | A layer-boundary change or an ADR (read-only, advisory) |
| Before coding | `dependency-auditor` | A ticket that adds or upgrades a dependency |
| Before coding | `accessibility-auditor` | A ticket that changes interactive UI: review of the plan (read-only) |
| During coding | `governed-implementer` | Risk 0–2 code, tests and docs (the maker) |
| After coding | `electron-security-reviewer` | Any change under `src/main/**`, `src/preload/**`, `src/shared/ipc/**` |
| After coding | `design-system-reviewer` | Any change to renderer components, pages or styles, with the `docs/ui-quality.md` check |
| After coding | `visual-qa-reviewer` | A changed screen or E2E flow |
| After coding | `accessibility-auditor` | The diff of a ticket that changes interactive UI |
| After coding | `dependency-auditor` | The final lockfile diff of a dependency ticket |
| Review gate | `architecture-reviewer` | Every ticket that changes code: full diff, acceptance criteria, correctness |
| Acceptance gate | `governance-verifier` | Every ticket that changes code: recorded local evidence, CI configuration, no weakened control |
| On a blocked action | `incident-reviewer` | A hook, deny rule or gate that blocks unexpectedly, or a third failed attempt |

The preparation roles advise and never count as verifiers (`AGENTS.md`). The maker never verifies its own work. `.claude/hooks/role-gate.mjs` records each role that finishes and refuses `gh pr create` and `gh pr ready` until both gate roles have run after the last code edit. Documentation-only changes pass without them.

## UI and copy

- A ticket that changes a screen starts with the `ui-ux-pro-max` skill (design-system search for this product type) and ends with the check of every changed screen against `docs/ui-quality.md`.
- User-facing copy, documentation and the pull request text go through the `unslop` skill before the pull request is opened.

## From local checks to a ready pull request

This order is fixed (`CLAUDE.md`, Delivery workflow). In a `/next-ticket` run the owner's start is the request to push the ticket branch and open the pull request; outside such a run, do steps 1 to 3, commit locally, and hand the owner the branch name and a filled-in pull request description without pushing.

1. Local checks pass: every command in `gate.yaml` `requiredChecksByRisk` for the risk level, plus the extra checks `CLAUDE.md` names under "Before claiming a ticket done", with output and exit code recorded. Write the diff (`git diff --stat origin/main...HEAD` and `git diff origin/main...HEAD`) and each check output to `.claude/state/review/` (git-ignored) and name those files when calling the gate roles. An acceptance criterion that needs a person (a manual check in a normal browser, a recorded manual step) is done as far as an agent can, with a scripted or headless run and its evidence, and the rest is listed under "Owner checks" in the pull request text; `governance-verifier` accepts that only when the ticket marks the step as manual.
2. Add one line for the ticket to `CHANGELOG.md` under `Unreleased` (a `.md` file, so it does not reset the role gate) and draft the pull request text from `.github/pull_request_template.md` with `Closes #<n>` and the evidence, passed through the `unslop` skill. The roles-run list is filled in as the gates report.
3. The specialists for the changed paths have passed, then `architecture-reviewer` (review gate), then `governance-verifier` (acceptance gate), on the full diff, the recorded evidence, the CHANGELOG line and the drafted text. A FAIL goes back to step 4 of the steps above; after any code edit, redo step 1 and run both gates again. After the gates, only the `governance-verifier` verdict is appended to the drafted text.
4. Push the ticket branch (`git push -u origin <branch>`) and open a draft: `gh pr create --draft`.
5. CI runs on the draft. Do not poll: end the turn with the line "Draft pull request #N is waiting for CI" and read `gh pr checks <n>` once when the session is woken (a CI event, or the owner says "continue"). If it fails, fix, re-run the local checks and both gates, and push again.
6. When CI is green, `gh pr ready` and a comment on the issue with the CI run link.

A ticket that is the last open sub-issue of a parent says `Closes #<sub-issue>` and `Closes #<parent>` in the pull request text. Ticket work never edits agent configuration (`.claude/agents/**`, `.claude/skills/**`, `.claude/hooks/**`, `.claude/settings.json`) unless the ticket is about it and the owner approved it; the `ask` rules in `.claude/settings.json` cover edits made with the edit tools, not edits made through a shell command.

Never push to `main`, force-push, run `git merge` or `gh pr merge`, or add `Governance Change Approval: yes` to a pull request body. Only the owner merges and releases.

## Outputs required

- Files changed (list)
- Test command run + result
- Typecheck result
- Risk level applied
- Attempt count
- Roles run, with verdicts (in a ticket run)

## Stops if

- Task reclassifies to risk 3+ during implementation.
- 3 attempts reached without passing tests.
- Architecture violation detected.
- A gate role fails and the fix is outside the ticket's scope.
- An owner decision in `docs/owner-decisions.md` blocks the ticket: stop and say so.
