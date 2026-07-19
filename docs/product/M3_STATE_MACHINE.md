# M3 — Sync Status State Machine

**Spec date:** 2026-07-20
**Milestone:** M3 — Subtitle Synchronization Check
**Prerequisites:** M3_SCOPE.md, M3_ANALYSIS_RULES.md, M3_TIMING_MODEL.md

> **Naming note:** This document defines the canonical M3 state names: `not_available`,
> `ready_to_check`, `timing_ok`, `needs_review`, `stale`, `check_failed`. Earlier drafts
> (M3_SCOPE.md) used `not_checked`, `check_passed`, `check_passed_with_warnings`, `needs_recheck`.
> This document supersedes those names for implementation.

---

## 1. State definitions

### `not_available`

**What it means:** The prerequisites for running a sync check are not met. Either `durationSeconds`
is null (video has not been inspected, or FFprobe did not return a duration), or `subtitle_status`
is not `ready` or `ready_with_warnings` (subtitle has not been successfully parsed).

**When it is set:**
- On project load, when either prerequisite is absent
- When the user clears the video source (`VIDEO_CLEARED` event)
- When the user clears the subtitle (`SUBTITLE_CLEARED` event)
- When `SynchronizationService` performs its prerequisite check and finds a prerequisite absent
  (this can happen if the service is called despite the UI guard being active, as a safety net)

**What is displayed to the user:**
Sync panel shows a muted placeholder. The "Check sync" action button is disabled. A contextual
reason is shown: "Video not yet inspected" (if `durationSeconds` is null) or "Subtitle not yet
parsed" (if subtitle is not ready). No previous result is displayed.

---

### `ready_to_check`

**What it means:** Both prerequisites are met — `durationSeconds` is non-null and `subtitle_status`
is `ready` or `ready_with_warnings` — but the user has not yet triggered a sync check for the
current data.

**When it is set:**
- On project load, when prerequisites are met but `sync_checked_at` is null (no check has ever run)
- When video is (re-)inspected and prerequisites are now both met for the first time
- When subtitle is (re-)parsed and prerequisites are now both met for the first time
- On project load, when `sync_checked_at` is null despite both prerequisites being met (e.g., after
  a DB migration that added sync columns to existing projects)

**What is displayed to the user:**
Sync panel shows a neutral ready state. The "Check sync" action button is enabled. A call-to-action
message is shown: "Run a synchronization check to verify subtitle timing."

---

### `timing_ok`

**What it means:** The most recent sync check ran successfully and emitted no warnings. All five
structural checks passed within their thresholds.

**When it is set:**
- When `ANALYSIS_SUCCEEDED` event fires and `syncWarnings.length === 0`
- Persisted to `projects.sync_status = 'timing_ok'`

**What is displayed to the user:**
Sync panel shows a green/positive indicator. Label: "Timing OK". The analyzed-at timestamp is
shown. The "Re-check" action is available. No warnings are shown.

---

### `needs_review`

**What it means:** The most recent sync check ran successfully but emitted one or more warnings.
The warnings are structural — cues outside range, span mismatches, late start, or large tail gap.
This does not necessarily mean the subtitle is wrong; it means a human should review the details.

**When it is set:**
- When `ANALYSIS_SUCCEEDED` event fires and `syncWarnings.length > 0`
- Persisted to `projects.sync_status = 'needs_review'`

**What is displayed to the user:**
Sync panel shows a yellow/warning indicator. Label: "Needs Review". The analyzed-at timestamp is
shown. Each warning is listed with a human-readable message. The "Re-check" action is available.
No raw `SyncWarningCode` strings are visible; only formatted messages from `syncFormatters.ts`.

---

### `stale`

**What it means:** A sync check was previously completed (result was `timing_ok`, `needs_review`,
or `check_failed`), but since then the video was re-inspected or the subtitle was re-parsed. The
persisted result may no longer reflect the current data. Also set when the stored
`sync_analysis_version` is older than the current `SYNC_ANALYSIS_VERSION` constant (threshold
changed since last check).

