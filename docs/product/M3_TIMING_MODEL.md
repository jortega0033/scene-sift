# M3 — Timing Model

**Spec date:** 2026-07-19

---

## Canonical unit

All M3 analysis operates in **integer milliseconds**. Floating-point seconds are converted once at the start of analysis and never used again within `SynchronizationAnalyzer`.

This matches the M2 normalizer, which stores all cue timestamps as `startMs: number` and `endMs: number` (integer milliseconds) in `SubtitleCue`. Integer milliseconds are natively comparable, avoid floating-point drift across arithmetic operations, and are sufficient precision for all structural timing checks that M3 performs.

---

## `durationMs` conversion

```typescript
// In SynchronizationService, before calling SynchronizationAnalyzer.analyze():
const durationMs: number = Math.floor(durationSeconds * 1000);
```

**Why `Math.floor` (not `Math.round` or `Math.ceil`):**

`durationSeconds` is a float from FFprobe. The video ends at that many seconds. `Math.floor` produces the largest integer millisecond value that does not exceed the actual video end.

`Math.round` or `Math.ceil` could round up to a `durationMs` that is past the real video end. A cue ending within that fractional-millisecond overshoot would appear within range when it is actually past the video end. `Math.floor` is the conservative choice: it places the range boundary at or before the actual video end, never after it. This means a cue that ends in the very last partial millisecond of video may be flagged as a tolerated overshoot — which is acceptable and handled by `TAIL_TOLERANCE_MS`.

**Example:**
```
durationSeconds = 5423.456789
Math.floor(5423.456789 * 1000) = Math.floor(5423456.789) = 5423456

video range = [0, 5423456] ms
cue endMs = 5423456  → within range (inclusive)
cue endMs = 5423457  → outside range by 1 ms → within TAIL_TOLERANCE_MS → tolerated overshoot
cue endMs = 5425457  → outside range by 2001 ms → exceeds TAIL_TOLERANCE_MS → CUES_OUTSIDE_VIDEO_RANGE
```

---

## Video range

The valid range for subtitle timestamps is `[0, durationMs]`, both endpoints inclusive.

```
within range:   startMs >= 0  AND  endMs <= durationMs
outside range:  startMs < 0   OR   endMs > durationMs
```

A cue ending exactly at `durationMs` is within range. A cue starting at `0` is within range.
Cues ending past `durationMs` but within `TAIL_TOLERANCE_MS` generate a warning, not an error.
Cues ending past `durationMs + TAIL_TOLERANCE_MS` generate an error (`check_failed`).

---

## Null and zero `durationSeconds` handling

| `durationSeconds` value | `durationMs` | Sync state | Behavior |
|---|---|---|---|
| `null` | not computed | `not_available` | Analysis aborts before `SynchronizationAnalyzer` is called. No checks run. SynchronizationService persists `not_available` and returns. |
| `0` | `0` | `check_failed` | Video range is `[0, 0]`. Any cue with `endMs > 0` is outside range. Analyzer runs and produces `CUES_OUTSIDE_VIDEO_RANGE`. This is a valid (if extreme) result. |
| `< 0` | negative | `check_failed` | Invalid video metadata. Analyzer receives a negative `durationMs`. Must detect this condition and return `check_failed` with a `CUES_OUTSIDE_VIDEO_RANGE` warning — the video range `[0, durationMs]` is incoherent and no cue can be valid. |
| `> 0` | positive | analysis proceeds | Normal path. |

A zero or negative `durationSeconds` must not crash the analyzer. These are edge cases that can arise from corrupt container metadata or unusual encoding tools. The analyzer must handle them explicitly and return a `check_failed` result rather than throwing.

---

## `fps` relevance

**M3 does not use `fps`.** Frame-level precision requires a video preview scrubber (M4) and VFR-aware timing analysis. M3 structural checks operate at the granularity of subtitle cue timestamps (integer milliseconds) against the video container duration bound — fps adds no information for this class of check.

`fps` is available in `projects.fps` and may be displayed in the sync summary panel for informational context. It must not be passed to `SynchronizationAnalyzer.analyze()` as a parameter, and it must not influence analysis classification.

If a future milestone requires frame-accurate sync checking (e.g., snapping cue boundaries to frame boundaries, or comparing cue timing against EDL cut points), that is an M4+ feature requiring a separate timing model document.

---

## Variable frame rate (VFR) handling

