# M3 Test Plan — Subtitle Synchronization Check

Version: 1.0
Status: Planning
Milestone: M3

---

## Overview

This document defines the complete test strategy for M3. Each section specifies exact file locations, test case descriptions, inputs, and expected outputs. "Expected output" is the concrete value the test asserts — not a prose description of behavior.

---

## 1. Unit Tests — SynchronizationAnalyzer

File: `tests/main/sync/SynchronizationAnalyzer.test.ts`

Target: `src/main/services/sync/SynchronizationAnalyzer.ts`

Minimum required: 20 test cases.

### Test Cases

**TC-ANA-01: Zero cues — Guard B fires, returns check_failed with NO_CUES_TO_ANALYZE**
Input: `{ durationMs: 120000, cues: [] }`
Expected: `{ syncStatus: 'check_failed', syncErrorCode: 'NO_CUES_TO_ANALYZE', syncWarnings: [] }` — Guard B fires before any check loop; zero cues is a guard failure, not an empty-OK result.

**TC-ANA-Guard-A-1: Zero video duration — Guard A fires, returns check_failed with INVALID_VIDEO_DURATION**
Input: `{ durationMs: 0, cues: [{ startMs: 0, endMs: 5000 }] }`
Expected: `{ syncStatus: 'check_failed', syncErrorCode: 'INVALID_VIDEO_DURATION', syncWarnings: [] }`.

**TC-ANA-Guard-A-2: Negative video duration — Guard A fires, returns check_failed with INVALID_VIDEO_DURATION**
Input: `{ durationMs: -1, cues: [{ startMs: 0, endMs: 5000 }] }`
Expected: `{ syncStatus: 'check_failed', syncErrorCode: 'INVALID_VIDEO_DURATION', syncWarnings: [] }` — negative `durationMs` is incoherent; Guard A must catch it explicitly.

**TC-ANA-02: Exactly 1 cue within range — no warnings**
Input: `{ durationMs: 120000, cues: [{ startMs: 1000, endMs: 5000 }] }`
Expected: `{ warnings: [] }` — single cue well within range triggers no checks (cue count < 10 suppresses span/tail checks).

**TC-ANA-03: CUES_OUTSIDE_VIDEO_RANGE — endMs exactly at tolerance boundary (no warning)**
Input: `{ durationMs: 120000, cues: [{ startMs: 0, endMs: 122000 }] }` — endMs = durationMs + 2000 exactly.
Expected: `{ warnings: [] }` — tolerance is inclusive, exactly at boundary is NOT out of range.

**TC-ANA-04: CUES_OUTSIDE_VIDEO_RANGE — endMs one ms over tolerance (warning fires)**
Input: `{ durationMs: 120000, cues: [{ startMs: 0, endMs: 122001 }] }` — endMs = durationMs + 2001.
Expected: `{ warnings: [{ code: 'CUES_OUTSIDE_VIDEO_RANGE', outOfRangeCount: 1 }] }`.

**TC-ANA-05: CUES_OUTSIDE_VIDEO_RANGE — multiple cues over range**
Input: `{ durationMs: 60000, cues: [{ startMs: 0, endMs: 62001 }, { startMs: 10000, endMs: 63000 }, { startMs: 20000, endMs: 50000 }] }`
Expected: `{ warnings: [{ code: 'CUES_OUTSIDE_VIDEO_RANGE', outOfRangeCount: 2 }] }` — only 2 cues exceed tolerance.

**TC-ANA-06: SUBTITLE_SPAN_SHORT — span exactly 50% of duration, 10 cues (no warning)**
Input: `durationMs: 100000`, span = `firstCueStartMs: 0, lastCueEndMs: 50000`, 10 cues spread across 0–50000ms.
Expected: `{ warnings: [] }` — 50.0% span does NOT trigger the short warning (threshold is strictly less than 50%).

**TC-ANA-07: SUBTITLE_SPAN_SHORT — span 49.9% of duration, 10 cues (warning fires)**
Input: `durationMs: 100000`, first cue starts 0ms, last cue ends 49900ms, 10 cues total.
Expected: `{ warnings: [{ code: 'SUBTITLE_SPAN_SHORT', spanRatio: 0.499 }] }` (or equivalent ratio value ≤ 2 decimal places).

