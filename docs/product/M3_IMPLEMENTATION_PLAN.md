# M3 Implementation Plan — Subtitle Synchronization Check

Version: 1.0
Status: Planning
Milestone: M3

---

## Overview

This plan defines the exact sequence of implementation phases for M3. Each phase specifies files to create or modify, required checks to pass, risk classification from `gate.yaml`, and attempt limits. Phases are ordered by dependency. No phase may begin until its predecessor has passed all required checks.

**General rules**:
- Maximum 3 implementation attempts per phase before escalation to human.
- Verifier must be a different role/agent than the implementer for Risk 2+ phases.
- All checks must actually be run and output observed. Do not claim passage without evidence.
- Owner override is in effect: manual human approval of individual phases is waived by the project owner. Automated validation is still required for every phase without exception.

---

## Phase 1 — Shared Types and Schemas

**Risk**: 1 (shared contracts only, no runtime privilege changes)

**Required checks**: `pnpm typecheck`, `pnpm lint`

**Attempt limit**: 3

### Files

**Create**: `src/shared/schemas/sync.ts`
- Export `SyncStatus` as a string union type: `'not_available' | 'ready_to_check' | 'timing_ok' | 'needs_review' | 'stale' | 'check_failed'`
- Export `SyncWarningCode` as a string union: `'CUES_OUTSIDE_VIDEO_RANGE' | 'SUBTITLE_SPAN_SHORT' | 'SUBTITLE_SPAN_LONG' | 'LARGE_TAIL_GAP' | 'LATE_SUBTITLE_START'`
- Export `SyncWarning` interface: `{ code: SyncWarningCode; outOfRangeCount?: number; spanRatio?: number; gapMs?: number; startRatio?: number }`
- Export `SyncAnalysisInput` interface: `{ durationMs: number; cues: Array<{ startMs: number; endMs: number }> }`
- Export `SyncAnalysisResult` interface: `{ warnings: SyncWarning[] }`
- Export `SyncCheckResult` interface: `{ success: boolean; result?: { status: SyncStatus; warnings: SyncWarning[]; checkedAt?: number }; error?: { code: string } }`
- Export `SYNC_THRESHOLDS` constant object (see M3_HANDOFF.md for values)

**Modify**: `src/shared/ipc/channels.ts`
- Add: `SYNC_CHECK_FOR_PROJECT: 'sync:checkForProject'`

**Modify**: `src/shared/ipc/contracts.ts`
- Add Zod schema for `SyncCheckForProjectPayload`: `z.object({ projectId: z.string().uuid() })`
- Add Zod schema for `SyncCheckResult` matching the TypeScript interface above

### Commands

```
pnpm typecheck
pnpm lint
```

Both must exit 0 with no warnings before Phase 1 is marked done.

---

## Phase 2 — Database Migration

**Risk**: 3 (schema change, migration file, Drizzle column addition)

**Required checks**: Migration test (`pnpm test -- --testPathPattern=0003`), independent DB reviewer, `pnpm validate`

**Attempt limit**: 3

**Verifier**: Must be a different implementer. DB reviewer must inspect the SQL and Drizzle schema independently.

### Files

**Create**: `src/database/migrations/0003_sync_check.sql`
```sql
-- Migration: 0003_sync_check
-- Adds subtitle synchronization check columns to projects table.
-- Safe: ADD COLUMN with NULL default only. Reversible by dropping columns.

ALTER TABLE projects ADD COLUMN sync_status TEXT;
ALTER TABLE projects ADD COLUMN sync_checked_at INTEGER;
ALTER TABLE projects ADD COLUMN sync_warnings_json TEXT;
ALTER TABLE projects ADD COLUMN sync_analysis_version INTEGER;
```

**Modify**: `src/database/schema.ts`
- Add four Drizzle columns to the `projects` table:
  - `syncStatus: text('sync_status')` — nullable
  - `syncCheckedAt: integer('sync_checked_at')` — nullable (Unix ms)
  - `syncWarningsJson: text('sync_warnings_json')` — nullable
  - `syncAnalysisVersion: integer('sync_analysis_version')` — nullable

**Modify**: `src/shared/schemas/project.ts`
- Add four optional fields to the project schema matching the DB columns above.

**Create**: `tests/database/migrations/0003_sync_check.test.ts`
- Implement TC-MIG-01, TC-MIG-02, TC-MIG-03 as defined in M3_TEST_PLAN.md.

### Commands

```
pnpm test -- --testPathPattern=0003_sync_check
pnpm validate
```

Both must exit 0. DB reviewer must confirm: (1) no destructive SQL, (2) Drizzle schema matches SQL columns, (3) existing rows survive migration.

---

## Phase 3 — Analyzer Implementation

**Risk**: 1 (pure computation, no file I/O, no IPC, no DB)

**Required checks**: `pnpm typecheck`, `pnpm test -- --testPathPattern=SynchronizationAnalyzer`

**Attempt limit**: 3

### Files