M3 does not attempt VFR handling. Container duration (from FFprobe `duration_seconds`) is a single scalar value independent of per-frame timing. M3 uses only this scalar for its range check. VFR handling — where individual frame durations vary and the total duration cannot be derived from a constant frame interval — is irrelevant to a duration-bounds check that uses the container's reported total duration.

---

## Offset sign convention

**Not defined in M3.** Offset detection and persistence are deferred to M4 or later.

M3 may detect a pattern consistent with a global offset (e.g., most cues fall before or after an expected range in the same direction) and report this as the informational `POSSIBLE_OFFSET` sync warning. However:

- M3 does not compute a specific offset value for correction purposes
- M3 does not persist an offset value
- M3 does not define whether a positive offset means "subtitle is early" or "subtitle is late"
- The `detail.offsetMs` field on `POSSIBLE_OFFSET` is an approximate descriptive statistic only, not a correction value

The offset sign convention must be defined and documented in M4's timing model spec before any offset is stored, displayed as actionable, or used in any computation. Do not anticipate the M4 convention in M3 code or comments.

---

## Tolerance thresholds

All thresholds are named constants exported from `src/main/services/sync/synchronizationAnalyzer.ts`. They are adjustable at a single location. A threshold change increments `SYNC_ANALYSIS_VERSION`, which triggers re-analysis of all existing results on the user's next sync check run.

| Constant | Value | Unit | Rationale |
|---|---|---|---|
| `TAIL_TOLERANCE_MS` | `2000` | ms | Cues ending up to 2 seconds after video end are common. Subtitle authoring tools often round timestamps, end-credit subtitles sometimes run past the container end, and minor re-encodes can shorten duration. 2 seconds is the outer boundary of routine overshoot. Beyond 2 seconds, the mismatch is too large to be rounding and likely indicates a different video version. |
| `SPAN_SHORT_RATIO` | `0.5` | ratio | Subtitle span covering less than 50% of video is unusual but possible (partial subtitle files, segment-specific subtitles, interview overlays). 50% is conservative — most full-program subtitles cover 70–95% of video. Below 50% is a soft warning warranting human review. |
| `SPAN_LONG_RATIO` | `1.2` | ratio | Subtitle span exceeding 120% of video duration is a strong indicator of mismatch: the subtitle was produced for a longer cut. 20% tolerance accommodates minor duration discrepancies between encode versions (e.g., theatrical vs. streaming cut length differences up to ~10 minutes on a 90-minute film fall within this tolerance). Beyond 120% the mismatch is too large to be a version difference. |
| `LATE_START_THRESHOLD_RATIO` | `0.15` | ratio | First cue starting after 15% of video duration is suspicious. 15% of a 90-minute film = ~13.5 minutes. A pre-dialogue opening sequence longer than 13 minutes is unusual in most program types. If the first cue starts after 15% of video, the subtitle may have a global offset or may belong to a different edit. |
| `LARGE_TAIL_THRESHOLD_MS` | `10000` | ms | Last cue followed by more than 10 seconds of empty video is flagged. 10 seconds accommodates end-credit timing, post-dialogue music sequences, and fade-out conventions. Values beyond 10 seconds suggest the subtitle does not cover the program's full duration or has a short-cut mismatch. |

### Threshold boundary semantics

- **At or below threshold:** no warning generated for that check
- **Above threshold:** warning generated with the associated `SyncWarningCode`
- Thresholds are applied independently; multiple warnings may be generated for a single analysis
- A single `check_failed` result may carry multiple `SyncWarning` entries

### Classification of warnings as soft vs hard

| Code | Classification | Result state |
|---|---|---|
| `CUES_OUTSIDE_VIDEO_RANGE` | Hard | `check_failed` |
| `CUES_BEFORE_VIDEO_START` | Hard | `check_failed` |
| `SPAN_LONG` | Hard | `check_failed` |
| `SPAN_SHORT` | Soft | `check_passed_with_warnings` |
| `LATE_START` | Soft | `check_passed_with_warnings` |
| `LARGE_TAIL_GAP` | Soft | `check_passed_with_warnings` |
| `POSSIBLE_OFFSET` | Informational | `check_passed_with_warnings` |

If any hard warning is present, the result is `check_failed` regardless of soft warnings.
If only soft or informational warnings are present, the result is `check_passed_with_warnings`.
If no warnings of any kind are present, the result is `check_passed`.

