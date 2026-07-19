# M1 Media Inspection — Acceptance Criteria Matrix

**Audit date**: 2026-07-19
**Branch**: feature/m1-media-ingestion-inspection
**Auditor**: documentation-writer (second batch)
**Source spec**: docs/product/MEDIA_INSPECTION_ACCEPTANCE_CRITERIA.md
**Overall verdict**: NOT ACCEPTED — 4 critical failures, 7 high findings

---

## How to read this table

- **VERIFIED**: The criterion was independently confirmed by reading source code, running commands, or observing actual output.
- **PARTIAL**: The criterion is partially met; a caveat or gap prevents full verification.
- **FAIL**: The criterion was tested and found non-compliant with the spec.
- **NOT VERIFIED**: No test or evidence exists that exercises this criterion against real production code.

---

## AC-001 — Post-create auto-inspection

| Criterion | Source | Implementation Evidence | Test Coverage | Status |
|---|---|---|---|---|
| AC-001-A: `projects.inspect(projectId)` is called by renderer immediately after `projects.create()` resolves | MEDIA_INSPECTION_ACCEPTANCE_CRITERIA.md | `CreateProjectForm.tsx`: `useInspectProject.mutate({ projectId: created.id })` called in the `onSuccess` callback of `useCreateProject`. Chain is `create → onSuccess → inspect.mutate`. | E2E (browser QA mock): `media-inspection.e2e.spec.ts` — "creates a project and triggers inspection automatically" asserts inspect mock was called after create. Mock level only; no IPC-layer evidence. | PARTIAL |
| AC-001-B: Metadata appears without additional user action beyond project creation | MEDIA_INSPECTION_ACCEPTANCE_CRITERIA.md | Renderer calls `inspect` automatically in `onSuccess`; UI re-renders on query invalidation. No button press required for inspection to start. | E2E mock confirms metadata section appears after create. No real Electron evidence (smoke test failed). | PARTIAL |
| AC-001-C: `projects.create()` resolves before inspection starts (inspection does not block creation response) | MEDIA_INSPECTION_ACCEPTANCE_CRITERIA.md | `useCreateProject.onSuccess` fires after `projects.create()` IPC resolves. Inspection is a separate `mutate` call, not chained inside the create IPC handler. DB write for project row is complete before inspect IPC is dispatched. | No dedicated test for ordering guarantee. E2E implicitly exercises sequence under mock. | PARTIAL |
| AC-001-D: Project appears in list immediately as 'draft' before inspection completes | MEDIA_INSPECTION_ACCEPTANCE_CRITERIA.md | `useCreateProject.onSuccess` calls `queryClient.invalidateQueries(['projects'])` before calling `inspectProject.mutate`. However `CreateProjectForm.tsx` awaits `inspectProject.mutateAsync` before calling `onCreated()`, keeping the modal open during inspection. Whether the draft project is visible in the list behind the modal is technically true but visually blocked. | No E2E test asserts draft status is visible in the list prior to inspection completing. | PARTIAL |

---

## AC-002 — Metadata display

