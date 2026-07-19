# SceneSift — MVP Roadmap

Date: 2026-07-19

---

## MVP definition

MVP = a user can load a video file, see its metadata, associate subtitle segments with it, select segments to clip, and generate clips via FFmpeg. No AI assistance, no cloud publishing, no batch workflows.

---

## Current state

Feature development not started. Governance milestone complete. Full validation green.

---

## Milestone map

### Milestone 0 — Governance layer (complete)

Delivered: `.claude/` governance stack, CI, adversarial test suite, design system, QA infrastructure.

Verdict: READY for feature development (2026-07-19).

---

### Milestone 1 — Project Media Ingestion and Inspection (first vertical slice)

**Goal**: A project created with a video file has media metadata. The user can see duration, resolution, codec, and fps before selecting clips.

**User-facing outcome**: "I created a project for episode-04.mp4 and can see it's 42:17, 1920×1080, H.264, 23.97fps."

**Scope** (see `FIRST_VERTICAL_SLICE.md` for full detail):
- FFprobe media metadata extraction (`-show_format -show_streams -print_format json`)
- New DB migration: `0001_media_inspection.sql` (duration, width, height, videoCodec, fps, bitRate, fileSizeBytes, inspectedAt, inspectionError)
- New `projectStatus` value: `ready` (post-inspection)
- New IPC channel: `project:inspect`
- New preload bridge method: `projects.inspect(projectId)`
- Renderer: display metadata in project detail panel
- Error handling: `inspection_error` visible to user, project stays `draft`
- QA fixtures updated with media metadata fields

**Risk level**: 3 (touches `src/main/services/ffmpeg/`, `src/preload/`, `src/shared/ipc/`, `src/database/migrations/`)

**Requires**: human review + independent verifier before merge

---

### Milestone 2 — Subtitle Parsing

**Goal**: If a project has a subtitle file, parse it and display the entries.

**User-facing outcome**: "I can see all 847 subtitle entries for episode-04.srt, each with start time, end time, and text."

**Scope** (to be specified in a future planning run):
- `.srt` parser (no external parser library — parse in-house or use approved dep)
- `.vtt` parser
- New DB table: `subtitle_entries` (project_id, index, start_ms, end_ms, text)
- New IPC channel: `project:parseSubtitles`
- Renderer: subtitle entry list in project detail

**Risk level**: 2 (subtitle parsing is pure text, no external process)

**Dependency**: Milestone 1 complete (project has media duration for timeline alignment)

---

### Milestone 3 — Clip Selection

**Goal**: User can select subtitle entries to clip and see the proposed clip time bounds.

**User-facing outcome**: "I selected 12 subtitle entries. I can see the clip bounds (42:13–42:28) and the subtitle text before generating."

**Scope** (to be specified):
- Clip selection model: select one or more contiguous subtitle entries per clip
- Clip persistence: new `clips` DB table
- New IPC channels: `clip:create`, `clip:list`, `clip:delete`
- Renderer: clip list alongside subtitle entries

**Risk level**: 2

**Dependency**: Milestone 2 complete

---

### Milestone 4 — Clip Generation (FFmpeg)

**Goal**: User can generate clips from selected subtitle entries. FFmpeg executes with -ss/-to flags.

**User-facing outcome**: "I clicked Generate on my 12 clips. They all exported to /exports/episode-04/. I can open them in Finder."

**Scope** (to be specified):
- FFmpeg -ss/-to execution per clip
- Worker thread for encoding (no main thread block)
- Real progress tracking via FFmpeg stderr parsing
- Output file existence verification
- `render_jobs` table updates: real status transitions
- Error surfacing (FFmpeg exit code, stderr)

**Risk level**: 3 (FFmpeg execution, filesystem writes, worker threads)

**Dependency**: Milestone 3 complete

---

### Post-MVP — Export and Review

| Feature | Priority | Notes |
|---|---|---|
| Open output folder in Finder | High | `shell.openExternal` on output directory |
| Clip rename | Medium | Update clip record name |
| Batch re-generate | Low | Re-run failed jobs |
| AI-assisted clip selection | Post-MVP | Runtime AI policy required |
| Remote publishing | Post-MVP | No cloud APIs in scope |

---

## Critical path

```
[Governance] → [Media Inspection] → [Subtitle Parsing] → [Clip Selection] → [Clip Generation]
    done             M1                    M2                    M3                  M4
```

Every milestone is a prerequisite for the next. No parallel development until M1 is merged and green.

---

## Constraints carried forward

From `loop-constraints.md`:
- Never use `shell: true` in any FFmpeg spawn call
- Never pass user-controlled values to command string
- New IPC channels require documented purpose, input schema, output schema, error contract
- New dependencies require ADR + dependency-auditor approval
- All migrations must be reversible where possible

From `AGENTS.md`:
- Risk-3 work requires specialist reviewer + independent verification + explicit human approval
- Max 3 implementation attempts per task before escalation
