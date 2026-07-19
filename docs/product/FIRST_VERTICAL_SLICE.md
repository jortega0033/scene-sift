# SceneSift — First Vertical Slice: Project Media Ingestion and Inspection

Date: 2026-07-19
Status: Specified — not implemented

---

## Summary

The first vertical slice adds FFprobe-based media metadata inspection to every project. When a project is created (or manually re-inspected), the app runs `ffprobe -show_format -show_streams` on the stored video path and persists the result. The project detail panel displays duration, resolution, codec, and fps. On success the project status transitions from `draft` to `ready`.

---

## User-facing outcome

> "I created a project for episode-04.mp4. Within a second, I can see it's 42:17, 1920×1080, H.264, 23.97fps and it's marked as Ready."

> "I created a project for a file on a network share that's no longer mounted. The app shows 'Inspection failed: file not found' and the project stays Draft. I can retry later."

---

## Success conditions

- [ ] New project immediately triggers FFprobe inspection of the video path
- [ ] On success: duration, resolution, codec, fps, bit rate, and file size are persisted and displayed
- [ ] On success: project status transitions `draft` → `ready`
- [ ] On failure: project status remains `draft`; an `inspectionError` message is stored and shown
- [ ] Inspection failure does not crash the app or corrupt the project record
- [ ] FFprobe not available → inspection skips; project stays `draft` with error: "FFprobe unavailable"
- [ ] Metadata persists across app restarts
- [ ] Project created before this slice (with no metadata) is handled gracefully (metadata shown as N/A)
- [ ] All existing tests continue to pass
- [ ] `pnpm validate` exits 0 after implementation

---

## Scope boundary

### In scope (this slice)

- `ffprobe -v quiet -print_format json -show_format -show_streams <path>` execution
- Parse: duration (seconds), width, height, video codec name, fps (avg_frame_rate fraction), bit_rate, size
- New DB migration `0001_media_inspection.sql`
- New `projectStatus` value `'ready'` (replacing the unused `'active'`)
- New IPC channel `PROJECT_INSPECT`
- New preload bridge: `projects.inspect(projectId)`
- New `sceneSiftApi.projects.inspect` type
- Renderer: media metadata section in project detail panel
- QA fixtures: `mediaMetadata` field added to fixture project records
- Mock: `projects.inspect(projectId)` mock in `mockSceneSiftApi.ts`
- Tests: unit (ffmpegService inspect fn), IPC contract, databaseService, E2E golden path

### Out of scope (this slice)

- Subtitle parsing
- Clip generation or rendering
- AI features
- Publishing
- Project update for name/paths
- Manual re-inspection trigger in UI (post-slice enhancement; inspection is automatic on create)

---

## Proposed new project status values

Current: `['draft', 'active', 'archived']`
Proposed: `['draft', 'ready', 'inspection_failed', 'archived']`

Note: `'inspecting'` is NOT written to the DB during in-progress inspection. The renderer shows a local spinner state while the `projects.inspect()` IPC call is in flight. This avoids migration complexity and race conditions. (See open question 2 resolution.)

| Status | Meaning | How reached |
|---|---|---|
| `draft` | Created, inspection not started or in progress | Default on create; renderer shows spinner during inspect |
| `ready` | Inspected successfully | Set after FFprobe returns metadata |
| `inspection_failed` | Inspection attempted and failed | Set if FFprobe errors |
| `archived` | User-archived, no longer active | User action (post-slice feature) |

**Migration note**: Existing records stay `draft`. The `'active'` status is removed from the Zod schema (it was unused). `'active'` rows in existing DBs will still be valid SQLite data but the schema will reject them — migration must reclassify existing `'active'` rows to `'ready'` or `'draft'`.

---

## File scope — new files

| File | Purpose | Risk level |
|---|---|---|
| `src/database/migrations/0001_media_inspection.sql` | Add media metadata columns + `inspection_error` column to `projects` | 3 |
| `tests/main/ffmpegService.inspect.test.ts` | Unit tests for `inspectMediaFile` | 1 |
| `tests/e2e/media-inspection.e2e.spec.ts` | E2E: create project → inspect → see metadata | 1 |

## File scope — modified files