| Criterion | Source | Implementation Evidence | Test Coverage | Status |
|---|---|---|---|---|
| AC-002-A: Duration displayed in HH:MM:SS or MM:SS format matching FFprobe `format.duration` | MEDIA_INSPECTION_ACCEPTANCE_CRITERIA.md | **FAIL.** `ProjectsPage.tsx:189`: `{selectedProject.mediaMetadata.durationSeconds.toFixed(2)}s` — renders raw decimal seconds (e.g. `2847.60s`). No `formatDuration` helper exists anywhere in `src/renderer/`. | E2E test checks for existence of metadata section but not duration format compliance. | FAIL |
| AC-002-B: Resolution displayed as `{width} x {height}` in pixels | MEDIA_INSPECTION_ACCEPTANCE_CRITERIA.md | `ProjectsPage.tsx` renders `{width} x {height}` in the metadata dl block. Design matches spec. | E2E snapshot confirms rendering with fixture values 1920 x 1080. | VERIFIED |
| AC-002-C: Codec displayed from FFprobe `streams[].codec_name` for the video stream | MEDIA_INSPECTION_ACCEPTANCE_CRITERIA.md | `ProjectsPage.tsx` renders `videoCodec` field from `mediaMetadata`. `ffmpegService.ts` extracts `codec_name` from the video stream object. | E2E fixture uses `videoCodec: 'h264'`, verified in snapshot. | VERIFIED |
| AC-002-D: Frame rate displayed as fps derived from `streams[].avg_frame_rate` (e.g., 23.97) | MEDIA_INSPECTION_ACCEPTANCE_CRITERIA.md | `ProjectsPage.tsx` renders `fps` field. `ffmpegService.ts` derives fps by evaluating `avg_frame_rate` fraction string (e.g., `"24000/1001"`). | Unit tests in `ffmpegService.inspect.test.ts` verify fps extraction from mock ffprobe output. | VERIFIED |
| AC-002-E: File size displayed in human-readable form (e.g., 4.2 GB) | MEDIA_INSPECTION_ACCEPTANCE_CRITERIA.md | **FAIL.** `ProjectsPage.tsx:230`: `{(selectedProject.mediaMetadata.fileSizeBytes / 1_048_576).toFixed(1)} MB` — always divides by 1 MiB and appends `MB`. For the fixture value of 3,021,000,000 bytes this renders as `2880.9 MB` rather than `2.8 GB`. No conditional GB branch exists. | No E2E test asserts the GB format for large files. | FAIL |
| AC-002-F: Bit rate displayed (e.g., 14.2 Mbps) | MEDIA_INSPECTION_ACCEPTANCE_CRITERIA.md | **FAIL.** `bitRateBps` is absent from `ProjectsPage.tsx` metadata dl block (lines 178–235). Field is present in `MediaMetadata` type and in fixtures but is never rendered in any UI component. | No E2E test asserts bit rate display. grep for `bitRateBps` in `src/renderer/` returns only fixture files. | FAIL |
| AC-002-G: All metadata uses design tokens — no hardcoded hex, px, or rgb values in new renderer code | MEDIA_INSPECTION_ACCEPTANCE_CRITERIA.md | `pnpm design:validate` exited 0. No inline hex or px values found in `ProjectsPage.tsx` metadata section during review. Tailwind utility classes used throughout. | `pnpm design:validate` pass confirmed. | VERIFIED |
| AC-002-H: Long codec names (>30 chars) truncate gracefully without breaking layout | MEDIA_INSPECTION_ACCEPTANCE_CRITERIA.md | `ProjectsPage.tsx` codec rendering does not include a Tailwind `truncate` or `overflow-hidden` class on the codec dd element. No explicit truncation logic was confirmed. | No dedicated test for >30-char codec names. | NOT VERIFIED |

---

## AC-003 — Persistence after restart

| Criterion | Source | Implementation Evidence | Test Coverage | Status |
|---|---|---|---|---|
| AC-003-A: `listProjects()` returns metadata-populated records after app restart | MEDIA_INSPECTION_ACCEPTANCE_CRITERIA.md | `databaseService.updateProjectInspection()` writes all 9 media columns to SQLite via a single ORM UPDATE. `listProjects()` SELECTs all columns including inspection fields via `mapProject()`. The code path is correct by inspection, but no test closes and reopens the database after writing inspection data to verify read-back. | **No test exercises the write-close-reopen-read path.** All E2E tests use the in-memory browser QA mock, not SQLite. `database-service.test.ts` never calls `updateProjectInspection`. | NOT VERIFIED |
| AC-003-B: `SELECT duration_seconds, width, height FROM projects WHERE id = ?` returns non-null for an inspected project | MEDIA_INSPECTION_ACCEPTANCE_CRITERIA.md | SQL migration creates nullable columns; `updateProjectInspection` populates them on success. The query would return non-null values if the implementation ran correctly against a real database. | No test performs a raw SQL SELECT against the SQLite file after inspection. | NOT VERIFIED |
| AC-003-C: `inspected_at` column populated with Unix ms timestamp | MEDIA_INSPECTION_ACCEPTANCE_CRITERIA.md | `databaseService.ts`: `inspectedAt: Date.now()` passed to ORM UPDATE on success path. Column type is `integer` (Unix ms). | No test verifies the value written to `inspected_at` via a real DB call. | NOT VERIFIED |

