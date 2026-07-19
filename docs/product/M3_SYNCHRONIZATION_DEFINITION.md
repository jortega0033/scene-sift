# M3 — Synchronization: Definition and Boundaries

**Spec date:** 2026-07-19

---

## What M3 can and cannot establish

M3 operates on two inputs only: video duration (from FFprobe metadata) and subtitle cue timestamps (from M2 parse). No audio is processed. No speech recognition occurs. No transcript is available.

### What M3 CAN detect

| Check | Detection method |
|---|---|
| Cues with timestamps outside video range | Any cue where `startMs < 0` or `endMs > durationMs + TAIL_TOLERANCE_MS` |
| Cues before video start | Any cue where `startMs < 0` |
| Subtitle span much shorter than video | `(lastCueEndMs - firstCueStartMs) / durationMs < SPAN_SHORT_RATIO` |
| Subtitle span extending beyond video | `lastCueEndMs > SPAN_LONG_RATIO * durationMs` |
| First cue starting suspiciously late | `firstCueStartMs / durationMs > LATE_START_THRESHOLD_RATIO` |
| Large gap between last cue and video end | `durationMs - lastCueEndMs > LARGE_TAIL_THRESHOLD_MS` |
| Consistent cross-cue shift pattern | Most cues fall outside expected range in the same direction (informational only) |

### What M3 CANNOT prove

- That subtitle text matches the spoken dialogue
- That subtitle text appears at the moment the corresponding words are spoken
- That a constant global offset would improve alignment
- That the subtitle was produced for this specific video file
- That the audio track corresponds to the video container duration
- That the subtitle language matches the spoken language

**M3 cannot prove that a subtitle is synchronized to dialogue.** It can only check that subtitle timestamps are structurally plausible relative to video duration metadata. A timing check that passes means the cue timestamps are consistent with the video length — it says nothing about whether the words appear at the right moments.

---

## Terminology — what M3 must and must not say

The UI and all user-facing copy must follow this convention without exception.

| Situation | Allowed phrasing | Forbidden phrasing |
|---|---|---|
| No structural problems detected | "Timing check passed" | "In sync", "Synchronized", "Perfectly synchronized" |
| Soft warnings only | "Timing check passed with warnings" | "Mostly in sync", "Synchronization issues detected" |
| Hard structural problems | "Timing needs review" | "Out of sync", "Desynchronized", "Broken" |
| Possible offset pattern detected | "Possible timing offset — review recommended" | "Offset detected", "Synchronized after offset" |
| Prerequisites not met | "Sync check not available" | "Not synchronized", "Cannot synchronize" |
| Check not yet run | "Not checked" | "Unknown sync state", "Sync status unavailable" |
| Stale result | "Sync check outdated — re-check recommended" | "Out of sync", "Sync check failed" |

The word "synchronized" must not appear in the UI as a positive assertion. It may appear in feature labels ("Synchronization Check", "Run sync check", "Sync panel") because these name the feature, not its result. It must not appear as a result label (e.g., "Synchronized ✓" is forbidden).

---

## Definitions

### `durationMs`

```
durationMs = Math.floor(durationSeconds * 1000)
```

Integer milliseconds derived from the FFprobe-reported container duration. See `M3_TIMING_MODEL.md` for the conversion rationale and null/zero handling.

`durationMs` is not computed when `durationSeconds` is null. A null `durationSeconds` places the project in `not_available` sync state immediately — no analysis runs.

### Video range

The valid time range for subtitle cues is `[0, durationMs]`, both endpoints inclusive.

```
within range: startMs >= 0  AND  endMs <= durationMs
outside range: startMs < 0   OR   endMs > durationMs
```

A cue ending exactly at `durationMs` is within range — the subtitle ends precisely at the video end.
A cue ending at `durationMs + 1` is technically outside range but within `TAIL_TOLERANCE_MS` (2000 ms), so it generates a warning rather than an error. See `M3_TIMING_MODEL.md` for threshold values.

### Subtitle span

```
subtitleSpanMs = lastCueEndMs - firstCueStartMs
```

