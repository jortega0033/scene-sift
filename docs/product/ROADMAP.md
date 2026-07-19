# SceneSift Product Roadmap

Source: GPT AI as PO/PM, provided by user 2026-07-19 for future reference.

**Rule**: One milestone at a time. Every milestone follows:
Plan/spec → implement on feature branch → targeted specialist review → full validation → acceptance audit → human merge.

**Current status**: M1 CLOSED. M2 CLOSED. M3 CLOSED (overnight branch 2026-07-20).
**Next**: M4 planning → implementation-readiness verdict → governed implementation on feature branch.

---

## M1 — Project Media Ingestion and Inspection

Load a video source file into a project and verify it is a valid video using FFprobe metadata.

**Status: CLOSED** — merged to main 2026-07-19 via owner override. See `docs/product/M1_ACCEPTANCE_AUDIT.md` Section 11 for merge record.

**Exit criteria met**: Create project → auto-inspect → display codec/resolution/duration/fps/bitrate/filesize → status=ready. Inspection failure shows human-readable error. Metadata persists across app restart.

---

## M2 — Subtitle Parsing and Attachment

**Goal**: Parse SRT/WebVTT subtitle files and attach them to projects.

**Status: CLOSED** — merged to main 2026-07-19 via owner override. See `docs/product/M2_ACCEPTANCE_AUDIT.md` for merge record.

**Scope (M2 only)**:
- In-process SRT + WebVTT parser (ASS deferred)
- 7-state subtitle state machine persisted to SQLite
- Subtitle summary panel in ProjectsPage renderer
- No sync check (M3), no preview (M4), no AI (M6+)

**Exit criteria met**: Select subtitle → parse succeeds → cue count + duration displayed → persists across restart. All 7 subtitle states render correctly. Parse failure shows human-readable error. 223 unit / 29 E2E / 13 visual tests pass.

---

## M3 — Subtitle Synchronization Check

**Goal**: Detect structural subtitle timing problems against the project video and present truthful, actionable synchronization warnings without building a subtitle editor.

**Status: CLOSED** — implemented + audited + merged to overnight branch 2026-07-20. All 30 ACs pass. See `docs/product/M3_ACCEPTANCE_CRITERIA.md`.

**Confirmed scope:**
- Analysis of persisted subtitle cue timeline vs. persisted video metadata
- Structural timing checks (cues outside duration, large tail, span mismatch, late start)
- Synchronization state machine with 6 states and restart persistence
- No global offset detection, no per-cue editing, no video preview, no AI, no audio analysis

**Exit criteria**: `docs/product/M3_ACCEPTANCE_CRITERIA.md` (AC-M3-001 through AC-M3-006).

---

## M4 — Video Preview Workspace

**Goal**: In-app video preview player synchronized with subtitle cue display.

**Key features**:
- Embedded video player (HTMLVideoElement or mpv via IPC)
- Subtitle cue overlay synchronized to playback position
- Playback controls: play/pause, seek, speed
- Jump-to-cue navigation from subtitle list

**Exit criteria**: Open project with ready+subtitle → preview workspace loads → subtitle cues display during playback.

---

## M5 — Transcript Preparation

**Goal**: Export a clean transcript from subtitle cues for downstream processing.

**Key features**:
- Strip formatting tags from subtitle text
- Merge adjacent cues from same speaker (configurable gap threshold)
- Export as plain text or structured JSON
- Preview transcript in-app before export

**Exit criteria**: Project with parsed subtitles → generate transcript → export as .txt or .json.

---

## M6 — AI Provider Infrastructure

**Goal**: Integrate configurable AI provider (Anthropic/OpenAI) for clip candidate generation.

**Key features**:
- Settings UI for API key entry (stored in OS keychain, never on disk)
- Provider selection (Anthropic Claude / OpenAI GPT)
- Model selection per provider
- Connection test / key validation
- Rate limit and quota enforcement before calls
- Consent gate: explicit user opt-in before any AI API call
- Privacy policy display (what data is sent)