---

## AC-004 — Error display

| Criterion | Source | Implementation Evidence | Test Coverage | Status |
|---|---|---|---|---|
| AC-004-A: FFprobe unavailable shows 'Inspection failed: FFprobe unavailable' | MEDIA_INSPECTION_ACCEPTANCE_CRITERIA.md | **FAIL.** `ProjectsPage.tsx:242`: `Inspection error: {selectedProject.inspectionError}` — renders the raw code `FFPROBE_ERROR` / `FFPROBE_UNAVAILABLE`, not the required human-readable string. No translation map exists in `src/renderer/`. | E2E test uses `toContainText('FFPROBE_ERROR')` — this passes because the raw code appears in the rendered string, but it confirms incorrect behavior. | FAIL |
| AC-004-B: File not found shows 'Inspection failed: file not found or inaccessible' | MEDIA_INSPECTION_ACCEPTANCE_CRITERIA.md | **FAIL.** Same root cause as AC-004-A. `ProjectsPage.tsx` renders `Inspection error: FILE_NOT_FOUND` instead of required human-readable message. | No E2E test asserts on the `FILE_NOT_FOUND` human-readable message. | FAIL |
| AC-004-C: No video stream shows 'Inspection failed: no video stream found' | MEDIA_INSPECTION_ACCEPTANCE_CRITERIA.md | **FAIL.** Same root cause. `NO_VIDEO_STREAM` code is rendered raw in the UI. | No E2E test asserts on the `NO_VIDEO_STREAM` human-readable message. | FAIL |
| AC-004-D: `inspectionError` field contains a structured code string, not raw FFprobe stderr | MEDIA_INSPECTION_ACCEPTANCE_CRITERIA.md | `ffmpegService.ts` returns only defined constant strings (`FILE_NOT_FOUND`, `FFPROBE_ERROR`, `PARSE_ERROR`, `NO_VIDEO_STREAM`). Raw stderr is never placed in the `inspectionError` field. `projectSchema.inspectionError: z.string().max(64).nullable()` enforces max length. | Electron security reviewer confirmed. Unit test `ffmpegService.inspect.test.ts` verifies error code extraction. | VERIFIED |
| AC-004-E: Project record still exists with original name and `videoPath` after failed inspection | MEDIA_INSPECTION_ACCEPTANCE_CRITERIA.md | `updateProjectInspection()` on failure path sets `status: 'inspection_failed'` and `inspectionError` but does not DELETE or overwrite `name` or `videoPath`. A separate `deleteProject()` call would be needed to remove the record. | Unit tests in `ffmpegService.inspect.test.ts` cover the failure path return value. No test verifies the DB row is intact after a failed inspection via a real DB call. | PARTIAL |

---

## AC-005 — Status state machine

| Criterion | Source | Implementation Evidence | Test Coverage | Status |
|---|---|---|---|---|
| AC-005-A: `projectSchema.status = 'ready'` after successful inspect call | MEDIA_INSPECTION_ACCEPTANCE_CRITERIA.md | `updateProjectInspection()` sets `status: 'ready'` on success. `projectSchema` has `status: z.enum(['draft','ready','inspection_failed','archived'])`. | Unit tests verify IPC handler returns `status: 'ready'` on success path. | VERIFIED |
| AC-005-B: `projectSchema.status = 'inspection_failed'` after failed inspect call | MEDIA_INSPECTION_ACCEPTANCE_CRITERIA.md | `updateProjectInspection()` sets `status: 'inspection_failed'` on failure path. | Unit tests and mock fixtures cover this path. | VERIFIED |
| AC-005-C: `StatusPill` receives `status='ok'` variant for `'ready'` | MEDIA_INSPECTION_ACCEPTANCE_CRITERIA.md | `statusPillVariant` function in `ProjectsPage.tsx` lines 8–14: `case 'ready': return 'ok'`. Confirmed correct. | E2E fixture `projectA` has `status: 'ready'` and renders StatusPill; snapshot verified. | VERIFIED |
| AC-005-D: `StatusPill` receives appropriate neutral/error variant for `'inspection_failed'` | MEDIA_INSPECTION_ACCEPTANCE_CRITERIA.md | `statusPillVariant`: `case 'inspection_failed': return 'warning'`. Maps correctly to a non-ok variant. | E2E fixture `projectB` has `status: 'inspection_failed'`; StatusPill renders in warning state. | VERIFIED |
| AC-005-E: Status pill visible in project list row, not only in detail panel | MEDIA_INSPECTION_ACCEPTANCE_CRITERIA.md | `ProjectsPage.tsx` renders `<StatusPill>` in the project list row and also in the detail panel. Both render from the same status field. | E2E snapshot captures the list row StatusPill. | VERIFIED |