The duration from the start of the first subtitle cue to the end of the last subtitle cue. This is NOT video duration, and it is NOT expected to equal video duration. A subtitle that covers only a portion of a video can still be correctly timed.

`subtitleSpanMs` is meaningful only when the cue document has at least one cue. If `cueCount === 0`, analysis cannot proceed (this should not occur in practice because M2 treats zero-cue parse as `parse_failed`, which disqualifies the project from M3 analysis).

### Analysis checks vs parser warnings

These are two distinct and non-overlapping taxonomies. They must never be mixed in the UI, in error messages, or in DB storage.

| Property | Parser warnings (M2) | Sync checks (M3) |
|---|---|---|
| Type name | `ParseWarningCode` | `SyncWarningCode` |
| Emitted by | `SubtitleNormalizer` | `SynchronizationAnalyzer` |
| Stored in | `subtitle_documents.warnings_json` | `projects.sync_warnings_json` |
| Concern | Subtitle file internal structure | Subtitle timestamp range vs video duration |
| Requires video metadata | No | Yes |
| Example code | `OVERLAPPING_CUES` | `SPAN_SHORT` |
| UI location | Subtitle panel warnings section | Sync panel warnings section |

A `ParseWarning` answers: "Is the subtitle file internally valid?"
A `SyncWarning` answers: "Do the subtitle timestamps fall within a plausible range for this video?"

Both may be present simultaneously on a project. They are displayed in separate UI sections and must never be aggregated into a single warning list.

---

## Sync warning vs sync error

Within M3's sync taxonomy, warnings and errors have distinct semantics:

**Sync warning** (result: `check_passed_with_warnings`): A structural condition that is unusual but can be intentional. The timing is not definitively wrong. Examples:
- Subtitle span covers less than 50% of video — could be a partial subtitle for a segment, a foreign-language subtitle for one character only, or a documentary interview subtitle.
- First cue starts after 15% of video — could be a film with a long pre-dialogue opening sequence.

**Sync error** (result: `check_failed`): A structural condition that is very unlikely to be intentional and strongly suggests the subtitle does not correspond to this video. Examples:
- One or more cues end more than 2 seconds past the video end — the subtitle references timestamps that do not exist in the video.
- Subtitle span exceeds 120% of video duration — the subtitle timeline is substantially longer than the video, indicating a different cut or an entirely different media file.

The boundary between warning and error is set by the tolerance thresholds defined in `M3_TIMING_MODEL.md`. All thresholds are adjustable constants documented with rationale.

---

## Why silence between subtitles is NOT a sync problem

Subtitles do not cover 100% of a video's duration. Gaps between cues — periods with no subtitle text on screen — are expected and correct for all properly authored subtitle files. A film with music, action sequences, or pauses between dialogue will have subtitle gaps that may last seconds or minutes.

M3 does not flag:

- Any gap between consecutive cues (normal subtitle structure)
- A video with content after the last subtitle cue, up to `LARGE_TAIL_THRESHOLD_MS`
- A first cue that starts after the video beginning, up to `LATE_START_THRESHOLD_RATIO` of video duration
- Any internal period in the subtitle timeline where no cue exists

Silence between subtitles is structural intent, not a timing error. Flagging intra-subtitle gaps would produce false positives for nearly every correctly authored subtitle file.

---

## The epistemic limit

M3's "timing check passed" means: **the subtitle cue timestamps are structurally consistent with the video duration.** It does not mean:

- The subtitles are accurate transcriptions
- The subtitles appear at the correct moments relative to dialogue
- The subtitles were produced for this specific video file
- The subtitles will render correctly for any viewer

"Timing check passed" is a necessary but not sufficient condition for genuine synchronization. Genuine synchronization — in the sense that a viewer experiences subtitles appearing at the right moment — can only be confirmed by:
1. A human watching the video with subtitles
2. Audio/transcript analysis comparing subtitle text to speech timestamps (out of M3 scope)

M3 communicates this limit through its UI copy. The phrase "timing check passed" is intentionally narrower than "synchronized" or "in sync". Implementation must not allow any UI copy, tooltip, or notification to exceed this epistemic boundary.
