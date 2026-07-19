# M3 — Sync Analysis Rules

**Spec date:** 2026-07-20
**Milestone:** M3 — Subtitle Synchronization Check
**Prerequisite:** M3_TIMING_MODEL.md (threshold values and durationMs conversion)

> **Naming note:** This document uses the canonical state and warning-code names for M3 implementation:
> states `timing_ok` / `needs_review` / `stale` (see M3_STATE_MACHINE.md) and warning codes prefixed
> `SUBTITLE_SPAN_*` / `LATE_SUBTITLE_START`. Earlier draft documents (M3_SCOPE.md, M3_TIMING_MODEL.md)
> used provisional names (`check_passed`, `needs_recheck`, `SPAN_SHORT`, `LATE_START`). This document
> supersedes those names for implementation purposes.

---

## 1. Input contract

`SynchronizationAnalyzer.analyze()` receives a single typed object. All nullable pre-checks are
performed by `SynchronizationService` **before** calling the analyzer; the analyzer never receives
null where the types below say `number`.

```typescript
interface SyncAnalysisInput {
  durationMs: number;             // integer ms; Math.floor(durationSeconds * 1000)
                                  // guaranteed non-null — null durationSeconds → not_available
                                  // before reaching analyzer
  firstCueStartMs: number | null; // null only when cueCount === 0
  lastCueEndMs: number | null;    // null only when cueCount === 0
  cueCount: number;               // total cue count from subtitle document
  cues: Array<{                   // minimal slice — timing only, no text
    startMs: number;
    endMs: number;
  }>;
  analysisVersion: number;        // current SYNC_ANALYSIS_VERSION constant;
                                  // stamped onto the result by the analyzer
}
```

**Source of each field:**

| Field | Source |
|---|---|
| `durationMs` | Computed by `SynchronizationService`: `Math.floor(projects.duration_seconds * 1000)` |
| `firstCueStartMs` | `subtitle_documents.cues_json[0].startMs` (null if `cueCount === 0`) |
| `lastCueEndMs` | `subtitle_documents.cues_json[cueCount-1].endMs` (null if `cueCount === 0`) |
| `cueCount` | `projects.subtitle_cue_count` |
| `cues` | `subtitle_documents.cues_json` mapped to `{startMs, endMs}` only |
| `analysisVersion` | `SYNC_ANALYSIS_VERSION` constant imported by `SynchronizationService` |

**Important:** `cues` contains only `{startMs, endMs}`. The full `text`, `lines`, and `index` fields
from `cues_json` are NOT passed to the analyzer. The analyzer is not permitted to deserialize or read
any field beyond timing.

The analyzer is a **pure function**: same input → same output. No IO, no `Date.now()`, no randomness.

---

## 2. Pre-analysis guards

These checks execute first, before any threshold check. A guard failure returns immediately with
`check_failed`; no further checks run.

### Guard A — Invalid video duration

```
if (durationMs <= 0) {
  return {
    syncStatus: 'check_failed',
    syncWarnings: [],
    syncErrorCode: 'INVALID_VIDEO_DURATION',
    syncAnalysisVersion: analysisVersion
  };
}
```

Covers: `durationMs === 0` (zero-duration video metadata from FFprobe), negative `durationMs`
(corrupt container metadata). Both are incoherent range bounds; no cue can be meaningfully checked.
This case should be rare — `SynchronizationService` checks `durationSeconds != null` before calling
the analyzer, but a zero or negative `durationSeconds` passes that null guard and reaches here.

### Guard B — No cues to analyze

```
if (cueCount === 0) {
  return {
    syncStatus: 'check_failed',
    syncWarnings: [],
    syncErrorCode: 'NO_CUES_TO_ANALYZE',
    syncAnalysisVersion: analysisVersion
  };
}
```

Covers: subtitle document exists but contains zero cues. `SynchronizationService` checks
`subtitle_status in ['ready', 'ready_with_warnings']`, which should imply at least one cue, but
the guard is a safety net for corrupt or empty subtitle documents that passed parsing.

After Guard B passes, `firstCueStartMs` and `lastCueEndMs` are guaranteed non-null. All subsequent
checks may treat them as `number`.

---

## 3. Check 1 — Cues outside video range

**Purpose:** Detect cues that extend beyond the video's end boundary by more than the allowed tail
tolerance, or that start before the video begins.