**When it is set:**
- On `VIDEO_RE_INSPECTED` event, when an existing sync result is present
- On `SUBTITLE_RE_PARSED` event, when an existing sync result is present
- On project load, when staleness is detected via the load-time algorithm (see section 4)
- When `SYNC_ANALYSIS_VERSION` constant has advanced past `projects.sync_analysis_version`

**What is displayed to the user:**
Sync panel shows a grey/stale indicator over the previous result. Label: "Stale — re-check needed".
The previous result and its warnings are shown in a muted style to indicate they may be outdated.
The analyzed-at timestamp is shown alongside a "last checked before changes" note. The "Re-check"
action is prominently enabled.

---

### `check_failed`

**What it means:** The sync check ran but the analyzer returned `check_failed` — either a
pre-analysis guard triggered (`INVALID_VIDEO_DURATION`, `NO_CUES_TO_ANALYZE`) or an internal
exception occurred (`SYNC_ANALYZER_INTERNAL_ERROR`).

**When it is set:**
- When `ANALYSIS_FAILED` event fires
- Persisted to `projects.sync_status = 'check_failed'`

**What is displayed to the user:**
Sync panel shows a red/error indicator. Label: "Check Failed". The failure code (human-readable
translation from `syncFormatters.ts`) is shown. The raw `SyncWarningCode` is never displayed.
The analyzed-at timestamp is shown. The "Re-check" action is available so the user can try again.

---

## 2. Transition table

Each row is one valid state transition. Events not listed for a given source state are either
impossible (button disabled) or no-ops (state unchanged).

| From state | Event | To state | Condition | Action |
|---|---|---|---|---|
| _(any)_ | `APP_OPENED_WITH_PROJECT` | _(see section 4)_ | Load-time staleness algorithm | Load DB row; run staleness check; set derived state |
| _(any)_ | `VIDEO_CLEARED` | `not_available` | Unconditional | Clear sync result; persist `not_available` |
| _(any)_ | `SUBTITLE_CLEARED` | `not_available` | Unconditional | Clear sync result; persist `not_available` |
| `not_available` | `VIDEO_RE_INSPECTED` | `not_available` | Subtitle still not ready | Persist `not_available` |
| `not_available` | `VIDEO_RE_INSPECTED` | `ready_to_check` | Subtitle is now ready | Persist `ready_to_check` |
| `not_available` | `SUBTITLE_RE_PARSED` | `not_available` | Video still not inspected | Persist `not_available` |
| `not_available` | `SUBTITLE_RE_PARSED` | `ready_to_check` | Video is now inspected | Persist `ready_to_check` |
| `ready_to_check` | `VIDEO_RE_INSPECTED` | `ready_to_check` | No prior sync result exists | No-op; already in ready state |
| `ready_to_check` | `SUBTITLE_RE_PARSED` | `ready_to_check` | No prior sync result exists | No-op; already in ready state |
| `ready_to_check` | `USER_REQUESTED_CHECK` | _(in-flight)_ | Prerequisites met | Call `SynchronizationService.analyzeForProject()` |
| `timing_ok` | `VIDEO_RE_INSPECTED` | `stale` | Prior result exists | Persist `stale`; retain `sync_warnings_json` |
| `timing_ok` | `SUBTITLE_RE_PARSED` | `stale` | Prior result exists | Persist `stale`; retain `sync_warnings_json` |
| `timing_ok` | `USER_REQUESTED_CHECK` | _(in-flight)_ | Prerequisites met | Re-run analysis |
| `needs_review` | `VIDEO_RE_INSPECTED` | `stale` | Prior result exists | Persist `stale`; retain `sync_warnings_json` |
| `needs_review` | `SUBTITLE_RE_PARSED` | `stale` | Prior result exists | Persist `stale`; retain `sync_warnings_json` |
| `needs_review` | `USER_REQUESTED_CHECK` | _(in-flight)_ | Prerequisites met | Re-run analysis |
| `check_failed` | `VIDEO_RE_INSPECTED` | `stale` | Prior result exists | Persist `stale`; retain `sync_warnings_json` |
| `check_failed` | `SUBTITLE_RE_PARSED` | `stale` | Prior result exists | Persist `stale`; retain `sync_warnings_json` |
| `check_failed` | `USER_REQUESTED_CHECK` | _(in-flight)_ | Prerequisites met | Re-run analysis |
| `stale` | `VIDEO_RE_INSPECTED` | `stale` | Already stale | No-op (still stale) |
| `stale` | `SUBTITLE_RE_PARSED` | `stale` | Already stale | No-op (still stale) |
| `stale` | `USER_REQUESTED_CHECK` | _(in-flight)_ | Prerequisites met | Re-run analysis |
| _(in-flight)_ | `ANALYSIS_SUCCEEDED` | `timing_ok` | `syncWarnings.length === 0` | Persist `timing_ok`; update `sync_checked_at` |
| _(in-flight)_ | `ANALYSIS_SUCCEEDED` | `needs_review` | `syncWarnings.length > 0` | Persist `needs_review`; update `sync_checked_at`; persist `sync_warnings_json` |
| _(in-flight)_ | `ANALYSIS_FAILED` | `check_failed` | Guard triggered or exception | Persist `check_failed`; update `sync_checked_at`; persist failure `sync_warnings_json` |

