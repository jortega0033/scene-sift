# SceneSift — Media Inspection Implementation Plan

Milestone: M1 — Project Media Ingestion and Inspection
Date: 2026-07-19
Risk level: 3 (touches main/preload/IPC/migrations)

---

## Pre-implementation checklist

- [ ] Feature branch created from current `main` (e.g., `feature/media-inspection-m1`)
- [ ] `pnpm validate` green on branch before any changes
- [ ] `STATE.md` updated to reflect active implementation run
- [ ] Implementer is NOT the same role as verifier
- [ ] Human approval confirmed for risk-3 changes

---

## Phase 1 — Database migration

**Risk**: 3 (`src/database/migrations/`)
**Requires**: human approval for migration

### Step 1.1: Create migration file

File: `src/database/migrations/0001_media_inspection.sql`

```sql
-- Migration: 0001_media_inspection
-- Adds media inspection metadata columns to projects table
-- Reclassifies unused 'active' status rows to 'draft'
-- Rollback: See rollback SQL at bottom of this file

-- Reclassify pre-M1 'active' status rows (none should exist in production)
UPDATE projects SET status = 'draft' WHERE status = 'active';

-- Add media metadata columns (all nullable for backward compatibility)
ALTER TABLE projects ADD COLUMN duration_seconds REAL;
ALTER TABLE projects ADD COLUMN width INTEGER;
ALTER TABLE projects ADD COLUMN height INTEGER;
ALTER TABLE projects ADD COLUMN video_codec TEXT;
ALTER TABLE projects ADD COLUMN fps REAL;
ALTER TABLE projects ADD COLUMN bit_rate_bps INTEGER;
ALTER TABLE projects ADD COLUMN file_size_bytes INTEGER;
ALTER TABLE projects ADD COLUMN inspected_at INTEGER;
ALTER TABLE projects ADD COLUMN inspection_error TEXT;

-- Rollback SQL (manual — SQLite does not support ALTER TABLE DROP COLUMN in older versions):
-- UPDATE projects SET status = 'draft';  (no way to restore 'active' rows after reclassify)
-- SQLite 3.35.0+ supports: ALTER TABLE projects DROP COLUMN duration_seconds; etc.
```

### Step 1.2: Update `src/database/schema.ts`

Add columns to `projectsTable`:
```typescript
durationSeconds: real('duration_seconds'),
width: integer('width'),
height: integer('height'),
videoCodec: text('video_codec'),
fps: real('fps'),
bitRateBps: integer('bit_rate_bps'),
fileSizeBytes: integer('file_size_bytes'),
inspectedAt: integer('inspected_at'),
inspectionError: text('inspection_error'),
```

**Verification**: Run `pnpm typecheck` — no errors. Run migration on a test DB.

---

## Phase 2 — Shared contracts

**Risk**: 1 (`src/shared/schemas/`, `src/shared/ipc/`)

### Step 2.1: Update `src/shared/schemas/project.ts`

1. Extend `projectStatusSchema`:
```typescript
export const projectStatusSchema = z.enum([
  'draft',
  'ready',
  'inspection_failed',
  'archived',
]);
```

2. Add `mediaMetadataSchema`:
```typescript
export const mediaMetadataSchema = z.object({
  durationSeconds: z.number().nullable(),
  width: z.number().int().nullable(),
  height: z.number().int().nullable(),
  videoCodec: z.string().nullable(),
  fps: z.number().nullable(),
  bitRateBps: z.number().int().nullable(),
  fileSizeBytes: z.number().int().nullable(),
  inspectedAt: z.number().int().nullable(),
});
```

3. Extend `projectSchema` with media fields:
```typescript
export const projectSchema = z.object({
  // existing fields ...
  mediaMetadata: mediaMetadataSchema.nullable(),
  inspectionError: z.string().max(64).nullable(),  // max(64) enforces structured code, not raw stderr
});
```

4. Add new input/output schemas for inspect:
```typescript
export const inspectProjectInputSchema = z.object({
  projectId: z.string().uuid(),
});

export const mediaInspectionResultSchema = z.object({
  projectId: z.string().uuid(),
  status: projectStatusSchema,
  mediaMetadata: mediaMetadataSchema.nullable(),
  inspectionError: z.string().max(64).nullable(),  // max(64): structured codes only, no raw stderr
});
```

### Step 2.2: Update `src/shared/ipc/channels.ts`

