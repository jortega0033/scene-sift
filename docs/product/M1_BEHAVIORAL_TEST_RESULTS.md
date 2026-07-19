# M1 Media Inspection — Behavioral Test Results

**Audit date**: 2026-07-19
**Branch**: feature/m1-media-ingestion-inspection
**Auditor**: documentation-writer (second batch)

---

## Test suite overview

| Suite | Command | Result | Tests |
|---|---|---|---|
| Unit (Vitest) | `pnpm test` | PASS | 100/100 |
| E2E (Playwright, browser QA mode) | `pnpm test:e2e` | PASS | 19/19 |
| Visual regression (Playwright) | `pnpm test:visual` | FAIL | 6/9 (3 pixel-diff failures) |
| Electron smoke | `pnpm test:electron` | FAIL | 0/1 (display session required) |

---

## Critical caveat: mock boundary

All 19 E2E tests and all unit tests exercise the system through mocks or stubs. No test exercises the complete production path:

```
OS file dialog
  → IPC marshal (contextBridge)
  → stat() on real filesystem
  → real ffprobe binary spawn
  → stdout accumulation
  → JSON.parse
  → SQLite UPDATE (real file)
  → IPC response marshal
  → React Query invalidation
  → renderer re-render
```

Every layer in this chain is either mocked (E2E: entire `window.sceneSift` API replaced by mock; unit: `CommandRunner` replaced by a jest-style spy) or not tested (SQLite persistence after `updateProjectInspection`). The test suite passing at 100% unit / 19/19 E2E proves that individual components behave correctly in isolation and that the React UI renders fixture data correctly. It does not prove that the production stack functions end-to-end.

---

## E2E tests: `tests/e2e/media-inspection.e2e.spec.ts`

**File status**: untracked (`??`) in git — not committed to the branch.
**Test environment**: Playwright against Vite dev server with `VITE_SCENESIFT_BROWSER_QA=1`. The real `window.sceneSift` preload bridge is replaced by `createMockSceneSiftApi()`. No Electron process. No IPC. No SQLite. No ffprobe.

### Test 1: "creates a project and triggers inspection automatically"

**What it does**: Opens the CreateProjectForm, fills in a project name and video file path using the mock dialog, submits the form, waits for the metadata section to appear in the project detail panel.

**What it verifies**:
- `mockSceneSiftApi.projects.create()` was called
- `mockSceneSiftApi.projects.inspect()` was called after create resolved
- The metadata dl block (`duration`, `resolution`, `codec`, `fps`, `file size`) becomes visible in the detail panel
- StatusPill shows the 'ready' variant after inspection

**What it does NOT verify**:
- Real IPC channel invocation
- Real ffprobe execution
- SQLite row creation or update
- That the metadata displayed matches actual ffprobe output from a real file
- Duration format compliance (AC-002-A) — test does not assert on the format of the duration string

**Mock behavior**: `mockSceneSiftApi.projects.inspect()` always returns `{ status: 'success', mediaMetadata: { durationSeconds: 2847.6, width: 1920, height: 1080, videoCodec: 'h264', fps: 23.976, bitRateBps: 8_500_000, fileSizeBytes: 3_021_000_000 } }` regardless of input. There is no code path in this test that invokes real ffprobe.

---

### Test 2: "shows error state when inspection fails"

**What it does**: The mock is configured to return `{ status: 'error', inspectionError: 'FFPROBE_ERROR' }` for the inspect call. Test verifies the error state renders.

**What it verifies**:
- `inspection_failed` status pill variant renders in the list row
- Some text containing `FFPROBE_ERROR` appears in the detail panel
- Project remains in the list after inspection failure

**What it does NOT verify**:
- The human-readable message required by AC-004-A (`'Inspection failed: FFprobe unavailable'`). The test uses `toContainText('FFPROBE_ERROR')`, which matches the non-compliant rendered string `'Inspection error: FFPROBE_ERROR'`. **This test passes while confirming incorrect behavior.**
- `FILE_NOT_FOUND` error code rendering (AC-004-B)
- `NO_VIDEO_STREAM` error code rendering (AC-004-C)

**Evidence theater concern**: The E2E test for AC-004 was written to match the wrong implementation. Passing this test at the mock level provides no assurance that the user will see the required human-readable message.

---

### Test 3: "displays correct metadata for a ready project"

**What it does**: Loads the multiple-projects fixture (which includes a pre-populated `projectA` with `status: 'ready'` and full `mediaMetadata`). Selects projectA and verifies the metadata section renders.

**What it verifies**:
- Duration field renders (does not assert format — sees `'2847.60s'` which is non-compliant but test passes)
- Resolution field renders as `1920 x 1080`
- Codec field renders as `h264`
- fps field renders as `23.98`
- File size field renders (renders `2880.9 MB` not `2.8 GB` — test does not assert on the GB format)
- `bitRateBps` is NOT asserted — test has no assertion for bit rate display