**_(in-flight)_** is not a persisted state. It represents the transient period between
`USER_REQUESTED_CHECK` and the IPC response. If the app closes during in-flight, the state remains
at whatever was last persisted before the check began (e.g., `stale`, `ready_to_check`).

**`not_available` is the terminal state for cleared prerequisites.** It is never set back to
`ready_to_check` automatically — only by `VIDEO_RE_INSPECTED` or `SUBTITLE_RE_PARSED` events that
satisfy both prerequisites simultaneously.

---

## 3. Events

### `APP_OPENED_WITH_PROJECT`

Fired when the project detail panel first renders for a project (including app restart with a
project pre-selected, and switching between projects). Triggers the load-time staleness algorithm
(section 4). Not a user action.

### `VIDEO_RE_INSPECTED`

Fired by `InspectionService.inspectForProject()` when it successfully updates `projects.inspected_at`
for a project that already has a sync result. `InspectionService` is responsible for checking
whether the current `sync_status` is non-null and non-`not_available` and emitting this event if so.
The event is NOT fired on the first inspection of a project (no prior sync result).

### `SUBTITLE_RE_PARSED`

Fired by `SubtitleService.parseSubtitleForProject()` when it successfully updates
`projects.subtitle_parsed_at` for a project that already has a sync result. Same responsibility
pattern as `VIDEO_RE_INSPECTED`. Not fired on first subtitle parse.

### `USER_REQUESTED_CHECK`

Fired when the user explicitly clicks the "Check sync" or "Re-check" button in the sync panel.
This is the **only trigger** for running `SynchronizationAnalyzer`. Analysis is never automatic.
The IPC channel `SYNC_ANALYZE_FOR_PROJECT` is invoked with `{ projectId }`.

### `ANALYSIS_SUCCEEDED`

Fired by `SynchronizationService` when `SynchronizationAnalyzer.analyze()` returns without throwing
and the result has `syncStatus === 'timing_ok'` or `syncStatus === 'needs_review'`. The service
persists the result and returns the updated `ProjectRecord` to the IPC handler.

### `ANALYSIS_FAILED`

Fired by `SynchronizationService` when `SynchronizationAnalyzer.analyze()` returns `check_failed`
(pre-analysis guard triggered) or throws an unhandled exception (caught by the service's own
try/catch). The service persists `check_failed` and the failure warning.

### `VIDEO_CLEARED`

Fired when the user removes the video source from a project (sets `durationSeconds` to null via the
project edit flow). Unconditionally transitions to `not_available` and clears the sync result.