Add:
```typescript
PROJECT_INSPECT: 'project:inspect',
```

### Step 2.3: Update `src/shared/ipc/contracts.ts`

Add:
```typescript
inspectProject: {
  input: inspectProjectInputSchema,
  output: mediaInspectionResultSchema,
},
```

### Step 2.4: Update `src/shared/api/sceneSiftApi.ts`

Add to `projects` namespace:
```typescript
inspect: (projectId: string) => Promise<MediaInspectionResult>;
```

Add type export:
```typescript
export type MediaInspectionResult = z.infer<typeof mediaInspectionResultSchema>;
```

**Verification**: `pnpm typecheck` — no errors.

---

## Phase 3 — Main process: FFprobe inspection function

**Risk**: 3 (`src/main/services/ffmpeg/`)

### Step 3.1: Extend `src/main/services/ffmpeg/ffmpegService.ts`

Add `inspectMediaFile` function:

```typescript
export const inspectMediaFile = async (
  videoPath: string,
  ffprobePath: string,
  runner: CommandRunner = runCommand,
): Promise<MediaInspectionResult> => {
  // 1. Normalize and validate path — path.resolve eliminates ../ components;
  //    stat().isFile() rejects device nodes (/dev/zero), named pipes, sockets,
  //    directories, and non-existent paths. This is the correct mitigation for
  //    the arbitrary-path threat (not a '..'-substring check, which only blocks
  //    traversal and has false positives on filenames like 'Directors.Cut..mp4').
  const resolvedPath = path.resolve(videoPath);
  let fileStat: import('node:fs').Stats;
  try {
    fileStat = await stat(resolvedPath);
  } catch {
    return { status: 'inspection_failed', mediaMetadata: null, inspectionError: 'FILE_NOT_FOUND' };
  }
  if (!fileStat.isFile()) {
    return { status: 'inspection_failed', mediaMetadata: null, inspectionError: 'PATH_TRAVERSAL' };
  }

  // 2. Run FFprobe with hard 15-second timeout — prevents indefinite hang on
  //    device files, named pipes, or pathological media. Kill the child process
  //    on expiry and return FFPROBE_ERROR. Do not defer this to technical debt —
  //    timeout is required before merge given arbitrary-path risk.
  const result = await runner(ffprobePath, [
    '-v', 'quiet',
    '-print_format', 'json',
    '-show_format',
    '-show_streams',
    resolvedPath,
  ], { timeoutMs: 15_000 });

  if (result.exitCode !== 0) {
    return { status: 'inspection_failed', mediaMetadata: null, inspectionError: 'FFPROBE_ERROR' };
  }

  // 4. Parse output
  let parsed: FfprobeOutput;
  try {
    parsed = JSON.parse(result.stdout) as FfprobeOutput;
  } catch {
    return { status: 'inspection_failed', mediaMetadata: null, inspectionError: 'PARSE_ERROR' };
  }

  const videoStream = parsed.streams?.find((s) => s.codec_type === 'video');
  if (!videoStream) {
    return { status: 'inspection_failed', mediaMetadata: null, inspectionError: 'NO_VIDEO_STREAM' };
  }

  const fps = parseFraction(videoStream.avg_frame_rate ?? '0/0');
  const durationSeconds = parsed.format?.duration ? parseFloat(parsed.format.duration) : null;
  const bitRateBps = parsed.format?.bit_rate ? parseInt(parsed.format.bit_rate, 10) : null;
  const fileSizeBytes = parsed.format?.size ? parseInt(parsed.format.size, 10) : null;

  return {
    status: 'ready',
    mediaMetadata: {
      durationSeconds: Number.isFinite(durationSeconds) ? durationSeconds : null,
      width: videoStream.width ?? null,
      height: videoStream.height ?? null,
      videoCodec: videoStream.codec_name ?? null,
      fps: Number.isFinite(fps) ? fps : null,
      bitRateBps: Number.isFinite(bitRateBps) ? bitRateBps : null,
      fileSizeBytes: Number.isFinite(fileSizeBytes) ? fileSizeBytes : null,
      inspectedAt: Date.now(),
    },
    inspectionError: null,
  };
};
```

Note: `parseFraction('24000/1001')` → `24000 / 1001 ≈ 23.976`. Guard against `0/0` → return null.

