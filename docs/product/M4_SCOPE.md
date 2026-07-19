# M4 — Video Preview Workspace: Scope

Date: 2026-07-20
Status: PLANNING

---

## Goal

Give users an in-app video player synchronized with subtitle cue display so they can review timing before clip export.

---

## In scope

| Feature | Notes |
|---|---|
| Embedded video player (HTMLVideoElement) | H.264 MP4, WebM codecs via Chromium |
| Subtitle cue overlay synchronized to playback position | Text from DB, displayed at correct timestamps |
| Playback controls: play/pause, seek, speed | Speed: 0.5/0.75/1.0/1.25/1.5/2.0 |
| Jump-to-cue navigation from cue list | Click cue → seek to startMs |
| Custom Electron protocol for local file serving | `local://` scheme, no raw file path to renderer |
| `video:getCues` IPC channel | Returns cue list for the project |
| Preview page in renderer (4th nav route) | Accessible when project.status='ready' |
| Player state machine (6 states) | not_ready, loading, ready, playing, paused, error |
| Error display for unsupported codecs | Human-readable message, no raw errors |

---

## Explicitly out of scope for M4

| Feature | Reason |
|---|---|
| Full-screen mode | Deferred to M5 |
| mpv/external player via IPC | Deferred; HTMLVideoElement covers H.264 MVP |
| Transcript view | M5 |
| Clip selection / in-out markers | M6 |
| Audio waveform visualization | M7+ |
| AI clip suggestions | M6+ |
| Global offset correction | Post-M4 |
| Subtitle editing | Out of scope for MVP |
| Multi-subtitle track | Post-M4 |
| Keyboard shortcuts beyond space/arrow | Deferred |

---

## Prerequisites

- Project status: `ready` (video inspected, mediaMetadata present)
- Subtitle status: `ready` OR `ready_with_warnings` (subtitle parsed, cues in DB)
- Both prerequisites shown as reasons when preview is unavailable

---

## Codec note

HTMLVideoElement in Chromium supports H.264 MP4, WebM (VP8/VP9/AV1), and Ogg Theora. H.265/MKV are NOT supported. Users with H.265 or MKV files will see a "Format not supported" error state. This is a known M4 limitation — not a bug.

---

## Not implemented status

The following remain unimplemented after M4:
- Clip selection and time-bound review (M6)
- Transcript generation (M5)
- AI clip suggestions (M6+)
- Publishing / FFmpeg render pipeline (M7+)
