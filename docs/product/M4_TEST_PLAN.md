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
| TC-E2E-006 | Click cue item | `preview-video` currentTime updated to cue.startMs |
| TC-E2E-007 | Speed picker | Select 2.0× → `preview-speed-picker` shows selected |

---

## Visual regression tests — `tests/visual/preview.visual.spec.ts`

| Snapshot | Fixture | Description |
|---|---|---|
| `preview-not-available` | No project | Not-available placeholder |
| `preview-ready` | `preview-ready` (no subtitle) | Player visible, no cue list |
| `preview-with-active-cue` | `preview-with-subtitle` (cue at t=0) | Cue highlighted in list, overlay text visible |

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