**TC-ANA-08: SUBTITLE_SPAN_SHORT — span < 50%, but only 9 cues (no warning — sparse guard)**
Input: `durationMs: 100000`, span covers 30000ms (30%), 9 cues total.
Expected: `{ warnings: [] }` — sparse file guard suppresses the check.

**TC-ANA-09: SUBTITLE_SPAN_LONG — lastCueEndMs exactly 120% of durationMs (no warning)**
Input: `{ durationMs: 100000, lastCueEndMs: 120000 }` — ratio = 1.2 exactly.
Expected: `{ warnings: [] }` — at exactly 120% is NOT over the threshold (threshold is strictly greater than 1.2).

**TC-ANA-10: SUBTITLE_SPAN_LONG — lastCueEndMs one ms over 120% (warning fires)**
Input: `{ durationMs: 100000, lastCueEndMs: 120001 }` — ratio = 1.200_01.
Expected: `{ warnings: [{ code: 'SUBTITLE_SPAN_LONG', spanRatio: expect.closeTo(1.2, 2) }] }`.

**TC-ANA-11: LARGE_TAIL_GAP — gap exactly 10000ms, 10 cues (no warning)**
Input: `{ durationMs: 60000, lastCueEndMs: 50000 }`, 10 cues. Gap = 10000ms exactly.
Expected: `{ warnings: [] }` — exactly 10s is NOT a large gap (threshold is strictly greater than 10000ms).

**TC-ANA-12: LARGE_TAIL_GAP — gap 10001ms, 10 cues (warning fires)**
Input: `{ durationMs: 60000, lastCueEndMs: 49999 }`, 10 cues. Gap = 10001ms.
Expected: `{ warnings: [{ code: 'LARGE_TAIL_GAP', gapMs: 10001 }] }`.

**TC-ANA-13: LARGE_TAIL_GAP — gap > 10s with only 9 cues (warning fires — no sparse guard on Check 4)**
Input: `{ durationMs: 60000, cues: [9 cues with lastCueEndMs: 45000] }`. Gap = 15000ms.
Expected: `{ syncWarnings: [{ code: 'LARGE_TAIL_GAP', gapMs: 15000 }] }` — LARGE_TAIL_GAP has no cue-count sparse guard. The skip condition is only when SUBTITLE_SPAN_SHORT was already emitted. Since SUBTITLE_SPAN_SHORT is skipped for 9 cues (sparse guard) but not emitted, Check 4 still runs and fires for this 15000ms gap.

**TC-ANA-14: LATE_SUBTITLE_START — firstCueStartMs exactly 15% of durationMs (no warning)**
Input: `{ durationMs: 100000, firstCueStartMs: 15000 }`.
Expected: `{ warnings: [] }` — exactly at 15% is NOT late (threshold is strictly greater than 15%).

**TC-ANA-15: LATE_SUBTITLE_START — firstCueStartMs one ms over 15% (warning fires)**
Input: `{ durationMs: 100000, firstCueStartMs: 15001 }`.
Expected: `{ warnings: [{ code: 'LATE_SUBTITLE_START', startRatio: expect.closeTo(0.15, 2) }] }`.

**TC-ANA-16: All checks fire simultaneously**
Input: Craft a cue set where all 5 warning conditions are met simultaneously (10+ cues, out-of-range cue, span < 50%, last cue > 120% duration, gap > 10s at a different point is impossible simultaneously with long span — design accordingly using out-of-range + late start + short span + out-of-range count).
Expected: All applicable warning codes present in result array.

**TC-ANA-17: No warnings — clean file with 10+ cues**
Input: 15 cues evenly distributed across a 120s video, all within range, span ~80%, tail gap ~2s, first cue at 2s (1.7%).
Expected: `{ warnings: [] }`.

**TC-ANA-18: 10,000 cues — completes without error, no timeout**
Input: Generate 10,000 cues evenly distributed across a 3600s video, all within range.
Expected: Result returned within 500ms. No warnings. No thrown exceptions.

**TC-ANA-19: Cue with endMs < startMs (degenerate cue) — handled gracefully**
Input: `{ startMs: 5000, endMs: 3000 }` — negative duration cue.
Expected: Analyzer does not throw. Result contains no crash. NEGATIVE_DURATION_CUE is an M2 warning and is NOT re-emitted here.