**Create**: `src/main/services/sync/SynchronizationAnalyzer.ts`
- Implement `SynchronizationAnalyzer` class (or exported function).
- Input: `SyncAnalysisInput` from `src/shared/schemas/sync.ts`.
- Output: `SyncAnalysisResult`.
- Implement all five checks as private methods:
  - `checkCuesOutsideVideoRange(cues, durationMs): SyncWarning | null`
  - `checkSubtitleSpanShort(cues, durationMs): SyncWarning | null`
  - `checkSubtitleSpanLong(cues, durationMs): SyncWarning | null`
  - `checkLargeTailGap(cues, durationMs): SyncWarning | null`
  - `checkLateSubtitleStart(cues, durationMs): SyncWarning | null`
- Import thresholds from `SYNC_THRESHOLDS` constant only. No magic numbers in implementation.
- Handle empty cue array gracefully (return no warnings).
- Do not import from M2 parser. Do not re-emit M2 warning codes.

**Create**: `tests/main/sync/SynchronizationAnalyzer.test.ts`
- Implement TC-ANA-01 through TC-ANA-20 as defined in M3_TEST_PLAN.md.
- Minimum 20 tests. All must pass.

### Commands

```
pnpm typecheck
pnpm test -- --testPathPattern=SynchronizationAnalyzer
```

All 20 tests must pass. No TypeScript errors.

---

## Phase 4 — Service Implementation

**Risk**: 2 (accesses DB, orchestrates analysis, writes sync results)

**Required checks**: `pnpm test -- --testPathPattern=SynchronizationService`, independent verifier, `pnpm validate`

**Attempt limit**: 3

**Verifier**: Different implementer. Must run checks and observe output. Reject-until-proven-safe stance.

### Files

**Create**: `src/main/services/sync/SynchronizationService.ts`
- Implement `SynchronizationService` class.
- Depends on: `databaseService` (injected), `SynchronizationAnalyzer`.
- Method: `checkForProject(projectId: string): Promise<SyncCheckResult>`
  1. Validate projectId is UUID. Return `PROJECT_NOT_FOUND` error if not.
  2. Load project from DB. Return `PROJECT_NOT_FOUND` if null.
  3. Determine availability: if `durationSeconds` is null or `subtitleStatus` not in `['ready', 'ready_with_warnings']`, return `not_available` without writing to DB.
  4. Load cues from DB (from `subtitles` table or `cues_json` column per M2 schema).
  5. Call `SynchronizationAnalyzer.analyze({ durationMs: durationSeconds * 1000, cues })`.
  6. Determine status: 0 warnings → `timing_ok`, >0 warnings → `needs_review`.
  7. Write result to DB: `syncStatus`, `syncCheckedAt` (Date.now()), `syncWarningsJson` (JSON.stringify), `syncAnalysisVersion: 1`.
  8. Return `SyncCheckResult` with status, warnings, and checkedAt.
  9. Wrap steps 4–8 in try/catch. On exception: write `check_failed` to DB, return `{ success: true, result: { status: 'check_failed' } }`. Never forward exception message.
- Method: `computeCurrentStatus(project): SyncStatus`
  - Determines effective status considering staleness: if `inspectedAt > syncCheckedAt || subtitleParsedAt > syncCheckedAt`, return `stale` even if DB shows `timing_ok`.
  - Determines `ready_to_check` vs `not_available` based on project fields.

**Modify**: Database service interface to add `updateProjectSyncStatus(projectId, fields)` method.

**Create**: `tests/main/sync/SynchronizationService.test.ts`
- Implement TC-SVC-01 through TC-SVC-05 as defined in M3_TEST_PLAN.md.
- Mock all `databaseService` calls.

### Commands

```
pnpm test -- --testPathPattern=SynchronizationService
pnpm validate
```

All 5 service tests must pass. Full validate must exit 0.

---

## Phase 5 — IPC and Preload

**Risk**: 3 (preload modification, new IPC channel, renderer-facing bridge change)

**Required checks**: `pnpm test -- --testPathPattern=ipc-contracts`, electron security reviewer, `pnpm validate`

**Attempt limit**: 3

**Verifier**: Must be `electron-security-reviewer` role. Independent of implementer. Must inspect the contextBridge API surface and IPC handler for raw ipcRenderer exposure and input validation.

### Files

**Create**: `src/main/ipc/handlers/syncHandler.ts`
- Register handler for channel `SYNC_CHECK_FOR_PROJECT`.
- Validate incoming payload against `SyncCheckForProjectPayload` Zod schema from Phase 1.
- Reject invalid payloads with structured error (no exception propagation).
- Call `synchronizationService.checkForProject(projectId)`.
- Return `SyncCheckResult`. Never forward raw exception messages.

**Modify**: `src/preload/index.ts`
- Add `syncCheckForProject: (projectId: string) => Promise<SyncCheckResult>` to the `window.sceneSift` bridge.
- Use `ipcRenderer.invoke(SYNC_CHECK_FOR_PROJECT, { projectId })` — no raw ipcRenderer exposure.
- Validate that `projectId` is a non-empty string before invoking (preload-level guard).