**Algorithm:**

```
let outOfRangeCount = 0;

for (const cue of cues) {
  if (cue.endMs > durationMs + TAIL_TOLERANCE_MS || cue.startMs < 0) {
    outOfRangeCount++;
  }
}

if (outOfRangeCount > 0) {
  warnings.push({
    code: 'CUES_OUTSIDE_VIDEO_RANGE',
    outOfRangeCount
  });
}
```

**Soft boundary:** Cues ending in the half-open interval `(durationMs, durationMs + TAIL_TOLERANCE_MS]`
are NOT out-of-range. This accommodates subtitle authoring tools that round timestamps past the
container end. Only cues ending beyond `durationMs + TAIL_TOLERANCE_MS` are flagged.

**Negative start:** A cue with `startMs < 0` is a sub-case of `CUES_OUTSIDE_VIDEO_RANGE` — it is
counted in `outOfRangeCount` using the same code. There is no separate code for negative starts.

**Flat form:** The warning carries only the count (`outOfRangeCount`). No cue examples, no reason
strings, no nested detail objects are persisted. This keeps `sync_warnings_json` small and stable.

---

## 4. Check 2 — Subtitle span too short

**Purpose:** Detect subtitle files that cover only a small fraction of the video, which may indicate
a mismatched source, a partial subtitle file, or a global offset that shifted most content out of
range.

**Algorithm:**

```
// Skip sparse subtitle files — short span is expected when there are few cues
if (cueCount >= 10) {
  const subtitleSpanMs = lastCueEndMs - firstCueStartMs;
  const spanRatio = subtitleSpanMs / durationMs;

  if (spanRatio < SPAN_SHORT_RATIO) {
    warnings.push({
      code: 'SUBTITLE_SPAN_SHORT',
      spanRatio
    });
  }
}
```

**Skip condition:** If `cueCount < 10`, the check is skipped entirely. Sparse subtitle files
(interview captions, chapter markers, forced narrative titles) legitimately span a small fraction
of video. The 10-cue minimum prevents false positives on these cases. No warning is emitted for
sparse files, regardless of their span.

**`subtitleSpanMs` definition:** `lastCueEndMs − firstCueStartMs`. This is the span from the first
cue's start to the last cue's end — the "covered window" of the subtitle file. It does not measure
total dialogue duration (which would require summing individual cue durations).

---

## 5. Check 3 — Subtitle span too long

**Purpose:** Detect subtitle files where the last cue extends well beyond the video's end boundary,
indicating the subtitle was produced for a longer version of the video.

**Algorithm:**

```
if (lastCueEndMs > durationMs * SPAN_LONG_RATIO) {
  warnings.push({
    code: 'SUBTITLE_SPAN_LONG',
    spanRatio: lastCueEndMs / durationMs
  });
}
```

**No skip condition:** This check runs regardless of `cueCount`. A single cue ending at 200% of
video duration is still anomalous.

**Relationship to Check 1:** Check 3 uses `SPAN_LONG_RATIO * durationMs` as the threshold, which
is a much looser boundary than `durationMs + TAIL_TOLERANCE_MS` used by Check 1. Both checks may
fire simultaneously for the same project:

- `CUES_OUTSIDE_VIDEO_RANGE` fires if any cue ends beyond `durationMs + 2000 ms`
- `SUBTITLE_SPAN_LONG` fires if the last cue ends beyond `durationMs * 1.2`

On a 90-minute video (`durationMs = 5,400,000`), `CUES_OUTSIDE_VIDEO_RANGE` fires at `5,402,000 ms`
and `SUBTITLE_SPAN_LONG` fires at `6,480,000 ms`. Between these two thresholds, only
`CUES_OUTSIDE_VIDEO_RANGE` is emitted.

---

## 6. Check 4 — Large tail gap

**Purpose:** Detect cases where the subtitle content ends well before the video ends — the video
has a long unsubbed tail, which may indicate incomplete subtitle coverage or an earlier cut of the
video.

**Algorithm:**

```
// Skip if span-short already flagged — tail gap is a redundant signal in that case
if (!warnings.some(w => w.code === 'SUBTITLE_SPAN_SHORT')) {
  const tailGapMs = durationMs - lastCueEndMs;

  if (tailGapMs > LARGE_TAIL_GAP_MS) {
    warnings.push({
      code: 'LARGE_TAIL_GAP',
      gapMs: tailGapMs
    });
  }
}
```

