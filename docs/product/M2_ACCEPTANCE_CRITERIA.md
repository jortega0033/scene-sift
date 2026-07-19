# M2 — Acceptance Criteria

**Spec date:** 2026-07-19

All criteria are testable. No vague language. Each criterion references a user story and maps to a specific test.

---

## AC-M2-001 — SRT parse: valid file produces correct cue count

**US:** US-03, US-04
**Given:** Project has subtitle_path pointing to a valid 10-cue SRT file at known location.
**When:** `subtitle.parseForProject(projectId)` is invoked.
**Then:**
- `subtitle_status` = `'ready'`
- `subtitle_cue_count` = 10
- Each cue has correct `startMs`, `endMs`, `text`
- `subtitle_last_cue_end_ms` = last cue's endMs

---

## AC-M2-002 — WebVTT parse: valid file produces correct cue count

**US:** US-03, US-04
**Given:** Valid 8-cue WebVTT file with `WEBVTT` header.
**When:** Parse invoked.
**Then:**
- `subtitle_status` = `'ready'`
- `subtitle_cue_count` = 8
- `source_format` = `'vtt'`

---

## AC-M2-003 — SRT timestamp parsed to correct milliseconds

**US:** US-03
**Given:** SRT cue with timestamp `00:01:23,456 --> 00:01:25,789`.
**When:** Parse invoked.
**Then:**
- `startMs` = 83456
- `endMs` = 85789

---

## AC-M2-004 — WebVTT timestamp with optional hours

**US:** US-03
**Given:** VTT cue with timestamp `01:23.456 --> 01:25.789` (no hours).
**When:** Parse invoked.
**Then:**
- `startMs` = 83456
- `endMs` = 85789

---

## AC-M2-005 — SRT tags stripped from cue text

**US:** US-03
**Given:** SRT cue text `<i>Hello</i> <b>world</b>`.
**When:** Parse invoked.
**Then:** `cue.text` = `'Hello world'` (no tags).

---

## AC-M2-006 — WebVTT voice tags stripped

**US:** US-03
**Given:** VTT cue text `<v Speaker>Hello there</v>`.
**When:** Parse invoked.
**Then:** `cue.text` = `'Hello there'`.

---

## AC-M2-007 — File size limit enforced before read

**US:** US-05
**Given:** File at subtitle_path has `stat().size` = 2,097,153 (1 byte over limit).
**When:** Parse invoked.
**Then:**
- No `readFile` called
- `subtitle_status` = `'parse_failed'`
- `subtitle_parse_error` = `'SUBTITLE_FILE_TOO_LARGE'`

---

## AC-M2-008 — Cue count truncation at 10,000

**US:** US-03
**Given:** SRT file containing 15,000 valid cues.
**When:** Parse invoked.
**Then:**
- `subtitle_cue_count` = 10,000
- `subtitle_status` = `'ready_with_warnings'`
- Warning with code `'CUES_TRUNCATED'` present

---

## AC-M2-009 — Cue text truncated at 2,048 chars

**US:** US-03
**Given:** SRT cue with text 3,000 chars long.
**When:** Parse invoked.
**Then:**
- `cue.text.length` = 2,048
- Warning code `'CUE_TEXT_TRUNCATED'` present

---

## AC-M2-010 — Unsupported format returns correct state

**US:** US-06
**Given:** `subtitlePath` ends in `.ass`.
**When:** Parse invoked.
**Then:**
- `subtitle_status` = `'unsupported'`
- `subtitle_parse_error` = `'SUBTITLE_UNSUPPORTED_FORMAT'`
- No `readFile` called

---

## AC-M2-011 — Missing file returns correct state

**US:** US-07
**Given:** `subtitlePath` points to a file that does not exist (`stat()` throws ENOENT).
**When:** Parse invoked.
**Then:**
- `subtitle_status` = `'missing'`
- `subtitle_parse_error` = `'SUBTITLE_FILE_NOT_FOUND'`

---

## AC-M2-012 — WebVTT without WEBVTT header fails fatally

**US:** US-05
**Given:** File with `.vtt` extension, no `WEBVTT` header on first line.
**When:** Parse invoked.
**Then:**
- `subtitle_status` = `'parse_failed'`
- `subtitle_parse_error` = `'SUBTITLE_INVALID_FORMAT'`

---