**Exit criteria**: Enter and validate API key → connection test passes → provider config persists.

---

## M7 — Clip Candidate Generation

**Goal**: Use AI to identify clip-worthy segments from the transcript.

**Key features**:
- Send transcript (stripped of PII per privacy policy) to configured AI provider
- Structured output: list of candidate segments with start/end timestamps, score, reason
- Display candidate list in project workspace
- User can accept, reject, or adjust each candidate

**Exit criteria**: Project with transcript + AI provider configured → generate candidates → list displayed with timestamps and reasons.

---

## M8 — Candidate Review Workflow

**Goal**: Structured review UI for accepting/rejecting clip candidates.

**Key features**:
- Card-per-candidate layout with accept/reject/skip controls
- Batch accept/reject
- Filter by score threshold
- Candidate notes (user annotation)
- Review state persists to project record

**Exit criteria**: Generate candidates → review all → accepted candidates advance to clip timing editor.

---

## M9 — Clip Timing Editor

**Goal**: Fine-tune clip in/out points before rendering.

**Key features**:
- Timeline scrubber with video preview
- Drag handles for clip start/end
- Frame-accurate adjustment
- Preview clip trim before committing
- Adjusted timing written back to candidate record

**Exit criteria**: Accept candidate → open timing editor → adjust handles → save adjusted timing.

---

## M10 — Subtitle Editing

**Goal**: Edit subtitle cues assigned to a clip before rendering.

**Key features**:
- Display cues within clip time range
- Edit cue text inline
- Adjust cue timing
- Add or remove cues
- Changes scoped to clip, not source subtitle file

**Exit criteria**: Open clip subtitle editor → modify cues → save → changes reflected in clip record.

---

## M11 — Vertical Composition Settings

**Goal**: Configure output format for vertical (9:16) clip rendering.

**Key features**:
- Output resolution selection (1080×1920, 720×1280)
- Blur background vs crop background
- Subtitle burn-in position (bottom, center)
- Font, size, color for burned subtitles
- Settings persist per project

**Exit criteria**: Configure vertical layout → settings saved → used in render step.

---

## M12 — FFmpeg Clip Rendering

**Goal**: Render accepted clips to video files using FFmpeg.

**Key features**:
- Build FFmpeg argument array from clip record + composition settings
- Execute FFmpeg with timeout and output size limit
- Progress reporting via stderr parsing
- Output file written to project output directory
- Render result (success/fail/output path) persisted to clip record

**Exit criteria**: Render one accepted clip → output file created → metadata written to DB.

---

## M13 — Render Queue and Recovery

**Goal**: Queue multiple clips for sequential rendering with error recovery.

**Key features**:
- Queue UI showing pending/rendering/complete/failed clips
- Sequential render execution (one at a time to avoid resource contention)
- Retry failed renders
- Cancel in-progress render
- Queue state persists across app restart

**Exit criteria**: Queue 3+ clips → render sequentially → app restart → queue state restored.

---

## M14 — Export and Project Completion

**Goal**: Package rendered clips for export/publishing handoff.

**Key features**:
- Copy rendered clips to user-selected export directory
- Generate clip manifest (JSON: filename, source project, timestamps, subtitle text)
- Mark project as complete
- Archive or delete project record (user choice)

**Exit criteria**: Render complete → export to directory → manifest written → project marked complete.

---

## Optional / Post-M14

### M15 — Publishing Integration

Platform-specific upload: TikTok/Instagram/YouTube direct upload via platform API with caption generation from clip metadata.

### M16 — Batch Projects

Process multiple episodes in a single session with shared settings templates.

### M17 — Custom AI Prompts

User-editable prompt templates for candidate generation. Saved per project or globally.

### M18 — Clip Analytics

Track view counts and engagement for published clips (via platform API polling).

### M19 — Subtitle Translation

AI-assisted subtitle translation for multi-language clip output.

### M20 — Cloud Sync (Opt-in)

Optional encrypted project backup/sync. Requires explicit user consent and privacy review.