**What it does NOT verify**:
- Duration formatted as HH:MM:SS or MM:SS (AC-002-A FAIL confirmed here)
- File size auto-scaling to GB (AC-002-E FAIL confirmed here)
- Bit rate display (AC-002-F FAIL — no assertion exists)

---

### Test 4: "multiple projects do not interfere with each other"

**What it does**: Loads a multi-project fixture with projectA (ready) and projectB (inspection_failed). Verifies each project shows its own state independently.

**What it verifies**:
- Selecting projectA shows ready metadata
- Selecting projectB shows error state
- StatusPill variants differ between the two projects

**What it does NOT verify**:
- Database isolation (uses JS in-memory mock, not SQLite)

---

## Other E2E tests referencing M1 behavior

The following tests in the broader E2E suite (`tests/e2e/`) implicitly cover M1 UI elements:

| Test file | Relevant coverage |
|---|---|
| `tests/e2e/projects.e2e.spec.ts` | Project list rendering, StatusPill presence, create-project form |
| `tests/e2e/app-shell.e2e.spec.ts` | App shell renders correctly; no M1-specific assertions |
| `tests/e2e/accessibility.e2e.spec.ts` | ARIA roles on project list and detail panel |

---

## Unit tests: `tests/main/ffmpegService.inspect.test.ts`

**File status**: untracked (`??`) — not committed.
**Test environment**: Vitest. Uses a mocked `CommandRunner` (a function that returns a predetermined `RunCommandResult` without spawning any process). A real temporary file is created on disk for `stat().isFile()` checks.

### Test case inventory (9 tests)

| Test case | What it proves | What it does NOT prove |
|---|---|---|
| Happy path: full metadata extraction | `ffmpegService.inspectMediaFile()` correctly parses a well-formed ffprobe JSON payload and returns all 7 metadata fields | That a real ffprobe binary produces this JSON format |
| `FILE_NOT_FOUND` — file does not exist | Returns `{ inspectionError: 'FILE_NOT_FOUND' }` when `stat()` throws | Real filesystem behavior beyond temp-file deletion |
| `FILE_NOT_FOUND` — path is a directory | Returns `{ inspectionError: 'FILE_NOT_FOUND' }` when `stat().isFile()` returns false | Device node or named-pipe edge cases |
| `FFPROBE_UNAVAILABLE` — no ffprobe binary | Returns `{ inspectionError: 'FFPROBE_UNAVAILABLE' }` when availability check fails | Real `which ffprobe` behavior on production machines |
| `FFPROBE_ERROR` — non-zero exit code | Returns `{ inspectionError: 'FFPROBE_ERROR' }` when runner returns `exitCode !== 0` | Raw stderr content not leaked (confirmed by separate security review) |
| `NO_VIDEO_STREAM` — audio-only file | Returns `{ inspectionError: 'NO_VIDEO_STREAM' }` when ffprobe output has no video stream | Audio-only container edge cases beyond the test fixture |
| `PARSE_ERROR` — malformed JSON output | Returns `{ inspectionError: 'PARSE_ERROR' }` when ffprobe stdout is not valid JSON | Partial JSON or truncated output scenarios |
| Timeout propagation | `timeoutMs: 15000` is forwarded to `runCommand` options | That `runCommand` actually kills the process — that is covered separately in runCommand tests |
| fps fraction parsing | `avg_frame_rate: '24000/1001'` is correctly evaluated to `23.976` | Integer fps values, zero denominator edge cases |

**Proof strength**: MODERATE for the parsing and error-code logic. The unit tests establish that given a certain mock response the service produces the correct output. They do not test the spawn path, the actual stdout accumulation, or the behavior of a real ffprobe binary.

---

## Unit tests: `tests/main/ipc-contracts.test.ts`

**File status**: modified (` M`) — unstaged.
**Additions in this branch**: PROJECT_INSPECT channel added.

### Relevant test cases (5 total, 2 directly M1-relevant)

| Test case | What it proves |
|---|---|
| `PROJECT_INSPECT` channel in `ALL_IPC_CHANNELS` | Channel name is registered and exported from `src/shared/ipc/channels.ts` |
| `PROJECT_INSPECT` schema rejects non-UUID `projectId` | Zod `z.string().uuid()` on `inspectProjectInputSchema` rejects non-UUID strings |
| `PROJECT_INSPECT` schema rejects missing `projectId` | Schema rejects payloads without the required field |
| `project:inspect` input schema validates correctly | Well-formed `{ projectId: '...' }` passes validation |
| `mediaInspectionResultSchema` roundtrip | A valid result object passes the output schema |

**What this does NOT prove**: That the handler registered for `PROJECT_INSPECT` implements the schema contract — only that the schema exists and validates inputs. Handler logic is not exercised by these tests.

