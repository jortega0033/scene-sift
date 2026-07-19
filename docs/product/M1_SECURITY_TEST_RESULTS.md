# M1 Media Inspection — Security Test Results

**Audit date**: 2026-07-19
**Branch**: feature/m1-media-ingestion-inspection
**Reviewer**: electron-security-reviewer (primary), skeptical-reviewer (independent confirmation)
**Verdict**: CONDITIONAL — one HIGH severity unmitigated finding, two MEDIUM findings

---

## Review scope

This document records the security verification performed on the M1 implementation. It covers:

- Child process execution safety (`shell: false`, argument arrays)
- Input path validation at both IPC handler entry points
- Timeout and process kill behavior
- Error information bounding (no raw stderr to renderer)
- Preload surface area and raw `ipcRenderer` exposure
- `BrowserWindow` security configuration flags
- Adversarial scenario results
- Open findings

---

## 1. `shell: false` verification

**Requirement**: `loop-constraints.md` — "Never use `shell: true`." `electron-main.md` — "Use argument arrays for all child process execution."

**Finding**: PASS

**Evidence**:

`src/main/services/process/runCommand.ts:20–23`:

```typescript
const child = spawn(binaryPath, args, {
  shell: false,
  stdio: ['ignore', 'pipe', 'pipe'],
});
```

`shell: false` is set unconditionally. It is the only `spawn` or `exec` call in `src/main/` (confirmed by grep for `spawn\|exec(` across `src/main` — only match is `runCommand.ts`). No other child process execution path exists.

**Additional verification**: `pnpm governance:validate` runs a forbidden-pattern check that rejects `shell: true` patterns. Exit 0 confirmed.

---

## 2. Argument array verification

**Requirement**: `electron-main.md` — "Use argument arrays for all child process execution. Never construct command strings."

**Finding**: PASS

**Evidence**:

Three call sites were reviewed:

1. `ffmpegService.ts:75` — ffprobe availability check:
   ```typescript
   runner(candidate, ['-version'])
   ```

2. `ffmpegService.ts:151–155` — media inspection:
   ```typescript
   runner(ffprobePath, [
     '-v', 'quiet',
     '-print_format', 'json',
     '-show_format',
     '-show_streams',
     resolved,
   ], { timeoutMs: INSPECT_TIMEOUT_MS })
   ```

3. `runCommand.ts:20–23` — the underlying spawn:
   ```typescript
   spawn(binaryPath, args, { shell: false, ... })
   ```
   where `args` is typed as `string[]` and passed as the array parameter, never concatenated.

No template string construction of command arguments was found in any file under `src/main/`. The `resolved` path variable is appended to the args array (element 6) rather than interpolated into a command string.

---

## 3. Path validation at PROJECT_CREATE handler

**Requirement**: `electron-main.md` — "Validate all executable paths before invocation." `media-pipeline.md` — "Validate all input paths. Reject paths with `..` traversal."

**Finding**: PASS

**Evidence**:

`src/main/ipc/registerIpcHandlers.ts:127–138`:

```typescript
const resolved = resolvePath(payload.video.path);  // path.resolve()
try {
  const fileStat = await stat(resolved);
  if (!fileStat.isFile()) {
    throw new AppError('VIDEO_FILE_NOT_FOUND', 'Video path does not exist or is not a file.');
  }
} catch {
  throw new AppError('VIDEO_FILE_NOT_FOUND', 'Video path does not exist.');
}
```

`path.resolve()` eliminates `..` traversal. `stat().isFile()` rejects directories, device nodes, named pipes, and non-existent paths. The video path originates from `dialog.showOpenDialog` (native OS file picker with Video extension filter) and is validated against `selectedVideoSchema` (Zod) before reaching this handler — the renderer cannot supply an arbitrary path string without user interaction with the OS dialog.

---

## 4. Path validation at PROJECT_INSPECT handler (ffmpegService)

**Requirement**: `media-pipeline.md` — "Validate all input paths." Security spec: `stat().isFile()` at inspect.

**Finding**: PASS

**Evidence**:

`src/main/services/ffmpeg/ffmpegService.ts:140–149`:

```typescript
const resolved = resolvePath(videoPath);  // path.resolve()
try {
  const fileStat = await stat(resolved);
  if (!fileStat.isFile()) {
    return { ..., inspectionError: 'FILE_NOT_FOUND' };
  }
} catch {
  return { ..., inspectionError: 'FILE_NOT_FOUND' };
}
```

