# SceneSift — Media Inspection State Machine

Milestone: M1 — Project Media Ingestion and Inspection
Date: 2026-07-19

---

## Project status values (proposed for M1)

Current schema: `['draft', 'active', 'archived']`
Proposed schema: `['draft', 'ready', 'inspection_failed', 'archived']`

Changes:
- Remove `'active'` (was unused; never transitioned to in existing code)
- Add `'ready'` (successfully inspected, metadata available)
- Add `'inspection_failed'` (inspection attempted and failed)
- Retain `'draft'` (created, not yet inspected)
- Retain `'archived'` (user-archived; post-M1 feature)

**Migration note**: Existing `'active'` rows must be reclassified. Migration `0001_media_inspection.sql` should `UPDATE projects SET status = 'draft' WHERE status = 'active'` before adding constraints, then add the new columns.

---

## State diagram

```
                    ┌─────────────────────────┐
                    │         [draft]          │
                    │  status = 'draft'        │
                    │  metadata = null         │
                    │  inspectionError = null  │
                    └─────────┬───────────────┘
                              │
                              │  projects.inspect(projectId) called
                              │  [guard: FFprobe path available]
                              │  [guard: videoPath stored]
                              │
                    ┌─────────▼───────────────┐
                    │  [inspection in flight]  │
                    │  (transient, not stored) │
                    │  UI: loading indicator   │
                    └────┬───────────┬─────────┘
                         │           │
            success      │           │  failure
         (exit 0,        │           │  (exit ≠ 0, file
          video stream   │           │   not found,
          found)         │           │   no video stream,
                         │           │   FFprobe not available)
                         │           │
             ┌───────────▼─┐       ┌─▼──────────────────┐
             │   [ready]   │       │ [inspection_failed] │
             │  metadata   │       │  metadata = null    │
             │  populated  │       │  inspectionError    │
             │  status =   │       │  = error code       │
             │  'ready'    │       │  status =           │
             └─────────────┘       │  'inspection_failed'│
                                   └────────────────────┘
                                          │
                                          │  (future: re-inspect trigger)
                                          ▼
                                   back to [draft] → re-run inspection
```

(The `[archived]` status is a terminal state reachable from any non-archived status via user action. Not implemented in M1.)

---

## Transitions

### T-001: `draft` → `ready`

| Field | Value |
|---|---|
| Trigger | `PROJECT_INSPECT` IPC call returns success |
| Guard | FFprobe path resolved; video path stored; FFprobe exit 0; video stream present |
| Effect | Update `projects` row: `status = 'ready'`, set all metadata columns, `inspected_at = now()` |
| Error state | None (happy path) |

### T-002: `draft` → `inspection_failed`

| Field | Value |
|---|---|
| Trigger | `PROJECT_INSPECT` IPC call returns failure |
| Guard | FFprobe not available, OR file not found/accessible, OR FFprobe exit ≠ 0, OR no video stream |
| Effect | Update `projects` row: `status = 'inspection_failed'`, `inspection_error = <error_code>`, metadata columns remain null |
| Error state | None (this IS the error state) |

### T-003: `inspection_failed` → `draft` (future)

| Field | Value |
|---|---|
| Trigger | User clicks "Re-inspect" (future feature, not in M1) |
| Guard | User has confirmed the video path is still valid |
| Effect | Reset `status = 'draft'`, `inspection_error = null` |

### T-004: Any → `archived` (future)

| Field | Value |
|---|---|
| Trigger | User archives the project (future feature, not in M1) |
| Guard | None |
| Effect | `status = 'archived'`; project excluded from active lists |

---

## Guards

| Guard | Implementation |
|---|---|
| FFprobe path resolved | `checkFfmpegAvailability()` returns `ffprobeAvailable: true` |
| Video path stored | `project.videoPath` is non-empty string |
| File accessible | `fs.access(videoPath)` succeeds before calling FFprobe |
| No `..` traversal | `videoPath` validated before shell pass-through |
| FFprobe exit 0 | `runCommand` returns `exitCode === 0` |
| Video stream present | Parsed FFprobe output has ≥1 `streams[]` entry with `codec_type === 'video'` |

---

## Error codes (structured, not raw FFprobe stderr)

| Error code | Meaning |
|---|---|
| `FFPROBE_UNAVAILABLE` | No FFprobe binary found at any candidate path |
| `FILE_NOT_FOUND` | `fs.access` failed before calling FFprobe |
| `PATH_TRAVERSAL` | videoPath contains `..` — rejected before execution |
| `FFPROBE_ERROR` | FFprobe exited non-zero |
| `NO_VIDEO_STREAM` | FFprobe succeeded but output has no video stream |
| `PARSE_ERROR` | FFprobe output could not be JSON-parsed |
| `UNKNOWN` | Unexpected error; check logs |

---

## DB representation

```sql
-- After migration 0001_media_inspection.sql:
projects.status         TEXT NOT NULL DEFAULT 'draft'
                        -- Valid values: 'draft' | 'ready' | 'inspection_failed' | 'archived'
projects.duration_seconds  REAL
projects.width             INTEGER
projects.height            INTEGER
projects.video_codec       TEXT
projects.fps               REAL
projects.bit_rate_bps      INTEGER
projects.file_size_bytes   INTEGER
projects.inspected_at      INTEGER       -- Unix ms timestamp
projects.inspection_error  TEXT          -- error code string, nullable
```

All media metadata columns are nullable. A project in `'ready'` status has all columns populated. A project in `'draft'` or `'inspection_failed'` status has all columns null.

---

## Renderer state

| App state | Renderer behavior |
|---|---|
| Inspection in flight | `projects.inspect()` Promise pending → show loading indicator in project detail |
| Status `'ready'` | Show metadata grid: duration, resolution, codec, fps, bit rate, file size |
| Status `'inspection_failed'` | Show error message (from `inspectionError` field) + status pill |
| Status `'draft'` (no metadata) | Show "Not yet inspected" placeholder |
| Status `'archived'` | (Future) |
