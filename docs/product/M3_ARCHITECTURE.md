# M3 Architecture — Subtitle Synchronization Check

**Status**: Planning  
**Milestone**: M3  
**Last updated**: 2026-07-20

---

## 1. New Files

| Path | Layer | Description |
|---|---|---|
| `src/shared/schemas/sync.ts` | shared | `SyncStatus` enum, `SyncWarningCode` enum, `SyncWarning` type, `SyncAnalysisResult` type, `SyncAnalysisInput` type, sync-related project schema additions |
| `src/shared/ipc/channels.ts` | shared | Add `SYNC_CHECK_FOR_PROJECT` string constant |
| `src/shared/ipc/contracts.ts` | shared | Add `syncCheckForProjectInput` and `syncCheckForProjectOutput` Zod schemas |
| `src/main/services/sync/SynchronizationAnalyzer.ts` | main | Pure analysis class; no IO, no imports from database layer |
| `src/main/services/sync/SynchronizationService.ts` | main | Orchestrates DB reads, calls analyzer, persists result |
| `src/main/ipc/handlers/syncHandler.ts` | main | IPC handler for `SYNC_CHECK_FOR_PROJECT` |
| `src/database/migrations/0003_sync_check.sql` | database | Adds 4 sync columns to `projects` table |
| `src/renderer/features/projects/SyncStatusPanel.tsx` | renderer | New UI component displaying sync status, warnings, and Check Sync button |
| `tests/main/sync/SynchronizationAnalyzer.test.ts` | test | Unit tests for pure analysis logic — all 5 warning checks, boundary conditions |
| `tests/main/sync/SynchronizationService.test.ts` | test | Unit tests for orchestration, DB interaction, state transitions |
| `tests/renderer/syncFormatters.test.ts` | test | Unit tests for display formatting helpers |
| `tests/e2e/sync.spec.ts` | test | E2E: trigger sync check, verify panel updates, stale state display |
| `tests/visual/sync.visual.spec.ts` | test | Visual regression for all 6 sync states rendered in `SyncStatusPanel` |

---

## 2. Modified Files

| Path | Changes |
|---|---|
| `src/database/schema.ts` | Add 4 nullable sync columns to `projectsTable`: `syncStatus`, `syncCheckedAt`, `syncWarningsJson`, `syncAnalysisVersion` |
| `src/shared/schemas/project.ts` | Extend `projectSchema` with optional `syncStatus`, `syncCheckedAt`, `syncWarningsJson`, `syncAnalysisVersion` fields |
| `src/shared/api/sceneSiftApi.ts` | Add `syncCheckForProject(projectId: string): Promise<SyncCheckForProjectOutput>` method signature |
| `src/preload/index.ts` | Expose `syncCheckForProject` via `contextBridge.exposeInMainWorld` |
| `src/main/ipc/registerIpcHandlers.ts` | Register `syncHandler` for `SYNC_CHECK_FOR_PROJECT` channel |
| `src/main/services/database/databaseService.ts` | Add `getProjectForSync(id: string)`, `getCuesForProject(id: string)`, and `persistSyncResult(id, result)` methods |
| `src/renderer/features/projects/ProjectsPage.tsx` | Render `<SyncStatusPanel>` for the selected project |

---

## 3. SynchronizationAnalyzer Design

Pure class — no constructor dependencies, no IO. All inputs passed explicitly to `analyze()`.

```typescript
class SynchronizationAnalyzer {
  private static readonly TAIL_TOLERANCE_MS = 2000;
  private static readonly SPAN_SHORT_RATIO = 0.5;
  private static readonly SPAN_LONG_RATIO = 1.2;
  private static readonly LATE_START_THRESHOLD_RATIO = 0.15;
  private static readonly LARGE_TAIL_GAP_MS = 10000;

  analyze(input: SyncAnalysisInput): SyncAnalysisResult { ... }
  private checkOutOfRange(cues: SubtitleCue[], durationMs: number): SyncWarning[] { ... }
  private checkSpanShort(firstMs: number, lastMs: number, durationMs: number): SyncWarning | null { ... }
  private checkSpanLong(lastMs: number, durationMs: number): SyncWarning | null { ... }
  private checkTailGap(lastMs: number, durationMs: number): SyncWarning | null { ... }
  private checkLateStart(firstMs: number, durationMs: number): SyncWarning | null { ... }
}
```