The `videoPath` argument is the value stored in the database (set by the PROJECT_CREATE handler, which validated it at creation time). The PROJECT_INSPECT IPC handler accepts only a `projectId` (UUID) from the renderer, looks up `project.videoPath` from the database, and passes that database value to `inspectMediaFile`. The renderer cannot inject a new arbitrary path on the inspect call.

The path receives `path.resolve()` again at inspect time, followed by `stat().isFile()`, before being passed to ffprobe. Both checks are present.

---

## 5. Timeout and process kill behavior

**Requirement**: `media-pipeline.md` — "Set resource limits (timeout, memory) on all external processes."

**Finding**: PASS for timeout kill. HIGH FINDING for memory/output bounding (see section 11).

**Evidence** (timeout and kill):

`src/main/services/ffmpeg/ffmpegService.ts:28`:
```typescript
const INSPECT_TIMEOUT_MS = 15_000;
```

Passed at line 154 to `runner(ffprobePath, [...], { timeoutMs: INSPECT_TIMEOUT_MS })`.

`src/main/services/process/runCommand.ts:29–35`:
```typescript
const timer = options?.timeoutMs != null
  ? setTimeout(() => {
      timedOut = true;
      child.kill();         // actual SIGKILL to the child process
    }, options.timeoutMs)
  : null;
```

The timer calls `child.kill()` — a real process termination signal, not merely a promise timeout that leaves the process running. The timer is cleared in both the `'error'` handler (line 46) and the `'close'` handler (line 51) to prevent a dangling timer from firing after the process has already exited. On timeout, the `'close'` handler (lines 50–57) sets `exitCode: null` and `error: 'PROCESS_TIMEOUT'`.

**Unit test coverage**: `ffmpegService.inspect.test.ts` verifies that `timeoutMs: 15000` is forwarded to the runner. Actual kill behavior on a real spawned process is not tested in this suite.

---

## 6. Error information bounding — no raw stderr to renderer

**Requirement**: `electron-main.md` — "Return structured errors, not raw exception messages." `MEDIA_INSPECTION_ACCEPTANCE_CRITERIA.md` AC-007-B.

**Finding**: PASS for current code paths. MEDIUM concern for generic exception path.

**Evidence (pass)**:

`ffmpegService.ts:157–159`: When ffprobe exits with non-zero status, the function returns `inspectionError: 'FFPROBE_ERROR'`. The `result.stderr` value is never placed in the returned `InspectionOutcome` object.

`registerIpcHandlers.ts:157–165`: The handler forwards only `outcome.inspectionError` (the coded string) and the extracted `mediaMetadata` to the renderer. No raw ffprobe stdout or stderr is included in the IPC response.

`mediaInspectionResultSchema` (Zod, in `src/shared/schemas/project.ts`): `inspectionError: z.string().max(64).nullable()` — a 64-character cap means raw ffprobe stderr (which can be many kilobytes) could not fit in this field even if it were placed there.

**Medium concern**: `src/main/utils/errors.ts` — `toSafeError()` — handles unexpected (non-AppError) exceptions in `createIpcHandler.ts:16–19` by forwarding `error.message` to the renderer. No current code path constructs an `Error` from raw ffprobe stderr, so this path is not currently triggered by ffprobe failures. However, any unanticipated exception (e.g., a SQLite error with an absolute path, a Node.js internal error with filesystem details) would surface the raw `Error.message` to the renderer in production builds. Recommendation: restrict `toSafeError()` non-AppError branch to a fixed generic message in production.

---

## 7. Preload surface area

**Requirement**: `preload-ipc.md` — "Expose ONLY narrow, typed APIs through `contextBridge.exposeInMainWorld`. Never expose raw `ipcRenderer`, `require`, or `process`. Never implement generic `invoke(channel)` pass-throughs."

**Finding**: PASS

**Evidence**:

`src/preload/index.ts:1–44` exposes only a fixed object of named, typed methods via `contextBridge.exposeInMainWorld('sceneSift', sceneSiftApi)`. Each method calls `ipcRenderer.invoke` with a specific hardcoded `IPC_CHANNELS` constant. No method accepts a channel name as a parameter. The `sceneSiftApi` object includes:

- `app.getVersion()`, `app.getPlatform()`
- `dialog.selectVideoFile()`, `dialog.selectSubtitleFile()`, `dialog.selectOutputDirectory()`
- `projects.create()`, `projects.list()`, `projects.get()`, `projects.delete()`, `projects.inspect()`
- `system.getCapabilities()`
- `ffmpeg.checkAvailability()`
- `database.getHealth()`
- `settings.get()`, `settings.update()`, `settings.selectFfmpegPath()`, `settings.selectFfprobePath()`
- `queue.list()`, `queue.createDemoJob()`

