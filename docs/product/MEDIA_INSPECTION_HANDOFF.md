# SceneSift — Media Inspection Handoff

Milestone: M1 — Project Media Ingestion and Inspection
Date: 2026-07-19
For: Implementing agent (governed-implementer or human engineer)

---

## What you are building

Add FFprobe-based video metadata inspection to SceneSift. When a project is created, the renderer calls `projects.inspect(projectId)` which triggers FFprobe on the stored video path. The result (duration, resolution, codec, fps, etc.) is stored in the DB and displayed in the project detail panel.

This is planning-only. Do not implement until you have:
- [ ] Human approval
- [ ] Feature branch (not main)
- [ ] All checks green on branch before your first change

---

## Quick reference

| Topic | Source |
|---|---|
| Full feature spec | `docs/product/FIRST_VERTICAL_SLICE.md` |
| State machine | `docs/product/MEDIA_INSPECTION_STATE_MACHINE.md` |
| Acceptance criteria | `docs/product/MEDIA_INSPECTION_ACCEPTANCE_CRITERIA.md` |
| Test plan | `docs/product/MEDIA_INSPECTION_TEST_PLAN.md` |
| Risk register | `docs/product/MEDIA_INSPECTION_RISK_REGISTER.md` |
| Implementation plan | `docs/product/MEDIA_INSPECTION_IMPLEMENTATION_PLAN.md` |
| Governance constraints | `loop-constraints.md`, `gate.yaml`, `AGENTS.md` |

---

## What already exists (do not duplicate)

| Component | Location | Notes |
|---|---|---|
| FFprobe path resolution | `src/main/services/ffmpeg/ffmpegService.ts:28` | `getCandidatePaths()` resolves bundled/override/PATH |
| FFprobe binary call pattern | `ffmpegService.ts:61` | `runner(candidate, ['-version'])` — use same pattern |
| `runCommand` utility | `src/main/services/process/runCommand.ts` | `spawn(path, args, { shell: false })` |
| IPC handler registration | `src/main/ipc/registerIpcHandlers.ts` | `registerValidatedHandler(channel, inputSchema, outputSchema, fn)` |
| Preload bridge | `src/preload/index.ts` | Extend `projects` namespace |
| Project creation handler | `registerIpcHandlers.ts:119` | Pattern to follow for new handler |
| QA mock | `src/renderer/qa/mockSceneSiftApi.ts` | Mirror real API shape |

---

## Critical constraints — non-negotiable

1. **`shell: false`** on every `spawn` call involving FFprobe. The existing `runCommand` already enforces this — use it.

2. **Argument array only**. Never: `ffprobe ${path}`. Always: `runner(ffprobePath, ['-v', 'quiet', ..., videoPath])`.

3. **Validate paths at both creation and inspection time.** At `PROJECT_CREATE` handler: call `stat(video.path).isFile()` — rejects device nodes (`/dev/zero`), named pipes, directories. The `selectedVideoSchema.path` is unconstrained (`z.string().min(1)`), so a renderer can store any arbitrary absolute path without going through the dialog. At `PROJECT_INSPECT` handler: `path.resolve(videoPath)` + `stat().isFile()` on the DB-retrieved path before FFprobe. Do NOT use a `..`-substring check — it has false positives (filenames like `Directors.Cut..mp4`) and misses absolute non-regular-file paths.

4. **No raw FFprobe stderr to renderer**. The `inspectionError` field returned by the IPC handler is a structured code string (e.g., `'FILE_NOT_FOUND'`), not raw process output.

5. **New IPC channel must be registered in `channels.ts`** and validated by `contracts.ts` Zod schemas. The `registerValidatedHandler` wrapper handles validation — do not bypass it.

6. **New DB columns are all nullable**. Projects created before M1 will have `null` for all media columns. The renderer must handle this gracefully.

7. **Migration is risk-3**. Needs independent verifier + human approval before merge.

---

## Proposed FFprobe command

```
ffprobe -v quiet -print_format json -show_format -show_streams <videoPath>
```

**Parse targets from JSON output**:
- `streams[]` where `codec_type === 'video'`: `codec_name`, `width`, `height`, `avg_frame_rate`
- `format`: `duration` (string seconds), `bit_rate` (string bps), `size` (string bytes)

