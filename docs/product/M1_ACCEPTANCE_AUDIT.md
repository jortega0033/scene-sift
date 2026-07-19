# M1 Media Ingestion & Inspection — Acceptance Audit

**Audit Run ID:** 2026-07-19T-m1-acceptance-audit
**Parent Run ID:** 2026-07-19T-m1-media-inspection
**Branch:** feature/m1-media-ingestion-inspection
**Audit Date:** 2026-07-19
**Risk Level:** 3
**Final Verdict:** M1 NOT ACCEPTED

---

## 1. Purpose and Scope

This document records the independent post-implementation acceptance audit of the M1 media ingestion and inspection feature. The audit was commissioned as a fresh, independent evaluation of the implementation that exists in the working tree on `feature/m1-media-ingestion-inspection`. The audit is not a re-run of the implementation reviews; it is an independent assessment of whether all acceptance criteria are met and whether the implementation is safe to merge.

The audit covers:

- Branch and working-tree state verification
- Spec document availability check
- Validation command reproduction (all commands run fresh)
- Five specialized reviewer passes (electron security, architecture, governance, migration/database, behavioral)
- One adversarial skeptical reviewer pass
- Computed merge-gate verdict

---

## 2. Agents Invoked

| Role | Independence | Scope |
|---|---|---|
| Orchestrator / workflow-orchestrator | N/A | Coordinates phases, collects evidence |
| electron-security-reviewer | Independent of implementer | runCommand.ts, ffmpegService.ts, registerIpcHandlers.ts, preload/index.ts, BrowserWindow config |
| architecture-reviewer | Independent of implementer | Layer boundaries, import graph, preload/IPC symmetry, QA bridge guard |
| governance-verifier | Independent of implementer | gate.yaml integrity, adversarial tests, settings.json, loop-run-log, forbidden patterns |
| migration-reviewer | Independent of implementer | Schema migration SQL, databaseService.ts, mapProject consistency |
| behavioral-reviewer | Independent of implementer | Acceptance criteria mapping, UI rendering, E2E test coverage adequacy |
| skeptical-reviewer | Independent of all above | Adversarial challenge of every claimed pass, evidence-theater detection |

---

## 3. Branch State

| Property | Value |
|---|---|
| Branch | feature/m1-media-ingestion-inspection |
| Total changed files | 52 |
| Staged files | 37 |
| Unstaged modified files | 20 |
| Untracked files | 3 |
| Commits since base | 1 (init commit only — all M1 work is uncommitted working-tree changes) |
| Git stash | Empty |

### Working-Tree Commit Status Warning

The core M1 implementation files are **not committed** to the branch. They exist only as working-tree modifications:

- `src/database/schema.ts` — unstaged
- `src/database/migrations/meta/_journal.json` — unstaged
- `src/main/ipc/registerIpcHandlers.ts` — unstaged
- `src/main/services/database/databaseService.ts` — unstaged
- `src/main/services/ffmpeg/ffmpegService.ts` — unstaged
- `src/main/services/process/runCommand.ts` — unstaged
- `src/preload/index.ts` — unstaged
- `src/renderer/features/projects/CreateProjectForm.tsx` — unstaged
- `src/renderer/features/projects/ProjectsPage.tsx` — unstaged
- `src/renderer/hooks/useProjects.ts` — unstaged
- `src/shared/api/sceneSiftApi.ts` — unstaged
- `src/shared/ipc/channels.ts` — unstaged
- `src/shared/ipc/contracts.ts` — unstaged
- `src/shared/schemas/project.ts` — unstaged
- `tests/main/ipc-contracts.test.ts` — unstaged

Fully untracked (not in git index at all):

- `src/database/migrations/0001_media_inspection.sql`
- `tests/e2e/media-inspection.e2e.spec.ts`
- `tests/main/ffmpegService.inspect.test.ts`

This means the audit is evaluating working-tree state, not committed state. All validation results below reflect the working tree.

---

## 4. Spec Documents Verified Present

All required specification documents were found:

| Document | Status |
|---|---|
| `docs/product/MEDIA_INSPECTION_ACCEPTANCE_CRITERIA.md` | FOUND |
| `docs/product/MEDIA_INSPECTION_IMPLEMENTATION_PLAN.md` | FOUND |
| `docs/product/MEDIA_INSPECTION_HANDOFF.md` | FOUND |
| `docs/product/FIRST_VERTICAL_SLICE.md` | FOUND |
| `docs/product/MEDIA_INSPECTION_TEST_PLAN.md` | FOUND |
| `docs/product/MEDIA_INSPECTION_STATE_MACHINE.md` | FOUND |
| `docs/product/MEDIA_INSPECTION_RISK_REGISTER.md` | FOUND |
| `docs/product/MEDIA_INGESTION_USER_STORIES.md` | FOUND |
| `docs/product/CURRENT_PRODUCT_STATE.md` | FOUND |
| `docs/product/MVP_SCOPE.md` | FOUND |

No required spec documents are missing.

---

## 5. Validation Commands — Full Results

All commands were run fresh by the audit orchestrator against the current working tree.

| Command | Exit Code | Result | Notes |
|---|---|---|---|
| `pnpm typecheck` | 0 | PASS | tsc -p tsconfig.app.json and tsconfig.electron.json both clean, 0 errors |
| `pnpm lint` | 0 | PASS | ESLint --max-warnings=0, 0 warnings, 0 errors |
| `pnpm test` | 0 | PASS | 100/100 tests, 13 files, ~2.18s, coverage 53.4% |
| `pnpm governance:validate` | 0 | PASS | CI SHA pinning confirmed, governance validation passed |
| `pnpm architecture:validate` | 0 | PASS | Architecture boundary checks passed |
| `pnpm design:validate` | 0 | PASS | Design system validation passed |
| `pnpm dependencies:validate` | 0 | PASS | Dependency validation passed |
| `pnpm claude:validate` | 0 | PASS | ALL PASSED: config, agents, rules, skills, memory policy, 0 errors |
| `pnpm claude:test:adversarial` | 0 | PASS | 34/34 adversarial governance tests passed |
| `pnpm build` | 0 | PASS | Renderer 1823 modules, 387KB js (116KB gzip); main 48.67KB; preload 3.13KB |
| `pnpm package:dir` | 0 | PASS (with warnings) | Signed with Apple Development identity; 3 duplicate-dep warnings (react-hook-form, once, readable-stream) |
| `pnpm validate` | 0 | PASS | Full composite: governance + architecture + design + dependencies + typecheck + lint + test + build |
| `pnpm test:e2e` | 0 | PASS | 19/19 Playwright E2E in browser QA mode (chromium), ~4.0s |
| `pnpm test:visual` | 1 | FAIL | 6/9 passed; 3 failed with sub-2% pixel diffs (app-shell 154px, dark-app-shell 162px, projects-populated 154px) |
| `pnpm test:electron` | 1 | FAIL (environment) | "Process failed to launch!" — Electron GUI requires display server not available in headless execution |

### Environment Limitations

**test:electron failure** is an environment constraint, not a code defect. The Electron smoke test requires a macOS Quartz display session (or X11) which was not available in the headless execution environment. This failure does not indicate that the packaged application is broken; the `pnpm package:dir` succeeded and produced `release/mac-arm64/SceneSift.app`.

**test:visual failures** are sub-2% pixel-ratio diffs (154-162 pixels out of ~16,000+) across three snapshots. These are consistent with minor rendering environment drift vs the stored baselines. However, the `projects-populated.png` baseline is the most M1-relevant snapshot. If baselines were regenerated to match the current renderer state — which includes AC-002-A (duration in wrong format) and absence of AC-002-F (bit rate) — regenerating baselines now would entrench non-compliant behavior. Visual baselines should not be updated until AC-002-A, AC-002-F, and AC-008-B failures are fixed.

---

## 6. Reviewer Verdicts

### 6.1 Electron Security Reviewer — CONDITIONAL

The electron security reviewer evaluated 10 security constraints:

