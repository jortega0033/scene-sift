# YouTube Clipper Skill — Milestone Impact Report

**Audit commit**: f31f077ee0905c95a510a6f34bbd0c3c85b15129  
**Date**: 2026-07-20

For each SceneSift milestone M6–M14, this report states what (if anything) should change in light of the external reference audit.

---

## M6 — AI Provider Infrastructure

**Current planned approach**: Settings UI for API key entry (stored in OS keychain), provider selection (Anthropic/OpenAI), model selection, connection test, rate limit enforcement, explicit consent gate, privacy disclosure.

**External repository insight**: The skill has no real AI API key management. It relies on the Claude Code environment's ambient credentials. The `.env.example` shows `ANTHROPIC_API_KEY` as a config value stored in a plain file. No keychain, no consent gate, no provider abstraction, no rate limit, no retry.

**Recommended change**: None — the external approach is insecure and incompatible. M6 plan is already superior.

**Expected implementation savings**: None.

**New risks**: None from external repo. Pre-existing risk: keychain API varies by platform (macOS Keychain, Windows Credential Store, Linux Secret Service) — requires platform-specific implementation.

**New tests**: None required from this audit.

**Documentation files to amend**: None.

**Decision**: NO CHANGE

---

## M7 — Clip Candidate Generation

**Current planned approach**: Send transcript to AI provider, receive structured output: list of candidate segments with start/end timestamps, score, reason. Display candidate list. User can accept/reject/adjust.

**External repository insight**: SKILL.md describes semantic chapter analysis at 2-5 minute granularity with title, time_range, summary, keywords. No structured JSON schema enforced. No timestamp validation. Batch-per-chapter prompt.

**Recommended change**: MINOR AMENDMENT — explicitly require:

1. AI output must conform to a validated JSON schema:
   ```typescript
   z.object({
     chapters: z.array(z.object({
       title: z.string().max(200),
       startMs: z.number().int().nonnegative(),
       endMs: z.number().int().positive(),
       summary: z.string().max(1000),
       keywords: z.array(z.string().max(100)).max(10),
     }))
   })
   ```
2. After Zod parse, validate all timestamps against video duration.
3. Reject candidates where `endMs <= startMs` or `endMs > videoDurationMs`.
4. Store the prompt template version in DB alongside generated candidates.
5. Target granularity: 2-5 minutes per chapter (add to spec).
6. No invented dialogue, no score fabrication — candidates must be grounded in actual subtitle cue text.

**Expected implementation savings**: LOW — prompt concept saves some design time; structured schema adds validation work.

**New risks**: Risk that structured JSON output requirement increases token usage (need to test).

**New tests**:
- `chapters[n].endMs <= chapters[n].startMs` → reject
- `chapters[n].startMs >= videoDurationMs` → reject
- Zod schema validation failure → returns structured error (no raw AI output to renderer)

**Documentation files to amend**: `docs/product/M7_IMPLEMENTATION_PLAN.md` (when created) — add structured schema, validation requirements, grounding requirement, prompt template versioning.

**Decision**: MINOR AMENDMENT

---

## M8 — Candidate Review Workflow

**Current planned approach**: Card-per-candidate layout with accept/reject/skip controls, batch accept/reject, filter by score, notes, persisted review state.

**External repository insight**: The skill has no review workflow. User selects chapters in an interactive shell prompt. No persistence, no batch operations, no filtering.

**Recommended change**: None — no useful insight from external repository.

**Decision**: NO CHANGE

---

## M9 — Clip Timing Editor

**Current planned approach**: Timeline scrubber with video preview, drag handles for clip start/end, frame-accurate adjustment, preview trim, adjusted timing written back to candidate record.

**External repository insight**: `utils.py` provides pure timestamp conversion functions: `time_to_seconds`, `seconds_to_time`, `parse_time_range`. These confirm the expected test cases and edge cases.

**Recommended change**: MINOR AMENDMENT — add test cases derived from utils.py to M9 acceptance criteria:

| Input | Expected output |
|---|---|
| `"01:23:45.678"` | 5025678 ms |
| `"23:45.678"` | 1425678 ms |
| `"45.678"` | 45678 ms |
| `"00:00 - 03:15"` | (0, 195000) ms |
| `"01:30:00-01:33:15"` | (5400000, 5595000) ms |
| start == end | Invalid: start must be before end |
| start > end | Invalid |
| start < 0 | Invalid |
| end > videoDurationMs | Invalid: clamp or reject |

Also confirm: SceneSift canonical time unit is integer milliseconds. All timing editor values are stored and compared in integer milliseconds. No float arithmetic in comparisons.

**Expected implementation savings**: LOW — test cases save some specification time.

**Decision**: MINOR AMENDMENT

---

## M10 — Subtitle Editing for Selected Clip

**Current planned approach**: Display cues within clip time range, edit cue text inline, adjust cue timing, add/remove cues, changes scoped to clip record.