**Skip condition:** If `SUBTITLE_SPAN_SHORT` was already emitted, `LARGE_TAIL_GAP` is skipped.
A subtitle that covers less than 50% of video will almost always have a large tail gap — emitting
both is redundant and adds noise. `SUBTITLE_SPAN_SHORT` is the primary signal; `LARGE_TAIL_GAP`
is the secondary detail.

**Negative tail gap:** If `lastCueEndMs > durationMs`, `tailGapMs` is negative. The threshold
check `tailGapMs > LARGE_TAIL_GAP_MS` is never true for a negative value, so no warning is
emitted. Cues past the video end are handled by Check 1.

---

## 7. Check 5 — Late subtitle start

**Purpose:** Detect cases where the first subtitle cue appears unusually late in the video, which
may indicate a global offset has pushed all cues forward, or that the subtitle file belongs to a
version of the video with a longer pre-dialogue opening sequence.

**Algorithm:**

```
const lateStartThresholdMs = durationMs * LATE_START_THRESHOLD_RATIO;

if (firstCueStartMs > lateStartThresholdMs) {
  warnings.push({
    code: 'LATE_SUBTITLE_START',
    startRatio: firstCueStartMs / durationMs
  });
}
```

**No skip condition:** This check runs independently of other results. It may co-occur with
`LARGE_TAIL_GAP` (subtitle shifted forward), `SUBTITLE_SPAN_SHORT` (subtitle covers only a central
window), or `CUES_OUTSIDE_VIDEO_RANGE` (subtitle shifted so far forward that it extends past the
video end).

**Interpretive note (for UI display, not analysis logic):** A late start does not definitively
indicate a sync problem. Long intros (music videos, documentary openings, extended cold opens) may
legitimately have no dialogue for the first 15%+ of video. The warning prompts human review; it
does not imply correction is needed.

---

## 8. Result assembly

After all checks complete (guards passed, checks 1–5 run):

```typescript
interface SyncWarning {
  code: SyncWarningCode;
  outOfRangeCount?: number;  // CUES_OUTSIDE_VIDEO_RANGE only
  spanRatio?: number;        // SUBTITLE_SPAN_SHORT, SUBTITLE_SPAN_LONG only
  gapMs?: number;            // LARGE_TAIL_GAP only
  startRatio?: number;       // LATE_SUBTITLE_START only
}

interface SyncAnalysisResult {
  syncStatus: 'timing_ok' | 'needs_review' | 'check_failed';
  syncWarnings: SyncWarning[];
  syncErrorCode?: string;  // only when check_failed (guard failures: INVALID_VIDEO_DURATION, NO_CUES_TO_ANALYZE)
  syncAnalysisVersion: number;
}

const syncStatus = syncWarnings.length === 0 ? 'timing_ok' : 'needs_review';

return {
  syncStatus,
  syncWarnings,
  syncAnalysisVersion: analysisVersion
};
```

**`timing_ok`:** All 5 checks completed with no warnings emitted. No structural timing anomaly
was detected given the current threshold values.

**`needs_review`:** One or more checks emitted a warning. The warnings are persisted as
`sync_warnings_json`. The user should inspect them but no automatic action is taken.

**`check_failed`:** Only returned from pre-analysis guards (section 2). Never returned from the
check loop itself — all check-loop warnings result in `needs_review`, not `check_failed`.

**Warning ordering:** Warnings are appended in the order checks are performed (Check 1 → 2 → 3
→ 4 → 5). The order is stable and deterministic.

---

## 9. Error handling

Any unhandled exception thrown during analysis (e.g., malformed cue array, JSON deserialization
error in cues passed from service, arithmetic on unexpected undefined values) must be caught by
the analyzer's top-level try/catch:

```typescript
try {
  // ... guard checks and analysis loop
} catch (err: unknown) {
  log.error('[SynchronizationAnalyzer] unexpected error', {
    code: 'SYNC_ANALYZER_INTERNAL_ERROR',
    // do NOT log err.message — may contain user file path or subtitle content
  });
  return {
    syncStatus: 'check_failed',
    syncWarnings: [],
    syncErrorCode: 'SYNC_ANALYZER_INTERNAL_ERROR',
    syncAnalysisVersion: analysisVersion
  };
}
```