Add local types:
```typescript
type FfprobeStream = { codec_type: string; codec_name?: string; width?: number; height?: number; avg_frame_rate?: string; };
type FfprobeFormat = { duration?: string; bit_rate?: string; size?: string; };
type FfprobeOutput = { streams?: FfprobeStream[]; format?: FfprobeFormat; };
```

**Verification**: `pnpm typecheck`. Run unit tests (`pnpm test -- ffmpegService.inspect`).

---

## Phase 4 — Main process: DatabaseService update method

**Risk**: 2 (`src/main/services/database/`)

### Step 4.1: Add `updateProjectInspection` to `databaseService.ts`

```typescript
public updateProjectInspection(
  projectId: string,
  result: MediaInspectionResult,
): ProjectRecord {
  const orm = this.ensureOrm();

  const existing = orm.select({ id: projectsTable.id })
    .from(projectsTable)
    .where(eq(projectsTable.id, projectId))
    .get();
  if (!existing) {
    throw new AppError('PROJECT_NOT_FOUND', 'Project not found for inspection update.');
  }

  const now = Date.now();
  orm.update(projectsTable)
    .set({
      status: result.status,
      durationSeconds: result.mediaMetadata?.durationSeconds ?? null,
      width: result.mediaMetadata?.width ?? null,
      height: result.mediaMetadata?.height ?? null,
      videoCodec: result.mediaMetadata?.videoCodec ?? null,
      fps: result.mediaMetadata?.fps ?? null,
      bitRateBps: result.mediaMetadata?.bitRateBps ?? null,
      fileSizeBytes: result.mediaMetadata?.fileSizeBytes ?? null,
      inspectedAt: result.mediaMetadata?.inspectedAt ?? null,
      inspectionError: result.inspectionError ?? null,
      updatedAt: now,
    })
    .where(eq(projectsTable.id, projectId))
    .run();

  const updated = this.getProject(projectId);
  if (!updated) throw new AppError('PROJECT_NOT_FOUND', 'Project missing after inspection update.');
  return updated;
}
```

Note: **All three** methods that return `ProjectRecord` must be updated to include the new columns. TypeScript compilation will fail if any is missed because `ProjectRecord` gains required fields from `projectSchema`.

### Step 4.2: Update `getProject`, `listProjects`, and `createProject` mappings

In `databaseService.ts`, the explicit field-by-field mapping in each of these three methods must include the new columns:

```typescript
// Add to every ProjectRecord mapping object in getProject, listProjects, and createProject:
mediaMetadata: row.inspectedAt != null ? {
  durationSeconds: row.durationSeconds ?? null,
  width: row.width ?? null,
  height: row.height ?? null,
  videoCodec: row.videoCodec ?? null,
  fps: row.fps ?? null,
  bitRateBps: row.bitRateBps ?? null,
  fileSizeBytes: row.fileSizeBytes ?? null,
  inspectedAt: row.inspectedAt,
} : null,
inspectionError: row.inspectionError ?? null,
```

`listProjects` is the most critical — it populates the TanStack Query cache. If it omits the new fields, every project returned will fail Zod parse at the IPC contract validation layer.

### Step 4.3: Validate `video.path` at `PROJECT_CREATE` handler

In `registerIpcHandlers.ts`, inside the `PROJECT_CREATE` handler, add path validation before `databaseService.createProject()`:

```typescript
import { stat } from 'node:fs/promises';

// Inside PROJECT_CREATE handler, after input validation:
try {
  const fileStat = await stat(payload.video.path);
  if (!fileStat.isFile()) {
    throw new AppError('INVALID_FILE_PATH', 'Video path must point to a regular file.');
  }
} catch (err) {
  if (err instanceof AppError) throw err;
  throw new AppError('FILE_NOT_ACCESSIBLE', 'Video file is not accessible.');
}
```

This prevents arbitrary paths (device nodes, named pipes, directories) from being stored in the DB.

---

## Phase 5 — IPC handler registration

**Risk**: 3 (`src/main/ipc/registerIpcHandlers.ts`, `src/preload/index.ts`)

### Step 5.1: Register handler in `registerIpcHandlers.ts`