**TC-ANA-20: All cues start at 0ms (degenerate timing) — no false LATE_SUBTITLE_START**
Input: 20 cues all with startMs = 0, endMs distributed across a 60s video.
Expected: No `LATE_SUBTITLE_START` warning (firstCueStartMs = 0 which is 0% of any duration).

---

## 2. Unit Tests — SynchronizationService

File: `tests/main/sync/SynchronizationService.test.ts`

Target: `src/main/services/sync/SynchronizationService.ts`

Strategy: Mock `databaseService` entirely. No real SQLite in these tests.

Minimum required: 5 test cases.

### Test Cases

**TC-SVC-01: Project not found — returns structured error**
Setup: `databaseService.getProjectById(id)` returns `null`.
Input: Valid UUID projectId.
Expected: Returns `{ success: false, error: { code: 'PROJECT_NOT_FOUND' } }`. Does NOT throw.

**TC-SVC-02: durationSeconds is null — returns not_available**
Setup: Project row exists with `durationSeconds: null`, `subtitleStatus: 'ready'`.
Expected: Returns `{ success: true, result: { status: 'not_available' } }`. No DB write for sync_status.

**TC-SVC-03: subtitleStatus not ready — returns not_available**
Setup: Project row exists with `durationSeconds: 120`, `subtitleStatus: 'pending'`.
Expected: Returns `{ success: true, result: { status: 'not_available' } }`.

**TC-SVC-04: Normal check flow — result persisted to DB**
Setup: Project row with `durationSeconds: 120`, `subtitleStatus: 'ready'`, and 15 valid cues in `cues_json`.
Analyzer mock returns 0 warnings.
Expected: `databaseService.updateProjectSyncStatus` is called once with `{ syncStatus: 'timing_ok', syncWarningsJson: '[]', syncCheckedAt: <timestamp>, syncAnalysisVersion: 1 }`. Returns `{ success: true, result: { status: 'timing_ok', warnings: [] } }`.

**TC-SVC-05: Analyzer throws — returns check_failed, error not leaked to renderer**
Setup: Valid project and subtitle data. Analyzer mock throws `new Error('internal crash')`.
Expected: Returns `{ success: true, result: { status: 'check_failed' } }`. The error message `'internal crash'` does NOT appear in the returned value. `databaseService.updateProjectSyncStatus` is called with `syncStatus: 'check_failed'`.

---

## 3. Unit Tests — Sync Formatters

File: `tests/renderer/syncFormatters.test.ts`

Target: `src/renderer/features/projects/syncFormatters.ts`

### Test Cases

**TC-FMT-01: formatSyncStatus('not_available') returns non-empty human label**
Expected: Returns a string containing neither the raw code nor empty string. Example: "Not available."

**TC-FMT-02: formatSyncStatus('ready_to_check') returns actionable label**
Expected: String indicates check is available. Must not be the raw enum value.

**TC-FMT-03: formatSyncStatus('timing_ok') returns passing label without "in sync"**
Expected: String does NOT contain "in sync" or "synchronized." Contains "passed" or "ok" or equivalent.

**TC-FMT-04: formatSyncStatus('needs_review') returns review label**
Expected: String communicates warnings found, not that the file is broken.

**TC-FMT-05: formatSyncStatus('stale') returns stale label**
Expected: String communicates that results are outdated.

**TC-FMT-06: formatSyncStatus('check_failed') returns failure label**
Expected: String communicates check did not complete.

**TC-FMT-07: formatSyncWarning — CUES_OUTSIDE_VIDEO_RANGE with count=1**
Input: `{ code: 'CUES_OUTSIDE_VIDEO_RANGE', outOfRangeCount: 1 }`
Expected: Output string contains "1" and communicates that a cue extends beyond video. Must not contain the raw code string.

**TC-FMT-08: formatSyncWarning — CUES_OUTSIDE_VIDEO_RANGE with count=3**
Input: `{ code: 'CUES_OUTSIDE_VIDEO_RANGE', outOfRangeCount: 3 }`
Expected: Output string contains "3" and is grammatically correct (plural).