---

## AC-006 — Resilience

| Criterion | Source | Implementation Evidence | Test Coverage | Status |
|---|---|---|---|---|
| AC-006-A: Project record still exists and is listable after inspection fails | MEDIA_INSPECTION_ACCEPTANCE_CRITERIA.md | Inspection failure path calls `updateProjectInspection` with failure fields, not DELETE. Project row persists with `status: 'inspection_failed'`. | E2E mock with failed-inspection fixture confirms list renders the project. | PARTIAL (mock only) |
| AC-006-B: Other project records are unaffected by a failed inspection | MEDIA_INSPECTION_ACCEPTANCE_CRITERIA.md | `updateProjectInspection` issues a single `UPDATE ... WHERE id = ?` — only the target row is modified. | E2E multi-project fixture shows two projects; failed project does not affect the ready project. | PARTIAL (mock only) |
| AC-006-C: `projects.videoPath` retains original value after failed inspection | MEDIA_INSPECTION_ACCEPTANCE_CRITERIA.md | `updateProjectInspection` on failure sets `inspectionError` and `status` but does not touch `videoPath`. The video path column is not in the UPDATE on failure. | No test reads `videoPath` from DB after a failed inspection to verify it is unchanged. | NOT VERIFIED |
| AC-006-D: Calling inspect twice on a 'draft' project does not create duplicate records or errors (idempotent) | MEDIA_INSPECTION_ACCEPTANCE_CRITERIA.md | `updateProjectInspection` issues an UPDATE (not INSERT), so repeated calls overwrite rather than duplicate. The IPC handler does not guard against a second concurrent call. | No test calls inspect twice in sequence to verify idempotency. | NOT VERIFIED |

---

## AC-007 — Error information exposure

| Criterion | Source | Implementation Evidence | Test Coverage | Status |
|---|---|---|---|---|
| AC-007-A: `inspectionError` field returned by IPC handler is a structured code, not raw stderr text | MEDIA_INSPECTION_ACCEPTANCE_CRITERIA.md | `registerIpcHandlers.ts` lines 157–165 forward only `outcome.inspectionError` (a constant string). Raw stdout/stderr from `runCommand` are never placed in the returned object. | Electron security review confirmed. Unit test confirms error code string returned. | VERIFIED |
| AC-007-B: No `Error.message` containing FFprobe internal details sent to renderer | MEDIA_INSPECTION_ACCEPTANCE_CRITERIA.md | No code path constructs an `Error` from raw ffprobe stderr text. `toSafeError()` in `src/main/utils/errors.ts` could forward an arbitrary `Error.message` for unexpected exceptions, but no such path currently runs through ffprobe stderr content. | Security review noted the `toSafeError` generic catch as a medium-severity forward-looking concern. | PARTIAL |
| AC-007-C: Zod validation on handler output rejects unstructured error strings | MEDIA_INSPECTION_ACCEPTANCE_CRITERIA.md | `projectSchema.inspectionError: z.string().max(64).nullable()` — enforces max 64 chars. Full `mediaInspectionResultSchema` is used to validate IPC output. Long raw error strings would be rejected by the max(64) constraint. | IPC contract tests in `ipc-contracts.test.ts` verify schema rejection of malformed payloads. | VERIFIED |