```typescript
registerValidatedHandler(
  IPC_CHANNELS.PROJECT_INSPECT,
  inspectProjectInputSchema,
  mediaInspectionResultSchema,
  async ({ projectId }) => {
    const project = databaseService.getProject(projectId);
    if (!project) {
      throw new AppError('PROJECT_NOT_FOUND', 'Project not found.');
    }
    const capabilities = await checkFfmpegAvailability(databaseService.getSettings());
    if (!capabilities.ffprobeAvailable || !capabilities.ffprobePath) {
      const result = {
        projectId,
        status: 'inspection_failed' as const,
        mediaMetadata: null,
        inspectionError: 'FFPROBE_UNAVAILABLE',
      };
      databaseService.updateProjectInspection(projectId, result);
      return result;
    }
    const inspectResult = await inspectMediaFile(project.videoPath, capabilities.ffprobePath);
    const updated = databaseService.updateProjectInspection(projectId, {
      ...inspectResult,
      projectId,
    });
    return {
      projectId: updated.id,
      status: updated.status as MediaInspectionResult['status'],
      mediaMetadata: updated.mediaMetadata ?? null,
      inspectionError: updated.inspectionError ?? null,
    };
  },
);
```

### Step 5.2: Add to `src/preload/index.ts`

```typescript
projects: {
  // existing methods ...
  inspect: (projectId: string) => ipcRenderer.invoke(IPC_CHANNELS.PROJECT_INSPECT, { projectId }),
},
```

**Verification**: `pnpm typecheck`. Run `pnpm test:electron`.

---

## Phase 6 — Renderer: project detail metadata display

**Risk**: 2 (`src/renderer/features/projects/ProjectsPage.tsx`)

### Step 6.1: Update `ProjectsPage.tsx`

**Critical**: Update both StatusPill conditionals. `projectA.status === 'active'` appears at two call sites (project list row and detail panel header). When `'active'` is removed from `projectStatusSchema`, these become permanently false — every project shows `'neutral'`. Replace both:

```tsx
// BEFORE (two locations in ProjectsPage.tsx):
status={project.status === 'active' ? 'ok' : 'neutral'}
status={selectedProject.status === 'active' ? 'ok' : 'neutral'}

// AFTER:
status={project.status === 'ready' ? 'ok' : 'neutral'}
status={selectedProject.status === 'ready' ? 'ok' : 'neutral'}
```

Add media metadata section to the selected project detail panel:

```tsx
{selectedProject?.status === 'ready' && selectedProject.mediaMetadata && (
  <div className="space-y-3 border-t border-border pt-3">
    <h4 className="text-label uppercase tracking-label text-muted-foreground">
      Media metadata
    </h4>
    <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
      <div>
        <dt className="text-muted-foreground">Duration</dt>
        <dd className="font-mono text-mono-path">
          {formatDuration(selectedProject.mediaMetadata.durationSeconds)}
        </dd>
      </div>
      <div>
        <dt className="text-muted-foreground">Resolution</dt>
        <dd className="font-mono text-mono-path">
          {selectedProject.mediaMetadata.width} × {selectedProject.mediaMetadata.height}
        </dd>
      </div>
      <div>
        <dt className="text-muted-foreground">Codec</dt>
        <dd className="font-mono text-mono-path truncate">
          {selectedProject.mediaMetadata.videoCodec ?? 'Unknown'}
        </dd>
      </div>
      <div>
        <dt className="text-muted-foreground">Frame rate</dt>
        <dd className="font-mono text-mono-path">
          {selectedProject.mediaMetadata.fps?.toFixed(2) ?? 'Unknown'} fps
        </dd>
      </div>
    </dl>
  </div>
)}

{selectedProject?.status === 'inspection_failed' && (
  <p className="border-t border-border pt-3 text-xs text-foreground">
    Inspection failed: {formatInspectionError(selectedProject.inspectionError)}
  </p>
)}

{selectedProject?.status === 'draft' && !selectedProject.mediaMetadata && (
  <p className="border-t border-border pt-3 text-xs text-muted-foreground">
    Media not yet inspected.
  </p>
)}
```

Add utility functions (same file or `src/renderer/utils/formatMedia.ts`):
```typescript
export const formatDuration = (seconds: number | null): string => {
  if (!seconds) return 'Unknown';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    : `${m}:${String(s).padStart(2, '0')}`;
};

export const formatInspectionError = (code: string | null): string => {
  const messages: Record<string, string> = {
    FFPROBE_UNAVAILABLE: 'FFprobe unavailable. Configure FFprobe path in Settings.',
    FILE_NOT_FOUND: 'Video file not found or inaccessible.',
    PATH_TRAVERSAL: 'Invalid file path.',
    FFPROBE_ERROR: 'FFprobe could not read the file.',
    NO_VIDEO_STREAM: 'No video stream found in the file.',
    PARSE_ERROR: 'FFprobe output could not be parsed.',
    UNKNOWN: 'Unknown error. Check app logs.',
  };
  return messages[code ?? ''] ?? 'Unknown error.';
};
```