### `SUBTITLE_CLEARED`

Fired when the user removes the subtitle from a project (sets `subtitle_status` to `not_selected`
or `missing`). Unconditionally transitions to `not_available` and clears the sync result.

---

## 4. Staleness detection on load

Executed by `SynchronizationService` during project load (triggered by `APP_OPENED_WITH_PROJECT`).
This is a read-and-optionally-update operation. No analysis runs.

```typescript
function computeLoadTimeState(project: ProjectRecord): SyncStatus {
  const {
    durationSeconds,
    subtitleStatus,
    syncStatus,
    syncCheckedAt,
    syncAnalysisVersion,
    inspectedAt,
    subtitleParsedAt,
  } = project;

  // Step 1 — Prerequisites check
  const prereqsMet =
    durationSeconds != null &&
    (subtitleStatus === 'ready' || subtitleStatus === 'ready_with_warnings');

  if (!prereqsMet) {
    return 'not_available';
  }

  // Step 2 — No prior check
  if (syncCheckedAt == null || syncStatus == null) {
    return 'ready_to_check';
  }

  // Step 3 — Analysis version stale
  if (syncAnalysisVersion != null && syncAnalysisVersion < SYNC_ANALYSIS_VERSION) {
    return 'stale';
  }

  // Step 4 — Data changed since last check
  if (inspectedAt != null && syncCheckedAt < inspectedAt) {
    return 'stale';
  }
  if (subtitleParsedAt != null && syncCheckedAt < subtitleParsedAt) {
    return 'stale';
  }

  // Step 5 — Use persisted state
  // Valid persisted states: 'timing_ok', 'needs_review', 'check_failed', 'stale'
  return syncStatus as SyncStatus;
}
```

**If `computeLoadTimeState` returns `stale` but the DB has a different persisted value:**
`SynchronizationService` updates `projects.sync_status = 'stale'` in the DB. This UPDATE is
performed lazily on first load, not eagerly for all projects at startup. It is a single-row
UPDATE with no other changes.

**If `computeLoadTimeState` returns `ready_to_check` but DB has null `sync_status`:**
`SynchronizationService` updates `projects.sync_status = 'ready_to_check'` in the DB. This ensures
the first time the renderer displays a ready project, the DB is in a consistent state.

**`inspectedAt` and `subtitleParsedAt` comparison:** Uses integer millisecond comparison. If either
timestamp is null, the corresponding stale check is skipped (cannot compare against null). A project
with `inspectedAt = null` but `durationSeconds != null` (which should not occur in practice but may
occur in corrupt DB rows) is treated as non-stale for that field.

---

## 5. `not_available` conditions

`not_available` is set whenever **either** of the following is true:

1. `durationSeconds IS NULL` — the video source has not been inspected, or FFprobe did not return
   a duration value. This covers: video never inspected, inspection failed, video cleared after
   inspection.

2. `subtitle_status NOT IN ('ready', 'ready_with_warnings')` — the subtitle has not been
   successfully parsed. This covers:
   - `subtitle_status = 'not_selected'` — no subtitle file chosen
   - `subtitle_status = 'missing'` — subtitle file path set but file is gone
   - `subtitle_status = 'parsing'` — parse in progress (transient; sync button disabled)
   - `subtitle_status = 'parse_failed'` — subtitle could not be parsed
   - `subtitle_status = NULL` — no subtitle record

Both prerequisites must be met simultaneously to exit `not_available`. Satisfying one prerequisite
while the other remains unmet does not change the state.

**The `not_available` state does not distinguish between the two absent prerequisites at the
`sync_status` level.** The distinction (which prerequisite is missing) is determined by the UI
layer at render time from the live project fields, not stored in `sync_status`.

---

## 6. Persistence

These are the DB columns on the `projects` table that store sync state. Added in migration
`0003_sync_analysis.sql`. All are nullable; existing rows default to null.