### Why thresholds are adjustable

Subtitle authoring tools, broadcast standards, streaming platform conventions, and individual author habits produce a wide range of timing patterns. The values above are reasonable starting defaults but are not empirically validated against a SceneSift user corpus. They are documented as named constants so they can be updated in a single location when real usage data is available. Any change increments `SYNC_ANALYSIS_VERSION`, causing existing analysis results to be marked stale. The user re-runs the check explicitly — re-analysis is never automatic.

---

## `SYNC_ANALYSIS_VERSION`

```typescript
// src/main/services/sync/synchronizationAnalyzer.ts
export const SYNC_ANALYSIS_VERSION = 1;
```

Every persisted sync result carries this value in `projects.sync_analysis_version`.

**On project load:** If `sync_analysis_version < SYNC_ANALYSIS_VERSION` (i.e., the stored version is older than the current constant), the `SynchronizationService` treats the sync status as `needs_recheck`. The outdated result is displayed with a stale indicator. The user re-runs the check explicitly.

**When to increment `SYNC_ANALYSIS_VERSION`:**
- Any threshold constant change (`TAIL_TOLERANCE_MS`, `SPAN_SHORT_RATIO`, etc.)
- Any change to which checks are performed (adding or removing a `SyncWarningCode`)
- Any change to the hard/soft classification of an existing warning code
- Any change to the `durationMs` conversion strategy (e.g., switching from `Math.floor` to another method)

**When NOT to increment:**
- UI-only changes (display copy, formatting)
- Bug fixes in display or formatting code
- Addition of new fields to the persisted result that do not affect the sync state classification
- Changes to the DB schema that do not affect analysis logic

`SYNC_ANALYSIS_VERSION` is an integer. Increment by 1 only (do not skip values). Document the reason for each increment in a comment alongside the constant and in `docs/governance/GOVERNANCE_DECISIONS.md`.

---

## `SyncWarningCode` taxonomy

```typescript
// src/shared/schemas/sync.ts
export type SyncWarningCode =
  | 'CUES_OUTSIDE_VIDEO_RANGE'   // one or more cues extend beyond durationMs + TAIL_TOLERANCE_MS
  | 'CUES_BEFORE_VIDEO_START'    // one or more cues start before 0 ms
  | 'SPAN_SHORT'                 // subtitle span < SPAN_SHORT_RATIO × durationMs
  | 'SPAN_LONG'                  // lastCueEndMs > SPAN_LONG_RATIO × durationMs
  | 'LATE_START'                 // firstCueStartMs > LATE_START_THRESHOLD_RATIO × durationMs
  | 'LARGE_TAIL_GAP'             // durationMs - lastCueEndMs > LARGE_TAIL_THRESHOLD_MS
  | 'POSSIBLE_OFFSET';           // informational: most cues shifted consistently in one direction

export interface SyncWarning {
  code: SyncWarningCode;
  message: string;        // human-readable, for internal logs only — never raw in UI
  detail?: {
    affectedCueCount?: number;   // for CUES_OUTSIDE_VIDEO_RANGE, CUES_BEFORE_VIDEO_START
    ratioFound?: number;         // for SPAN_SHORT, SPAN_LONG (the computed ratio)
    thresholdRatio?: number;     // for SPAN_SHORT, SPAN_LONG (the threshold that was exceeded)
    gapMs?: number;              // for LARGE_TAIL_GAP, LATE_START (the computed gap in ms)
    thresholdMs?: number;        // for LARGE_TAIL_GAP (the threshold value)
    approximateShiftMs?: number; // for POSSIBLE_OFFSET — descriptive, not a correction value
  };
}
```

`POSSIBLE_OFFSET.detail.approximateShiftMs` is a descriptive approximation only. It must be displayed with a clear disclaimer that it is not a correctable offset in M3. No UI element may present it as an actionable value (e.g., no "Apply offset" button referencing this value).

---

## Analysis input and output types

