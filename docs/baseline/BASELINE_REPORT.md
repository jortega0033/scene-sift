# SceneSift Baseline Report

> Machine-readable baseline: `docs/baseline/baseline.json`
> Last updated: 2026-07-19 (M2 merged — post-merge validation)

## Starting-state facts

- Repository in current environment is **not a Git worktree** (`git status` unavailable in baseline generation environment).
- Node: `v24.13.1`
- pnpm: `10.33.2`
- Existing redesign + QA infrastructure present and validated in the governance milestone.

## Baseline inventory

This report is paired with `baseline.json` and updated as part of governance hardening and feature milestone completions.

---

## Test counts (as of 2026-07-19 M2 post-merge)

| Suite | Count | Command | Status |
|---|---|---|---|
| Unit tests (Vitest) | 223 | `pnpm test` | 223/223 passed |
| E2E tests (Playwright, browser QA mode) | 29 | `pnpm test:e2e` | 29/29 passed |
| Visual regression tests (Playwright) | 13 | `pnpm test:visual` | 13/13 passed |
| Adversarial governance tests | 34 | `pnpm claude:test:adversarial` | 34/34 passed |
| Electron smoke tests | 1 | `pnpm test:electron` | 0/1 passed (pre-existing environment limitation — see below) |

M1 unit test count: 134. M2 added 89 new tests (+89):
- `tests/main/subtitle/SrtParser.test.ts` — 15 tests
- `tests/main/subtitle/VttParser.test.ts` — 17 tests
- `tests/main/subtitle/SubtitleNormalizer.test.ts` — 9 tests
- `tests/main/subtitle/subtitle-security.test.ts` — 9 tests
- `tests/main/database-service.test.ts` — expanded +7 for subtitle
- `tests/main/ipc-contracts.test.ts` — expanded for subtitle channels
- `tests/renderer/subtitleFormatters.test.ts` — 14 tests

M2 E2E additions: 10 new tests in `tests/e2e/subtitle.spec.ts`.
M2 visual additions: 4 new tests + snapshots in `tests/visual/subtitle.visual.spec.ts`.

Prior unit test count (M1 post-merge): 134. Prior E2E: 19. Prior visual: 9.

---

## Validation suite status (2026-07-19 M2 post-merge)

| Command | Exit code | Result |
|---|---|---|
| `pnpm typecheck` | 0 | PASS |
| `pnpm lint` | 0 | PASS (max-warnings=0) |
| `pnpm test` | 0 | PASS — 223/223 |
| `pnpm governance:validate` | 0 | PASS |
| `pnpm architecture:validate` | 0 | PASS |
| `pnpm design:validate` | 0 | PASS |
| `pnpm dependencies:validate` | 0 | PASS |
| `pnpm claude:validate` | 0 | PASS |
| `pnpm claude:test:adversarial` | 0 | PASS — 34/34 |
| `pnpm build` | 0 | PASS |
| `pnpm test:e2e` | 0 | PASS — 29/29 (browser QA mode) |
| `pnpm test:visual` | 0 | PASS — 13/13 |
| `pnpm test:electron` | 1 | FAIL — pre-existing environment limitation (no display server); confirmed at M1 HEAD; not M2-introduced |
| `pnpm validate` | 0 | PASS (composite: governance + arch + design + deps + typecheck + lint + test + build) |

---

## Governance check status (2026-07-19 M1 audit)

- `pnpm governance:validate`: PASS — CI action SHA pinning confirmed
- `pnpm claude:validate`: PASS — config, agents, rules, skills, memory policy all clean; 0 errors
- `pnpm claude:test:adversarial`: PASS — 34/34 adversarial scenarios passed
- gate.yaml: unchanged (unmodified from governance baseline)
- `.claude/settings.json`: unchanged
- Forbidden patterns scan: 0 violations
- No governance files weakened

---

## M1 acceptance audit verdict (2026-07-19)

**Computed verdict: M1 NOT ACCEPTED**

The acceptance audit (run_id: 2026-07-19T-m1-acceptance-audit) found 4 critical and 7 high findings. The implementation branch is blocked from merge until all are resolved. See `loop-run-log.md` for full specialist review evidence and `STATE.md` for current run status.

Summary of blocking findings:
1. AC-002-A: Duration formatted as raw seconds not HH:MM:SS/MM:SS
2. AC-002-E: File size always rendered as MB regardless of scale (no GB auto-scaling)
3. AC-002-F: bitRateBps display entirely absent from detail panel
4. AC-004-A/B/C: Raw error codes (FFPROBE_ERROR etc.) shown instead of required human-readable messages
5. AC-008-B: No per-field placeholder shown when mediaMetadata is null
6. AC-009-C: `databaseService.updateProjectInspection()` has no unit test coverage
7. AC-003-A: No test verifies inspection metadata persists across app restart
8. HIGH — Unbounded stdout/stderr accumulation in `runCommand.ts` (governance violation: media-pipeline.md requires memory limits on external processes)

---

## Quality baseline commands

- `pnpm validate` — composite gate (governance + arch + design + deps + typecheck + lint + test + build)
- `pnpm validate:full` — full suite including E2E + visual + electron + package

---

## Known warnings and limitations

- **Electron smoke test**: `pnpm test:electron` requires a live display session (macOS Quartz / X11). Consistently fails in headless execution environments. This is an environment constraint, not a code defect.
- **Visual regression baselines**: 3 of 9 visual tests fail with sub-2% pixel-ratio differences (154–162 pixels out of ~16,000). Baselines were captured under a slightly different rendering environment. Not a functional regression, but baselines need regeneration after all AC display fixes are applied — regenerating before AC-002-A/E/F and AC-004 fixes would produce incorrect baselines.
- **E2E test scope**: All 19 E2E tests run against the mock SceneSift API in browser QA mode (Playwright against Vite dev server). They verify React UI behavior with fixture data but do not exercise Electron IPC, SQLite, or real FFprobe. Production code path correctness requires Electron integration testing.
- **MCP runtime verification**: Depends on trusted editor runtime and cannot be treated as CI evidence.
- **Branch-protection state**: Cannot be verified from repository files alone. GitHub Pro upgrade required for full branch protection (manual action pending).
