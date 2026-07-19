# M3 Acceptance Criteria — Subtitle Synchronization Check

Version: 1.0
Status: Planning
Milestone: M3

---

## Overview

This document defines testable acceptance criteria for the M3 subtitle synchronization check feature. Every criterion must be verifiable by a human or automated test. No vague language is used. Criteria are numbered sequentially within each group.

---

## AC-M3-001 — State Machine Correctness

**AC-M3-001.1**
Given a project where `durationSeconds` is NULL in the database,
when the sync panel is rendered,
then it displays the `not_available` state and no check button is shown.

**AC-M3-001.2**
Given a project where `subtitleStatus` is NOT one of `['ready', 'ready_with_warnings']`,
when the sync panel is rendered,
then it displays the `not_available` state regardless of video duration.

**AC-M3-001.3**
Given a project where `durationSeconds` is non-null AND `subtitleStatus` is `'ready'` or `'ready_with_warnings'`
AND `sync_status` is NULL or has never been set,
when the sync panel is rendered,
then it displays the `ready_to_check` state with a "Check Timing" button visible.

**AC-M3-001.4**
Given a project that has had a successful sync check with no warnings,
when the sync panel is rendered,
then `sync_status` is `timing_ok` and the panel shows a success indicator with no warning list.

**AC-M3-001.5**
Given a project that has had a successful sync check that produced one or more warnings,
when the sync panel is rendered,
then `sync_status` is `needs_review` and the panel shows the warning list.

**AC-M3-001.6**
Given a project where the sync check IPC call returned an error or the analyzer threw an exception,
when the sync panel is rendered,
then `sync_status` is `check_failed` and the panel shows a failure message.

**AC-M3-001.7**
Given a project with `sync_status` of `timing_ok` or `needs_review`,
when the project's video is re-inspected (i.e., `inspectedAt` is updated to a timestamp after `sync_checked_at`),
then on the next project load the sync panel displays the `stale` state.

**AC-M3-001.8**
Given a project with `sync_status` of `timing_ok` or `needs_review`,
when the project's subtitles are re-parsed (i.e., `subtitleParsedAt` is updated to a timestamp after `sync_checked_at`),
then on the next project load the sync panel displays the `stale` state.

---

## AC-M3-002 — Analysis Correctness

**AC-M3-002.1**
Given a subtitle file where any cue has `endMs > durationMs + 2000` (TAIL_TOLERANCE_MS),
when a sync check is run,
then a `CUES_OUTSIDE_VIDEO_RANGE` warning is generated.

**AC-M3-002.2**
Given a subtitle file where the maximum cue `endMs` equals `durationMs + 1000` (within the 2000ms tolerance),
when a sync check is run,
then NO `CUES_OUTSIDE_VIDEO_RANGE` warning is generated.

**AC-M3-002.3**
Given a subtitle file with at least 10 cues where the span (lastCueEndMs - firstCueStartMs) is less than 50% of `durationMs`,
when a sync check is run,
then a `SUBTITLE_SPAN_SHORT` warning is generated.

**AC-M3-002.4**
Given a subtitle file with fewer than 10 cues where the span is less than 50% of `durationMs`,
when a sync check is run,
then NO `SUBTITLE_SPAN_SHORT` warning is generated (sparse file guard active).

**AC-M3-002.5**
Given a subtitle file where `lastCueEndMs > durationMs * 1.2` (SPAN_LONG_RATIO),
when a sync check is run,
then a `SUBTITLE_SPAN_LONG` warning is generated.

**AC-M3-002.6**
Given a subtitle file where `durationMs - lastCueEndMs > 10000` (LARGE_TAIL_GAP_MS) and cue count >= 10,
when a sync check is run,
then a `LARGE_TAIL_GAP` warning is generated.

**AC-M3-002.7**
Given a subtitle file where the first cue starts after `durationMs * 0.15` (LATE_START_THRESHOLD_RATIO),
when a sync check is run,
then a `LATE_SUBTITLE_START` warning is generated.

