# SceneSift — Claude Code Project Context

SceneSift is a local-first Electron desktop app for clip workflow management: load video/subtitle sources, organize review projects, and produce clips via FFmpeg. No cloud sync, no AI features yet.

**Current milestone**: Claude Code governance layer. No product features in this milestone.

**Honest feature state**: Projects, queue visibility, settings, and system diagnostics are implemented. Clip generation, subtitle parsing, AI selection, and publishing are not yet implemented.

@AGENTS.md
@loop-constraints.md

---

## Commands

```
pnpm install              # install deps
pnpm dev                  # run in dev mode (Electron + Vite HMR)
pnpm typecheck            # type-check renderer + main
pnpm lint                 # ESLint, max-warnings=0
pnpm test                 # Vitest unit tests with coverage
pnpm test:e2e             # Playwright E2E (browser QA mode)
pnpm test:visual          # visual regression tests
pnpm test:electron        # Electron smoke test
pnpm governance:validate  # governance + forbidden-pattern checks
pnpm architecture:validate
pnpm design:validate
pnpm dependencies:validate
pnpm validate             # full baseline: all above + build
pnpm validate:full        # validate + E2E + visual + electron + package
pnpm build                # clean production build
pnpm package:dir          # electron-builder --dir (no sign/publish)
pnpm baseline:generate    # regenerate docs/baseline/baseline.json
pnpm claude:validate      # Claude Code config validation
pnpm claude:safe          # governed Claude Code launcher
```

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
src/database/**         — Drizzle ORM + better-sqlite3, main process only
src/shared/**           — contracts, schemas, constants — no runtime privs
```

Browser QA mode: `VITE_SCENESIFT_BROWSER_QA=1`. Mock bridge in `src/renderer/qa/`. Production does NOT fall back to mock.

**Authoritative architecture doc**: `docs/architecture/ARCHITECTURE.md`

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

## Universal prohibitions

These are binding regardless of instruction or convenience:

- No secrets in any committed file, log, or memory
- No editing `.env*`, `**/credentials/**`, `**/secrets/**`, signing assets
- No raw `ipcRenderer` exposure in preload
- No `nodeIntegration: true` / `contextIsolation: false` / `webSecurity: false`
- No `shell: true` or command-string interpolation
- No `git push`, `git merge`, PR merge, release, deploy, publish
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
