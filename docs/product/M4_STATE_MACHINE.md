# M4 — Video Preview Workspace: State Machine

Date: 2026-07-20
Status: PLANNING

---

## Player state machine

Player state is local React state (NOT persisted to DB).

### States

| State | Description | Button labels |
|---|---|---|
| `not_ready` | No project selected, or project/subtitle prerequisites not met | — (no player shown) |
| `loading` | Cues fetch in progress, video element initializing | Disabled spinner |
| `ready` | Video loaded, paused at start | "Play" |
| `playing` | Actively playing | "Pause" |
| `paused` | User paused mid-play | "Play" (resume) |
| `error` | HTMLVideoElement `error` event fired | "Retry" |

### Transitions

```
not_ready → loading       : project selected with all prerequisites met
loading → ready           : video 'canplay' event + cues loaded
loading → error           : video 'error' event
ready → playing           : user clicks Play
playing → paused          : user clicks Pause
paused → playing          : user clicks Play (resume)
paused → ready            : user clicks "Back to start"
playing → ready           : video 'ended' event (auto-stops, resets position)
* → not_ready             : project deselected or prerequisites lost
* → loading               : project changed
error → loading           : user clicks Retry
```

---

## Prerequisites check

`canPreview` = `project.status === 'ready' AND (project.subtitleStatus === 'ready' OR project.subtitleStatus === 'ready_with_warnings')`

Note: Preview is available with `ready_with_warnings` subtitle — warnings don't block viewing.

When `canPreview` is false, PreviewPage shows a "No preview available" message with reason (missing video inspection, missing subtitle).

---

## Cue display state

Cue display is derived from player state + current time:

| Player State | Cue overlay |
|---|---|
| `not_ready` | Hidden |
| `loading` | Hidden |
| `ready` (t=0) | Hidden (no cues at t=0 typically) |
| `playing` / `paused` | Active cues from timeupdate |
| `error` | Hidden |

Active cue = any cue where `currentTimeMs >= startMs AND currentTimeMs <= endMs`.

---

## Navigation state

PreviewPage does NOT add new state to `useUiStore.selectedProjectId`. It reads the already-selected project and shows it. Navigating to preview without a selected project shows `not_ready`.

---

## DB persistence

None. Player position, speed, and mute state are NOT persisted. Each session starts fresh.