| Constraint | Verdict | Key Evidence |
|---|---|---|
| shell: false on all spawns | PASS | runCommand.ts:21 `shell: false` unconditional; confirmed single spawn call site |
| Argument arrays, no string concatenation | PASS | ffmpegService.ts:151-155 passes `['-v','quiet',...]` array; no template strings |
| BrowserWindow flags (nodeIntegration, contextIsolation, sandbox, webSecurity) | PASS | createMainWindow.ts:18-24 all four flags correctly set |
| path.resolve() + stat().isFile() at PROJECT_CREATE | PASS | registerIpcHandlers.ts:127-138 stat().isFile() before DB write |
| path.resolve() + stat().isFile() at PROJECT_INSPECT | PASS | ffmpegService.ts:140-149 stat().isFile() before ffprobe spawn |
| 15s timeout with child.kill() | PASS | runCommand.ts:29-35 SIGKILL via child.kill(); timer cleared on close/error |
| No raw stderr to renderer | PASS | inspectionError always set to structured code constant; toSafeError covers generic exceptions |
| Narrow preload bridge, no raw ipcRenderer | PASS | preload/index.ts:1-44 only named typed methods; ipcRenderer not on exposed object |
| Error codes max 64 chars | PASS | project.ts:56,75 z.string().max(64).nullable() |
| No command string construction | PASS | No template-string command construction found |

**HIGH finding:** Unbounded stdout/stderr accumulation in runCommand.ts:37-43. `stdout += chunk.toString()` and `stderr += chunk.toString()` with no maxBuffer, no size cap. Violates media-pipeline.md requirement to set memory limits on external processes. A crafted media file could exhaust main-process heap.

**MEDIUM findings:**
- TOCTOU race between stat().isFile() and ffprobe spawn — known/accepted per project memory but no fd-based re-validation
- toSafeError() forwards arbitrary Error.message for non-AppError exceptions — could leak internal paths in unanticipated failure cases

### 6.2 Architecture Reviewer — APPROVED

| Check | Verdict |
|---|---|
| `pnpm architecture:validate` exit code | 0 |
| `pnpm typecheck` exit code | 0 |
| IPC channel/contract/preload/handler symmetry | PASS — project:inspect in all four locations |
| Renderer has no electron/node/main imports | PASS — no violations |
| Shared layer has no renderer/main imports | PASS — no violations |
| Main has no renderer imports | PASS — no violations |
| QA bridge guard in main.tsx only, env-gated | PASS — installBridge throws in production if preload absent |

No critical or high findings. Two medium notes: full-tree grep deferred to pnpm architecture:validate (exit 0); no new ADR needed since no boundary change.

### 6.3 Governance Verifier — APPROVED

| Check | Verdict |
|---|---|
| `pnpm governance:validate` exit code | 0 |
| `pnpm claude:validate` exit code | 0 |
| `pnpm claude:test:adversarial` result | 34/34 passed |
| gate.yaml unchanged | YES |
| settings.json unchanged | YES |
| package.json unchanged | YES |
| pnpm-lock.yaml unchanged | YES |
| No forbidden patterns found | YES |
| Loop run complete with checks array | YES |
| All three M1 implementation reviewers complete | YES |
| inspectionError max(64) enforced | YES |

MEDIUM notes: CLAUDE.md still says "Current milestone: Claude Code governance layer" but M1 feature work is complete — documentation drift. Prior governance-verifier session self-closed its condition by direct log edit; this session independently re-ran all underlying commands.

### 6.4 Migration Reviewer — APPROVED

| Check | Verdict |
|---|---|
| Migration SQL column count | 9 columns — all match spec |
| Status migration present | YES — 'active' migrated to 'ready' |
| Parameterized queries only | YES |
| null inspected_at guarded | YES |
| Failure outcome handled | YES |
| Journal registered | YES |
| mapProject() used consistently | YES — all 4 ProjectRecord-returning methods route through mapProject() |

MEDIUM finding: `deleteProject()` executes two sequential DELETEs (renderJobsTable then projectsTable) without an explicit transaction. A crash between the two leaves orphaned render job records deleted while the project row survives.

### 6.5 Behavioral Reviewer — CONDITIONAL

