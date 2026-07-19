# SceneSift Baseline Report

> Machine-readable baseline: `docs/baseline/baseline.json`
> Last updated: 2026-07-19 (M1 acceptance audit)

## Starting-state facts

- Repository in current environment is **not a Git worktree** (`git status` unavailable in baseline generation environment).
- Node: `v24.13.1`
- pnpm: `10.33.2`
- Existing redesign + QA infrastructure present and validated in the governance milestone.

## Baseline inventory

This report is paired with `baseline.json` and updated as part of governance hardening and feature milestone completions.

---

## Test counts (as of 2026-07-19 M1 audit)

| Suite | Count | Command | Status |
|---|---|---|---|
| Unit tests (Vitest) | 100 | `pnpm test` | 100/100 passed |
| E2E tests (Playwright, browser QA mode) | 19 | `pnpm test:e2e` | 19/19 passed |
| Visual regression tests (Playwright) | 9 | `pnpm test:visual` | 6/9 passed (3 sub-2% pixel drift failures — see limitations) |
| Adversarial governance tests | 34 | `pnpm claude:test:adversarial` | 34/34 passed |
| Electron smoke tests | 1 | `pnpm test:electron` | 0/1 passed (environment limitation — see below) |

Prior unit test count (governance baseline): 89. Increase of 11 reflects M1 media-inspection additions:
- `tests/main/ffmpegService.inspect.test.ts` — 9 new tests
- `tests/main/ipc-contracts.test.ts` — expanded for `project:inspect` channel
- `tests/governance/adversarial-scenarios.test.ts` — minor additions

Prior E2E test count (governance baseline): 12. Increase of 7 reflects M1 E2E additions:
- `tests/e2e/media-inspection.e2e.spec.ts` — 4 new tests
- Expansion of existing E2E suites

---

## Validation suite status (2026-07-19 M1 audit)

| Command | Exit code | Result |
|---|---|---|
| `pnpm typecheck` | 0 | PASS |
| `pnpm lint` | 0 | PASS (max-warnings=0) |
| `pnpm test` | 0 | PASS — 100/100 |
| `pnpm governance:validate` | 0 | PASS |
| `pnpm architecture:validate` | 0 | PASS |
| `pnpm design:validate` | 0 | PASS |
| `pnpm dependencies:validate` | 0 | PASS |
| `pnpm claude:validate` | 0 | PASS |
| `pnpm claude:test:adversarial` | 0 | PASS — 34/34 |
| `pnpm build` | 0 | PASS — renderer 387KB (116KB gzip) |
| `pnpm package:dir` | 0 | PASS — signed, notarization skipped |
| `pnpm test:e2e` | 0 | PASS — 19/19 (browser QA mode) |
| `pnpm test:visual` | 1 | PARTIAL — 6/9 (3 sub-2% pixel drift failures) |
| `pnpm test:electron` | 1 | FAIL — environment limitation (no display server) |
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
