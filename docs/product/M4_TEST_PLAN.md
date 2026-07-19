# M4 — Video Preview Workspace: Test Plan

Date: 2026-07-20
Status: PLANNING

---

## Unit tests

### `tests/main/video/videoService.test.ts`

| TC | Description | Method |
|---|---|---|
| TC-VS-001 | `getPlaybackUrl` → valid UUID + videoPath → returns `local://video/{projectId}` | mock db.getProject |
| TC-VS-002 | `getPlaybackUrl` → project not found → throws | mock returns null |
| TC-VS-003 | `getPlaybackUrl` → project exists, videoPath null → throws | mock returns project without videoPath |
| TC-VS-004 | `getCues` → valid project + subtitle doc → returns mapped VideoCueItem[] | mock db.getProject + db.getSubtitleDocument |
| TC-VS-005 | `getCues` → valid project, no subtitle doc → returns [] | mock getSubtitleDocument returns null |
| TC-VS-006 | `getCues` → project not found → throws | mock returns null |
| TC-VS-007 | `getCues` → cue text preserved verbatim (HTML entities not decoded) | mock with cue text '<b>test</b>' |

---

### `tests/main/video/localVideoProtocol.test.ts`

| TC | Description | Mock |
|---|---|---|
| TC-LP-001 | Valid UUID, file exists → returns 200, correct Content-Type (.mp4 → video/mp4) | mock db + mock fs.stat + mock createReadStream |
| TC-LP-002 | Valid UUID, Range header → returns 206, Content-Range correct | mock same + range header |
| TC-LP-003 | Non-UUID path segment → returns 404, no file access | no db call expected |
| TC-LP-004 | Valid UUID, fs.stat throws → returns 404 | mock stat to throw |
| TC-LP-005 | Valid UUID, project.videoPath null → returns 404 | mock db returns project without videoPath |
| TC-LP-006 | Path traversal attempt (non-UUID like `../../etc`) → returns 404 | no file access |
| TC-LP-007 | Unknown extension → returns 200 with `application/octet-stream` | mock with .xyz extension |
| TC-LP-008 | Range end omitted (`bytes=100-`) → serves from 100 to totalSize-1 | verify Content-Range |
| TC-LP-009 | Inverted range (`bytes=500-100`) → returns 416, no file data streamed | verify status 416 |
| TC-LP-010 | Range start equals file size (`bytes=1000-` when file is 1000 bytes) → returns 416 | out-of-range start |
| TC-LP-011 | Malformed Range header (`bytes=abc-def`) → returns 416 | parseRange returns null |
| TC-LP-012 | File is a symlink (lstat.isFile() returns false for symlink) → returns 404 | mock lstat to return symlink stat |

---

### `tests/renderer/preview/videoFormatters.test.ts`

| TC | Description | Input → Expected |
|---|---|---|
| TC-FMT-001 | `formatCueTime` — zero | 0 → `'00:00:00.000'` |
| TC-FMT-002 | `formatCueTime` — sub-minute | 65432 → `'00:01:05.432'` |
| TC-FMT-003 | `formatCueTime` — over-hour | 3_661_000 → `'01:01:01.000'` |
| TC-FMT-004 | `formatPlayerTime` — zero | 0 → `'0:00'` |
| TC-FMT-005 | `formatPlayerTime` — 65s | 65_000 → `'1:05'` |
| TC-FMT-006 | `formatPlayerTime` — 3661s | 3_661_000 → `'1:01:01'` |

---

### `tests/renderer/preview/cueUtils.test.ts` (or inside videoFormatters.test.ts)

| TC | Description |
|---|---|
| TC-CUE-001 | `getActiveCues(cues, 0)` → returns [] when no cues start at 0 |
| TC-CUE-002 | `getActiveCues(cues, 1500)` → returns cue with startMs≤1500 and endMs≥1500 |
| TC-CUE-003 | `getActiveCues(cues, 3000)` → returns [] when no active cue |
| TC-CUE-004 | `getActiveCues` → multiple overlapping cues → returns both |
| TC-CUE-005 | Boundary: cue starts at exactly currentTime → included |
| TC-CUE-006 | Boundary: cue ends at exactly currentTime → included |

---

### `tests/renderer/preview/useVideoPlayer.test.ts`

State machine transitions (Vitest, jsdom):

| TC | Transition | Trigger |
|---|---|---|
| TC-SM-001 | `not_ready` → `loading` | prerequisites become met |
| TC-SM-002 | `loading` → `ready` | `canplay` event fires |
| TC-SM-003 | `ready` → `playing` | play() called |
| TC-SM-004 | `playing` → `paused` | pause() called |
| TC-SM-005 | `paused` → `playing` | play() called |
| TC-SM-006 | `playing` → `error` | `error` event fires |
| TC-SM-007 | `ready` → `error` | `error` event fires |
| TC-SM-008 | `error` → `loading` | retry called |
| TC-SM-009 | `playing` → `ready` | `ended` event fires, currentTime resets to 0 |
| TC-SM-010 | `not_ready` stays `not_ready` | prerequisites missing |