| File | Change | Risk level |
|---|---|---|
| `src/database/schema.ts` | Add media columns to `projectsTable` | 2 |
| `src/shared/schemas/project.ts` | Extend `projectSchema`, new `projectStatusSchema` values | 1 |
| `src/shared/ipc/channels.ts` | Add `PROJECT_INSPECT` | 3 |
| `src/shared/ipc/contracts.ts` | Add `inspectProject` input/output schemas | 3 |
| `src/shared/api/sceneSiftApi.ts` | Add `projects.inspect` method type | 1 |
| `src/main/services/ffmpeg/ffmpegService.ts` | Add `inspectMediaFile(filePath, ffprobePath)` | 3 |
| `src/main/services/database/databaseService.ts` | Add `updateProjectInspection()` | 2 |
| `src/main/ipc/registerIpcHandlers.ts` | Register `PROJECT_INSPECT` handler | 3 |
| `src/preload/index.ts` | Expose `projects.inspect` | 3 |
| `src/renderer/features/projects/ProjectsPage.tsx` | Display media metadata in detail panel | 2 |
| `src/renderer/qa/fixtures.ts` | Add `qaFixtureNames` entry + `mediaMetadata` to project fixtures | 1 |
| `src/renderer/qa/mockSceneSiftApi.ts` | Add `projects.inspect` mock | 2 |
| `src/renderer/features/projects/CreateProjectForm.tsx` | Trigger inspect after create + TanStack cache invalidation | 2 |
| `src/main/services/process/runCommand.ts` | Add `timeoutMs` option | 3 |
| `tests/fixtures/sceneSiftApi.ts` | Add `FIXTURES.inspectionFailedProject` constant | 1 |
| `tests/main/ipc-contracts.test.ts` | Add `PROJECT_INSPECT` contract test | 1 |

---

## IPC contract (proposed)

### Input

```typescript
inspectProjectInputSchema = z.object({
  projectId: z.string().uuid(),
})
```

### Output

```typescript
mediaInspectionResultSchema = z.object({
  projectId: z.string().uuid(),
  status: projectStatusSchema,  // 'ready' | 'inspection_failed'
  mediaMetadata: z.object({     // field is 'mediaMetadata' (not 'metadata') — matches projectSchema
    durationSeconds: z.number().nullable(),
    width: z.number().int().nullable(),
    height: z.number().int().nullable(),
    videoCodec: z.string().nullable(),
    fps: z.number().nullable(),
    bitRateBps: z.number().int().nullable(),
    fileSizeBytes: z.number().int().nullable(),
    inspectedAt: z.number().int(),
  }).nullable(),
  inspectionError: z.string().max(64).nullable(),  // max(64): structured codes only, never raw stderr
})
```

---

## FFprobe command (proposed)

```
ffprobe -v quiet -print_format json -show_format -show_streams <videoPath>
```

Parse from output:
- `streams[n].codec_type === 'video'` → codec_name, width, height, avg_frame_rate (`num/den` fraction → decimal fps)
- `format.duration` → parseFloat seconds
- `format.bit_rate` → parseInt bps
- `format.size` → parseInt bytes

All values are nullable — partial metadata is valid. An empty result (no video stream, no format) with exit 0 is treated as `inspection_failed`.

---

## Security constraints (carried from `loop-constraints.md` and `gate.yaml`)

- `ffprobe` must be invoked with argument array, never a command string
- `shell: false` required on the spawn call
- `video.path` must be validated at `PROJECT_CREATE` handler time (not only at inspect time) using `stat().isFile()` — prevents arbitrary paths from being stored in the DB
- `videoPath` retrieved from DB must be re-validated at `PROJECT_INSPECT` time using `path.resolve()` + `stat().isFile()` — not a `..`-substring check (that check misses absolute device/pipe paths and produces false positives)
- `runCommand` must accept a `timeoutMs` option; all FFprobe calls use 15 000 ms timeout with child-process kill on expiry
- FFprobe output is JSON parsed only — `stdout` is never eval'd
- `inspectionError` field is a structured code string with `z.string().max(64)` — never raw stderr
- Raw FFprobe stderr must NOT be surfaced to the renderer (surface structured error code only)
- New IPC channel requires: documented purpose, input schema, output schema, error contract (all defined above)

---

## Open questions for implementer

1. **Inspection timing**: Triggered automatically after `PROJECT_CREATE` succeeds, or via separate `PROJECT_INSPECT` call from renderer? — Recommend: renderer calls `projects.inspect(projectId)` immediately after `projects.create()` succeeds. Keeps IPC handler responsibilities single.

2. **`inspecting` status race**: If inspection takes >1s (large file on slow disk), should the UI show a loading state per project, or suppress the status during the brief inspection window? — Recommend: show `draft` with spinner in project detail until inspect call resolves. No database write for `inspecting` status (avoids migration complexity).

3. **Existing projects**: Users who upgrade from pre-M1 builds will have projects with no metadata. Those projects should be inspectable via a "Re-inspect" button in the project detail panel. Document this as a known gap for M1 and address in a follow-up.

4. **FFprobe path resolution**: The existing `checkFfmpegAvailability` function already resolves the effective FFprobe path. The new `inspectMediaFile` function should accept an explicit `ffprobePath: string` argument (the resolved path from capabilities) rather than re-running path discovery.