---

## AC-008 — Null/graceful handling

| Criterion | Source | Implementation Evidence | Test Coverage | Status |
|---|---|---|---|---|
| AC-008-A: Projects with null metadata columns render without throwing in renderer | MEDIA_INSPECTION_ACCEPTANCE_CRITERIA.md | `ProjectsPage.tsx:178`: `{selectedProject.mediaMetadata && (<dl>...</dl>)}` — the entire metadata block is conditionally rendered only when `mediaMetadata` is non-null. React does not throw when the block is absent. | E2E fixture includes `projectC` with `status: 'draft'` and null metadata; no crash observed. | VERIFIED |
| AC-008-B: Project detail shows a placeholder for each metadata field when metadata is null | MEDIA_INSPECTION_ACCEPTANCE_CRITERIA.md | **FAIL.** When `mediaMetadata` is null the entire section is absent — no `dl` block renders, no per-field placeholder text (e.g. "—" or "Not yet inspected") is shown. AC-008-B requires visible placeholders for each field, not a silent empty section. | No E2E test asserts on placeholder text for null-metadata projects. | FAIL |
| AC-008-C: Running `0001_media_inspection.sql` on a DB with existing project rows does not fail | MEDIA_INSPECTION_ACCEPTANCE_CRITERIA.md | Migration adds nullable columns with no DEFAULT clause, which SQLite handles by setting existing rows to NULL — no schema conflict for existing rows. Verified by migration reviewer. | Migration reviewer confirmed safe-on-upgrade. No automated migration-against-seed-data test exists. | VERIFIED |

---

## AC-009 — Test coverage

| Criterion | Source | Implementation Evidence | Test Coverage | Status |
|---|---|---|---|---|
| AC-009-A: `tests/main/ffmpegService.inspect.test.ts` exists covering happy path, file not found, no video stream, FFprobe unavailable | MEDIA_INSPECTION_ACCEPTANCE_CRITERIA.md | File exists (untracked `??` in git status). 9 test cases confirmed by validator. Covers happy path, `FILE_NOT_FOUND`, `NO_VIDEO_STREAM`, `FFPROBE_UNAVAILABLE`, `PARSE_ERROR`, and timeout path. All use a mocked `CommandRunner` and a real temp file for stat(). | `pnpm test` passes 100/100 including these 9 tests. | VERIFIED |
| AC-009-B: `tests/main/ipc-contracts.test.ts` includes `PROJECT_INSPECT` channel | MEDIA_INSPECTION_ACCEPTANCE_CRITERIA.md | `ipc-contracts.test.ts` has 5 tests including `PROJECT_INSPECT` channel registration and Zod schema rejection of invalid payloads. | `pnpm test` passes 100/100. | VERIFIED |
| AC-009-C: `databaseService.updateProjectInspection()` tested with valid and null metadata | MEDIA_INSPECTION_ACCEPTANCE_CRITERIA.md | **FAIL.** `tests/main/database-service.test.ts` covers only `createProject`, `listProjects`, `getProject`, `deleteProject`, and settings. `updateProjectInspection` is never called in any test file. grep for `updateProjectInspection` in `tests/` returns zero hits. | Method exists at `databaseService.ts:117` and is untested. | FAIL |
| AC-009-D: `tests/e2e/media-inspection.e2e.spec.ts` covers create project -> inspect -> see metadata | MEDIA_INSPECTION_ACCEPTANCE_CRITERIA.md | File exists (untracked `??`). 4 E2E tests confirmed. Covers: create-and-inspect flow, error state display, multi-project state. All run against browser QA mock; no real Electron IPC or SQLite exercised. | `pnpm test:e2e` 19/19 passed (all in browser QA mode). | PARTIAL |
| AC-009-E: At least one visual test baseline updated to include metadata display | MEDIA_INSPECTION_ACCEPTANCE_CRITERIA.md | `dark-theme.visual.spec.ts` and its PNG snapshots were added in this branch. 3 existing visual baselines have sub-2% pixel-diff failures (baseline drift). The `projects-populated.png` baseline is the most relevant snapshot. | `pnpm test:visual` 6 passed / 3 failed (pixel-diff in existing baselines). Visual suite cannot currently serve as correctness signal until baselines are regenerated after AC-002/AC-004 fixes. | PARTIAL |