**External repository insight**: `extract_subtitle_clip.py` provides the most directly applicable reference:
- Cue range selection
- Timestamp rebase
- SRT serialization
- Boundary-overlap handling (currently strict-containment only — a defect that must be fixed in SceneSift's implementation)

**Recommended change**: SIGNIFICANT AMENDMENT — M10 acceptance criteria must explicitly cover:

**Cue selection algorithm (required ACs)**:
- AC: Cue entirely within clip range [clipStart, clipEnd] is included
- AC: Cue that starts before clipStart and ends within range is included, with start clamped to clipStart (overlap behavior)
- AC: Cue that starts within range and ends after clipEnd is included, with end clamped to clipEnd (overlap behavior)
- AC: Cue that spans the entire clip range [before clipStart to after clipEnd] is included, with both boundaries clamped
- AC: Cue entirely before clip range is excluded
- AC: Cue entirely after clip range is excluded
- AC: Cue that becomes zero-duration after clamping is excluded

**Timestamp rebase (required ACs)**:
- AC: All included cue start times are rebased: `rebasedStartMs = originalStartMs - clipStartMs`, minimum 0
- AC: All included cue end times are rebased: `rebasedEndMs = originalEndMs - clipStartMs`, clamped to clipDurationMs
- AC: Rebased timestamps use integer milliseconds
- AC: Rebased cues with startMs >= endMs are excluded
- AC: First cue in output starts at or near 0 ms

**SRT serialization (required ACs)**:
- AC: Output SRT uses comma-separated milliseconds (`HH:MM:SS,mmm --> HH:MM:SS,mmm`)
- AC: Output SRT uses sequential 1-based index
- AC: Empty SRT (no cues in range) is valid output (0-byte file or empty SRT with header only)

**Source preservation**:
- AC: Original SubtitleDocument (M2) is not modified
- AC: Clip subtitle is derived from M2 SubtitleDocument cues, not from re-reading the subtitle file from disk

**Expected implementation savings**: HIGH — boundary overlap algorithm, rebase algorithm, and SRT serialization are nontrivial. Reference implementation reduces design uncertainty.

**New risks**:
- R1: Floating-point rebase errors if float is used instead of integer milliseconds
- R2: Cue clipping at boundaries changes meaning (partial word at clip start/end) — this is expected behavior; document it
- R3: Bilingual cues (two-line text) must be preserved as a unit in merge

**New tests**: All ACs above become unit tests in `tests/main/subtitleClipService.test.ts`.

**Documentation files to amend**: `docs/product/M10_IMPLEMENTATION_PLAN.md` (when created) — add cue selection algorithm, boundary overlap handling, rebase algorithm, SRT serialization requirements, source preservation requirement.

**Decision**: SIGNIFICANT AMENDMENT

---

## M11 — Vertical Composition Settings

**Current planned approach**: Output resolution selection, blur vs crop background, subtitle burn-in position, font/size/color, settings persist per project.

**External repository insight**: `burn_subtitles.py` uses `FontSize=24, MarginV=30` as defaults. `force_style` supports additional parameters.

**Recommended change**: MINOR AMENDMENT — document known-good `force_style` defaults:
- FontSize: 24 (for 1080p; 18 for 720p)
- MarginV: 30 (pixels from bottom)
- Alignment: 2 (center-bottom)
- Note that FontSize should scale with output resolution

Also document that subtitle burn-in requires libass detection at startup. If libass unavailable, disable burn-in option in M11 settings UI with clear message: "Subtitle burn-in requires FFmpeg with libass support. [Install instructions]"

**Expected implementation savings**: LOW — defaults save some testing.

**Decision**: MINOR AMENDMENT

---

## M12 — FFmpeg Clip Rendering

**Current planned approach**: Build FFmpeg argument array from clip record + composition settings, execute with timeout and output size limit, progress reporting, output file to project dir, result persisted to DB.

**External repository insight**: 
- libass detection via `ffmpeg -filters | grep subtitles` — ADAPT
- Subtitle burn-in command concept: `subtitles=path:force_style='...'` — ADAPT  
- Subtitle path escaping problem documented in TECHNICAL_NOTES.md — ADAPT awareness
- Stream-copy accuracy problem — REJECT as frame-accurate strategy
- Full-video tempdir copy — REJECT; use subtitle-only staging

**Recommended change**: SIGNIFICANT AMENDMENT — M12 implementation plan must include:

1. **libass capability detection** at app startup (or lazily on first M11/M12 use):
   ```typescript
   await ffmpegService.detectLibassSupport()  // runs `[ffmpegPath, '-filters']`
   ```

2. **Subtitle path preparation**: When subtitle burn-in is requested, copy only the subtitle file to a sanitized temp path. Escape the path for the `subtitles` filter: replace `\` with `\\`, `:` with `\:`, `'` with `\'`.

3. **Rendering mode**: Default to `-c:v libx264 -crf 22 -preset medium -c:a aac` for user-facing clips. Stream copy (`-c copy`) must NOT be the default render mode.

4. **Subtitle burn-in command**:
   ```
   [ffmpegPath, '-ss', startSec, '-i', videoPath, '-t', durationSec,
    '-vf', `subtitles=${escapedSubtitlePath}:force_style='FontSize=${size},MarginV=${margin}'`,
    '-c:v', 'libx264', '-crf', '22', '-preset', 'medium',
    '-c:a', 'aac', outputPath]
   ```

5. **Clip without subtitles**:
   ```
   [ffmpegPath, '-ss', startSec, '-i', videoPath, '-t', durationSec,
    '-c:v', 'libx264', '-crf', '22', '-preset', 'medium',
    '-c:a', 'aac', outputPath]
   ```

6. **All existing SceneSift controls** must apply:
   - `timeoutMs`: 300000 (5 minutes, configurable)
   - `maxOutputBytes`: 1_048_576 (1 MB) for stderr; progress via `-progress` to named pipe or stdout
   - Argument array (no `shell: true`)
   - Explicit output path collision check before starting render
   - Output file existence + non-zero size verification after render completes
   - Structured error codes (not raw FFmpeg stderr to renderer)
   - Process kill on timeout or cancellation

7. **Progress reporting**: Parse `-progress pipe:1` output or FFmpeg stderr `time=` lines. Report `{ framesCompleted, totalFrames, speed, eta }` to renderer via IPC events.

**Expected implementation savings**: MEDIUM — command concept and libass detection save investigation time; argument construction details and safety controls are additive work.

**New tests**: 
- `renderClip` with subtitle burn-in produces output file
- `renderClip` with missing libass falls back to no-subtitle render or returns structured error
- `renderClip` with corrupted input returns structured error within timeout
- Subtitle path with spaces renders correctly
- Subtitle path with colons (Windows) renders correctly (escaping)
- Output collision returns error before starting FFmpeg

**Documentation files to amend**: `docs/product/M12_IMPLEMENTATION_PLAN.md` (when created) — add libass detection, subtitle staging, path escaping, render command design, stream-copy prohibition.

**Decision**: SIGNIFICANT AMENDMENT

---

## M13 — Render Queue and Recovery

**Current planned approach**: Queue UI with pending/rendering/complete/failed states, sequential execution, retry, cancel, restart recovery.

**External repository insight**: The skill has no queue or recovery. One-shot synchronous execution.

**Recommended change**: None — no useful insight.

**Decision**: NO CHANGE

---

## M14 — Export and Project Completion

**Current planned approach**: Copy rendered clips to user-selected export directory, generate clip manifest (JSON), mark project complete, archive/delete option.

**External repository insight**: 
- `sanitize_filename()` provides a cross-platform filename sanitization algorithm — ADAPT
- `create_output_dir()` creates per-session timestamped output directory — ADAPT concept, but use per-project directory not per-session timestamp

**Recommended change**: MINOR AMENDMENT — M14 implementation plan should include:

1. **Filename sanitization** for exported clip files:
   - Remove `[<>:"/\\|?*]` from user-provided names
   - Replace spaces with `_`
   - Collapse consecutive `_` to single `_`  
   - Strip leading/trailing dots and spaces
   - Cap at 100 characters (preserve extension)
   - Test with Unicode characters, emojis, null bytes

2. **Output directory structure** (per-project, not per-session timestamp):
   ```
   {exportDir}/{projectName}-clips/{clip-01-{sanitizedTitle}}.mp4
   ```
   Not: `youtube-clips/20260121_143022/...`

3. **Collision policy**: If output file already exists, fail with `OUTPUT_FILE_EXISTS` error. Do not overwrite silently.

**Expected implementation savings**: LOW — filename sanitization algorithm saves implementation time.

**Decision**: MINOR AMENDMENT

---

## Summary Decision Table

| Milestone | Decision |
|---|---|
| M6 | NO CHANGE |
| M7 | MINOR AMENDMENT — structured schema, validation, grounding requirement |
| M8 | NO CHANGE |
| M9 | MINOR AMENDMENT — timestamp test cases from utils.py |
| M10 | SIGNIFICANT AMENDMENT — boundary overlap, rebase, SRT serialization ACs |
| M11 | MINOR AMENDMENT — libass detection UI, force_style defaults |
| M12 | SIGNIFICANT AMENDMENT — libass detection, subtitle staging, render command design |
| M13 | NO CHANGE |
| M14 | MINOR AMENDMENT — filename sanitization, output structure |

---

## Consolidated Recommendation Document

Since M6–M14 implementation plans do not yet exist, the above amendments should be incorporated when those documents are created. The first such document to create is `docs/product/M6_IMPLEMENTATION_PLAN.md` during M6 planning.

For M10 and M12, the amendments are significant enough to elevate risk classification:
- M10 subtitle range extraction: if initially spec'd as risk-1 (renderer only), the addition of a subtitle extraction service in main process may elevate to risk-2
- M12 FFmpeg rendering: risk-3 confirmed (main-process privileged service)