**Raw exception messages must NOT be surfaced to the renderer.** The renderer receives only the
structured `SyncWarning` array. Internal error details are logged to the main-process log only,
and must not include subtitle text or file paths.

**`SynchronizationService` also wraps the `analyze()` call** in a try/catch. If `analyze()` throws
(rather than returning a `check_failed` result), the service catches the error, persists
`check_failed` with `SYNC_ANALYZER_INTERNAL_ERROR`, and returns a structured error to the IPC
handler. The IPC handler returns a structured `{success: false, error: 'SYNC_ANALYZE_FAILED'}`
response — not a raw exception.

---

## 10. What this analysis does NOT do

This list is binding. Any capability listed here is explicitly out of M3 scope.

- **Does not verify dialogue matches.** There is no comparison between subtitle text and spoken
  audio. Sync is purely structural (cue timing vs. video duration), not content-based.
- **Does not detect per-speaker sync.** No speaker-level timing analysis.
- **Does not correct offsets.** The analyzer detects possible problems; it does not modify, compute,
  or suggest a correction offset. No offset value is computed, even informally.
- **Does not re-read subtitle files.** All input data comes from the database (`projects` table
  and `subtitle_documents` table). No file system access occurs at analysis time.
- **Does not run FFprobe.** `durationMs` is computed from the already-persisted
  `projects.duration_seconds`. No new video inspection occurs.
- **Does not detect global offset.** A consistent forward or backward shift across all cues is
  deferred to M4+. M3 does not compute `approximateShiftMs` or any equivalent offset estimate.
  The `POSSIBLE_OFFSET` informational code defined in earlier drafts is NOT implemented in M3.
- **Does not distinguish hard vs. soft warnings.** All warnings result in `needs_review`. The
  hard/soft classification defined in M3_TIMING_MODEL.md is superseded for M3 by this simpler
  model. Hard/soft may be reintroduced in M4 if needed.
- **Does not trigger automatically.** The analyzer is called only when the user triggers the
  check explicitly via IPC.

---

## 11. Threshold table

All five constants are exported from `src/main/services/sync/synchronizationAnalyzer.ts`.
A change to any constant increments `SYNC_ANALYSIS_VERSION`, invalidating prior results.

| Constant | Value | Unit | Used In | Rationale |
|---|---|---|---|---|
| `TAIL_TOLERANCE_MS` | `2000` | ms | Check 1 | Cues ending up to 2 s past video end are routine (authoring tool rounding, minor re-encodes). Beyond 2 s, the mismatch is too large to be rounding. |
| `SPAN_SHORT_RATIO` | `0.5` | ratio | Check 2 | Subtitle span below 50% of video is unusual for full-program content. Threshold is conservative — most full-program subtitles span 70–95%. Below 50% warrants human review. Check skipped when `cueCount < 10`. |
| `SPAN_LONG_RATIO` | `1.2` | ratio | Check 3 | Subtitle extending past 120% of video suggests it was authored for a longer cut. 20% tolerance accommodates minor duration differences between encode versions (e.g., theatrical vs. streaming cuts). |
| `LATE_START_THRESHOLD_RATIO` | `0.15` | ratio | Check 5 | First cue after 15% of video (≈13 min on a 90-min film) is suspicious. Most programs have dialogue within the first 15%. A later start suggests a global offset or wrong source. |
| `LARGE_TAIL_GAP_MS` | `10000` | ms | Check 4 | Last cue followed by >10 s of video is flagged. 10 s accommodates end-credit timing, post-dialogue music, and fade-out conventions. Beyond 10 s suggests incomplete coverage or a cut mismatch. |

### Boundary semantics

- **At threshold (equal):** no warning. Thresholds are exclusive upper/lower bounds.
  - Example: `tailGapMs === 10000` → no `LARGE_TAIL_GAP` warning.
  - Example: `tailGapMs === 10001` → `LARGE_TAIL_GAP` emitted.
- **Multiple warnings:** all applicable warnings are emitted; they are independent. A single
  project may have all 5 warning codes simultaneously.
- **Skip conditions** (Check 2 skip on `cueCount < 10`; Check 4 skip on `SUBTITLE_SPAN_SHORT`)
  are documented in their respective check sections above.
