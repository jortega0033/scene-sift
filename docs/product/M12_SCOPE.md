# M12 — FFmpeg Clip Rendering: Scope

## Goal

Render an accepted clip candidate to a video file using FFmpeg. Build the full filter graph from clip timing, subtitle cues, and composition settings. Persist the render result to the DB. Expose render start/status IPC channels. Show basic render UI in the candidate detail view.

## Boundaries

**In scope:**
- ClipRenderService: resolve video path, build FFmpeg args, run FFmpeg, parse progress, persist result
- `buildFfmpegArgs` pure function: filter graph for blur/crop background × 3 subtitle positions × 5 font families × color × size
- `progressParser`: extract `out_time_ms=` from FFmpeg `-progress pipe:2` stderr
- Migration 0009: add `candidateId` FK to `render_jobs`; add `renderErrorCode TEXT`
- IPC channels: `render:startForCandidate`, `render:getJob`
- Preload bridge: `render` namespace
- Renderer: RenderButton in candidate detail + job status display (progress bar, success, error)
- QA mock for render namespace
- Unit tests: buildFfmpegArgs, progressParser, service, IPC handler, renderer component
- Subtitle temp file written to OS tmpdir and cleaned up after render

**Out of scope (deferred):**
- Cancel in-progress render (M13)
- Sequential render queue (M13)
- Export to user-selected directory (M14)
- Audio track manipulation beyond passthrough (-c:a copy or aac)
- Custom encoding presets
- Thumbnail generation

## Dependencies satisfied by M11 (verified present)

- `project_composition_settings` table with all 7 settings fields
- `clip_candidates` with `startMs`, `endMs`, `title`, `candidateStatus`
- `clip_cues` with per-candidate subtitle cues (sequenceIndex, startMs, endMs, text)
- `runCommand` with `timeoutMs` + `maxOutputBytes`
- `ffmpegService.ts` with `checkFfmpegAvailability` (provides resolved FFmpeg path)

## Non-goals

- Watermarks, intro/outro, chapters
- GPU encoding (libx264 only; software encode is the safe default)
- Resolution other than what CompositionSettings specifies
- Side-channel progress push (no IPC push events — renderer polls)