## AC-M2-013 — Subtitle state persists across DB close/reopen

**US:** US-13
**Given:** Project parsed successfully (status = `'ready'`). DB closed and reopened.
**When:** `listProjects()` called.
**Then:**
- `subtitle_status` = `'ready'`
- `subtitle_cue_count` = N (original cue count)
- `subtitle_last_cue_end_ms` = original value
- `subtitle_parsed_at` = original timestamp

---

## AC-M2-014 — Subtitle document persists across DB close/reopen

**US:** US-13
**Given:** Project parsed successfully. DB closed and reopened.
**When:** `getSubtitleDocument(projectId)` called.
**Then:** Returns complete `SubtitleDocument` with correct `cues`, `warnings`, `summary`, `schemaVersion: 1`.

---

## AC-M2-015 — Subtitle replace clears old cue document

**US:** US-09
**Given:** Project has `subtitle_status = 'ready'` with cue document.
**When:** Subtitle file replaced (new path stored).
**Then:**
- `subtitle_status` = `'selected'`
- `subtitle_cue_count` = null
- `getSubtitleDocument(projectId)` returns null

---

## AC-M2-016 — Delete project cascades subtitle document

**US:** (implied by US-10)
**Given:** Project has `subtitle_status = 'ready'` with cue document.
**When:** `deleteProject(projectId)` called.
**Then:**
- `subtitle_documents` row for `projectId` does not exist
- No orphan row after project deletion

---

## AC-M2-017 — Re-parse failure removes old cue document

**US:** US-12
**Given:** Project in `ready` state with cue document. Source file modified to be invalid.
**When:** Re-parse invoked.
**Then:**
- `subtitle_status` = `'parse_failed'`
- `getSubtitleDocument(projectId)` returns null (old stale cues removed)

---

## AC-M2-018 — Zero-duration cue warning

**US:** US-11
**Given:** SRT cue with `startMs == endMs`.
**When:** Parse invoked.
**Then:** Warning code `'ZERO_DURATION_CUE'` present.

---

## AC-M2-019 — Negative-duration cue warning

**US:** US-11
**Given:** SRT cue with `endMs < startMs`.
**When:** Parse invoked.
**Then:** Warning code `'NEGATIVE_DURATION_CUE'` present. Cue still included.

---

## AC-M2-020 — IPC: non-UUID projectId rejected

**Security**
**Given:** IPC call to `subtitle:parseForProject` with `{ projectId: 'not-a-uuid' }`.
**When:** Handler processes input.
**Then:** Returns structured error. No DB query executed.

---

## AC-M2-021 — Path traversal canonicalized

**Security**
**Given:** `subtitlePath` stored as `'/safe/dir/../../../etc/passwd'`.
**When:** Parse invoked. File at resolved path does not exist.
**Then:** `path.resolve()` canonicalizes to `/etc/passwd`. `stat()` fails (file missing in test) → `subtitle_status = 'missing'`. No unresolved path used in `readFile`.

---

## AC-M2-022 — Cue text not logged

**Security**
**Given:** Subtitle file with cue text `"John Doe's SSN is 123-45-6789"`.
**When:** Parse invoked.
**Then:** No logger output contains the cue text. Log contains only `{ cueIndex, startMs, endMs, warningCode }` for any warning.

---

## AC-M2-023 — Renderer displays human-readable error, not raw code

**US:** US-05, US-06, US-07
**Given:** Subtitle in `parse_failed` state with `subtitle_parse_error = 'SUBTITLE_PARSE_ERROR'`.
**When:** ProjectsPage renders.
**Then:** UI shows human-readable message (from `formatSubtitleError()`). Raw code string `'SUBTITLE_PARSE_ERROR'` not visible to user.

---

## AC-M2-024 — Renderer displays subtitle summary when ready

**US:** US-04
**Given:** Subtitle in `ready` state with `cueCount = 42`, `lastCueEndMs = 125000`.
**When:** ProjectsPage renders.
**Then:**
- Displays "42 cues" (or similar)
- Displays "2:05" (formatted from 125000 ms)
- Does NOT display raw ms value

---

## AC-M2-025 — Browser QA: all 7 subtitle states covered

**QA**
**Given:** Browser QA mode (`VITE_SCENESIFT_BROWSER_QA=1`).
**When:** Each subtitle fixture state selected.
**Then:** Each of the 7 states (`not_selected`, `selected`, `parse_failed`, `unsupported`, `missing`, `ready`, `ready_with_warnings`) renders without errors. No undefined/null rendering bugs.