`SyncAnalysisInput` carries only pre-loaded data:

```typescript
interface SyncAnalysisInput {
  cues: SubtitleCue[];        // from subtitle_documents.cues_json
  durationMs: number;         // from projects.inspected_duration_ms
  analysisVersion: number;    // current algorithm version constant
}
```

`SyncAnalysisResult` is the pure output:

```typescript
interface SyncAnalysisResult {
  syncStatus: 'timing_ok' | 'needs_review' | 'check_failed';
  warnings: SyncWarning[];
  analysisVersion: number;
}
```

`SyncWarning` structure:

```typescript
interface SyncWarning {
  code: SyncWarningCode;      // enum member
  message: string;            // human-readable description
  severity: 'error' | 'warn';
  context?: Record<string, number | string>;
}
```

`SyncWarningCode` enum members:

- `OUT_OF_RANGE` — cue timestamps outside video duration
- `SPAN_TOO_SHORT` — subtitle span covers less than 50% of video
- `SPAN_TOO_LONG` — last cue extends beyond 120% of video duration
- `LARGE_TAIL_GAP` — gap between last cue and end of video exceeds 10 s
- `LATE_START` — first cue starts after 15% of video duration

Status derivation in `analyze()`:
- If any warning has `severity: 'error'` → `needs_review`
- If warnings is empty → `timing_ok`
- If warnings are all `warn` → `timing_ok` (warnings surfaced but not blocking)
- On caught exception → `check_failed` (no warnings persisted)

---

## 4. SynchronizationService Design

```typescript
class SynchronizationService {
  constructor(private readonly db: DatabaseService) {}

  async checkForProject(projectId: string): Promise<SyncCheckResult>
  getSyncDisplay(project: Project): SyncDisplayState
}
```

### `checkForProject` flow

1. Call `db.getProjectForSync(projectId)` — returns `null` if not found → return `check_failed` result.
2. Validate that `project.syncStatus !== 'not_available'` — if `not_available`, return early with that status (no analysis run, no DB write).
3. Call `db.getCuesForProject(projectId)` — returns `[]` if no subtitle document.
4. If `cues.length === 0` and `project.inspectedDurationMs` is null → status is `not_available`; persist and return.
5. Call `SynchronizationAnalyzer.analyze({ cues, durationMs: project.inspectedDurationMs, analysisVersion: CURRENT_ANALYSIS_VERSION })`.
6. Call `db.persistSyncResult(projectId, { syncStatus, warnings, analysisVersion, syncCheckedAt: Date.now() })` inside a transaction.
7. Return `SyncCheckResult`.

### `getSyncDisplay`

Derives `SyncDisplayState` from project DB fields — no computation, no IO:

```typescript
interface SyncDisplayState {
  status: SyncStatus;           // 6-state enum value
  warnings: SyncWarning[];      // parsed from syncWarningsJson or []
  checkedAt: Date | null;
  isStale: boolean;             // computed from timestamps (see Section 6)
}
```

The renderer calls `getSyncDisplay` by reading project fields delivered via IPC — the method is a pure derive function and can be replicated in renderer-safe form as a utility. The service version lives in main for use by IPC handlers; a renderer-safe counterpart is a plain function in `src/renderer/features/projects/syncUtils.ts`.

---

## 5. IPC Contract

Channel constant (in `src/shared/ipc/channels.ts`):

```typescript
export const SYNC_CHECK_FOR_PROJECT = 'sync:checkForProject';
```

