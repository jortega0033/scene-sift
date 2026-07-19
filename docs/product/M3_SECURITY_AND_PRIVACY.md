# M3 Security and Privacy Analysis

## Scope

M3 adds structural subtitle timing analysis against video metadata. All analysis is purely computational, operating exclusively on data already persisted in the local SQLite database. This document enumerates the data flows, IPC surface, renderer constraints, and threat model for the synchronization check feature.

---

## 1. Data Flow Security

### Complete data path

```
subtitle_documents.cues_json   (SQLite, main process only)
  ↓ parameterized SELECT — DatabaseService
video_sources.duration_seconds (SQLite, main process only)
  ↓ validated in SynchronizationAnalyzer (pure computation, main process)
SynchronizationAnalyzer result
  ↓ persisted to sync_check_results (SQLite, main process only)
  ↓ returned via ipcRenderer.invoke → contextBridge
Renderer receives {syncStatus, syncWarnings[], syncCheckedAt, error?}
```

### What does NOT happen

- No data leaves the machine at any point.
- No file reads occur during analysis. All required data is read from SQLite rows already populated by M1 (FFprobe) and M2 (subtitle parser).
- No FFprobe re-run is performed during M3 analysis.
- No network calls of any kind.
- No new files are written to disk. The only persistence target is the existing SQLite database (same file used by M1 and M2).
- No stdout/stderr logging of subtitle cue content.

### Data sources consumed (read-only during analysis)

| Source | Table/Column | Population milestone |
|--------|-------------|---------------------|
| Video duration | `video_sources.duration_seconds` | M1 |
| Cue start/end times | `subtitle_documents.cues_json` | M2 |
| Project association | `projects.id` | M1 |

### Data written (analysis results only)

| Target | Table/Column | Content |
|--------|-------------|---------|
| Sync status | `sync_check_results.status` | Enum string |
| Sync warnings | `sync_check_results.warnings_json` | Array of `{code, metadata}` objects — no cue text |
| Timestamp | `sync_check_results.checked_at` | ISO timestamp |
| Version hashes | `sync_check_results.source_hashes` | Hash of input data versions — no raw content |

---

## 2. IPC Security

### Channel: `SYNC_CHECK_FOR_PROJECT`

Registered in `src/shared/ipc/channels.ts`. No other channel is added by M3.

**Input payload**

```ts
{ projectId: string }
```

**Validation before handler executes**

1. `projectId` is validated as a UUID v4 string using the shared UUID schema (Zod). Non-UUID input is rejected before any database access.
2. The handler queries the database with a parameterized statement: `SELECT ... WHERE projects.id = ?`. No string interpolation.
3. If the project does not exist, the handler returns a structured error response — it does not throw. No exception stack traces are surfaced to the renderer.

**Output payload (success)**

```ts
{
  syncStatus: SyncStatus,      // enum: not_available | ready_to_check | timing_ok | needs_review | stale | check_failed
  syncWarnings: SyncWarning[], // array of {code: SyncWarningCode, metadata: Record<string, number>}
  syncCheckedAt: string | null // ISO 8601 timestamp or null
}
```

**Output payload (error)**

```ts
{
  error: { code: string, message: string }
  // no stack trace, no raw exception message
}
```

### Handler behavior on unknown/invalid projectId

- UUID validation fails → handler returns `{ error: { code: 'INVALID_PROJECT_ID', message: 'Invalid project identifier' } }` with no database query executed.
- UUID valid but project not found in DB → handler returns `{ error: { code: 'PROJECT_NOT_FOUND', message: 'Project not found' } }` (same structure as above, no information about why it is missing).

### What is never in the IPC payload

- Raw cue text (subtitle content).
- File system paths.
- Raw error messages from SQLite or the analysis layer.
- Stack traces.

---

## 3. Renderer Security

### contextBridge surface

`window.sceneSift.syncCheckForProject` is exposed via `contextBridge.exposeInMainWorld` in `src/preload/index.ts`. The method:

- Accepts `{ projectId: string }` only.
- Validates input type (string) at the preload boundary before forwarding.
- Never exposes raw `ipcRenderer`, `require`, or `process`.

### What the renderer receives

```ts
interface SyncCheckResult {
  syncStatus: SyncStatus;
  syncWarnings: SyncWarning[];
  syncCheckedAt: string | null;
  error?: { code: string; message: string };
}
```

The renderer has no access to:
- Raw cue data.
- Database row contents.
- File paths.
- Analysis intermediate values.

### SyncWarning structure

```ts
interface SyncWarning {
  code: SyncWarningCode;   // enum string, defined in src/shared/
  metadata: {
    // All numeric. No strings, no text content.
    count?: number;        // e.g., number of out-of-range cues
    ratioPercent?: number; // e.g., span-to-duration ratio as integer %
    gapSeconds?: number;   // e.g., tail gap in whole seconds
    offsetPercent?: number; // e.g., late-start offset as integer %
  };
}
```

The renderer renders warning metadata values (numbers) into human-readable template strings defined in the component layer. No user-controlled text reaches the DOM via the warning payload.

---

## 4. No PII in Warnings

SyncWarning objects are designed to contain no personally identifiable or user-authored content:

| Field | Type | Contains user content? |
|-------|------|----------------------|
| `code` | Enum string (defined in source) | No |
| `metadata.count` | integer | No |
| `metadata.ratioPercent` | integer | No |
| `metadata.gapSeconds` | integer | No |
| `metadata.offsetPercent` | integer | No |

No subtitle text, speaker labels, or file names appear in any SyncWarning field.

**Sufficiency for UI display**: The warning code (enum) maps to a human-readable label in the component. The numeric metadata fields populate the label template (e.g., "N cue(s) extend beyond video duration"). This is sufficient to convey all meaningful timing information to the user without transmitting cue content.

---

## 5. Privacy Policy Compliance

| Requirement | M3 status |
|-------------|-----------|
| Network calls | None — no privacy policy update required |
| Data sent externally | None — no consent gate required |
| Subtitle content locality | Stays on local machine — no data residency concern |
| User consent check before AI/network call | Not applicable — M3 has no AI or network calls |
| New data categories collected | None — analysis results are derived metadata only |

M3 requires no changes to `docs/governance/DATA_PRIVACY.md`.

---

## 6. Threat Model

### Threat 1: Malformed `cues_json` in the database

**Vector**: M2 parser wrote a corrupt or maliciously crafted JSON string to `subtitle_documents.cues_json`. Analysis reads this value and attempts to parse it.

**Mitigation**: Before analysis, `cues_json` is parsed with a Zod schema that validates the structure of each cue object (`{startMs: number, endMs: number}`). If parsing fails for any reason (invalid JSON, wrong shape, non-numeric time values), `SynchronizationAnalyzer` returns `check_failed` immediately without processing any cue data.

**Residual risk**: Low. Zod parse failure is caught and results in a structured error state. No exception propagates to the renderer.

---

### Threat 2: Null or NaN `durationSeconds` from a corrupt database row

**Vector**: `video_sources.duration_seconds` is null, zero, negative, or NaN due to a bad FFprobe result or database write error.

**Mitigation**: Pre-guard check in the handler verifies `durationSeconds` is a finite positive number before invoking `SynchronizationAnalyzer`. If the guard fails, the handler returns `not_available` with a structured reason. `SynchronizationAnalyzer` is never called with invalid duration data.

**Residual risk**: None. The pre-guard is a simple type + range check before any computation.

---

### Threat 3: IPC injection via `projectId`

**Vector**: Renderer passes a crafted `projectId` string intended to cause SQL injection or path traversal.

**Mitigation**: UUID v4 validation (Zod) rejects any non-UUID string before the handler executes. All subsequent database queries use parameterized statements. There is no string interpolation in any query that touches the `projectId`.

**Residual risk**: None. UUID format is sufficiently restrictive that no SQL metacharacters can pass validation.

---

### Threat 4: XSS via warning text rendered in the renderer

**Vector**: A warning object returned from the main process contains attacker-controlled text that is rendered as HTML in the React component.

**Mitigation**: SyncWarning objects contain only enum strings (defined in source code, not user-controlled) and numeric values. The renderer maps warning codes to static human-readable label templates using a lookup table — no user-controlled text is interpolated into DOM output. React's default JSX escaping provides an additional layer even if this assumption is violated.

**Residual risk**: None under the current warning schema. Any future change to add text fields to SyncWarning must be reviewed against this threat.

---

### Threat 5: Analysis hangs on a very large cue set

**Vector**: A subtitle file with an extreme number of cues causes the analysis computation to block the main process event loop.

**Mitigation**: M2 already enforces a hard cap of 10,000 cues at parse time. `SynchronizationAnalyzer` performs only linear passes over the cue array (no quadratic operations). Benchmarks confirm that 10,000 cues complete analysis in under 100ms on representative hardware. No timeout mechanism is required for the analysis phase itself; the IPC handler uses the standard Electron IPC timeout.

**Residual risk**: Low. The M2 cap is the binding constraint. If M2 raises the cap in a future milestone, this threat should be re-evaluated.

---

### Threat 6: Stale result displayed after project data changes

**Vector**: Video or subtitle source data changes after a sync check was run, but the renderer continues to display the previous `timing_ok` or `needs_review` result without indication that it is outdated.

**Mitigation**: M3 defines the `stale` state explicitly. The main process records version hashes of the input data (video duration hash and cues_json hash) at check time. On subsequent reads, the handler compares current hashes to stored hashes and returns `stale` if they differ. The renderer displays a visual indicator and re-check prompt when status is `stale`.

**Residual risk**: Low. The stale check is deterministic and runs on every result read, not just on explicit user action.

---

## 7. Electron Security Boundaries Unchanged

M3 introduces no changes to Electron security configuration:

| Security property | M3 change |
|------------------|-----------|
| New BrowserWindow | None |
| `nodeIntegration` | Unchanged (`false`) |
| `contextIsolation` | Unchanged (`true`) |
| `sandbox` | Unchanged (`true`) |
| `webSecurity` | Unchanged (`true`) |
| `shell: true` | None added |
| New child processes | None |
| New `spawn`/`exec` calls | None |
| New external executables | None |

The only new Electron surface added by M3 is one IPC channel (`SYNC_CHECK_FOR_PROJECT`) registered in `src/shared/ipc/channels.ts` and one narrow method on the `contextBridge` API.