```typescript
// Input to SynchronizationAnalyzer.analyze()
// Both fields are validated non-null by SynchronizationService before calling analyze().
interface SyncAnalysisInput {
  durationSeconds: number;           // from projects.duration_seconds — guaranteed non-null here
  subtitleDocument: SubtitleDocument; // from subtitle_documents — guaranteed cues.length >= 1
}

// Output from SynchronizationAnalyzer.analyze()
interface SyncAnalysisResult {
  analysisVersion: number;           // === SYNC_ANALYSIS_VERSION — stamped by analyzer, not service
  syncStatus: 'check_passed' | 'check_passed_with_warnings' | 'check_failed';
  warnings: SyncWarning[];           // empty array when syncStatus === 'check_passed'
  firstCueStartMs: number;           // from subtitleDocument.cues[0].startMs
  lastCueEndMs: number;              // from subtitleDocument.cues[cues.length - 1].endMs
  durationMs: number;                // computed from durationSeconds via Math.floor conversion
}
```

`SynchronizationAnalyzer.analyze()` is a pure function: given the same input it always produces the same output. It has no IO dependencies, no side effects, and no `Date.now()` call. The `analyzedAt` timestamp is set once in `SynchronizationService`, immediately after `analyze()` returns, following the same pattern as M2's `subtitle_parsed_at`.

---

## DB schema additions (M3 migration)

```sql
-- src/main/services/database/migrations/0003_sync_analysis.sql
ALTER TABLE projects ADD sync_status TEXT;
ALTER TABLE projects ADD sync_analysis_version INTEGER;
ALTER TABLE projects ADD sync_analyzed_at INTEGER;
ALTER TABLE projects ADD sync_warnings_json TEXT;
```

All additions are additive and nullable. Existing rows default to `null` across all new columns. The application treats `sync_status = null` identically to `not_checked` (prerequisites met) or `not_available` (prerequisites absent) for display purposes. `null` sync status never requires a migration data backfill — the business logic at load time resolves the correct display state.

`sync_warnings_json` stores a JSON array of `SyncWarning` objects. The maximum expected size is small (fewer than 10 warnings per project, each with limited detail). No separate table is needed.

### `projectSchema` additions

```typescript
// src/shared/schemas/project.ts — add to projectSchema:
syncStatus: z.enum([
  'not_available',
  'not_checked',
  'check_passed',
  'check_passed_with_warnings',
  'check_failed',
  'needs_recheck',
]).nullable(),
syncAnalysisVersion: z.number().int().nullable(),
syncAnalyzedAt: z.number().int().nullable(),
syncWarningsJson: z.string().nullable(),  // JSON-serialized SyncWarning[] — parsed by renderer
```

`syncWarningsJson` is kept as a raw string in `projectSchema` to avoid embedding complex nested types in the project record. The renderer deserializes it via `syncFormatters.parseSyncWarnings(syncWarningsJson)` — a pure function that returns `SyncWarning[]` or `[]` on parse failure.

---

## `SynchronizationService` persistence contract

```typescript
// Conceptual — not final implementation
async analyzeForProject(projectId: string): Promise<ProjectRecord> {
  // 1. Look up project row — throw PROJECT_NOT_FOUND if absent
  // 2. Check prerequisites:
  //    a. durationSeconds not null — if null: persist not_available, return
  //    b. subtitle_status in ['ready', 'ready_with_warnings'] — if not: persist not_available, return
  // 3. Load SubtitleDocument from subtitle_documents table
  //    — if absent (should not occur given step 2b): persist not_available, return
  // 4. Call SynchronizationAnalyzer.analyze({ durationSeconds, subtitleDocument })
  // 5. sync_analyzed_at = Date.now() — set ONCE here, not inside analyzer
  // 6. Persist: UPDATE projects SET
  //      sync_status, sync_analysis_version, sync_analyzed_at, sync_warnings_json
  //    WHERE id = projectId
  //    — single UPDATE, no transaction needed (single table, single row, no FK-coupled writes)
  // 7. Return updated ProjectRecord
}
```

Persistence is a single-row UPDATE on the projects table. No separate sync table exists. No transaction wrapper is needed beyond SQLite's implicit single-statement atomicity.

---

## Stale detection on project load

On every project load (not on every DB read), `SynchronizationService` checks:

```typescript
if (project.syncAnalysisVersion !== null &&
    project.syncAnalysisVersion < SYNC_ANALYSIS_VERSION) {
  // Stored result is from an older analysis version — mark stale
  // UPDATE projects SET sync_status = 'needs_recheck' WHERE id = projectId
}
```

This check is performed lazily (on load or on first sync panel render), not eagerly on all projects at startup. It does not re-run analysis — it only updates the display status to `needs_recheck` so the user sees the stale indicator and can re-run explicitly.
