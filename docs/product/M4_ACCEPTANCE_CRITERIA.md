# M4 — Video Preview Workspace: Acceptance Criteria

Date: 2026-07-20
Status: PLANNING

---

## AC-M4-001 — Preview navigation

### AC-M4-001.1
Preview nav item is visible in the left nav bar when any project is selected.

### AC-M4-001.2
Clicking Preview nav item renders the PreviewPage.

### AC-M4-001.3
When no project is selected, PreviewPage shows `preview-not-available` with message indicating a project must be selected.

### AC-M4-001.4
When selected project lacks video inspection (`status !== 'ready'`), `preview-not-available` mentions "Video inspection complete" as a requirement.

### AC-M4-001.5
When selected project has video inspected but no subtitle (`subtitleStatus` not ready), `preview-not-available` mentions "Subtitle parsed" as a requirement.

---

## AC-M4-002 — Video playback

### AC-M4-002.1
When prerequisites are met, `preview-video` element is present and `src` is set to the `local://` URL.

### AC-M4-002.2
Play button (`preview-play-pause`) starts playback; `preview-current-time` updates as video plays.

### AC-M4-002.3
Pause button stops playback at current position; seeking then clicking Play resumes from new position.

### AC-M4-002.4
Speed picker (`preview-speed-picker`) changes playback speed; all 6 values (0.5, 0.75, 1.0, 1.25, 1.5, 2.0) are available.

### AC-M4-002.5
Seek bar (`preview-seek-bar`) reflects current position; clicking/dragging seeks video.

### AC-M4-002.6
-5s button seeks backward; +5s seeks forward; does not seek past 0 or past duration.

### AC-M4-002.7
When video ends, player returns to `ready` state (paused at 0 or end, ready to replay).

---

## AC-M4-003 — Subtitle overlay

### AC-M4-003.1
`preview-subtitle-overlay` is present in DOM when player is in `ready`, `playing`, or `paused` state.

### AC-M4-003.2
When `playing`, subtitle text for the current playback position appears in the overlay. (Verified via QA fixture with known cue timestamps.)

### AC-M4-003.3
When no cue is active at current position, overlay is empty (no text displayed).

### AC-M4-003.4
Subtitle overlay text is escaped — no HTML tags from cue text are rendered as markup.

---

## AC-M4-004 — Cue list

### AC-M4-004.1
`preview-cue-list` is visible when prerequisites are met and cues are available.

### AC-M4-004.2
Cue list shows all cues with correct timestamp format (HH:MM:SS.mmm or similar).

### AC-M4-004.3
Clicking a cue item seeks video to that cue's `startMs`.

### AC-M4-004.4
The active cue (by current playback position) is highlighted in the cue list (`preview-cue-item-active`).

### AC-M4-004.5
When there are no cues (subtitle has 0 cues or no subtitle), cue list is empty or shows "No cues" message.

---

## AC-M4-005 — Error handling

### AC-M4-005.1
When the video file cannot be loaded (HTMLVideoElement `error` event), `preview-error` is displayed with a human-readable message.

### AC-M4-005.2
Error message does NOT contain raw error codes, file paths, or internal stack traces.

### AC-M4-005.3
`preview-retry` button is visible in error state; clicking it re-initializes the player.

---

## AC-M4-006 — Security (protocol handler)

### AC-M4-006.1
The `video:getPlaybackUrl` IPC handler rejects non-UUID `projectId` with a structured error (not raw Zod/stack trace in production).

### AC-M4-006.2
The `local://` protocol handler rejects requests with non-UUID path segments (returns 404, no file access).

### AC-M4-006.3
The `local://` protocol handler returns 404 when the project's videoPath no longer exists on disk.

### AC-M4-006.4
Raw file paths are NOT exposed to the renderer at any point (URL contains only `local://video/{projectId}`).

### AC-M4-006.5
No `shell: true`, `nodeIntegration: true`, `contextIsolation: false`, or `webSecurity: false` changes introduced.

---

## AC-M4-007 — Test coverage

### AC-M4-007.1
`tests/main/video/videoService.test.ts` exists with tests covering: getPlaybackUrl (valid UUID, invalid project, missing file), getCues (valid project, no subtitle document).

### AC-M4-007.2
`tests/main/video/localVideoProtocol.test.ts` OR equivalent coverage in videoService tests: valid request → resolves file, invalid UUID → 404, missing file → 404.

### AC-M4-007.3
`tests/renderer/preview/` OR `tests/renderer/videoFormatters.test.ts`: covers time formatting (HH:MM:SS.mmm), cue filtering (active cue at time T).

### AC-M4-007.4
`tests/e2e/preview.spec.ts` exists with at least: not-available state, video loads with subtitle overlay visible, cue list rendered, click-to-seek verified.

### AC-M4-007.5
`tests/visual/preview.visual.spec.ts` exists with at least 3 snapshots: not-available, player-ready, player-with-cue-active.

### AC-M4-007.6
IPC contract test (`tests/main/ipc-contracts.test.ts`) covers `VIDEO_GET_CUES` and `VIDEO_GET_PLAYBACK_URL` channels.

---

## AC-M4-008 — Design system compliance

### AC-M4-008.1
No hardcoded hex/px values in preview components — all tokens from `src/renderer/tokens/`.

### AC-M4-008.2
All interactive components have keyboard support and ARIA roles per UX specification.

### AC-M4-008.3
`pnpm design:validate` exits 0.