### `tests/renderer/preview/controls.test.ts`

Playback control tests:

| TC | AC | Description |
|---|---|---|
| TC-CTRL-001 | AC-M4-002.2 | Play button → player state transitions to `playing` |
| TC-CTRL-002 | AC-M4-002.3 | Pause → player state transitions to `paused` |
| TC-CTRL-003 | AC-M4-002.5 | Seek bar input → `currentTime` updated |
| TC-CTRL-004 | AC-M4-002.6 | -5s → seek clamped to 0 when currentTime < 5 |
| TC-CTRL-005 | AC-M4-002.6 | +5s → seek clamped to duration when near end |
| TC-CTRL-006 | AC-M4-002.7 | `ended` event → state=ready, currentTime=0 |

### `tests/renderer/preview/subtitleEscape.test.ts`

DOM-level XSS escaping (verifies React's text node escaping at component level):

| TC | Description |
|---|---|
| TC-XSS-001 | Cue text `<script>alert(1)</script>` → renders as literal text, no script executed |
| TC-XSS-002 | Cue text `<img src=x onerror=alert(1)>` → no onerror handler invoked |
| TC-XSS-003 | Cue text `&lt;b&gt;bold&lt;/b&gt;` → HTML entities rendered as text, not parsed |

### `tests/governance/` additions — adversarial protocol handler tests

| TC | Description |
|---|---|
| TC-GOV-001 | `local:///video/../../../../etc/passwd` → 404, no file access (UUID regex rejects) |
| TC-GOV-002 | `local:///video/00000000-0000-0000-0000-000000000000` (valid UUID, no project) → 404 |
| TC-GOV-003 | Protocol handler never exposes file path in response body |
| TC-GOV-004 | `video:getPlaybackUrl` with non-UUID projectId → structured error, not raw Zod |

---

### `tests/main/ipc-contracts.test.ts` additions

| TC | Description |
|---|---|
| TC-IPC-V | `VIDEO_GET_PLAYBACK_URL` channel registered, input validated with z.string().uuid() |
| TC-IPC-C | `VIDEO_GET_CUES` channel registered, input validated with z.string().uuid() |

---

## E2E tests — `tests/e2e/preview.spec.ts`

Uses browser QA mode (`VITE_SCENESIFT_BROWSER_QA=1`).

| TC | Fixture | Assertion |
|---|---|---|
| TC-E2E-001 | No project selected | `preview-not-available` visible, "select a project" text |
| TC-E2E-002 | Project status `inspection_failed` | `preview-not-available` with "Video inspection" requirement |
| TC-E2E-003 | Project ready, subtitle not parsed | `preview-not-available` with "Subtitle parsed" requirement |
| TC-E2E-004 | `preview-ready` fixture | `preview-video` present, `preview-cue-list` visible |
| TC-E2E-005 | `preview-with-subtitle` fixture | `preview-subtitle-overlay` present, cue items visible |
| TC-E2E-006 | Click cue item | `preview-video` currentTime updated to cue.startMs (mockSceneSiftApi returns blank mp4 data URI, not local: URL) |
| TC-E2E-007 | Speed picker | Select 2.0× → `preview-speed-picker` shows selected |
| TC-E2E-008 | Error state | Mock `video.getPlaybackUrl()` returns invalid src → `preview-error` visible, human-readable message (no raw codes) |
| TC-E2E-009 | Error retry | Click `preview-retry` → player reinitializes, returns to loading state |
| TC-E2E-010 | Loading state | `preview-loading` spinner visible while player initializing |

---

## Visual regression tests — `tests/visual/preview.visual.spec.ts`

| Snapshot | Fixture | Description |
|---|---|---|
| `preview-not-available` | No project | Not-available placeholder |
| `preview-ready` | `preview-ready` (no subtitle) | Player visible, no cue list |
| `preview-with-active-cue` | `preview-with-subtitle` (cue at t=0) | Cue highlighted in list, overlay text visible |
| `preview-loading` | `preview-ready` (before canplay) | Spinner visible in player area |
| `preview-error` | Error fixture (invalid src) | Error state with retry button |

Visual baselines must be generated after Phase 4 completes. Run:
```bash
pnpm test:visual -- --update-snapshots
```
Then commit baselines.

---

## Integration checks (no new tests — existing suite)

- `pnpm test:electron` — smoke test passes with new IPC channels registered
- `pnpm governance:validate` — no forbidden patterns introduced
- `pnpm architecture:validate` — no layer boundary violations

---

## Test count delta estimate

| Type | Before M4 | After M4 |
|---|---|---|
| Unit | 299 | ~319 (+20) |
| E2E | 37 | ~44 (+7) |
| Visual | 19 | ~22 (+3) |

Exact counts confirmed post-implementation by running `pnpm test`.

---

## Out-of-scope for M4 tests

- Electron `protocol.handle` native API integration test (mocked in unit tests — real Electron tested by smoke test)
- Actual video decode/playback (requires real video file; E2E uses HTML mock src)
- Range request byte accuracy (covered by unit TC-LP-002; byte-level correctness verified manually if needed)
