# M2 — User Stories

**Spec date:** 2026-07-19

---

## US-01 — Select subtitle during project creation

**As** a user creating a new project,
**I want** to optionally select a subtitle file during project creation,
**so that** the project remembers which subtitle file belongs to it.

**Preconditions:** Project creation dialog is open.
**Acceptance:** Subtitle file path is stored. `subtitle_status = 'selected'`. No parse initiated automatically.
**Out of scope:** Parsing. Format validation at select time. Only path is stored.

---

## US-02 — Select subtitle on existing project

**As** a user viewing a project with no subtitle selected,
**I want** to add a subtitle file to an existing project,
**so that** I can associate a subtitle with a project I created without one.

**Preconditions:** Project has `subtitle_status = 'not_selected'`.
**Acceptance:** Subtitle path updated. `subtitle_status = 'selected'`. Parse button visible.

---

## US-03 — Parse subtitle file

**As** a user viewing a project with a subtitle selected but not yet parsed,
**I want** to trigger subtitle parsing,
**so that** cue data becomes available for downstream features.

**Preconditions:** `subtitle_status = 'selected'` or re-parse from `ready/ready_with_warnings/parse_failed`.
**Acceptance:** Parse runs. Cue count, duration summary displayed. State transitions to `ready` or `ready_with_warnings` on success.

---

## US-04 — View parse success results

**As** a user whose subtitle parsed successfully,
**I want** to see a summary of the parse results (cue count, total duration, format),
**so that** I can confirm the correct subtitle was parsed.

**Preconditions:** `subtitle_status = 'ready'` or `'ready_with_warnings'`.
**Acceptance:** Summary panel shows: cue count, last cue end time formatted as MM:SS or HH:MM:SS, source format (SRT/WebVTT), parsed-at timestamp.

---

## US-05 — Handle fatal parse failure

**As** a user whose subtitle failed to parse,
**I want** to see a human-readable error message explaining what failed,
**so that** I know what to fix.

**Preconditions:** `subtitle_status = 'parse_failed'`.
**Acceptance:** Human-readable error message shown (not raw error code). Retry button visible. Replace button visible.

---

## US-06 — Handle unsupported subtitle format

**As** a user who selected an ASS or unknown-format subtitle file,
**I want** to see a clear message that the format is not supported and what formats are accepted,
**so that** I can convert or find an alternative.

**Preconditions:** `subtitle_status = 'unsupported'`.
**Acceptance:** Message: "ASS subtitle format is not yet supported. Convert to SRT or WebVTT first." (for .ass) or "Subtitle format is not supported. Supported formats: .srt, .vtt" (for other). Replace button visible.

---

## US-07 — Handle missing subtitle file

**As** a user whose subtitle file was moved or deleted after being selected,
**I want** to see a clear message that the file is no longer at the stored path,
**so that** I know to re-select it.

**Preconditions:** `subtitle_status = 'missing'`.
**Acceptance:** Message: "Subtitle file not found at the stored path." Re-select button visible. Remove button visible.

---

## US-08 — Retry parse after fixing the subtitle file

**As** a user who fixed a subtitle file that previously failed to parse,
**I want** to retry parsing without having to re-select the file,
**so that** I can iterate without repeating the file selection step.

**Preconditions:** `subtitle_status = 'parse_failed'`. User has fixed the file at the stored path.
**Acceptance:** Clicking "Retry" re-runs parse against the same stored path. State updates to new outcome.

---

## US-09 — Replace subtitle file

**As** a user who wants to use a different subtitle file for a project,
**I want** to replace the current subtitle file with a new one,
**so that** the project uses the new file's cues going forward.

**Preconditions:** Any state where subtitle is set.
**Acceptance:** New path stored. State resets to `selected`. All prior cue data cleared. Old `subtitle_documents` row deleted.

---

## US-10 — Remove subtitle

**As** a user who wants to disassociate the subtitle from a project,
**I want** to remove the subtitle entirely,
**so that** the project returns to having no subtitle.

**Preconditions:** Any state.
**Acceptance:** `subtitlePath` set to null. State = `not_selected`. All subtitle columns null. `subtitle_documents` row deleted.

---

## US-11 — View parse warnings

**As** a user whose subtitle parsed with warnings (e.g., zero-duration cues),
**I want** to see what warnings were found,
**so that** I can decide whether the subtitle quality is acceptable.

**Preconditions:** `subtitle_status = 'ready_with_warnings'`.
**Acceptance:** Warning badge or count shown. Warning details accessible (list of warning codes + human-readable descriptions). Warnings do not block use.

---

## US-12 — Re-parse a successfully parsed subtitle

**As** a user who edited the subtitle file on disk after it was already parsed,
**I want** to re-parse the file to refresh the cue data,
**so that** the in-app data reflects my edits.

**Preconditions:** `subtitle_status = 'ready'` or `'ready_with_warnings'`.
**Acceptance:** Clicking "Re-parse" runs parse again. If success: cue doc updated. If failure: old cue doc removed, state = `parse_failed`.

---

## US-13 — Subtitle state persists across restarts

**As** a user who closes and reopens the app,
**I want** all subtitle state (status, cue count, parse results) to be exactly as I left it,
**so that** I do not need to re-parse on every session.

**Preconditions:** App was closed while project had a parsed subtitle.
**Acceptance:** On app restart: `subtitle_status`, `subtitle_cue_count`, `subtitle_last_cue_end_ms`, and full `SubtitleDocument` all restored from DB. Renderer displays correct summary without re-parsing.

---

## US-14 — Subtitle state preserved when project is selected

**As** a user switching between projects,
**I want** each project to show its own subtitle state,
**so that** I can work on multiple projects with different subtitle states.

**Preconditions:** Multiple projects with different subtitle states.
**Acceptance:** Selecting Project A shows A's subtitle state. Selecting Project B shows B's subtitle state. No cross-contamination.

---

## US-15 — Zero cue result shown clearly

**As** a user whose subtitle file parsed successfully but contained no valid cues,
**I want** to see a clear message rather than blank state,
**so that** I understand the file was valid but empty.

**Preconditions:** Parse returns `ready` with `cueCount = 0` (if 0-cue result maps to `parse_failed`) or displays "0 cues found".
**Design note:** Per M2_PARSING_RULES.md, 0 cues after parse = `parse_failed` with `SUBTITLE_PARSE_ERROR`. Renderer must show: "Subtitle file was valid but contained no readable cues."