**Modify**: `src/shared/api/sceneSiftApi.ts`
- Add `syncCheckForProject(projectId: string): Promise<SyncCheckResult>` to the typed API interface.

**Modify**: `src/main/ipc/registerIpcHandlers.ts`
- Import and register `syncHandler`.

**Modify**: `tests/main/ipc-contracts.test.ts`
- Add TC-IPC-01 as defined in M3_TEST_PLAN.md.

### Commands

```
pnpm test -- --testPathPattern=ipc-contracts
pnpm validate
```

IPC contract test must pass. Validate must exit 0. Security reviewer must sign off: (1) no raw ipcRenderer in preload, (2) UUID validation present in handler, (3) no exception leakage.

---

## Phase 6 — Renderer Component

**Risk**: 1 (renderer only, no main process changes)

**Required checks**: `pnpm typecheck`, `pnpm lint`, `pnpm test -- --testPathPattern=syncFormatters`, design-system-reviewer sign-off

**Attempt limit**: 3

### Files

**Create**: `src/renderer/features/projects/syncFormatters.ts`
- Export `formatSyncStatus(status: SyncStatus): string` — human labels for all 6 states. Must NOT return "in sync."
- Export `formatSyncWarning(warning: SyncWarning): string` — human string with numerical metadata.
- Export `formatSyncTimestamp(unixMs: number): string` — relative time string.
- All labels subject to AC-M3-004.1 (no misleading sync language).

**Create**: `src/renderer/features/projects/SyncStatusPanel.tsx`
- React component. Props: `{ project: Project }`.
- Computes effective sync status using `computeCurrentStatus` logic (or calls it via a hook/util).
- Renders the correct state UI for all 6 states.
- "Check Timing" button calls `window.sceneSift.syncCheckForProject(project.id)`.
- Loading state shown while IPC in flight. Button disabled during loading.
- No auto-trigger on mount or on any useEffect without user interaction.
- No imports from main, database, or media layers.
- Uses design tokens exclusively. No hardcoded colors or px values.

**Modify**: `src/renderer/features/projects/ProjectsPage.tsx` (or equivalent project detail component)
- Import and render `SyncStatusPanel` in the appropriate section.

**Create**: `tests/renderer/syncFormatters.test.ts`
- Implement TC-FMT-01 through TC-FMT-12 as defined in M3_TEST_PLAN.md.

### Commands

```
pnpm typecheck
pnpm lint
pnpm test -- --testPathPattern=syncFormatters
```

All formatter tests must pass. No TypeScript errors. No lint warnings. Design-system-reviewer must confirm: (1) token usage only, (2) no auto-trigger logic, (3) misleading copy absent.

---

## Phase 7 — E2E and Visual Tests

**Risk**: 1 (test files only)

**Required checks**: `pnpm validate:full` (includes E2E and visual regression)

**Attempt limit**: 3

### Files

**Create**: Browser QA fixtures for all 6 sync states
- Extend `src/renderer/qa/` mock data to include projects with each `sync_status` value.
- Ensure `syncWarningsJson` fixture has 2 warnings for `needs_review` tests and 3 for visual regression.

**Create**: `tests/e2e/sync.spec.ts`
- Implement TC-E2E-01 through TC-E2E-08 as defined in M3_TEST_PLAN.md.
- All 8 tests must pass.

**Create**: `tests/visual/sync.visual.spec.ts`
- Implement VR-01 through VR-05 as defined in M3_TEST_PLAN.md.
- Generate initial baseline screenshots by running with `--update-snapshots` on first pass.
- Subsequent runs compare against baseline. All comparisons must pass within configured threshold.

### Commands

```
pnpm validate:full
```

Full validate including E2E and visual must exit 0. All 8 E2E tests and all visual scenarios must pass.

---

## Phase 8 — Final Validation

**Risk**: 1 (no code changes — validation only)

**Required checks**: `pnpm validate:full`

**Attempt limit**: 1 (this phase is verification only; if it fails, return to the relevant phase)

### Actions

Run the complete validation suite and record the exact output.

```
pnpm validate:full
```

Record: exit code, test counts, E2E counts, visual scenario counts, typecheck result, lint result, governance validation result.

Phase 8 is complete when `pnpm validate:full` exits 0 with all checks passing. Any failure returns to the appropriate earlier phase.

---

## Phase Summary

| Phase | Description | Risk | Verifier Required | Attempt Limit |
|---|---|---|---|---|
| 1 | Shared types and schemas | 1 | No | 3 |
| 2 | Database migration | 3 | Yes — DB reviewer | 3 |
| 3 | Analyzer implementation | 1 | No | 3 |
| 4 | Service implementation | 2 | Yes — independent implementer | 3 |
| 5 | IPC and preload | 3 | Yes — electron-security-reviewer | 3 |
| 6 | Renderer component | 1 | Design-system-reviewer for copy | 3 |
| 7 | E2E and visual tests | 1 | No | 3 |
| 8 | Final validation | 1 | No | 1 |