---

## Unit tests: `tests/main/database-service.test.ts`

**What it covers**: `createProject`, `listProjects`, `getProject`, `deleteProject`, settings get/set. Uses a real better-sqlite3 in-memory database.

**What is missing**: `updateProjectInspection()` is never called in this test file. The entire inspection persistence path (write 9 media columns, set `inspected_at`, read back via `mapProject`) is untested at the database layer. This is the AC-009-C failure.

**Persistence proof gap**: No test in any suite:
1. Calls `updateProjectInspection()` with real metadata values
2. Verifies the returned `ProjectRecord` contains the written values
3. Closes and reopens the database
4. Calls `listProjects()` and verifies metadata fields are non-null

This means AC-003-A (`listProjects()` returns metadata-populated records after app restart) is an assertion without evidence.

---

## Browser QA fixture coverage

All E2E tests load fixtures from `src/renderer/qa/fixtures.ts`. The following project states are covered:

| State | Fixture | mediaMetadata | inspectionError | StatusPill variant |
|---|---|---|---|---|
| `ready` | `projectA` | Full 7 fields populated (bitRateBps: 8_500_000, fileSizeBytes: 3_021_000_000, etc.) | null | ok |
| `inspection_failed` | `projectB` | null | `'FFPROBE_ERROR'` | warning |
| `draft` | `projectC` | null | null | neutral |

**Gap**: `FILE_NOT_FOUND` and `NO_VIDEO_STREAM` error codes are not exercised in any E2E fixture. Only `FFPROBE_ERROR` appears. AC-004-B and AC-004-C are untested at the browser fixture level.

---

## Visual regression tests

| Test | File | Baseline | Result | Notes |
|---|---|---|---|---|
| Light app shell | `tests/visual/app-shell.visual.spec.ts` | Stored PNG | FAIL (154 px diff, ratio 0.01) | Sub-2% drift, likely rendering environment mismatch |
| Dark app shell | `tests/visual/dark-theme.visual.spec.ts` | `dark-app-shell-chromium-darwin.png` (NEW) | FAIL (162 px diff, ratio 0.01) | New baseline added in this branch; still fails |
| Projects populated | `tests/visual/projects-populated.visual.spec.ts` | Stored PNG | FAIL (154 px diff, ratio 0.01) | Most M1-relevant snapshot; captures metadata display |
| Dark settings | `tests/visual/dark-theme.visual.spec.ts` | `dark-settings-chromium-darwin.png` (NEW) | PASS | New baseline for dark theme |
| Other 5 tests | Various | Stored PNGs | PASS | Not M1-specific |

**Consequence for M1**: The `projects-populated.png` failure means the current visual baseline was not updated after implementing the metadata display section. If AC-002-A and AC-002-F are fixed (duration format, bit rate added), the visual snapshot will change again. The visual suite cannot be used as a correctness signal until:
1. AC fixes are applied
2. Baselines are regenerated with `pnpm test:visual --update-snapshots` in a consistent rendering environment

---

## Electron smoke test

**Command**: `pnpm test:electron`
**Result**: FAIL — `Process failed to launch!`
**Reason**: The Electron smoke test requires a live GUI display session (macOS Quartz window server). The test runner environment does not have a visible display context for launching Electron windows.

**Implication**: No automated test has verified that the production Electron binary successfully:
- Launches and loads the preload script
- Establishes the contextBridge on the real window object
- Handles a `project:inspect` IPC call end-to-end with real SQLite and real ffprobe

The real production code path is unverified by any automated test in this suite.

---

## Flows with only mock-level evidence vs real Electron evidence

| User flow / behavior | Mock-level evidence | Real Electron evidence |
|---|---|---|
| Project creation persists to SQLite | Unit test covers `createProject()` with in-memory DB | None (smoke test failed) |
| Inspection triggers automatically after create | E2E mock confirms call sequence | None |
| Metadata displays correctly after inspection | E2E mock renders fixture data | None |
| Duration format HH:MM:SS | Not tested (mock, format not asserted) | None |
| Bit rate displayed | Not tested (mock, field absent) | None |
| File size auto-scales to GB | Not tested (mock, format not asserted) | None |
| Error codes translated to human-readable messages | E2E passes against wrong behavior | None |
| Null metadata shows per-field placeholders | E2E shows no crash but no placeholder asserted | None |
| Inspection metadata persists across restart | None | None |
| SQLite `inspected_at` correctly set | None | None |
| `updateProjectInspection()` called with real DB | None | None |
| Real ffprobe binary invoked via argument array | Unit test with mock runner | None |
| 15s SIGKILL fires on real process | Unit test with mock runner | None |
| Unbounded stdout mitigated | Not mitigated — HIGH finding | None |