| Column | Type | Description |
|---|---|---|
| `sync_status` | `TEXT` | The current sync state enum value. One of: `not_available`, `ready_to_check`, `timing_ok`, `needs_review`, `stale`, `check_failed`. Null is treated as `ready_to_check` (if prerequisites met) or `not_available` (if not) for display. |
| `sync_checked_at` | `INTEGER` | Unix milliseconds timestamp of the last completed analysis (set by `SynchronizationService` immediately after `analyze()` returns). Null if no analysis has run. |
| `sync_warnings_json` | `TEXT` | JSON-serialized `SyncWarning[]` array from the most recent analysis. Null if state is `not_available`, `ready_to_check`, or `stale` with no prior result. The renderer deserializes via `syncFormatters.parseSyncWarnings()` which returns `[]` on parse failure. |
| `sync_analysis_version` | `INTEGER` | The `SYNC_ANALYSIS_VERSION` constant value at the time the last analysis ran. Null if no analysis has run. Used to detect threshold-change staleness on load. |

**No separate sync table.** All sync state is stored on the `projects` row. The maximum
`sync_warnings_json` size is bounded (fewer than 10 warnings, each with limited `detail` fields).

**Clearing sync state** (`VIDEO_CLEARED` or `SUBTITLE_CLEARED`) sets:
```sql
UPDATE projects SET
  sync_status = 'not_available',
  sync_checked_at = NULL,
  sync_warnings_json = NULL,
  sync_analysis_version = NULL
WHERE id = ?
```

**Persisting a new analysis result** sets:
```sql
UPDATE projects SET
  sync_status = ?,            -- 'timing_ok' | 'needs_review' | 'check_failed'
  sync_checked_at = ?,        -- Date.now() from SynchronizationService
  sync_warnings_json = ?,     -- JSON.stringify(syncWarnings)
  sync_analysis_version = ?   -- SYNC_ANALYSIS_VERSION
WHERE id = ?
```

---

## 7. UI consequences

| State | Indicator | Label | Action available | Warnings shown |
|---|---|---|---|---|
| `not_available` | Grey / muted | "Not available" + contextual reason | None (button disabled) | None |
| `ready_to_check` | Neutral / idle | "Check sync to verify timing" | "Check sync" button | None |
| `timing_ok` | Green | "Timing OK" | "Re-check" button | None |
| `needs_review` | Yellow | "Needs Review" | "Re-check" button | Warning list (formatted) |
| `stale` | Grey / strikethrough overlay on prior result | "Stale — re-check needed" | "Re-check" button | Prior warnings shown in muted style |
| `check_failed` | Red | "Check Failed" + human-readable failure reason | "Re-check" button | Failure reason (formatted) |

**Display rules:**

- The `sync_checked_at` timestamp is displayed on all states except `not_available` and
  `ready_to_check`, formatted as a human-readable relative or absolute time by `syncFormatters.ts`.
- No raw `SyncWarningCode` strings are ever shown. `syncFormatters.formatWarning(warning)` returns
  the display string.
- The UI never claims the subtitle is "in sync" or "correct". `timing_ok` means no structural
  issues were detected — not that the subtitle is semantically accurate.
- The "Re-check" button is always enabled in `timing_ok`, `needs_review`, `check_failed`, and
  `stale`. It is disabled in `not_available`.
- During in-flight analysis, the button shows a loading state and is disabled. No intermediate
  state is persisted during in-flight.

---

## 8. Test scenarios

These are concrete scenarios for unit and integration tests. Each specifies initial DB state,
event, and expected outcome after the event is processed.

### Scenario 1 — First check, no warnings

**Setup:** Project has `durationSeconds = 3600.0`, `subtitle_status = 'ready'`, `sync_status = null`,
`sync_checked_at = null`. Analyzer returns `{syncStatus: 'timing_ok', syncWarnings: []}`.

**Event:** `USER_REQUESTED_CHECK`