Raw `ipcRenderer`, `require`, and `process` are imported into the preload module scope but are never attached to the exposed `sceneSiftApi` object. The contextBridge isolates the preload module scope from the renderer, so these cannot be accessed from `window.sceneSift` or any other renderer-visible path.

**New M1 addition**: `projects.inspect(projectId: string)` calls `ipcRenderer.invoke(IPC_CHANNELS.PROJECT_INSPECT, { projectId })` with the `projectId` as the only renderer-supplied input. The renderer cannot supply a file path directly to the inspect handler.

---

## 8. BrowserWindow security flags

**Requirement**: `electron-main.md` — "BrowserWindow must always use: `nodeIntegration: false`, `contextIsolation: true`, `sandbox: true`, `webSecurity: true`."

**Finding**: PASS

**Evidence**:

`src/main/windows/createMainWindow.ts:18–24`:

```typescript
webPreferences: {
  preload: preloadPath,
  nodeIntegration: false,
  contextIsolation: true,
  sandbox: true,
  webSecurity: true,
  devTools: Boolean(devServerUrl),
}
```

All four required flags are set correctly and unconditionally. `devTools` is gated to the presence of a dev server URL, which is acceptable and does not affect the four security-critical flags. No conditional logic disables any of the four required flags.

---

## 9. `inspectionError` Zod max-64 constraint

**Requirement**: `MEDIA_INSPECTION_ACCEPTANCE_CRITERIA.md` AC-007-C. Security property: prevents raw ffprobe stderr (which can be many kilobytes) from appearing in the schema-validated IPC response even if placed there.

**Finding**: PASS

**Evidence**:

`src/shared/schemas/project.ts:56`:
```typescript
inspectionError: z.string().max(64).nullable()
```

Present in both `projectSchema` (line 56) and `mediaInspectionResultSchema` (line 75). The actual error codes in use (`FILE_NOT_FOUND`, `FFPROBE_ERROR`, `PARSE_ERROR`, `NO_VIDEO_STREAM`, `FFPROBE_UNAVAILABLE`) are all well under 64 characters. Any attempt to populate this field with raw stderr text of more than 64 characters would be rejected by Zod validation.

---

## 10. Adversarial scenario results

**Command**: `pnpm claude:test:adversarial`
**Result**: 34 passed, 0 failed

Adversarial governance tests cover:
- `gate.yaml` structure integrity
- `settings.json` structure and hook definitions
- Hook file existence
- Binding document existence (`AGENTS.md`, `loop-constraints.md`, `CLAUDE.md`)
- `CLAUDE.md` content invariants (presence of required sections)
- `.mcp.json` security properties

**M1-relevant adversarial checks**:

The adversarial suite does not include scenario-specific tests for ffprobe path injection, argument array enforcement, or `shell:false` at the unit level. These were verified by the electron-security-reviewer via direct code reading rather than automated adversarial scenarios. The governance adversarial suite primarily tests the governance infrastructure, not the product security controls.

---

## 11. HIGH FINDING — Unbounded stdout/stderr accumulation

**Severity**: HIGH

**Location**: `src/main/services/process/runCommand.ts:37–43`

**Code**:
```typescript
child.stdout.on('data', (chunk: Buffer) => {
  stdout += chunk.toString();
});
child.stderr.on('data', (chunk: Buffer) => {
  stderr += chunk.toString();
});
```

**Description**: Output from the child process (ffprobe) is accumulated in unbounded JavaScript strings. There is no `maxBuffer`, no incremental size check, no byte counter, no truncation, and no mechanism to abort early once output exceeds a configurable bound.

**Why it matters**: `ffmpegService.ts:151–155` invokes ffprobe with `-show_format -show_streams`, which emits a JSON object containing all streams, all format metadata, and all tags. A pathological or deliberately crafted media file could have:
- Thousands of embedded subtitle or data streams
- Very large custom tag fields (album art as base64, embedded chapter metadata, etc.)
- Bloated format metadata

This could cause ffprobe to emit megabytes or gigabytes of JSON to stdout, all of which would be buffered in main-process heap before `JSON.parse()` is called at line 163, which would double the memory usage again.

The 15-second wall-clock timeout (`child.kill()`) bounds how long the process runs but does NOT bound how much output is produced in that window. A small script producing several gigabytes of stdout in well under 15 seconds is trivial.

**Governance rule violated**: `docs/quality/.claude/rules/media-pipeline.md` states explicitly: "Set resource limits (timeout, memory) on all external processes." Only the timeout half of this requirement is implemented.

**Required fix**: Add an incremental byte-count accumulator to both `child.stdout.on('data', ...)` and `child.stderr.on('data', ...)`. When the accumulated size exceeds a threshold (e.g., 4 MB), call `child.kill()` and return a new structured error code `OUTPUT_TOO_LARGE`. Example:

```typescript
const MAX_OUTPUT_BYTES = 4 * 1024 * 1024; // 4 MB
let stdoutBytes = 0;
child.stdout.on('data', (chunk: Buffer) => {
  stdoutBytes += chunk.length;
  if (stdoutBytes > MAX_OUTPUT_BYTES) {
    child.kill();
    // resolve with OUTPUT_TOO_LARGE
    return;
  }
  stdout += chunk.toString();
});
```

---

## 12. MEDIUM FINDING — TOCTOU race between stat() and ffprobe spawn

**Severity**: MEDIUM (known/accepted per project memory)

**Locations**:
- `registerIpcHandlers.ts:128–137` (PROJECT_CREATE)
- `ffmpegService.ts:140–155` (PROJECT_INSPECT / inspectMediaFile)

**Description**: Both handlers call `stat().isFile()` on a resolved path string, then later use the same path string in a subsequent privileged operation (DB write for create; ffprobe spawn for inspect). Between the `stat()` check and the privileged operation, the file at the target path could theoretically be replaced by a different file, symlink, FIFO, or device node by a local attacker.

`stat()` (not `lstat()`) follows symlinks, so if an attacker with local filesystem write access to the exact path can swap a symlink between the check and use, they could cause ffprobe to operate on a file the user never selected.

**Practical exploitability**: Requires a local attacker with write access to the exact file path at precisely the right timing window (between two Node.js async calls). In a single-user desktop app threat model, an attacker with this capability would generally already have local code-execution capability equivalent to the app's own privileges. The 15-second SIGKILL bounds the damage for any stuck read attempt.

**Status**: This pattern was explicitly approved as the design per project memory ("stat().isFile() at create + path.resolve() at inspect + 15s FFprobe timeout") and is the documented approach. It is a known accepted residual risk, not a new regression introduced by M1.

**Required action**: Add an entry to `docs/product/MEDIA_INSPECTION_RISK_REGISTER.md` formally tracking this TOCTOU as an accepted residual risk with its threat model justification. A stronger mitigation (open the file via `fs.open`, call `fstat` on the resulting fd, pass `/dev/fd/N` reference to ffprobe, close fd after spawn) is not implemented and is left as a future hardening task.

---

## 13. MEDIUM FINDING — toSafeError() forwards arbitrary Error.message

**Severity**: MEDIUM

**Location**: `src/main/utils/errors.ts` (toSafeError), `src/main/ipc/createIpcHandler.ts:16–19`

**Description**: For unexpected (non-AppError) exceptions thrown inside any IPC handler, `toSafeError()` constructs a response using `error.message` directly. In development builds it also includes the stack trace. No current code path puts raw ffprobe stderr into an `Error.message`, so AC-007-B (no raw FFprobe details to renderer) is satisfied in the current code. However, any unanticipated future exception — a SQLite error with an absolute filesystem path, a Node.js internal error with memory addresses, a dependency error with a username in a path — would surface that raw string to the renderer in production builds.

**Required fix**: In the non-AppError branch of `toSafeError()`, use a fixed generic message (`'An unexpected internal error occurred'`) in production builds. Reserve `error.message` forwarding to an explicitly gated `process.env.NODE_ENV === 'development'` or `DEBUG_IPC=1` flag.

---

## Summary

| Check | Status |
|---|---|
| `shell: false` on all spawn calls | PASS |
| Argument arrays — no command string construction | PASS |
| `path.resolve()` + `stat().isFile()` at PROJECT_CREATE | PASS |
| `path.resolve()` + `stat().isFile()` at PROJECT_INSPECT | PASS |
| 15-second SIGKILL timeout on ffprobe | PASS |
| No raw ffprobe stderr in IPC response | PASS |
| Preload exposes only named typed methods | PASS |
| No raw `ipcRenderer` on exposed bridge | PASS |
| BrowserWindow `nodeIntegration: false` | PASS |
| BrowserWindow `contextIsolation: true` | PASS |
| BrowserWindow `sandbox: true` | PASS |
| BrowserWindow `webSecurity: true` | PASS |
| `inspectionError` max 64 chars (Zod) | PASS |
| Adversarial governance scenarios (34) | PASS |
| Unbounded stdout/stderr accumulation | HIGH FINDING — unmitigated |
| TOCTOU race between stat and spawn | MEDIUM FINDING — accepted risk, needs risk register entry |
| toSafeError() forwards arbitrary Error.message | MEDIUM FINDING — no current exploit path, forward-looking concern |