| Acceptance Criterion | Verdict | Notes |
|---|---|---|
| AC-001: Auto-inspect on create | PASS | CreateProjectForm calls inspect immediately after create |
| AC-002-A: Duration HH:MM:SS | FAIL | Rendered as raw seconds e.g. "2847.60s" |
| AC-002-B: Resolution W x H | PASS | width x height display present |
| AC-002-C: Codec name | PASS | videoCodec field displayed |
| AC-002-D: FPS | PASS | fps field displayed |
| AC-002-E: File size human-readable | FAIL | Always MB; never scales to GB for large files |
| AC-002-F: Bit rate displayed | FAIL | bitRateBps entirely absent from metadata display section |
| AC-002-G: Design tokens | PASS | No hardcoded colors found |
| AC-002-H: Long codec truncation | PASS | CSS truncation present |
| AC-003-A: Persistence after restart | NOT TESTED | No test closes/reopens DatabaseService and re-reads data |
| AC-003-B: DB columns non-null | PASS (partial) | Verified by schema |
| AC-003-C: inspected_at populated | PASS | Schema and handler set Date.now() |
| AC-004-A: FFprobe unavailable message | FAIL | Renders "Inspection error: FFPROBE_ERROR" not spec message |
| AC-004-B: File not found message | FAIL | Renders raw code not spec message |
| AC-004-C: No video stream message | FAIL | Renders raw code not spec message |
| AC-004-D: Structured error code | PASS | Error codes are structured constants |
| AC-004-E: Project survives failed inspection | PASS | Record preserved |
| AC-005-A: Status 'ready' on success | PASS | Schema and handler correct |
| AC-005-B: Status 'inspection_failed' on failure | PASS | Schema and handler correct |
| AC-005-C/D: StatusPill variants | PASS | ready→ok, failed→warning, draft→neutral |
| AC-005-E: Status pill in list row | PASS | Visible in project list |
| AC-006-A: Listable after failed inspection | PASS | Project record preserved |
| AC-006-B: Other records unaffected | PASS | Scoped UPDATE |
| AC-006-C: videoPath retained | PASS | UPDATE does not touch videoPath |
| AC-006-D: Idempotent double-inspect | PASS | UPDATE on same id is safe |
| AC-007-A/B/C: No raw stderr to renderer | PASS | Verified by security reviewer |
| AC-008-A: Null metadata renders without throw | PASS | Conditional rendering prevents null dereference |
| AC-008-B: Per-field placeholder for null | FAIL | Entire section hidden when mediaMetadata null; no placeholders |
| AC-008-C: Migration safe on existing data | PASS | All columns nullable |
| AC-009-A: ffmpegService.inspect.test.ts exists | PASS | 9 tests covering happy path, file not found, no video stream, FFprobe unavailable |
| AC-009-B: ipc-contracts.test.ts includes PROJECT_INSPECT | PASS | Channel present |
| AC-009-C: updateProjectInspection tested | FAIL | Not called in any test file |
| AC-009-D: E2E create→inspect→metadata | PASS | 4 E2E scenarios |
| AC-009-E: Visual baseline updated | PASS | dark-theme.visual.spec.ts added |
| AC-010-A: governance:validate exit 0 | PASS | Confirmed |
| AC-010-B: typecheck exit 0 | PASS | Confirmed |
| AC-010-C: lint exit 0 | PASS | Confirmed |
| AC-010-D: pnpm test all pass | PASS | 100/100 |
| AC-010-E: build exit 0 | PASS | Confirmed |
| AC-010-F: Independent verifier approved | CONDITIONAL | See skeptical findings |
| AC-010-G: Human approval before merge | REQUIRED | Human merge gate not yet passed |

### 6.6 Skeptical Reviewer — FAIL (computed verdict basis)

The skeptical reviewer independently verified all claims and identified the following:

**CRITICAL findings (4):**

1. **CRIT-1 — AC-004-A/B/C FAIL:** Raw error codes displayed instead of required human-readable messages. `ProjectsPage.tsx:242` renders `"Inspection error: FFPROBE_ERROR"`. AC-004-A requires `"Inspection failed: FFprobe unavailable"`. The E2E test for AC-004 asserts `toContainText('FFPROBE_ERROR')` which passes against wrong behavior because the substring is present in the non-compliant string — the test validates incorrect behavior.