**Expected:** `sync_status = 'timing_ok'`, `sync_checked_at != null`,
`sync_warnings_json = '[]'`, `sync_analysis_version = 1`.

**UI:** Green indicator, "Timing OK", "Re-check" button enabled.

---

### Scenario 2 — Check produces warnings

**Setup:** Project with valid prerequisites. Analyzer returns
`{syncStatus: 'needs_review', syncWarnings: [{code: 'LARGE_TAIL_GAP', ...}]}`.

**Event:** `ANALYSIS_SUCCEEDED` (warnings.length > 0)

**Expected:** `sync_status = 'needs_review'`, `sync_warnings_json` contains 1 warning,
`sync_analysis_version = 1`.

**UI:** Yellow indicator, "Needs Review", warning listed with formatted message.

---

### Scenario 3 — Subtitle re-parsed after timing_ok

**Setup:** Project with `sync_status = 'timing_ok'`, `sync_checked_at = T1`. User re-parses
subtitle, `subtitle_parsed_at` becomes `T2 > T1`.

**Event:** `SUBTITLE_RE_PARSED`

**Expected:** `sync_status = 'stale'`. Prior `sync_warnings_json` retained (not cleared).

**UI:** Grey stale indicator, "Stale — re-check needed", prior result (empty warnings) shown
in muted style.

---

### Scenario 4 — Video re-inspected after needs_review

**Setup:** Project with `sync_status = 'needs_review'`, `sync_checked_at = T1`. User re-inspects
video, `inspected_at` becomes `T2 > T1`.

**Event:** `VIDEO_RE_INSPECTED`

**Expected:** `sync_status = 'stale'`. Prior `sync_warnings_json` retained.

---

### Scenario 5 — Load-time staleness detection

**Setup:** App closed after sync check. DB has `sync_status = 'timing_ok'`,
`sync_checked_at = 1000`. User edited subtitle offline; on next app open, DB has
`subtitle_parsed_at = 2000 > 1000`.

**Event:** `APP_OPENED_WITH_PROJECT`

**Expected:** `computeLoadTimeState` returns `stale`. Service updates DB to
`sync_status = 'stale'`. UI shows stale indicator.

---

### Scenario 6 — Guard: no cues to analyze

**Setup:** Project has `durationSeconds = 1200.0`, `subtitle_status = 'ready'`, but
`subtitle_cue_count = 0` (empty subtitle document).

**Event:** `USER_REQUESTED_CHECK`

**Expected:** Analyzer pre-analysis Guard B fires. `sync_status = 'check_failed'`,
`sync_warnings_json` contains `{code: 'NO_CUES_TO_ANALYZE'}`.

**UI:** Red indicator, "Check Failed", human-readable message from `syncFormatters`.

---

### Scenario 7 — Video cleared after needs_review

**Setup:** Project with `sync_status = 'needs_review'` and existing `sync_warnings_json`.

**Event:** `VIDEO_CLEARED`

**Expected:** `sync_status = 'not_available'`, `sync_checked_at = null`,
`sync_warnings_json = null`, `sync_analysis_version = null`.

**UI:** Grey muted placeholder, "Not available — Video not yet inspected", button disabled.

---

### Scenario 8 — Analysis version staleness on load

**Setup:** DB has `sync_status = 'timing_ok'`, `sync_analysis_version = 1`.
`SYNC_ANALYSIS_VERSION` constant is now `2` (a threshold was updated since the last check).
`sync_checked_at`, `inspected_at`, `subtitle_parsed_at` are all equal (no data changes).

**Event:** `APP_OPENED_WITH_PROJECT`

**Expected:** `computeLoadTimeState` returns `stale` (Step 3: `syncAnalysisVersion 1 < 2`).
Service updates DB to `sync_status = 'stale'`. UI shows stale indicator prompting re-check.

**Rationale:** The thresholds changed, so the previous result may no longer be valid under the
new rules. The user must explicitly re-run to get a result based on current thresholds.