---

## AC-010 — Process gates

| Criterion | Source | Implementation Evidence | Test Coverage | Status |
|---|---|---|---|---|
| AC-010-A: `pnpm governance:validate` exits 0 | MEDIA_INSPECTION_ACCEPTANCE_CRITERIA.md | Confirmed. Governance validation passed including CI action SHA pinning check. | Exit code 0 observed. `pnpm claude:validate` also exits 0 (34 adversarial scenarios passed). | VERIFIED |
| AC-010-B: `pnpm typecheck` exits 0 | MEDIA_INSPECTION_ACCEPTANCE_CRITERIA.md | Confirmed. `tsc -p tsconfig.app.json --noEmit` and `tsc -p tsconfig.electron.json --noEmit` both completed with zero errors. | Exit code 0 observed. | VERIFIED |
| AC-010-C: `pnpm lint` exits 0 (max-warnings=0) | MEDIA_INSPECTION_ACCEPTANCE_CRITERIA.md | Confirmed. ESLint with `--max-warnings=0` reported no warnings or errors. | Exit code 0 observed. | VERIFIED |
| AC-010-D: `pnpm test` passes all tests with no new failures and no `.skip`/`.only` introduced | MEDIA_INSPECTION_ACCEPTANCE_CRITERIA.md | Confirmed. 13 test files, 100 tests passed. No `.skip` or `.only` patterns found by governance validate. | Exit code 0, 100/100 tests. | VERIFIED |
| AC-010-E: `pnpm build` exits 0 | MEDIA_INSPECTION_ACCEPTANCE_CRITERIA.md | Confirmed. Vite renderer (1823 modules, 387 KB), tsup main (48.67 KB), tsup preload (3.13 KB) all succeeded. | Exit code 0 observed. | VERIFIED |
| AC-010-F: Independent verifier approved (different agent/role than implementer; ran real commands) | MEDIA_INSPECTION_ACCEPTANCE_CRITERIA.md | Three reviewers completed: electron-security-reviewer (APPROVED), architecture-reviewer (APPROVED), governance-verifier (CONDITIONALLY PASS, condition self-closed). Skeptical reviewer independently ran all commands and confirmed evidence. | Reviewer details in `loop-run-log.md`. | VERIFIED |
| AC-010-G: Human approval obtained before merge | MEDIA_INSPECTION_ACCEPTANCE_CRITERIA.md | `STATE.md` and `loop-run-log.md` both record "complete — awaiting human merge gate." No merge has occurred. Human approval remains required and has not yet been obtained. | Not yet obtained. Required before merge proceeds. | NOT VERIFIED |

---

## User flow step coverage

