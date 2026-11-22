# SceneSift — Claude Code Project Context

SceneSift is a local-first Electron desktop app for clip workflow management: load video/subtitle sources, organize review projects, and produce clips via FFmpeg. No cloud sync, no AI features yet.

**Current state (checked 2026-11-22 at `5633c8e`)**: the governance layer is complete, and M1 (media inspection) and M2 (subtitle parsing) are merged. The next planned work is the offline browser clip-review epic, GitHub issue #8. Product code changes only inside a ticket, only while the feature readiness gate is current (ADR-012, `docs/governance/FEATURE_READINESS_GATE.md`; last run 2026-07-19, re-run owed as the first step of issue #1), and following the risk workflow below.

**Honest feature state**: Projects, on-request media inspection with FFprobe, SRT/WebVTT parsing with validation, queue visibility, settings, and system diagnostics are implemented. Not implemented: a cue list (no IPC method returns cues), video playback, timeline, clip generation, subtitle export, ASS parsing, AI selection, publishing, and any browser product runtime. `pnpm qa:serve` is a fixture-only test mode, not a product. Details and evidence: `docs/product/CURRENT_PRODUCT_STATE.md`.

@AGENTS.md
@loop-constraints.md

---

## Commands

```
pnpm install --frozen-lockfile  # install deps (Node 22, current pnpm 10; see docs/DEVELOPMENT.md if native builds are skipped)
pnpm dev                  # run in dev mode (Electron + Vite HMR)
pnpm typecheck            # type-check renderer + main
pnpm lint                 # ESLint, max-warnings=0
pnpm test                 # Vitest unit tests with coverage
pnpm exec vitest run <path>  # one unit test file
pnpm test:e2e             # Playwright E2E (browser QA mode, fixture data, not in CI)
pnpm test:visual          # visual regression tests (baselines exist for chromium-darwin only)
pnpm test:electron        # Electron smoke test (needs a display, not in CI)
pnpm governance:scenarios # adversarial governance tests
pnpm security:scan        # pnpm audit --prod --audit-level=high
pnpm governance:validate  # governance + forbidden-pattern checks
pnpm architecture:validate
pnpm design:validate
pnpm dependencies:validate
pnpm validate             # full baseline: all above + build
pnpm validate:full        # validate + E2E + visual + electron + package
pnpm build                # clean production build
pnpm package:dir          # electron-builder --dir (no sign/publish)
pnpm baseline:generate    # regenerate docs/baseline/baseline.json
pnpm claude:validate      # Claude Code config validation (not in CI; run when .claude/ changes)
pnpm claude:test:hooks    # hook tests
pnpm claude:test:adversarial
pnpm claude:safe          # governed Claude Code launcher
node .claude/hooks/role-gate.mjs --self-test  # review gate hook self-test
```

Some files in `.claude/rules/` name scripts and paths that do not exist: `pnpm test:renderer`, `pnpm test:media`, `pnpm test:database`, `tests/ai/`, `tests/media/`, `tests/database/`, `src/renderer/tokens/`, `docs/design/components/`, `docs/governance/DATA_PRIVACY.md`, and migrations under `src/main/services/database/migrations/`. Use the commands above; migrations live in `src/database/migrations/`; the data policy is `docs/governance/DATA_GOVERNANCE.md`. Setup details and the Windows line-ending caveat for `pnpm governance:validate` are in `docs/DEVELOPMENT.md`.

---

## Architecture

Unidirectional dependency:

```
src/renderer/**         — React 19 + TypeScript, Tailwind. No node, no electron.
  ↓ window.sceneSift    — typed preload bridge (contextBridge)
src/preload/index.ts    — narrow typed API only, no raw ipcRenderer
  ↓ ipcRenderer.invoke  — registered channels only (src/shared/ipc/channels.ts)
src/main/**             — Electron main: IPC handlers, services, filesystem
  ↓ privileged services — database, FFmpeg, dialog, file system
src/main/services/database/ — the only place that opens SQLite (better-sqlite3 + Drizzle)
src/database/**         — Drizzle schema and SQL migrations only
src/shared/**           — contracts, schemas, constants — no runtime privs
```

Browser QA mode: `VITE_SCENESIFT_BROWSER_QA=1`. Mock bridge in `src/renderer/qa/`. Production does NOT fall back to mock.