### Step 6.2: Trigger inspection after project creation

**Location**: `CreateProjectForm.tsx` (inside `onSubmit`). This is the chosen location — not a `useEffect`.

**Prerequisite**: Verify that `useCreateProject`'s mutation function returns `ProjectRecord` (not `void`). If it currently discards the return value, update the TanStack mutation definition to return the created project record so `result.id` is available.

**Cache invalidation**: After `inspect()` resolves, invalidate the `['projects']` query key so the list and detail panel re-render with the new metadata:

```typescript
const queryClient = useQueryClient();

const onSubmit = handleSubmit(async (values) => {
  // mutateAsync must return ProjectRecord — verify useCreateProject implementation
  const created = await createProject.mutateAsync({ ... });
  // Trigger inspection (non-blocking from user's perspective but we await for cache update)
  await window.sceneSift.projects.inspect(created.id);
  // Invalidate so useProjects() re-fetches with updated status + mediaMetadata
  await queryClient.invalidateQueries({ queryKey: ['projects'] });
  onCreated?.();
});
```

Without `invalidateQueries`, the TanStack cache still holds the stale `ProjectRecord` with `mediaMetadata: null` and the detail panel shows "Media not yet inspected" until manual refetch, violating AC-001-B.

---

## Phase 7 — QA fixtures and mock

**Risk**: 1 (`src/renderer/qa/`)

### Step 7.1: Update `fixtures.ts`

**Critical**: Add `'inspection-failed-project'` to `qaFixtureNames` const array FIRST. `QaFixtureName` is derived from that array, and `fixtureMap` is `Record<QaFixtureName, QaFixtureState>`. Adding to `fixtureMap` without adding to `qaFixtureNames` fails TypeScript compilation. Additionally, `resolveFixtureName()` validates URL params against this array — the fixture would silently fall back to `'multiple-projects'` at runtime if the name isn't registered.

```typescript
// Step 1: Add to qaFixtureNames array (BEFORE adding to fixtureMap):
export const qaFixtureNames = [
  // ... existing 13 names ...
  'inspection-failed-project',
] as const;
```

Add `mediaMetadata` to `projectA`, `projectB`, `projectC`:
```typescript
const projectA: ProjectRecord = {
  // existing ...
  status: 'ready',
  mediaMetadata: {
    durationSeconds: 2537.42,
    width: 1920,
    height: 1080,
    videoCodec: 'h264',
    fps: 23.976,
    bitRateBps: 14_200_000,
    fileSizeBytes: 4_296_000_000,
    inspectedAt: now - 5_000,
  },
  inspectionError: null,
};
```

`projectB` status: `'inspection_failed'` with `inspectionError: 'FILE_NOT_FOUND'`, `mediaMetadata: null`.
`projectC` status: `'ready'` with representative metadata.

Add new fixture `'inspection-failed-project'`:
```typescript
'inspection-failed-project': {
  name: 'inspection-failed-project',
  projects: [{ ...projectA, status: 'inspection_failed', mediaMetadata: null, inspectionError: 'FILE_NOT_FOUND' }],
  // ...
},
```

### Step 7.2: Update `tests/fixtures/sceneSiftApi.ts`

E2E and visual tests import this mapping file to get fixture URLs. Add the new fixture constant:

```typescript
export const FIXTURES = {
  // ... existing 13 entries ...
  inspectionFailedProject: 'inspection-failed-project',
} as const;
```

If tests use the raw string `'inspection-failed-project'` instead of this constant, it bypasses the established codebase pattern. Use the constant.

### Step 7.3: Add `projects.inspect` mock to `mockSceneSiftApi.ts`

```typescript
inspect: async (projectId: string) => {
  await delay();
  const project = findProject(projectId);
  if (!project) throw new Error('Project not found.');
  const metadata = {
    durationSeconds: 2537.42,
    width: 1920,
    height: 1080,
    videoCodec: 'h264',
    fps: 23.976,
    bitRateBps: 14_200_000,
    fileSizeBytes: 4_296_000_000,
    inspectedAt: Date.now(),
  };
  projects = projects.map((p) =>
    p.id === projectId
      ? { ...p, status: 'ready', mediaMetadata: metadata, inspectionError: null }
      : p,
  );
  return { projectId, status: 'ready', mediaMetadata: metadata, inspectionError: null };
},
```

