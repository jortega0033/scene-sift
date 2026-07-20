# M12 — Architecture

## Service decomposition

```
src/main/services/clip-render/
  buildFfmpegArgs.ts         -- pure: ClipCandidate + CompositionSettings + paths → string[]
  progressParser.ts          -- pure: stderr line → progress 0.0–1.0 | null
  srtWriter.ts               -- pure: ClipCue[] → SRT string
  clipRenderService.ts       -- orchestration: DB reads → build args → runCommand → DB write
```

`buildFfmpegArgs`, `progressParser`, and `srtWriter` are pure functions with no I/O — fully unit testable without mocks.

`clipRenderService` depends on:
- `DatabaseService` (via public methods only)
- `runCommand`
- `ffmpegService.checkFfmpegAvailability` (to resolve FFmpeg binary path)
- `fs/promises.writeFile`, `fs/promises.unlink` (temp SRT)
- `os.tmpdir`
- `path.join`, `path.resolve`

## IPC layer

```
src/main/ipc/renderHandlers.ts  -- registers render:startForCandidate, render:getJob, render:openOutputFile
```

`registerIpcHandlers` adds `clipRenderService` to its deps injection.

`render:openOutputFile` handler: looks up `outputPath` from DB via `db.getRenderJob(jobId)`, validates file exists, calls `shell.openPath`. Renderer passes only `jobId` — no path strings cross the IPC boundary.

## Preload bridge (risk 3)

Adds `render` namespace to `window.sceneSift`:
```typescript
render: {
  startForCandidate: (candidateId: string) => Promise<{ jobId: string }>,
  getJob: (jobId: string) => Promise<{ job: RenderJob }>,
  openOutputFile: (jobId: string) => Promise<{ opened: boolean }>,
}
```

Input validation in preload (using UUID_RE, matching existing preload pattern — no Zod in preload bundle):
- `candidateId`: UUID regex
- `jobId` (getJob): UUID regex
- `jobId` (openOutputFile): UUID regex — no path strings accepted from renderer

## Renderer (risk 2)

`RenderButton` component added to candidate detail in `CandidatesSection.tsx`:
- Shows "Render" button when `candidateStatus === 'accepted'`
- On click: calls `render.startForCandidate(candidateId)` → stores `jobId` in local state
- Polls `render.getJob(jobId)` every 1s while `status === 'rendering'`
- Shows indeterminate progress bar while rendering (M12 progress = 0 until done)
- On complete: shows output path, "Open in Finder" (shell.openPath via new IPC channel `render:openOutputFile`)
- On fail: shows human-readable error from `renderErrorCode`
- Poll via `useInterval` or `useEffect` + `setTimeout`

## ClipRenderService async error guarantee

The fire-and-forget render function body must be wrapped with a top-level `try/catch` that writes a terminal DB status on any uncaught error:

```typescript
const runRender = async () => {
  try {
    // ... render logic
  } catch (err) {
    const code = err instanceof AppError ? err.code : 'INTERNAL_ERROR';
    await db.updateRenderJobStatus(jobId, { status: 'failed', renderErrorCode: code });
  }
};
// fire-and-forget: no await, no `.catch()` needed because the body handles all errors
runRender();
```

This must be unit-tested: inject a throw at the DB read stage and verify the job row ends up `status='failed'`.

## QA mock

```typescript
window.sceneSift.render = {
  startForCandidate: async (candidateId) => ({ jobId: '11111111-1111-4111-8111-111111111111' }),
  getJob: async (jobId) => ({ job: { status: 'complete', progress: 1.0, outputPath: '/tmp/demo.mp4', renderErrorCode: null, ... } }),
  openOutputFile: async (jobId) => ({ opened: true }),
};
```

## Risk classification

| Component | Risk | Why |
|---|---|---|
| migration 0009 | 3 | Schema change, migrations path |
| DatabaseService methods | 3 | src/main/services/database/ |
| clipRenderService.ts | 3 | src/main/ + process execution |
| buildFfmpegArgs.ts | 2 | src/main/ but pure, no exec |
| progressParser.ts | 1 | Pure function |
| srtWriter.ts | 1 | Pure function |
| renderHandlers.ts | 3 | IPC/main |
| preload additions | 3 | contextBridge API surface |
| renderer RenderButton | 2 | React component + state |
| QA mock | 2 | mockSceneSiftApi.ts |
| tests | 1/2 | Test files |