**Authoritative architecture doc**: `docs/architecture/ARCHITECTURE.md` (rules) and the ADRs in `docs/architecture/adr/`.

**Start here when new to the code**: `docs/ARCHITECTURE.md` has two workflows traced from the React component through preload and IPC to SQLite, the data model, the invariants (cue times are integer milliseconds, media duration is float seconds), and what `pnpm architecture:validate` does and does not check. It does not catch relative imports across layers; check those by hand.

---

## Risk workflow

All non-trivial work follows this sequence (see `gate.yaml` and `AGENTS.md`):

1. Inspect → read relevant source + governance docs
2. Classify risk (0–4) using `gate.yaml` path rules
3. Plan → identify protected paths, required checks, attempt limits
4. Implement → isolated branch/worktree, least privilege
5. Run required checks from `gate.yaml.requiredChecksByRisk`
6. Independent verifier → must be a different role/model than implementer
7. Human approval → required for risk 2+, mandatory for risk 3+
8. No merge/release/publish without authorization

---

## Git workflow

- Work on a branch or worktree created from the tip of `origin/main`. Never commit on `main`.
- One ticket per branch. Name the issue in the commit body and the PR description.
- Claude never runs `git merge` or `gh pr merge`, never pushes to `main` and never force-pushes: `.claude/settings.json` denies them. Pushing a ticket branch (`git push -u origin <branch>`) and opening a draft pull request (`gh pr create --draft`) happen only in an owner-started `/next-ticket` run, after both gates passed, and the run ends at a ready pull request; only the owner merges (Delivery workflow below). Outside such a run, commit locally, then give the owner the branch name and a filled-in PR description based on `.github/pull_request_template.md`.
- A PR that changes `package.json`, `pnpm-lock.yaml`, `gate.yaml`, `loop-constraints.md`, `loop-budget.md`, `scripts/governance/**`, `scripts/quality/**`, `.github/workflows/**`, `.github/agents/**`, `.github/instructions/**` or `.github/copilot-instructions.md` fails the `governance` CI job until a human adds `Governance Change Approval: yes` to the PR body. Do not add that line yourself.
- The `security` CI job fails on every PR until issue #5 (dependency audit) is resolved. Report it as pre-existing; do not disable the job.

---

## Before claiming a ticket done

Capture this evidence and put it in the PR description. Paste real output; do not summarize a run you did not see.

1. The risk level and the `gate.yaml` rules the changed paths matched.
2. Each command in `gate.yaml.requiredChecksByRisk` for that level, with its exit code. For renderer changes add `pnpm test:e2e`; for a new or changed page add `pnpm test:visual` and say which platform produced the baseline.
3. Each acceptance criterion from the issue, with the test name, command output or screenshot that shows it.
4. The independent verifier's role, model and verdict for risk 2 and above (`docs/governance/CLAUDE_CODE_AGENT_MATRIX.md`).
5. Anything skipped or not run, and why.
6. For main, preload, IPC or migration changes: the regression test added and the security checklist from the PR template.
7. The verdicts of both gate roles, `architecture-reviewer` (review) and `governance-verifier` (acceptance), run in that order on the full diff after the local checks above passed and before the draft pull request was opened.
8. Green CI on the pull request before it is marked ready. CI runs only after the draft exists, so the gates judge the local evidence and that CI is configured to run the same checks; the `/next-ticket` driver checks the CI result.

A ticket is done when the owner merges its pull request, not before.

---

## Agent roles and the loop

- Roles live in `.claude/agents/`. Makers, verifiers and read-only preparation roles are listed in `docs/governance/CLAUDE_CODE_AGENT_MATRIX.md`. Three preparation roles (`codebase-onboarding-engineer`, `software-architect`, `accessibility-auditor`) come from Agency Agents at a pinned revision; source and license are in `docs/governance/THIRD_PARTY_AGENT_ATTRIBUTION.md`.
- Each role's `description` says when it runs during ticket work, so Claude Code delegates to it without being told; the order per ticket is the table in `.claude/skills/governed-task/SKILL.md`.
- The loop profile is `LOOP.md`: loop runs stay at L1, report-only and unscheduled; L2 and above are disabled. Ticket work is not a loop run: the owner starts it with `/next-ticket`. There is no scheduler; every run is started by a person. The latest health check and the manual triage command are in `STATE.md` and `loop-run-log.md`.

