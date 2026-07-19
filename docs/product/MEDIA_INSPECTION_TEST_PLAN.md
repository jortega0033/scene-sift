# SceneSift — Media Inspection Test Plan

Milestone: M1 — Project Media Ingestion and Inspection
Date: 2026-07-19

---

## Test scope

Covers all new code introduced by the first vertical slice. Does not retest existing functionality unless the change touches it (e.g., `projectSchema` extension, `StatusPill` new variant).

---

## Test types

### 1. Unit tests (`tests/main/`, `tests/renderer/`, `tests/database/`)

#### 1a. `ffmpegService` — `inspectMediaFile`

File: `tests/main/ffmpegService.inspect.test.ts` (new)

| Test | Input | Expected |
|---|---|---|
| Happy path — full metadata | Mock runner returns valid JSON with video stream | Returns `{ status: 'ready', metadata: { durationSeconds, width, height, videoCodec, fps, bitRateBps, fileSizeBytes } }` |
| FFprobe exit non-zero | Mock runner returns `exitCode: 1` | Returns `{ status: 'inspection_failed', inspectionError: 'FFPROBE_ERROR' }` |
| Runner throws (binary not found) | Mock runner throws | Returns `{ status: 'inspection_failed', inspectionError: 'FFPROBE_UNAVAILABLE' }` |
| Output missing video stream | Mock runner returns JSON with audio stream only | Returns `{ status: 'inspection_failed', inspectionError: 'NO_VIDEO_STREAM' }` |
| Output is invalid JSON | Mock runner returns non-JSON stdout | Returns `{ status: 'inspection_failed', inspectionError: 'PARSE_ERROR' }` |
| avg_frame_rate fraction | `"24000/1001"` (23.976) | fps ≈ 23.976 |
| avg_frame_rate integer | `"25/1"` | fps = 25 |
| avg_frame_rate zero denominator | `"0/0"` | fps = null (not divide-by-zero) |
| Duration from format | `"2537.42"` | durationSeconds = 2537.42 |
| Missing format.duration | JSON has no `format.duration` | durationSeconds = null |
| Path contains `..` | videoPath = `"../etc/passwd"` | Throws or returns `PATH_TRAVERSAL` error before calling runner |

#### 1b. `databaseService` — `updateProjectInspection`

File: `tests/database/databaseService.inspection.test.ts` (new or extend existing)

| Test | Input | Expected |
|---|---|---|
| Store full metadata | Valid inspection result | DB row has all metadata columns populated, status = `'ready'` |
| Store null metadata (failed) | `{ status: 'inspection_failed', inspectionError: 'FILE_NOT_FOUND' }` | DB row has all metadata columns null, status = `'inspection_failed'`, inspection_error set |
| Project not found | Invalid projectId | Throws `AppError` with code `PROJECT_NOT_FOUND` |
| Idempotent re-inspection | Call twice with same data | DB has second call's data (update, not insert) |
| Migration: existing `'active'` row | DB has `status = 'active'` from pre-M1 data | Migration reclassifies to `'draft'`; no crash |

#### 1c. `projectSchema` — new status values

File: `tests/renderer/schemas.test.ts` (new or extend)

| Test | Input | Expected |
|---|---|---|
| Valid `'ready'` status | `status: 'ready'` | Passes Zod parse |
| Valid `'inspection_failed'` status | `status: 'inspection_failed'` | Passes Zod parse |
| Old `'active'` status rejected | `status: 'active'` | Zod throws |
| Null metadata fields | `width: null, height: null` | Passes Zod parse |
| Missing inspection error | `inspectionError: undefined` | Treated as null |

#### 1d. IPC contract test

File: `tests/main/ipc-contracts.test.ts` (extend existing)

| Test | What |
|---|---|
| `PROJECT_INSPECT` channel registered | Channel string present in `IPC_CHANNELS` |
| Input schema validates `{ projectId: uuid }` | Zod parse passes |
| Input schema rejects non-UUID | `{ projectId: 'not-a-uuid' }` → Zod error |
| Output schema validates success result | Full metadata object → Zod parse passes |
| Output schema validates failure result | `{ status: 'inspection_failed', inspectionError: 'FILE_NOT_FOUND', metadata: null }` → passes |

---

### 2. E2E tests (`tests/e2e/`)

File: `tests/e2e/media-inspection.e2e.spec.ts` (new)

Uses browser QA mode (`VITE_SCENESIFT_BROWSER_QA=1`) with fixture `'multiple-projects'` (updated to include media metadata).

| Scenario | Steps | Expected |
|---|---|---|
| Golden path: view inspected project | Navigate to Projects, click project with metadata | Detail panel shows duration, resolution, codec, fps |
| Inspect failure display | Use `'ffmpeg-unavailable'` fixture + project with `'inspection_failed'` status | Error message visible; no crash |
| Metadata null safety | Use fixture with metadata = null (old-format project) | "Not yet inspected" placeholder visible; no crash |
| Status badge — ready | Inspected project | Status pill shows "Ready" |
| Status badge — inspection failed | Failed project | Status pill shows "Inspection failed" |

---

### 3. Visual regression tests (`tests/visual/`)

File: `tests/visual/media-inspection.visual.spec.ts` (new)

| Test | Fixture | Baseline |
|---|---|---|
| `@visual project detail — with metadata` | `'multiple-projects'` (updated) | `project-detail-with-metadata.png` |
| `@visual project detail — inspection failed` | New fixture `'inspection-failed-project'` | `project-detail-inspection-failed.png` |
| `@visual project detail — no metadata` | `'one-new-project'` (null metadata) | `project-detail-no-metadata.png` |

New baselines must be generated with `pnpm test:visual:update --grep "@visual media"` before first green run.

---

### 4. Existing test regression check

After implementing M1, all of the following must remain green:

| Suite | Target |
|---|---|
| `pnpm test` | All 89+ unit tests pass (new tests added, none removed) |
| `pnpm test:visual` | All 9+ visual baselines pass |
| `pnpm test:e2e` | All existing E2E scenarios pass |
| `pnpm test:electron` | Electron smoke test passes |
| `pnpm governance:validate` | No new forbidden patterns |

---

## Coverage gaps (known)

| Gap | Risk | Mitigation |
|---|---|---|
| FFprobe execution with real binary on CI | Medium | CI uses mock runner in unit tests; real binary test is local-only |
| Large file timeout behavior | Low (timeout not implemented in M1) | Document as open risk; implement timeout in M2 |
| Unusual codec names (av1, hevc) | Low | `videoCodec` stored as raw string; no normalization needed |
| Concurrent inspection of two projects | Low | IPC calls are sequential per renderer; no concurrency concern in M1 |
| `.mov`, `.mkv`, `.avi` format coverage | Medium | FFprobe handles these natively; test with at least one non-mp4 fixture |

---

## Test authoring constraints

From `tests.md` rule:
- No `.skip` or `.only` without documented approval
- Mocks only at system boundaries (mock `runCommand`, not internal FFprobe JSON parsing)
- Tests must be deterministic — no filesystem access except via temp dirs in unit tests
- New adversarial governance scenarios required if any new forbidden-pattern surface is added (IPC handler input validation)