| Step | Description | Evidence | Status |
|---|---|---|---|
| 1 | User opens Projects page and clicks 'New Project' | E2E `media-inspection.e2e.spec.ts` exercises CreateProjectForm open | PARTIAL (mock) |
| 2 | User selects video file via OS dialog | `dialogService.ts` + `dialog.showOpenDialog` with Video filter. `selectedVideoSchema` validates. | VERIFIED (code) |
| 3 | `CreateProjectForm.tsx` calls `projects.create()` IPC; project written with `status='draft'` | `registerIpcHandlers.ts` PROJECT_CREATE handler confirmed | VERIFIED (code) |
| 4 | Project appears in list immediately as 'draft' before inspection | Query invalidated after create. Modal remains open blocking visual observation. | PARTIAL |
| 5 | Renderer calls `window.sceneSift.projects.inspect(created.id)` automatically | `CreateProjectForm.tsx` `onSuccess` calls `inspectProject.mutate` | VERIFIED (code) |
| 6 | UI shows loading indicator while inspect Promise is in flight | `useInspectProject` exposes `isPending` state; loading state displayed in detail panel | VERIFIED (code) |
| 7 | Main process handler receives `project:inspect` IPC call with `{projectId: uuid}` | `registerIpcHandlers.ts` lines 142–167 handle `IPC_CHANNELS.PROJECT_INSPECT` | VERIFIED (code) |
| 8 | Handler looks up `project.videoPath` from DB using UUID | `databaseService.getProject(payload.projectId)` called before path validation | VERIFIED (code) |
| 9 | Handler validates path: `path.resolve()` + `stat().isFile()` | `ffmpegService.ts:140–149` confirms both checks | VERIFIED (code) |
| 10 | Handler checks FFprobe availability; returns `FFPROBE_UNAVAILABLE` if missing | `checkFfmpegAvailability()` called before spawn; structured result returned | VERIFIED (code) |
| 11 | Handler invokes FFprobe via `runCommand()` with argument array, `shell:false`, 15s timeout | `ffmpegService.ts:151–155`, `runCommand.ts:20–23` | VERIFIED (code) |
| 12 | FFprobe JSON output parsed; video stream located; metadata extracted | `ffmpegService.ts:163–195` parses and extracts 7 metadata fields | VERIFIED (unit tests) |
| 13 | On success: `updateProjectInspection()` stores metadata; status → 'ready' | Code path exists; NOT tested against real SQLite | PARTIAL |
| 14 | IPC handler returns `mediaInspectionResultSchema`-validated result | Zod validation on output confirmed; no raw stderr in result | VERIFIED |
| 15 | Renderer calls `queryClient.invalidateQueries` to refresh TanStack cache | `useProjects.ts` `onSuccess` callback confirmed | VERIFIED (code) |
| 16 | Project detail panel re-renders showing metadata grid | Metadata block renders for non-null `mediaMetadata`. Duration format and file size scale are non-compliant. | PARTIAL (fails AC-002-A, E, F) |
| 17 | Status pill in both list row and detail panel updates to show 'ok'/Ready | `statusPillVariant` mapping confirmed for 'ready' → 'ok' | VERIFIED |
| 18 | On failure: `inspection_failed` status, structured error code stored, user-readable message shown | Status and code stored correctly. UI renders raw code string instead of human-readable message (AC-004-A/B/C FAIL). | FAIL |
| 19 | On failure: project record intact with original name and videoPath; other projects unaffected | UPDATE-not-DELETE confirmed. Not verified against real SQLite. | PARTIAL |

---

## Security constraint coverage

| Constraint | Status |
|---|---|
| `shell: false` on all `spawn` calls | VERIFIED |
| Argument arrays — no command string concatenation | VERIFIED |
| `path.resolve()` before stat at PROJECT_CREATE | VERIFIED |
| `path.resolve()` + `stat().isFile()` before ffprobe at PROJECT_INSPECT | VERIFIED |
| 15-second SIGKILL timeout | VERIFIED |
| No raw FFprobe stderr in IPC response | VERIFIED |
| Preload exposes only named typed methods | VERIFIED |
| No raw `ipcRenderer` on window | VERIFIED |
| BrowserWindow `nodeIntegration: false`, `contextIsolation: true`, `sandbox: true`, `webSecurity: true` | VERIFIED |
| `inspectionError` max 64 chars (Zod) | VERIFIED |
| Unbounded stdout/stderr buffering | HIGH FINDING — not mitigated |
| TOCTOU race between stat and spawn | MEDIUM FINDING — documented accepted risk |

---

## Summary counts

| Status | Count |
|---|---|
| VERIFIED | 26 |
| PARTIAL | 15 |
| NOT VERIFIED | 7 |
| FAIL | 9 |

**Critical failures requiring fix before re-review**: AC-002-A (duration format), AC-002-E (file size scale), AC-002-F (bit rate missing), AC-004-A/B/C (raw error codes), AC-008-B (null placeholders), AC-009-C (updateProjectInspection untested), AC-003-A (persistence unverified).
