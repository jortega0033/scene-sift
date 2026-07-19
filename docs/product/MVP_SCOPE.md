# SceneSift — MVP Scope

Date: 2026-07-19

---

## What MVP is

A user can:
1. Create a project by selecting a local video file (and optionally a subtitle file and output directory)
2. See video metadata: duration, resolution, codec, fps (after FFprobe inspection)
3. Read subtitle entries from the associated subtitle file
4. Select subtitle entries to clip
5. Generate clips via FFmpeg
6. Review output files

This is the complete clip workflow for a single video. No network, no AI, no collaboration.

---

## What MVP is NOT

| Excluded | Why |
|---|---|
| AI-assisted clip selection | No AI providers wired. Runtime AI policy requires explicit consent + audit. Post-MVP feature. |
| Remote publishing / upload | No cloud integrations. Local-first is a core design constraint. |
| Subtitle translation | No translation services. |
| Batch export across projects | Cross-project workflows are post-MVP. |
| Collaborative review | Local-only by design. |
| Timeline editing / trim handles | Visual timeline is post-MVP; clips defined by subtitle segment boundaries only. |
| Video preview / playback | No video player in Electron renderer. Post-MVP. |
| Audio-only clips | Video clips only for MVP. |
| Custom clip time bounds | Clips are bounded by subtitle entry timestamps. Manual overrides are post-MVP. |
| Render history / audit | Queue shows current session; no persistent history UI. |
| App auto-update | No updater in scope. |

---

## User-facing capability boundary (MVP)

A user with a locally stored `.mp4` (or other supported format) and an optional `.srt` subtitle file can create a project, inspect its media, associate subtitle-defined clips, and render them to local disk via FFmpeg.

The app never sends any user media, paths, or subtitle content to a remote service.

---

## Not-a-bug behaviors during MVP development

These are correct behaviors during the milestone sequence, not bugs to fix:

| Behavior | Correct for milestone |
|---|---|
| Projects stay `draft` until Milestone 1 (Inspection) is implemented | M1 target |
| Subtitle file stored as path only, not parsed | M2 target |
| "Candidate generation" disclaimer visible | M4 target |
| Demo job never executes FFmpeg | M4 target |
| Clip list does not exist | M3 target |

---

## MVP acceptance definition

MVP is accepted when:
- A user can create a project, inspect its video, parse its subtitles, select clips, and generate output files
- All governance gates pass (`pnpm validate:full`)
- No regression in adversarial governance test suite
- All milestones (M1–M4) merged and independently verified