Input schema:

```typescript
const syncCheckForProjectInputSchema = z.object({
  projectId: z.string().min(1),
});
```

Output schema:

```typescript
const syncCheckForProjectOutputSchema = z.object({
  syncStatus: z.enum(['not_available', 'ready_to_check', 'timing_ok', 'needs_review', 'stale', 'check_failed']),
  syncWarnings: z.array(syncWarningSchema).nullable(),
  syncCheckedAt: z.number().nullable(),
  error: z.string().optional(),
});
```

Handler validates input with `syncCheckForProjectInputSchema.parse(payload)` before calling service. Returns structured error on validation failure — does not surface raw exception messages to renderer.

---

## 6. Staleness Detection

Staleness is a renderer-side display concern, not a trigger for automatic re-analysis.

Logic (evaluated when rendering project details):

```
isStale = 
  (syncStatus === 'timing_ok' || syncStatus === 'needs_review')
  AND (
    syncCheckedAt < project.inspectedAt
    OR (project.subtitleParsedAt !== null AND syncCheckedAt < project.subtitleParsedAt)
  )
```

When `isStale` is true:
- Display `stale` state in `SyncStatusPanel` (badge + explanatory text)
- Show "Re-run Check" prompt
- Do NOT automatically invoke `syncCheckForProject`

The `stale` value in `SyncStatus` enum is a display-only state — it is never written to the DB `sync_status` column. The column holds only the last computed result (`timing_ok`, `needs_review`, `check_failed`, `not_available`). `ready_to_check` is the initial/reset state.

---

## 7. Data Flow Diagram

```
User clicks "Check Sync"
  → renderer calls window.sceneSift.syncCheckForProject(projectId)
  → preload exposes: ipcRenderer.invoke(SYNC_CHECK_FOR_PROJECT, { projectId })
  → main IPC handler (syncHandler.ts)
      → validates input with Zod schema
      → SynchronizationService.checkForProject(projectId)
          → databaseService.getProjectForSync(projectId)   [reads projects row]
          → databaseService.getCuesForProject(projectId)   [reads subtitle_documents.cues_json]
          → SynchronizationAnalyzer.analyze(input)         [pure computation, no IO]
          → databaseService.persistSyncResult(id, result)  [db.transaction()]
      → returns SyncCheckResult
  → IPC response → renderer receives SyncCheckForProjectOutput
  → ProjectsPage updates project state → SyncStatusPanel re-renders
```

No intermediate state written to disk outside `persistSyncResult`. No file reads occur during analysis — all data comes from DB.

---

## 8. Layer Boundary Compliance

### `src/renderer/features/projects/SyncStatusPanel.tsx`
- No imports from `electron`, `node:*`, `@main/*`, `@database/*`
- IPC access only through `window.sceneSift.syncCheckForProject`
- No `eval`, no `new Function`

### `src/main/services/sync/SynchronizationAnalyzer.ts`
- Pure computation: no imports from `@database/*`, `electron`, or any IO module
- Inputs and outputs are plain TypeScript types from `src/shared/schemas/sync.ts`
- Importable in a worker thread without side effects

### `src/main/services/sync/SynchronizationService.ts`
- Main-process-only: imports `DatabaseService` from `src/main/services/database/`
- No renderer imports
- No direct `require('electron')` — receives `ipcMain` context indirectly via handler

### `src/main/ipc/handlers/syncHandler.ts`
- Registers on `ipcMain.handle(SYNC_CHECK_FOR_PROJECT, ...)`
- Imports channel constant from `src/shared/ipc/channels.ts`
- Validates with contracts from `src/shared/ipc/contracts.ts`

### `src/shared/schemas/sync.ts`
- No runtime privileges: pure types and Zod schemas
- No imports from main, renderer, preload, or database layers

### `src/database/migrations/0003_sync_check.sql`
- SQL only; no TypeScript imports
- Applied by migration runner in main process at startup