---

## Phase 8 — Tests

**Risk**: 1 (`tests/`)

1. Create `tests/main/ffmpegService.inspect.test.ts` — all scenarios from test plan
2. Extend `tests/main/ipc-contracts.test.ts` — add `PROJECT_INSPECT`
3. Extend `tests/database/databaseService.test.ts` — add `updateProjectInspection` tests
4. Create `tests/e2e/media-inspection.e2e.spec.ts` — golden path + error display
5. Create `tests/visual/media-inspection.visual.spec.ts` — 3 baselines
6. Run `pnpm test:visual:update --grep "@visual media"` to generate baselines

---

## Phase 9 — Full validation

```bash
pnpm governance:validate
pnpm architecture:validate
pnpm design:validate
pnpm dependencies:validate
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm test:visual:update --grep "@visual media"
pnpm test:visual
pnpm test:e2e
pnpm test:electron
```

All must exit 0. No `.skip`/`.only`. No new forbidden patterns.

---

## Phase 10 — Independent verification

Spawn `electron-security-reviewer` agent. Provide:
- New IPC channel definition
- Path validation logic
- Shell: false confirmation
- Raw stderr handling

Spawn `architecture-reviewer` agent. Provide:
- Import graph of new code
- Confirm no renderer → main imports

Spawn `governance-verifier` agent. Provide:
- Evidence JSON from Phase 9

Human must review and approve before merge.

---

## Constraints (from loop-constraints.md + electron-security-reviewer findings)

- `shell: false` on all FFprobe spawn calls — NO EXCEPTIONS
- No command string concatenation — argument array only
- No raw FFprobe stderr to renderer — structured error codes only (`z.string().max(64)` enforces this at schema level)
- **`video.path` must be validated at `PROJECT_CREATE` handler time** using `stat().isFile()` — not just at inspect time. A renderer can call `projects.create({video: {path: '/etc/passwd', ...}})` and store arbitrary paths in the DB if the create handler does not validate. Inspect re-validates, but creation is the primary gatekeeping point.
- **`runCommand` must accept a `timeoutMs` option** for the inspect call (15 000 ms). Kill child process on expiry, return `FFPROBE_ERROR`. Not deferrable given arbitrary-path risk (attacker can point FFprobe at `/dev/zero` and hang the IPC handler indefinitely).
- Path validation must use `path.resolve()` + `stat().isFile()`, NOT a substring check for `'..'`. The substring check has false positives (filenames like `Directors.Cut..mp4`) and misses absolute device/pipe paths that contain no `..`.
- `inspectionError` Zod schema must have `.max(64)` to enforce structured codes at the contract layer.
- No new external dependencies — FFprobe already bundled
- Migration must be tested on a real SQLite DB before merge
- IPC contract test must be updated with new channel

---

## Files created/modified summary

**New**:
- `src/database/migrations/0001_media_inspection.sql`
- `tests/main/ffmpegService.inspect.test.ts`
- `tests/e2e/media-inspection.e2e.spec.ts`
- `tests/visual/media-inspection.visual.spec.ts`

**Modified**:
- `src/database/schema.ts`
- `src/shared/schemas/project.ts`
- `src/shared/ipc/channels.ts`
- `src/shared/ipc/contracts.ts`
- `src/shared/api/sceneSiftApi.ts`
- `src/main/services/process/runCommand.ts` — add `timeoutMs` option
- `src/main/services/ffmpeg/ffmpegService.ts`
- `src/main/services/database/databaseService.ts`
- `src/main/ipc/registerIpcHandlers.ts` — video.path validation at create time
- `src/preload/index.ts`
- `src/renderer/features/projects/ProjectsPage.tsx`
- `src/renderer/features/projects/CreateProjectForm.tsx` — inspect trigger + cache invalidation
- `src/renderer/qa/fixtures.ts` — qaFixtureNames + fixtureMap
- `src/renderer/qa/mockSceneSiftApi.ts`
- `tests/fixtures/sceneSiftApi.ts` — add FIXTURES.inspectionFailedProject
- `tests/main/ipc-contracts.test.ts`
