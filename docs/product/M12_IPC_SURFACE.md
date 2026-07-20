# M12 — IPC Surface

## New channels (add to src/shared/ipc/channels.ts)

```typescript
RENDER_START_FOR_CANDIDATE: 'render:startForCandidate',
RENDER_GET_JOB: 'render:getJob',
RENDER_OPEN_OUTPUT_FILE: 'render:openOutputFile',
```

## Channel contracts

### render:startForCandidate

**Purpose**: Create a render job for an accepted clip candidate and begin rendering asynchronously. Returns immediately with the job ID; caller polls `render:getJob` for status.

**Input schema** (registered in `src/shared/ipc/contracts.ts`):
```typescript
z.object({ candidateId: z.string().uuid() })
```

**Output schema**:
```typescript
z.object({ jobId: z.string().uuid() })
```

**Error codes**: `CANDIDATE_NOT_FOUND`, `CANDIDATE_NOT_ACCEPTED`, `OUTPUT_DIRECTORY_NOT_CONFIGURED`, `RENDER_ALREADY_IN_PROGRESS`, `FFMPEG_NOT_AVAILABLE`

**Behavior**: Creates DB record with `status='queued'`, immediately starts async render (fire-and-forget pattern — render runs in background, status updated in DB). The IPC call resolves with `jobId` before render completes.

### render:getJob

**Purpose**: Poll render job status.

**Input schema**:
```typescript
z.object({ jobId: z.string().uuid() })
```

**Output schema**:
```typescript
z.object({
  job: z.object({
    id: z.string().uuid(),
    projectId: z.string().uuid(),
    candidateId: z.string().uuid().nullable(),
    status: z.enum(['queued', 'rendering', 'complete', 'failed']),
    progress: z.number().min(0).max(1),
    outputPath: z.string().nullable(),
    errorMessage: z.string().nullable(),
    renderErrorCode: z.string().nullable(),
    createdAt: z.number(),
    updatedAt: z.number(),
  }),
})
```

**Error codes**: `JOB_NOT_FOUND`

### render:openOutputFile

**Purpose**: Open the rendered output file in the OS file manager (Finder/Explorer). Input is a job UUID — the main process looks up the `outputPath` from the DB row, never trusting a renderer-supplied path string.

**Input schema**:
```typescript
z.object({ jobId: z.string().uuid() })
```

**Output schema**:
```typescript
z.object({ opened: z.boolean() })
```

**Implementation**: Main process calls `db.getRenderJob(jobId)` → reads `outputPath` from row → validates file exists → calls `shell.openPath(resolvedPath)`. The renderer never passes a path string across the IPC boundary.

**Error codes**: `JOB_NOT_FOUND`, `OUTPUT_FILE_NOT_FOUND`, `OUTPUT_PATH_NOT_READY` (job has no outputPath yet)

## Preload bridge additions

All inputs validated with UUID_RE (same pattern as existing preload) before forwarding.

```typescript
render: {
  startForCandidate: (candidateId: string) => {
    // validate candidateId is UUID
    return ipcRenderer.invoke(CHANNELS.RENDER_START_FOR_CANDIDATE, { candidateId });
  },
  getJob: (jobId: string) => {
    // validate jobId is UUID
    return ipcRenderer.invoke(CHANNELS.RENDER_GET_JOB, { jobId });
  },
  openOutputFile: (jobId: string) => {
    // validate jobId is UUID — renderer never passes a path string
    return ipcRenderer.invoke(CHANNELS.RENDER_OPEN_OUTPUT_FILE, { jobId });
  },
}
```

All three inputs are UUIDs. No path strings cross the IPC boundary from renderer to main.

## sceneSiftApi.ts additions

```typescript
render: {
  startForCandidate: (candidateId: string) => window.sceneSift.render.startForCandidate(candidateId),
  getJob: (jobId: string) => window.sceneSift.render.getJob(jobId),
  openOutputFile: (jobId: string) => window.sceneSift.render.openOutputFile(jobId),
}
```