**`avg_frame_rate` parsing**: the value is a fraction string like `"24000/1001"` or `"25/1"`. Parse as `num / den`. Guard against `den === 0` → return `null`.

---

## Proposed new project status values

Remove `'active'` (never used). Add `'ready'`, `'inspection_failed'`.

```typescript
// src/shared/schemas/project.ts
export const projectStatusSchema = z.enum([
  'draft',
  'ready',
  'inspection_failed',
  'archived',
]);
```

Migration `0001_media_inspection.sql` reclassifies any `'active'` rows to `'draft'` before adding columns.

---

## IPC flow (end to end)

```
renderer
  window.sceneSift.projects.inspect(projectId)
    → preload
      ipcRenderer.invoke('project:inspect', { projectId })
        → main: registerIpcHandlers
          validateInput({ projectId }) [Zod uuid]
          project = databaseService.getProject(projectId)
          capabilities = checkFfmpegAvailability(settings)
          if (!ffprobeAvailable) → return FFPROBE_UNAVAILABLE error result
          inspectResult = inspectMediaFile(project.videoPath, capabilities.ffprobePath)
          updated = databaseService.updateProjectInspection(projectId, inspectResult)
          return mediaInspectionResultSchema.parse(updated)  [Zod output validation]
        → preload: returns result
    → renderer
      update TanStack Query cache with new project metadata
      project detail panel re-renders with metadata
```

---

## TanStack Query cache update

After inspection completes, invalidate the `['projects']` query key so the list and detail panel re-render:

```typescript
const queryClient = useQueryClient();
const inspect = async (projectId: string) => {
  const result = await window.sceneSift.projects.inspect(projectId);
  // Invalidate cache so useProjects() re-fetches with new metadata
  await queryClient.invalidateQueries({ queryKey: ['projects'] });
  return result;
};
```

---

## Test approach

Unit tests use mock `runCommand` (not a real FFprobe binary). E2E tests use QA fixture data (mock bridge) — no real FFprobe needed.

Required new test files:
1. `tests/main/ffmpegService.inspect.test.ts` — ~12 cases (see test plan)
2. `tests/e2e/media-inspection.e2e.spec.ts` — golden path + error display
3. `tests/visual/media-inspection.visual.spec.ts` — 3 visual baselines

Run `pnpm test:visual:update --grep "@visual media"` to generate baselines before first visual run.

---

## Verification requirements (from AGENTS.md)

- Implementer and verifier must be independent roles
- Verifier must run real commands and provide exact evidence
- Required checks before merge:
  - `pnpm governance:validate` exit 0
  - `pnpm typecheck` exit 0
  - `pnpm lint` exit 0
  - `pnpm test` (all pass, count increases)
  - `pnpm test:visual` (all pass, new baselines included)
  - `pnpm test:e2e` exit 0
  - `pnpm build` exit 0
  - `electron-security-reviewer` approval on IPC + path validation
  - `architecture-reviewer` approval on layer boundaries
  - Human approval

---

## Known gaps (document, don't fix in M1)

| Gap | Note |
|---|---|
| `runCommand` timeout | **Must implement before merge** (elevated by security review — not deferrable). Add 15 000 ms `AbortController`-based timeout with child-process kill on expiry. See R-004. |
| No manual re-inspect UI | Future enhancement. M1 only has automatic inspection on create. |
| Old projects not auto-inspected | Upgrade path for pre-M1 projects: show "Not yet inspected" placeholder. Future feature: "Re-inspect all" batch trigger. |

---

## Risk level classification

| Path | Risk level |
|---|---|
| `src/database/migrations/**` | 3 |
| `src/main/**` | 3 |
| `src/preload/**` | 3 |
| `src/shared/ipc/**` | 3 |
| `src/main/services/ffmpeg/**` | 3 |
| `src/database/schema.ts` | 2 |
| `src/main/services/database/**` | 2 |
| `src/renderer/features/**` | 2 |
| `src/shared/schemas/**` | 1 |
| `src/shared/api/**` | 1 |
| `src/renderer/qa/**` | 1 |
| `tests/**` | 1 |

Maximum risk in this slice: **3**. All risk-3 changes require independent verifier + human approval.