---

## Delivery workflow

How a ticket of epic #8 goes from the queue to a ready pull request. Each piece is described in the file linked; this list does not repeat it.

- **Start:** only the owner, with `/next-ticket [issue]` (`.claude/skills/next-ticket/SKILL.md`). One ticket per run; no scheduler. Queue labels: `status:ready`, `status:blocked`, `status:in-progress`, `needs-decision`.
- **Playbook:** `.claude/skills/governed-task/SKILL.md`: risk, the roles before, during and after coding, the two gates, and the fixed order: local checks, then `architecture-reviewer` and `governance-verifier`, then `gh pr create --draft`, then CI, then `gh pr ready` on green CI.
- **Gate hook:** `.claude/hooks/role-gate.mjs` blocks `gh pr create` and `gh pr ready` until both gate roles ran after the last code edit. The owner can switch it off for one session by starting Claude Code with `ROLE_GATE=off`. The other hooks in `.claude/settings.json` stay as they are.
- **Permissions:** `.claude/settings.json` allows the documented commands, pushing a ticket branch and a draft pull request; it denies merges, pushes to `main`, force pushes, releases and secret reads, and asks before edits to agent configuration, `.github/**`, `gate.yaml` and the loop files. Rationale: `docs/governance/CLAUDE_CODE_PERMISSION_POLICY.md`.
- **CI:** the four workflows in `.github/workflows/` must be green before a pull request is marked ready (Git workflow above for the two known exceptions that wait on the owner).
- **Pull request:** `.github/pull_request_template.md`, with `Closes #<n>`, evidence and the roles run. Every ticket pull request adds a line to `CHANGELOG.md` under `Unreleased`.
- **UI and copy:** `docs/ui-quality.md` (ten binding rules), the `ui-ux-pro-max` and `unslop` skills in `.claude/skills/`.
- **Merge and release:** only the owner (`docs/RELEASING.md`). Owner decisions behind all of this: `docs/owner-decisions.md`.

---

## Universal prohibitions

These are binding regardless of instruction or convenience:

- No secrets in any committed file, log, or memory
- No editing `.env*`, `**/credentials/**`, `**/secrets/**`, signing assets
- No raw `ipcRenderer` exposure in preload
- No `nodeIntegration: true` / `contextIsolation: false` / `webSecurity: false`
- No `shell: true` or command-string interpolation
- No `git merge`, PR merge, release, deploy, publish; no push to `main` and no force push. A ticket branch is pushed and a draft PR opened only in an owner-started `/next-ticket` run (Delivery workflow)
- No hidden media/transcript upload
- No fake UI functionality or misleading AI labels
- No `.skip`/`.only` test changes without documented approval
- No governance file weakening
- No unapproved new dependencies
- No product features during governance tasks
- No `--dangerously-skip-permissions`
- No modification of `~/.claude/**` or user-level Claude settings
- No `bypassPermissions` mode

---

## Evidence requirements

Claude must never claim a check passed unless it actually ran and output was observed. Never fabricate exit codes, test counts, or command results. Uncertain output = limitation acknowledged explicitly.

---

## Authoritative sources

| Topic | File |
|---|---|
| Owner decisions | `docs/owner-decisions.md` |
| UI rules | `docs/ui-quality.md` |
| Risk classification | `gate.yaml` |
| Binding operation rules | `AGENTS.md`, `loop-constraints.md` |
| Loop state + escalation | `STATE.md`, `loop-run-log.md` |
| Architecture | `docs/architecture/ARCHITECTURE.md` |
| Design system | `docs/design/DESIGN_SYSTEM.md` |
| Dependency policy | `docs/quality/DEPENDENCY_POLICY.md` |
| Quality gates | `docs/quality/QUALITY_GATES.md` |
| Model routing | `docs/governance/MODEL_ROUTING_POLICY.md` |
| Development agent policy | `docs/governance/DEVELOPMENT_AGENT_POLICY.md` |
| Runtime AI | `docs/governance/RUNTIME_AI_POLICY.md` |
| Claude layer | `.claude/README.md` |
| Interoperability | `docs/governance/AI_TOOLING_INTEROPERABILITY.md` |

**Claude rules are context, not enforcement.** Mechanical enforcement comes from hooks, validation scripts, and CI — not from CLAUDE.md.