2. **CRIT-2 — AC-008-B FAIL:** `ProjectsPage.tsx:178` conditionally renders the entire metadata section: `{selectedProject.mediaMetadata && (<dl>...</dl>)}`. When `mediaMetadata` is null (draft projects, failed inspections), the entire section is hidden with no per-field placeholders. AC-008-B explicitly requires placeholder text for each field.

3. **CRIT-3 — AC-009-C FAIL:** `updateProjectInspection()` is never called in any test file in the repository. `tests/main/database-service.test.ts` covers only `createProject`, `listProjects`, `getProject`, `deleteProject`, and settings. The method exists in `databaseService.ts:117` but is completely untested.

4. **CRIT-4 — AC-003-A untested:** No test creates a project, calls `updateProjectInspection()` to write metadata, closes the database connection, reopens it, and verifies `listProjects()` returns the persisted metadata. All E2E tests use the browser QA mock which holds state in JS memory, not SQLite. The persistence acceptance criterion is entirely unverified.

**HIGH findings (7):**

5. **HIGH-1 — Unbounded stdout/stderr:** `runCommand.ts:37-43` accumulates all process output with no size cap, violating media-pipeline.md governance.

6. **HIGH-2 — AC-002-A confirmed FAIL:** Duration as `"2847.60s"` instead of `HH:MM:SS`/`MM:SS`.

7. **HIGH-3 — AC-002-F confirmed FAIL:** `bitRateBps` entirely absent from `ProjectsPage.tsx:178-235`.

8. **HIGH-4 — AC-002-E format failure:** File size always rendered as MB (`fileSizeBytes / 1_048_576`). No conditional GB scaling for large files.

**Evidence Theater Concerns:**

- All 19 E2E tests run against mock API in browser QA mode — they never exercise Electron IPC, SQLite, or real ffprobe. They prove React renders correctly with fixture data, nothing more.
- The AC-004 E2E test `toContainText('FFPROBE_ERROR')` was written to match wrong behavior and passes against non-compliant UI.
- `test:electron` failed — the real Electron smoke test was never successfully run.
- No test exercises the full production path: OS file dialog → IPC marshal → stat() → ffprobe spawn → stdout accumulation → JSON.parse → SQLite UPDATE → IPC response → React Query invalidation → renderer re-render.

---

## 7. Acceptance Criteria Summary

### Failed Criteria (Merge Blockers)

| ID | Description | Severity |
|---|---|---|
| AC-002-A | Duration format: raw seconds instead of HH:MM:SS/MM:SS | HIGH |
| AC-002-E | File size: always MB, no GB scaling for large files | HIGH |
| AC-002-F | Bit rate field absent from metadata display | HIGH |
| AC-004-A | Error message: "FFPROBE_ERROR" code shown instead of human-readable string | CRITICAL |
| AC-004-B | Error message: "FILE_NOT_FOUND" code shown instead of human-readable string | CRITICAL |
| AC-004-C | Error message: "NO_VIDEO_STREAM" code shown instead of human-readable string | CRITICAL |
| AC-008-B | No per-field placeholder when mediaMetadata is null | CRITICAL |
| AC-009-C | updateProjectInspection() has zero test coverage | CRITICAL |
| AC-003-A | Persistence after restart: completely untested | CRITICAL |

### Passed Criteria

All security-related criteria (AC-007, shell injection, preload exposure, structured error codes, BrowserWindow flags, path validation), state machine criteria (AC-005, AC-006), most display criteria (AC-002-B/C/D/G/H), IPC contract criteria (AC-009-B/D), and all governance/build criteria (AC-010-A through AC-010-E) passed.

---

## 8. Governance Constraint Verification

| Constraint | Status |
|---|---|
| gate.yaml unmodified | CONFIRMED — byte-identical |
| settings.json unmodified | CONFIRMED — no hooks removed |
| No new dependencies | CONFIRMED — package.json and pnpm-lock.yaml unchanged |
| No shell: true | CONFIRMED — grep 0 matches in src/ |
| No nodeIntegration: true | CONFIRMED — grep 0 matches |
| No contextIsolation: false | CONFIRMED |
| No raw ipcRenderer in preload | CONFIRMED — preload exposes only typed named methods |
| No --dangerously-skip-permissions | CONFIRMED |
| No bypassPermissions | CONFIRMED |
| No modification of ~/.claude | CONFIRMED |
| No git push / merge / release | CONFIRMED |

