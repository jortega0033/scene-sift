# M3 User Stories: Subtitle Timing Check

## Overview

These stories cover the complete set of user-facing behaviors for M3 structural subtitle timing analysis. All analysis is local, explicit-trigger only, and produces warning labels — not synchronization claims.

---

## Story 1: Pre-check before clip generation

**As a** clip editor with a ready video source and parsed subtitles,  
**I want to** run a timing check before investing time in clip generation,  
**so that** I can catch obvious timing mismatches at the project setup stage rather than discovering them in the output.

**Acceptance criteria**:
1. When both `videoSource.durationSeconds` and `subtitleDocument.cueCount` are present and non-zero, the sync status panel displays "Timing check available" with an active "Check Timing" button.
2. After clicking "Check Timing", the result is displayed within 3 seconds (on a project with up to 10,000 cues) and the button returns to an enabled state with a "Re-check" label.

---

## Story 2: Re-inspect video after codec change

**As a** user who re-ran video inspection after changing the source file (e.g., codec conversion),  
**I want to** see that my previous timing check result is now marked as outdated,  
**so that** I do not act on a result that no longer reflects the current video.

**Acceptance criteria**:
1. When `video_sources.duration_seconds` changes after a sync check was completed, the sync status transitions to `stale` on the next read without requiring a user action.
2. The stale panel displays the previous result dimmed, a "Timing check is outdated" label, and a primary "Re-check" button.

---

## Story 3: Re-parse subtitle after editing

**As a** user who re-parsed a subtitle file after manual edits to the source,  
**I want to** see that my previous timing check is stale,  
**so that** I know I need to re-run the check before trusting the previous result.

**Acceptance criteria**:
1. When `subtitle_documents.cues_json` changes (new parse result) after a sync check was completed, the sync status transitions to `stale` on the next read.
2. The panel clearly communicates "Video or subtitles changed since last check" as the reason for staleness.

---

## Story 4: Cues outside video range

**As a** user whose subtitle file contains cues that extend beyond the video's end time,  
**I want to** see a clear warning with a count of the affected cues,  
**so that** I can decide whether to trim or offset the subtitles before proceeding.

**Acceptance criteria**:
1. When one or more cue end times exceed `durationSeconds`, the sync status is `needs_review` and a `CUES_OUTSIDE_VIDEO_RANGE` warning is shown with an accurate count of affected cues.
2. The count in the warning matches the actual number of cues whose end time exceeds video duration (off-by-one errors are a defect).

---

## Story 5: Subtitle span much shorter than video

**As a** user whose subtitle file covers only a fraction of the video's total duration,  
**I want to** see a warning with the coverage ratio,  
**so that** I can determine whether the subtitle file is incomplete or the video has a long silent tail.

**Acceptance criteria**:
1. When the span from the first cue start to the last cue end is less than 50% of `durationSeconds`, a `SUBTITLE_SPAN_SHORT` warning is shown with the ratio expressed as an integer percentage.
2. The displayed percentage is calculated as `(lastCueEnd - firstCueStart) / durationSeconds * 100`, rounded to the nearest integer.

---

## Story 6: Subtitle span longer than video

**As a** user whose subtitle file extends past the video's end time,  
**I want to** see a clear warning,  
**so that** I know the subtitle file is longer than the video and may be misaligned.

**Acceptance criteria**:
1. When the last cue end time exceeds `durationSeconds`, a `SUBTITLE_SPAN_LONG` warning is shown.
2. The warning is distinct from `CUES_OUTSIDE_VIDEO_RANGE` — it indicates the overall span, not individual out-of-range cues (both warnings may appear together when applicable).

---

## Story 7: Large empty tail at end of video

**As a** user whose video has a long period of silence after the last subtitle cue ends,  
**I want to** see a tail gap warning with the gap duration,  
**so that** I can consider whether the video has an unexpectedly long ending or the subtitles end too early.

**Acceptance criteria**:
1. When `durationSeconds - lastCueEnd` exceeds 10 seconds, a `LARGE_TAIL_GAP` warning is shown with the gap expressed in whole seconds.
2. A gap of exactly 10 seconds does not trigger the warning; 10.001 seconds does (boundary is exclusive at 10s).

---

## Story 8: Very late subtitle start (possible offset)

**As a** user whose subtitles do not start until well into the video,  
**I want to** see a late-start warning with the offset percentage,  
**so that** I can identify whether an offset was accidentally applied to the subtitle file.

**Acceptance criteria**:
1. When `firstCueStart / durationSeconds` exceeds 10%, a `LATE_SUBTITLE_START` warning is shown with the offset expressed as an integer percentage of video duration.
2. The warning does not appear when the first cue starts within the first 10% of video duration.

---

## Story 9: Timing check passes with no warnings

**As a** user who ran a timing check and received no warnings,  
**I want to** see a clear positive result that the check found no issues,  
**so that** I have reasonable confidence the subtitle timing is structurally plausible before proceeding.

**Acceptance criteria**:
1. When no timing warnings are triggered, the sync status is `timing_ok` and the panel displays "Timing check passed" and "No structural timing issues detected".
2. The UI does not use the phrases "in sync", "perfectly synchronized", or any language that claims the timing is correct — only that no structural issues were detected.

---

## Story 10: Check unavailable due to missing data

**As a** user who has not yet completed video inspection or subtitle parsing,  
**I want to** see a clear explanation of why the timing check is not yet available,  
**so that** I know exactly what step to complete before the check becomes available.

**Acceptance criteria**:
1. When both video and subtitle data are absent, the panel displays "Inspect video and parse subtitles first".
2. When only subtitle data is absent (video is inspected), the panel displays "Parse subtitles first". When only video data is absent, the panel displays "Inspect video first". The message is specific to whichever prerequisite is missing.

---

## Story 11: Check fails and user retries

**As a** user who ran a timing check that failed due to corrupt data or an unexpected error,  
**I want to** see a human-readable explanation of the failure and a way to retry,  
**so that** I am not left with a broken state and no way to proceed.

**Acceptance criteria**:
1. When the analysis fails (e.g., cues_json fails Zod parsing, durationSeconds is invalid), the sync status is `check_failed` and the panel displays a human-readable reason — not a raw error code or exception message.
2. A "Retry" button is available and re-triggers the check when clicked.

---

## Story 12: First-time prompt to run check

**As a** user who has set up a project with video and subtitle data but has never run a timing check,  
**I want to** see a prompt encouraging me to run the check,  
**so that** I know the feature exists and am guided to use it before advancing to clip generation.

**Acceptance criteria**:
1. When `syncStatus` is `ready_to_check` (data is available, check has never been run), the panel displays an explanatory subtext — "Run to detect timing issues between subtitles and video" — alongside the "Check Timing" button.
2. The panel does not auto-run the check on project load — the check only starts on explicit user click of "Check Timing".

---

## Non-stories (explicitly out of scope for M3)

The following are intentionally excluded and must not be implemented:

- Automatic sync check on project open or data change.
- Audio analysis, waveform comparison, or any signal processing.
- AI-assisted subtitle alignment or correction.
- Network calls to any external service for timing validation.
- Claims that subtitles are "in sync" or "correctly synchronized".
- Subtitle editing or correction tooling.
- Batch sync checks across multiple projects.