**AC-M3-002.8**
Given a subtitle file where all cues are within bounds, span is between 50% and 120% of video duration, tail gap is within 10s, and first cue starts within the first 15% of video,
when a sync check is run,
then `sync_status` is set to `timing_ok` and zero warnings are generated.

---

## AC-M3-003 — Persistence and Restart

**AC-M3-003.1**
Given a project where a sync check has been run,
when the Electron application is quit and restarted,
then the `sync_status`, `sync_warnings_json`, and `sync_checked_at` values are identical to those before restart.

**AC-M3-003.2**
Given a project with `sync_status` of `timing_ok`,
when the app is restarted,
then the sync panel continues to show the `timing_ok` state without requiring a re-check.

**AC-M3-003.3**
Given a project with `sync_status` of `needs_review` and N warnings stored,
when the app is restarted,
then the sync panel shows `needs_review` and the same N warnings with the same codes and metadata as before restart.

---

## AC-M3-004 — UI Truthfulness

**AC-M3-004.1**
When a passing check result is displayed, the UI must show language equivalent to "timing check passed" or "structural check passed."
The strings "in sync," "synchronized," or any language implying audio/dialogue alignment MUST NOT appear anywhere in the sync panel.

**AC-M3-004.2**
The number of warnings displayed in the panel header or badge must exactly equal the length of the `syncWarningsJson` array stored in the database. Any mismatch is a defect.

**AC-M3-004.3**
Each warning code displayed in the panel must include a human-readable label (not the raw code string). For example, `CUES_OUTSIDE_VIDEO_RANGE` must render as something readable such as "Cues extend beyond video end."

**AC-M3-004.4**
A `CUES_OUTSIDE_VIDEO_RANGE` warning display must include the count of out-of-range cues (e.g., "3 cues extend beyond video end"). Displaying the warning without the count is a defect.

**AC-M3-004.5**
The `sync_checked_at` timestamp must be displayed as a relative time string (e.g., "2 hours ago") rather than a raw Unix milliseconds value or ISO string.

**AC-M3-004.6**
From the moment the user clicks "Check Timing" until the IPC response is received, the sync panel must display a loading/in-progress indicator. The check button must be disabled during this time.

---

## AC-M3-005 — Security Boundary

**AC-M3-005.1**
The `sync:checkForProject` IPC handler must reject any `projectId` value that is not a valid UUID (RFC 4122 format). The rejection must return a structured error, not throw an unhandled exception.

**AC-M3-005.2**
The `sync_warnings_json` value stored in the database must contain only warning codes, numerical metadata (counts, ratios, durations), and timestamps. It must contain no subtitle text, cue content, or user-provided strings.

**AC-M3-005.3**
The renderer must receive only structured warning objects (code + numerical metadata). Raw cue data, cue text, and cue arrays must not be transmitted over IPC or stored in renderer state.

---

## AC-M3-006 — Test Coverage

**AC-M3-006.1**
The `SynchronizationAnalyzer` unit test file must contain at least 15 distinct test cases covering the five warning checks, boundary conditions, and edge cases.

**AC-M3-006.2**
The `SynchronizationService` unit test file must contain at least 5 distinct test cases covering: project not found, null durationSeconds, subtitle not ready, normal check flow, and analyzer exception handling.

**AC-M3-006.3**
The E2E test suite for sync must contain at least 8 test scenarios covering all 6 sync states, the click-to-result flow, and warning list rendering.

**AC-M3-006.4**
The visual regression test suite for sync must contain at least 3 scenarios: `timing_ok` state, `needs_review` state with warnings, and `not_available` state. Each scenario must be captured in both light and dark theme where applicable.

**AC-M3-006.5**
All 6 sync states (`not_available`, `ready_to_check`, `timing_ok`, `needs_review`, `stale`, `check_failed`) must be exercised in at least one E2E test each.