---

## AC-M2-028 — subtitle:selectForProject sets selected state

**US:** US-01, US-02, US-09
**Given:** Project with `subtitle_status = 'not_selected'`. User selects a `.srt` file in the native dialog.
**When:** `subtitle:selectForProject({ projectId })` is invoked and user completes dialog selection.
**Then:**
- `subtitle_status` = `'selected'`
- `subtitlePath` = the path selected via native dialog
- No parse initiated
- `subtitle_cue_count` = null

---

## AC-M2-029 — subtitle:clearForProject removes subtitle

**US:** US-10
**Given:** Project with `subtitle_status = 'ready'`, cue document present.
**When:** `subtitle:clearForProject({ projectId })` is invoked.
**Then:**
- `subtitle_status` = `'not_selected'`
- `subtitlePath` = null
- All subtitle columns null
- `getSubtitleDocument(projectId)` returns null

---

## AC-M2-030 — No auto-parse on subtitle select

**US:** US-01, US-02, US-03
**Given:** Project with no subtitle.
**When:** `subtitle:selectForProject` completes with a file selection.
**Then:** `subtitle_status` = `'selected'`. No parse occurs. `subtitle_cue_count` = null. Parse button visible in UI.

---

## AC-M2-031 — Retry from parse_failed re-runs parse

**US:** US-08
**Given:** Project with `subtitle_status = 'parse_failed'`. Source file has been fixed at the stored path.
**When:** `subtitle:parseForProject(projectId)` invoked again.
**Then:** Parse runs against same stored path. If file is now valid: `subtitle_status = 'ready'`, `subtitle_cue_count` = N.

---

## AC-M2-032 — Re-parse success updates cue document

**US:** US-12
**Given:** Project with `subtitle_status = 'ready'`, `subtitle_cue_count = 10`. Source file edited to add 5 cues.
**When:** `subtitle:parseForProject(projectId)` invoked.
**Then:**
- `subtitle_status` = `'ready'`
- `subtitle_cue_count` = 15
- `getSubtitleDocument(projectId)` returns updated document with 15 cues (old doc replaced)

---

## AC-M2-033 — Project switching shows correct subtitle state per project

**US:** US-14
**Given:** Project A with `subtitle_status = 'ready'`, Project B with `subtitle_status = 'not_selected'`.
**When:** User selects Project A, then Project B, then Project A again.
**Then:** Project A shows `ready` state. Project B shows `not_selected` state. No cross-contamination.

---

## AC-M2-034 — Zero-cue parse is parse_failed

**US:** US-15
**Given:** Valid `.srt` file containing only malformed cue blocks (all timestamp lines fail regex — 0 cues produced).
**When:** Parse invoked.
**Then:**
- `subtitle_status` = `'parse_failed'`
- `subtitle_parse_error` = `'SUBTITLE_PARSE_ERROR'`
- Renderer displays: "Subtitle file was valid but contained no readable cues." (or equivalent human-readable message)

---

## AC-M2-035 — No dangerouslySetInnerHTML in renderer for subtitle content

**Security**
**Given:** Any subtitle state with cue content.
**When:** Automated governance test or ESLint runs.
**Then:** No `dangerouslySetInnerHTML` found in `src/renderer/features/projects/` files that could receive subtitle cue data. Lint or governance check exits 0.

---

## AC-M2-036 — subtitle path at project creation sets selected state

**US:** US-01
**Given:** Project created via `project:create` with `subtitle.path` set to a valid path
(obtained from a prior `dialog:selectSubtitleFile` call during project creation flow).
**When:** Project retrieved via `project:get(projectId)`.
**Then:** `subtitle_status = 'selected'`, `subtitlePath` = the provided path.

---

## AC-M2-026 — BOM stripped before parse

**Given:** UTF-8 BOM (EF BB BF) at start of SRT file.
**When:** Parse invoked.
**Then:** Parse succeeds. First cue index parsed correctly (BOM not treated as cue index).

---

## AC-M2-027 — CRLF normalized before parse

**Given:** SRT file with CRLF line endings.
**When:** Parse invoked.
**Then:** Parse succeeds. Cue count and text identical to same file with LF endings.