**TC-FMT-09: formatSyncWarning — SUBTITLE_SPAN_SHORT with ratio=0.3**
Input: `{ code: 'SUBTITLE_SPAN_SHORT', spanRatio: 0.3 }`
Expected: Output string contains "30%" (ratio rendered as percentage).

**TC-FMT-10: formatSyncWarning — LARGE_TAIL_GAP with gapMs=15000**
Input: `{ code: 'LARGE_TAIL_GAP', gapMs: 15000 }`
Expected: Output string contains "15" and "second" in some form.

**TC-FMT-11: formatSyncTimestamp — recent timestamp renders as relative**
Setup: `vi.useFakeTimers(); vi.setSystemTime(new Date('2024-01-15T12:00:00.000Z'));`
Cleanup: `afterEach(() => { vi.useRealTimers(); })`
Input: Unix ms for exactly 2 hours before the mocked "now": `new Date('2024-01-15T10:00:00.000Z').getTime()`
Expected: Output contains "2 hours ago" or "about 2 hours ago". Test must not rely on wall-clock time — deterministic via fake timer.

**TC-FMT-12: formatSyncTimestamp — does not return raw ms value**
Input: Any valid Unix ms timestamp.
Expected: Output is NOT a numeric string of ms and does NOT equal `String(inputMs)`.

---

## 4. E2E Tests

File: `tests/e2e/sync.spec.ts`

Mode: Browser QA mode (`VITE_SCENESIFT_BROWSER_QA=1`). Uses mock IPC bridge via fixtures.

Minimum required: 8 test cases.

### Test Cases

**TC-E2E-01: not_available state — panel renders correctly**
Fixture: Project with `sync_status: 'not_available'` (or `durationSeconds: null`).
Assert: Sync panel is visible. "Check Timing" button is NOT present. Panel shows not-available message.

**TC-E2E-02: ready_to_check state — check button shown**
Fixture: Project with `sync_status: null`, `durationSeconds: 120`, `subtitleStatus: 'ready'`.
Assert: Sync panel shows `ready_to_check` state. "Check Timing" button is visible and enabled.

**TC-E2E-03: timing_ok state — success indicator shown**
Fixture: Project with `sync_status: 'timing_ok'`, `sync_checked_at: <recent>`, `sync_warnings_json: '[]'`.
Assert: Panel shows passing state. No warning list. Relative timestamp visible. "in sync" text absent.

**TC-E2E-04: needs_review state — warning list renders**
Fixture: Project with `sync_status: 'needs_review'`, `sync_warnings_json` containing 2 warnings.
Assert: Warning count badge shows "2". Warning list has exactly 2 items. Each item has a human-readable label.

**TC-E2E-05: stale state — re-check prompt shown**
Fixture: Project with `sync_status: 'stale'` (i.e., `inspectedAt > sync_checked_at`).
Assert: Panel shows stale state. "Re-check" or "Check again" button visible.

**TC-E2E-06: check_failed state — error shown**
Fixture: Project with `sync_status: 'check_failed'`.
Assert: Panel shows failure message. No warning list. Re-check button may be visible.

**TC-E2E-07: Click "Check Timing" → loading state visible → result shown**
Fixture: `ready_to_check` project. IPC mock set to respond after 200ms delay with `timing_ok` result.
Actions: Click "Check Timing."
Assert: Loading indicator appears before IPC responds. After response, `timing_ok` state shown.

**TC-E2E-08: IPC mock returns needs_review — warnings list rendered correctly**
Fixture: `ready_to_check` project. IPC mock returns `{ status: 'needs_review', warnings: [{ code: 'CUES_OUTSIDE_VIDEO_RANGE', outOfRangeCount: 2 }, { code: 'LARGE_TAIL_GAP', gapMs: 12000 }] }`.
Actions: Click "Check Timing."
Assert: Panel shows `needs_review`. Warning count is 2. First warning text contains "2." Second warning text contains "12 seconds" or "12s."

---

## 5. Visual Regression Tests

File: `tests/visual/sync.visual.spec.ts`

Tool: Playwright visual comparison against stored baseline PNG snapshots.

Minimum required: 3 scenarios.

### Scenarios