---

## 9. Final Verdict

**M1 NOT ACCEPTED — DO NOT MERGE**

The branch has at minimum 4 critical and 7 high confirmed acceptance criteria failures. Additionally, one high-severity governance violation (unbounded stdout) is present. The E2E test suite that claims to validate AC-004 was written to match non-compliant behavior.

### Required Fixes Before Re-Audit

1. **AC-002-A:** Implement `formatDuration()` helper producing HH:MM:SS or MM:SS format; replace `durationSeconds.toFixed(2) + 's'` in `ProjectsPage.tsx`.
2. **AC-002-E:** Auto-scale file size: show GB when >= 1 GiB, MB otherwise.
3. **AC-002-F:** Add bit rate display to metadata section in `ProjectsPage.tsx`.
4. **AC-004-A/B/C:** Add error code to human-readable message translation map in renderer; update the AC-004 E2E test to assert on the human-readable string, not the raw code.
5. **AC-008-B:** Show per-field placeholder (e.g., "—") for each metadata field when `mediaMetadata` is null.
6. **AC-009-C:** Add unit tests for `updateProjectInspection()` covering valid metadata and null/failed metadata.
7. **AC-003-A:** Add a persistence test that writes inspection metadata via `updateProjectInspection()`, closes and reopens the `DatabaseService`, and verifies `listProjects()` returns the persisted data.
8. **HIGH-1 (governance):** Add incremental size cap to `runCommand.ts` stdout/stderr accumulation; return structured `OUTPUT_TOO_LARGE` error once a limit (e.g., 4 MB) is exceeded.

After all fixes are applied: regenerate visual baselines, update the E2E test assertions, and request a re-audit.

---

## 10. Human Merge Gate

Human approval is required before any merge to a protected branch. This audit does not authorize merge. The implementing agent does not have authority to merge or push. The human reviewer must:

1. Review this audit document and the reviewer evidence in `docs/governance/M1_REVIEWER_EVIDENCE.md`
2. Verify the required fixes have been applied
3. Optionally request a re-audit of the corrected implementation
4. Explicitly authorize merge in writing

No autonomous merge, push, release, or deployment will occur.

---

## 11. Owner Override — Merge Authorization

**Authorization date:** 2026-07-19
**Authorized by:** Repository owner (explicit prompt authorization)

**Decision: OWNER OVERRIDE — MERGED WITHOUT MANUAL DIFF OR RUNTIME REVIEW**

**Reason:**
M1 implementation completed, targeted remediation completed, automated validation passed,
focused delta acceptance audit returned ACCEPTED, and the repository owner explicitly chose
to defer manual testing.

**Automated evidence:**
- 134 unit/integration tests passing (15 test files)
- 19/19 E2E tests passing
- 9/9 visual regression tests passing
- `pnpm validate` exit 0
- `pnpm governance:validate` exit 0
- `pnpm architecture:validate` exit 0
- `pnpm design:validate` exit 0
- `pnpm dependencies:validate` exit 0
- `pnpm claude:validate` exit 0 (ALL PASSED)
- `pnpm claude:test:adversarial` exit 0 (34/34 passed)
- `pnpm build` exit 0
- `pnpm typecheck` exit 0
- `pnpm lint` exit 0 (0 warnings)
- Delta acceptance audit: ACCEPTED — all 8 previously-rejected criteria pass

**Manual review status:** SKIPPED, NOT PASSED
- Manual diff review: SKIPPED BY OWNER OVERRIDE
- Manual Electron runtime test: SKIPPED BY OWNER OVERRIDE
- Manual real-media smoke test: SKIPPED BY OWNER OVERRIDE

**Unsupported environment:**
`pnpm test:electron` / `pnpm validate:full` fail due to pre-existing environment constraint
(macOS Quartz display session required; headless execution not supported). Documented in
`docs/baseline/BASELINE_REPORT.md`. This is not a defect introduced by M1.

**Residual risk:** Accepted by the repository owner.