**VR-01: timing_ok state — light theme**
Setup: Render sync panel in `timing_ok` state. Theme: light.
Capture: Full sync panel component.
Baseline: `tests/visual/__screenshots__/sync-timing-ok-light.png`

**VR-02: timing_ok state — dark theme**
Setup: Same as VR-01. Theme: dark.
Baseline: `tests/visual/__screenshots__/sync-timing-ok-dark.png`

**VR-03: needs_review with 3 warnings — light theme**
Setup: Render sync panel with `needs_review` state and 3 warning items. Theme: light.
Capture: Full sync panel component including warning list.
Baseline: `tests/visual/__screenshots__/sync-needs-review-light.png`

**VR-04: needs_review with 3 warnings — dark theme**
Setup: Same as VR-03. Theme: dark.
Baseline: `tests/visual/__screenshots__/sync-needs-review-dark.png`

**VR-05: not_available state**
Setup: Render sync panel in `not_available` state.
Baseline: `tests/visual/__screenshots__/sync-not-available.png`

---

## 6. IPC Contract Test

File: `tests/main/ipc-contracts.test.ts`

Add the following contract to the existing test file.

**TC-IPC-01: SYNC_CHECK_FOR_PROJECT channel contract**
Assert: Channel constant `SYNC_CHECK_FOR_PROJECT` is registered in `src/shared/ipc/channels.ts`.
Assert: Handler accepts `{ projectId: string }` where projectId is a valid UUID.
Assert: Handler rejects malformed projectId (non-UUID string) with a structured error response.
Assert: Handler returns `SyncCheckResult` shape: `{ success: boolean, result?: { status: SyncStatus, warnings: SyncWarning[], checkedAt?: number }, error?: { code: string } }`.

---

## 7. Migration Tests

File: `tests/database/migrations/0003_sync_check.test.ts`

**TC-MIG-01: Existing project row survives migration**
Setup: Create a DB at schema version after 0002. Insert one project row. Run migration 0003.
Assert: Project row still exists. All pre-existing columns retain their values. New columns (`sync_status`, `sync_checked_at`, `sync_warnings_json`, `sync_analysis_version`) are all NULL for existing rows.

**TC-MIG-02: New project row after migration accepts sync columns**
Setup: Run migration 0003. Insert a project row with `sync_status: 'timing_ok'`, `sync_checked_at: <timestamp>`, `sync_warnings_json: '[]'`, `sync_analysis_version: 1`.
Assert: Row is inserted without error and can be read back with correct values.

**TC-MIG-03: DB schema matches expected columns after migration**
Setup: Run migration 0003.
Assert: `PRAGMA table_info(projects)` output includes all four new columns with correct types (`TEXT`, `INTEGER`, `TEXT`, `INTEGER`).

---

## 8. Persistence Test

File: `tests/database/sync-persistence.test.ts`

**TC-PER-01: Sync result survives DB close and reopen**
Steps:
1. Initialize a real `DatabaseService` instance. Create a project with `inspectionStatus: 'ready'` and `subtitleStatus: 'ready'`.
2. Call `SynchronizationService.checkForProject(projectId)`. Verify returned result has `syncStatus: 'needs_review'` and at least one warning.
3. Close (dispose) the `DatabaseService` instance.
4. Create a new `DatabaseService` instance and call `initialize()`.
5. Load the project with `getProject(projectId)`.
6. Assert: `syncStatus`, `syncWarningsJson`, `syncCheckedAt`, and `syncAnalysisVersion` all match the values from step 2.

---

## Test Coverage Summary

| Suite | File | Minimum Cases |
|---|---|---|
| SynchronizationAnalyzer unit | `tests/main/sync/SynchronizationAnalyzer.test.ts` | 20 |
| SynchronizationService unit | `tests/main/sync/SynchronizationService.test.ts` | 5 |
| Sync formatters unit | `tests/renderer/syncFormatters.test.ts` | 12 |
| E2E sync | `tests/e2e/sync.spec.ts` | 8 |
| Visual regression | `tests/visual/sync.visual.spec.ts` | 3 (5 recommended) |
| IPC contract | `tests/main/ipc-contracts.test.ts` | 1 new contract |
| Migration | `tests/database/migrations/0003_sync_check.test.ts` | 3 |

**Total minimum: 52 test cases**
