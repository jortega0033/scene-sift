# M1 Acceptance Audit — Reviewer Evidence Record

**Audit Run ID:** 2026-07-19T-m1-acceptance-audit
**Branch:** feature/m1-media-ingestion-inspection
**Date:** 2026-07-19

This document records the specific evidence, file-line references, commands actually run, and independence disclosures for all reviewers in the M1 acceptance audit. It is a binding supplement to `docs/product/M1_ACCEPTANCE_AUDIT.md`.

---

## Independence Disclosures

All reviewers in this audit are independent of the original M1 implementation agent. The original implementer was `claude-sonnet-4-6` operating in the `2026-07-19T-m1-media-inspection` run. All audit reviewers are separate invocations with no shared state from the implementation run. Specifically:

- The electron-security-reviewer did not write any of the M1 implementation files.
- The architecture-reviewer did not write any of the M1 implementation files.
- The governance-verifier is not the same invocation that originally recorded the CONDITIONALLY PASS finding in the m1-media-inspection log entry. This verifier independently re-ran all underlying commands rather than trusting the prior log's self-report.
- The migration-reviewer is independent of the database schema implementation.
- The behavioral-reviewer is independent of the UI rendering implementation.
- The skeptical-reviewer challenged all previous reviewer verdicts adversarially.

---

## 1. Electron Security Reviewer

**Verdict:** CONDITIONAL (one HIGH, two MEDIUM)

### What the reviewer actually ran

The reviewer performed static code analysis of the following files by reading them directly:

- `src/main/services/process/runCommand.ts`
- `src/main/services/ffmpeg/ffmpegService.ts`
- `src/main/ipc/registerIpcHandlers.ts`
- `src/preload/index.ts`
- `src/main/windows/createMainWindow.ts`
- `src/shared/schemas/project.ts`
- `src/main/utils/errors.ts`
- `src/main/ipc/createIpcHandler.ts`

The reviewer also reviewed grep results for `shell\s*:` and `spawn\|exec(` across `src/main/` to confirm no additional spawn call sites exist.

### Evidence by security constraint

**1. shell: false — PASS**
`src/main/services/process/runCommand.ts:20-23`:
```
spawn(binaryPath, args, { shell: false, stdio: ['ignore', 'pipe', 'pipe'] })
```
Only spawn call site in `src/main/` (confirmed via grep). `shell: false` is unconditional.

**2. Argument arrays, no command string concatenation — PASS**
`src/main/services/ffmpeg/ffmpegService.ts:75`:
```
runner(candidate, ['-version'])
```
`src/main/services/ffmpeg/ffmpegService.ts:151-155`:
```
runner(ffprobePath, ['-v','quiet','-print_format','json','-show_format','-show_streams', resolved], { timeoutMs: INSPECT_TIMEOUT_MS })
```
The `resolved` path is passed as a separate array element, not concatenated into a command string. No template-literal command construction found anywhere in `src/main/`.

**3. BrowserWindow security flags — PASS**
`src/main/windows/createMainWindow.ts:18-24`:
```
webPreferences: {
  preload: preloadPath,
  nodeIntegration: false,
  contextIsolation: true,
  sandbox: true,
  webSecurity: true,
  devTools: Boolean(devServerUrl)
}
```
All four required flags set correctly and unconditionally. `devTools` is gated to dev server presence only and does not affect the security-critical flags.

**4. path.resolve() + stat().isFile() at PROJECT_CREATE — PASS**
`src/main/ipc/registerIpcHandlers.ts:127-138`:
```
const resolved = resolvePath(payload.video.path);
try {
  const fileStat = await stat(resolved);
  if (!fileStat.isFile()) throw AppError('VIDEO_FILE_NOT_FOUND', ...)
} catch { throw AppError('VIDEO_FILE_NOT_FOUND', 'Video path does not exist.') }
```
Video path also originates from native OS file dialog via `dialogService.ts selectVideoFile` (dialog.showOpenDialog with Video extension filter), so renderer cannot supply arbitrary paths.

**5. path.resolve() + stat().isFile() at PROJECT_INSPECT — PASS**
`src/main/services/ffmpeg/ffmpegService.ts:140-149`:
```
const resolved = resolvePath(videoPath);
try {
  const fileStat = await stat(resolved);
  if (!fileStat.isFile()) return { ..., inspectionError: 'FILE_NOT_FOUND' }
} catch { return { ..., inspectionError: 'FILE_NOT_FOUND' } }
```
`resolved` path used at line 153 for the ffprobe spawn.

**6. 15-second timeout with child.kill() — PASS**
`src/main/services/ffmpeg/ffmpegService.ts:28`:
```
INSPECT_TIMEOUT_MS = 15_000
```
Passed at line 154 as `{ timeoutMs: INSPECT_TIMEOUT_MS }` to runner.
`src/main/services/process/runCommand.ts:29-35`:
```
const timer = options?.timeoutMs != null
  ? setTimeout(() => { timedOut = true; child.kill(); }, options.timeoutMs)
  : null;
```
`child.kill()` is an actual SIGKILL call, not merely a promise timeout. Timer is cleared in both the `'error'` (line 46) and `'close'` (line 51) event handlers. On timeout, close handler sets `exitCode: null` and `error: 'PROCESS_TIMEOUT'`.

**7. No raw stderr to renderer — PASS**
`src/main/services/ffmpeg/ffmpegService.ts:157-159`: ffprobe exit failure returns `inspectionError: 'FFPROBE_ERROR'` — `result.stderr` is never included in the returned `InspectionOutcome` or in `mediaInspectionResultSchema`.
`src/main/ipc/registerIpcHandlers.ts:157-165`: forwards only `outcome.inspectionError` (the coded string) and `mediaMetadata` to renderer, never raw stdout/stderr.
`src/main/ipc/createIpcHandler.ts:16-19`: catches thrown errors and calls `toSafeError(error)` which for AppError returns `{code, message, details}` and for generic Error returns `{code:'INTERNAL_ERROR', message: error.message}`. No code path constructs an Error from raw stderr text.

**8. Narrow preload bridge — PASS**
`src/preload/index.ts:1-44`: `contextBridge.exposeInMainWorld('sceneSift', sceneSiftApi)` exposes only a fixed object of named typed methods. Each calls `ipcRenderer.invoke` with a specific hardcoded `IPC_CHANNELS` constant. No method accepts a channel name as a parameter. Raw `ipcRenderer`, `require`, and `process` are in the preload module scope only and never attached to the exposed object.

**9. inspectionError max(64) — PASS**
`src/shared/schemas/project.ts:56`: `inspectionError: z.string().max(64).nullable()` (projectSchema)
`src/shared/schemas/project.ts:75`: same constraint in mediaInspectionResultSchema.
Actual error codes (`FILE_NOT_FOUND`, `FFPROBE_ERROR`, `PARSE_ERROR`, `NO_VIDEO_STREAM`) are 10-16 characters, well within the 64-char limit.

### HIGH Finding

**HIGH-1: Unbounded stdout/stderr accumulation**
`src/main/services/process/runCommand.ts:37-43`:
```
child.stdout.on('data', (chunk: Buffer) => { stdout += chunk.toString(); });
child.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString(); });
```
No `maxBuffer`, no incremental size check, no truncation, no slice at any point before or after accumulation. `ffmpegService.ts:163` then calls `JSON.parse(result.stdout)` — a second memory operation.

The 15-second SIGKILL bounds execution time but does NOT bound memory consumption before the kill fires. `ffprobe -show_format -show_streams` emits all streams, chapters, embedded metadata tags, and format info; a pathological media container with hundreds of streams or bloated tag fields could emit megabytes of JSON before 15 seconds elapse.

Directly conflicts with `.claude/rules/media-pipeline.md` requirement: "Set resource limits (timeout, memory) on all external processes."

### MEDIUM Findings

**MEDIUM-1: TOCTOU race**
`stat().isFile()` is called on the resolved path string in both `registerIpcHandlers.ts:128-137` (PROJECT_CREATE) and `ffmpegService.ts:140-155` (PROJECT_INSPECT). Then, some time later, the same path string is used again without re-validating via a file descriptor: a DB write for create, an ffprobe spawn for inspect. `stat()` (not `lstat()`) follows symlinks; a local attacker with write access to the exact target path at the exact right moment could swap the file between check and use. Practical exploitability requires local write-race capability (high bar for single-user desktop app) and this pattern matches the documented approved design per project memory. Not a new regression; should be formally tracked in MEDIA_INSPECTION_RISK_REGISTER.md.

**MEDIUM-2: toSafeError() forwards Error.message for generic exceptions**
`src/main/utils/errors.ts:20-31`: the non-AppError branch forwards `error.message` to the renderer via `createIpcHandler.ts:16-19`. No current code path constructs an Error from raw ffprobe stderr, so requirement #7 is satisfied today. However, any unanticipated exception (e.g., a SQLite error containing an absolute path, a Node.js fs error with a file descriptor number) could surface internal implementation text to the renderer. Recommend restricting the non-AppError branch to a fixed generic message in production builds.

---

## 2. Architecture Reviewer

**Verdict:** APPROVED

### What the reviewer actually ran / confirmed

The reviewer relied on:
- `pnpm architecture:validate` exit code 0 (run by orchestrator, independently confirmed)
- `pnpm typecheck` exit code 0 (run by orchestrator, independently confirmed)
- Direct file reading of all M1 interface files: `src/shared/ipc/channels.ts`, `src/shared/ipc/contracts.ts`, `src/preload/index.ts`, `src/main/ipc/registerIpcHandlers.ts`, `src/renderer/main.tsx`, `src/renderer/features/projects/ProjectsPage.tsx`, `src/renderer/hooks/useProjects.ts`

### Evidence by boundary

**IPC channel/contract/preload/handler symmetry — PASS**
- `src/shared/ipc/channels.ts`: `PROJECT_INSPECT = 'project:inspect'` present in `IPC_CHANNELS` and `ALL_IPC_CHANNELS`
- `src/preload/index.ts:29`: `inspect: (projectId: string) => ipcRenderer.invoke(IPC_CHANNELS.PROJECT_INSPECT, { projectId })`
- `src/shared/ipc/contracts.ts`: `project.inspect` with input `inspectProjectInputSchema` and output `mediaInspectionResultSchema`
- `src/main/ipc/registerIpcHandlers.ts:142-167`: handler registered for `IPC_CHANNELS.PROJECT_INSPECT`
All four locations are consistent. No orphaned channels found.

**Renderer has no electron/node/main imports — PASS**
No violations found in reviewed renderer files. All IPC access routes through `window.sceneSift`. `pnpm architecture:validate` exit 0 confirms full-tree static check.

**Shared layer has no runtime imports from renderer/main/preload — PASS**
`src/shared/schemas/project.ts`, `src/shared/ipc/channels.ts`, `src/shared/ipc/contracts.ts`, `src/shared/api/sceneSiftApi.ts` — all reviewed; only import zod, each other, and type-only imports.

**Main has no renderer imports — PASS**
No violations in reviewed main files. `pnpm architecture:validate` exit 0 covers full tree.

**QA bridge guard — PASS**
`src/renderer/main.tsx`: `installBridge()` is called unconditionally at module load. Inside `installBridge.ts`:
- Line 7-9: returns real `window.sceneSift` if it exists (production path)
- Line 11-15: installs mock only when `import.meta.env.VITE_SCENESIFT_BROWSER_QA === '1'`
- Lines 17-19: throws if preload absent and QA mode off (production fail-closed, no silent fallback)
`installBridge` import confirmed confined to `main.tsx` only.

**No new ADR required — confirmed**
No new architecture boundaries were introduced. All M1 changes follow established patterns covered by ADR-001 (IPC bridge), ADR-002 (preload constraint), ADR-006 (database access restriction).

---

## 3. Governance Verifier

**Verdict:** APPROVED

### What the reviewer actually ran

All commands re-run independently by this reviewer session:
- `pnpm governance:validate` — exit 0
- `pnpm claude:validate` — exit 0, ALL PASSED
- `pnpm claude:test:adversarial` — 34/34 passed
- File reads: `gate.yaml`, `.claude/settings.json`, `package.json`, `pnpm-lock.yaml`, `src/shared/schemas/project.ts`

### Evidence

**gate.yaml unchanged — CONFIRMED**
`git diff HEAD -- gate.yaml` returns empty. gate.yaml byte-identical to base commit.

**settings.json unchanged — CONFIRMED**
`git diff HEAD -- .claude/settings.json` returns empty. No hooks removed, no deny rules weakened.

**No new dependencies — CONFIRMED**
`git diff HEAD -- package.json pnpm-lock.yaml` returns empty for both files.

**No forbidden patterns — CONFIRMED**
Grep for `shell: true`, `nodeIntegration: true`, `contextIsolation: false`, `webSecurity: false` in `src/` — zero matches.

**inspectionError max(64) confirmed — CONFIRMED**
`src/shared/schemas/project.ts:56`: `inspectionError: z.string().max(64).nullable()` (projectSchema line 56)
`src/shared/schemas/project.ts:75`: `inspectionError: z.string().max(64).nullable()` (mediaInspectionResultSchema line 75)

**Adversarial tests — 34/34 confirmed**
All 34 adversarial governance scenarios in `tests/governance/adversarial-scenarios.test.ts` pass. Covers gate.yaml structure, settings.json structure, hook file existence, binding document existence, CLAUDE.md invariants, .mcp.json security.

**Loop run completeness — CONFIRMED**
`loop-run-log.md` m1-media-inspection entry has: checks array, all three reviewer verdicts, outcome, verdict string. State machine completed.

### MEDIUM Findings

**MEDIUM-1: CLAUDE.md documentation drift**
`CLAUDE.md` still states "Current milestone: Claude Code governance layer. No product features in this milestone." `STATE.md` and `loop-run-log.md` confirm M1 feature implementation was authorized and completed 2026-07-19. This is documentation drift, not a control weakening, but should be updated to avoid scope confusion for future agent sessions.

**MEDIUM-2: Prior governance-verifier self-closure**
The m1-media-inspection log entry's governance-verifier evidence states its CONDITIONALLY PASS condition was "closed by updating this log entry" — a prior verifier session appears to have self-closed its condition via direct log edit rather than a confirming party. Mitigated in this session: all underlying commands were independently re-run rather than trusting the log's self-report. Not a control bypass since the underlying evidence checks out.

---

## 4. Migration Reviewer

**Verdict:** APPROVED

### What the reviewer actually ran / confirmed

- Direct file read: `src/database/migrations/0001_media_inspection.sql`
- Direct file read: `src/database/migrations/meta/_journal.json`
- Direct file read: `src/database/schema.ts`
- Direct file read: `src/main/services/database/databaseService.ts`
- `pnpm typecheck` exit 0 (confirms Drizzle schema consistency)

### Evidence by constraint

**9 new columns, all nullable — CONFIRMED**
`0001_media_inspection.sql` adds: `duration_seconds` (REAL), `width` (INTEGER), `height` (INTEGER), `video_codec` (TEXT), `fps` (REAL), `bit_rate_bps` (INTEGER), `file_size_bytes` (INTEGER), `inspected_at` (INTEGER), `inspection_error` (TEXT) — all with `DEFAULT NULL`. 9/9 match the specification.

**Status migration present — CONFIRMED**
SQL contains: `UPDATE projects SET status = 'ready' WHERE status = 'active';` — migrates legacy 'active' status to 'ready' as required.

**Parameterized queries only — CONFIRMED**
All Drizzle ORM `.set()`, `.where()`, `.values()` calls use parameter binding. No string-interpolated SQL found in `databaseService.ts`.

**null inspected_at guard — CONFIRMED**
`updateProjectInspection()` sets `inspectedAt: outcome.success ? Date.now() : null` — explicit null on failure path.

**Journal registered — CONFIRMED**
`meta/_journal.json` includes the `0001_media_inspection` entry.

**mapProject() used consistently — CONFIRMED**
All four ProjectRecord-returning methods (`listProjects`, `createProject`, `getProject`, `updateProjectInspection`) route through `mapProject()` helper. No raw row objects returned to callers. Drizzle schema field names correctly mapped to camelCase TS names.

### MEDIUM Finding

**MEDIUM-1: deleteProject() missing transaction**
`databaseService.ts deleteProject()` executes two sequential DELETE statements:
1. `db.delete(renderJobsTable).where(eq(renderJobsTable.projectId, id))`
2. `db.delete(projectsTable).where(eq(projectsTable.id, id))`

No `db.transaction()` wrapper. A process crash between statements leaves render jobs permanently deleted while the project row survives — undetectable orphaned data loss. Recommend wrapping both deletes in `db.transaction((tx) => { ... })`.

---

## 5. Behavioral Reviewer

**Verdict:** CONDITIONAL

### What the reviewer actually ran / confirmed

- Direct file reads: `src/renderer/features/projects/ProjectsPage.tsx`, `src/renderer/features/projects/CreateProjectForm.tsx`, `src/renderer/hooks/useProjects.ts`, `src/renderer/qa/fixtures.ts`, `tests/e2e/media-inspection.e2e.spec.ts`
- Traced `statusPillVariant()` function at `ProjectsPage.tsx:8-14`
- Reviewed `pnpm test:e2e` output: 19/19 passed

### HIGH Findings

**HIGH-1: AC-002-F unmet — bit rate absent**
`ProjectsPage.tsx:179-235` metadata `<dl>` block contains: `durationSeconds`, `width`/`height`, `videoCodec`, `fps`, `fileSizeBytes` — but **not** `bitRateBps`. The field exists in `MediaMetadata` type and in fixtures (`projectAMediaMetadata.bitRateBps = 8_500_000`) but is never rendered. Grep for `bitRateBps` in `src/renderer/` returns only `fixtures.ts` and `mockSceneSiftApi.ts` — never used in a UI component.

**HIGH-2: AC-002-A unmet — duration format**
`ProjectsPage.tsx:189`:
```
{selectedProject.mediaMetadata.durationSeconds.toFixed(2)}s
```
This renders e.g. `"2847.60s"`. AC-002-A requires HH:MM:SS or MM:SS format. 2847.6 seconds = 47 minutes 27.6 seconds, which should display as `"47:27"` or `"0:47:27"`. No `formatDuration` helper exists anywhere in `src/renderer/`.

### MEDIUM Findings

**MEDIUM-1: useInspectProject has no onError query invalidation**
`useProjects.ts useInspectProject`: no `onError` callback that calls `queryClient.invalidateQueries`. If inspection throws due to an IPC transport error, the project list will not refresh and the project remains stuck in `draft` status until the user manually navigates away.

**MEDIUM-2: CreateProjectForm modal blocks during inspection**
`CreateProjectForm.tsx` awaits `inspectProject.mutateAsync` before calling `onCreated()`. The create-project modal stays open and covers the project list for the entire inspection duration (up to 15 seconds). The project IS added to the list as `draft` (query invalidated after create) but the blocking modal prevents the user from observing the draft state per AC-001-D.

### Passing Evidence

**StatusPill mapping correct — PASS**
`ProjectsPage.tsx:8-14`:
```
function statusPillVariant(status: string): 'ok' | 'warning' | 'neutral' {
  if (status === 'ready') return 'ok';
  if (status === 'inspection_failed') return 'warning';
  return 'neutral';
}
```
Matches AC-005-C (`ready→ok`) and AC-005-D (`inspection_failed→warning`).

**E2E test coverage — 4 scenarios**
`tests/e2e/media-inspection.e2e.spec.ts` covers:
1. Create project and auto-inspect triggers
2. Metadata displays on successful inspection
3. Inspection failure shows error state
4. Project list shows status pill

All 4 pass against browser QA mock.

**Auto-inspect on create — PASS**
`CreateProjectForm.tsx` calls `projects.create()` then immediately calls `inspectProject.mutateAsync(created.id)` — no additional user action required.

---

## 6. Skeptical Reviewer

**Verdict:** FAIL — DO NOT MERGE

### Independence Disclosure

The skeptical reviewer is adversarial to all prior reviewer verdicts by design. Its role is to find where prior reviewers were too lenient, missed failures, or relied on mock evidence that does not prove production correctness.

### What the skeptical reviewer actually ran

- Direct reads: `ProjectsPage.tsx`, `runCommand.ts`, `ffmpegService.ts`, `tests/e2e/media-inspection.e2e.spec.ts`, `tests/main/database-service.test.ts`, `tests/main/ffmpegService.inspect.test.ts`
- Traced all grep results provided in audit evidence
- Reviewed all prior reviewer findings for evidence-theater patterns

### Evidence for CRITICAL findings

**CRIT-1: AC-004 error messages — confirmed by file read**
`src/renderer/features/projects/ProjectsPage.tsx:242` (exact line):
```jsx
<p>Inspection error: {selectedProject.inspectionError}</p>
```
When `inspectionError = 'FFPROBE_ERROR'`, this renders: `"Inspection error: FFPROBE_ERROR"`.

AC-004-A requires: `"Inspection failed: FFprobe unavailable"`
AC-004-B requires: `"Inspection failed: file not found or inaccessible"`
AC-004-C requires: `"Inspection failed: no video stream found"`

No error code translation map exists anywhere in `src/renderer/`. Grep for `'FFPROBE_ERROR'` in `src/renderer/` returns only `fixtures.ts:98` (fixture data) — no translation logic.

The E2E test at `tests/e2e/media-inspection.e2e.spec.ts`:
```
await expect(page.getByTestId('inspection-error')).toContainText('FFPROBE_ERROR');
```
This passes because `"Inspection error: FFPROBE_ERROR"` contains the substring `"FFPROBE_ERROR"`. The test validates the wrong behavior and cannot detect the fix once it's made (it would still pass if the output were `"Inspection failed: FFprobe unavailable"` since that string does NOT contain `"FFPROBE_ERROR"`). The test must be updated to assert on the human-readable string.

**CRIT-2: AC-008-B null metadata — confirmed by file read**
`src/renderer/features/projects/ProjectsPage.tsx:178`:
```jsx
{selectedProject.mediaMetadata && (
  <dl>
    {/* all metadata fields */}
  </dl>
)}
```
When `selectedProject.mediaMetadata` is null (draft status, failed inspection), the entire `<dl>` block is hidden. No fallback text, no per-field placeholder (e.g., `"—"`), no `"Not yet inspected"` message. The entire section simply does not render.

**CRIT-3: AC-009-C updateProjectInspection untested — confirmed by grep**
Grep for `updateProjectInspection` in `tests/`:
- `tests/main/database-service.test.ts`: ZERO hits
- `tests/main/ffmpegService.inspect.test.ts`: ZERO hits
- `tests/e2e/media-inspection.e2e.spec.ts`: ZERO hits

The method is defined in `src/main/services/database/databaseService.ts:117` but is never called in any test file. AC-009-C requires: "databaseService.updateProjectInspection() tested with valid and null metadata."

**CRIT-4: AC-003-A persistence untested — confirmed by analysis**
No test in the entire test suite:
1. Creates a project
2. Calls `updateProjectInspection()` to write metadata
3. Closes the `DatabaseService` instance (or calls an equivalent reset)
4. Reopens / reinitializes `DatabaseService`
5. Calls `listProjects()` and asserts non-null metadata fields

All E2E tests use browser QA mock (`VITE_SCENESIFT_BROWSER_QA=1`). Mock state is JS in-memory; it never touches SQLite. Mock `listProjects()` returns whatever is in `fixtureMap`, which is initialized from static fixtures — it never reads from a SQLite file.

`tests/main/database-service.test.ts` does test SQLite persistence for basic CRUD, but never calls `updateProjectInspection()` at all.

### Evidence-Theater Analysis

The skeptical reviewer identifies five patterns where passing test results do not prove production correctness:

1. **Browser QA mode E2E**: All 19 E2E tests run against `mockSceneSiftApi`. Mock `inspect()` always returns `{ success: true, mediaMetadata: { width: 1920, ... } }` regardless of what file path is provided. These tests prove React renders correctly with fixture data; they cannot distinguish a working production stack from a completely broken IPC layer.

2. **AC-004 E2E test validates wrong behavior**: The `toContainText('FFPROBE_ERROR')` assertion was written to match the current non-compliant implementation. It passes against wrong behavior. Once the AC-004 fix is applied (showing human-readable message), this test will FAIL — but that failure correctly indicates the test needs updating, not a regression.

3. **ffmpegService unit tests use mocked runner**: `tests/main/ffmpegService.inspect.test.ts` uses `vi.fn()` for `CommandRunner`. Tests prove parsing and error-code logic. They never invoke a real ffprobe binary and cannot detect spawn configuration issues, stdout buffering issues, or OS-level path resolution differences.

4. **test:electron failed**: The Electron smoke test failed with `"Process failed to launch!"` — the real Electron binary was never successfully validated in this audit cycle. `pnpm package:dir` succeeded and produced `SceneSift.app`, but whether the app launches and correctly initializes the preload bridge and IPC handlers has not been verified in this audit.

5. **No full-stack integration test**: No test exercises the complete production path end-to-end: OS file dialog → IPC marshal → stat() → ffprobe spawn → stdout accumulation → JSON.parse → SQLite UPDATE → IPC response → React Query invalidation → renderer re-render. Every layer in this chain is either mocked or untested in isolation.

### What the evidence does and does not prove

**The evidence proves:**
- Zod schemas reject invalid IPC payloads including non-UUID project IDs
- `shell: false` is set unconditionally on the spawn call
- `path.resolve()` is called before passing path to ffprobe
- A SIGKILL timer fires at 15 seconds
- `exitCode !== 0` returns `FFPROBE_ERROR` not raw stderr
- `project:inspect` channel exists in `ALL_IPC_CHANNELS`
- Preload bridge exposes only named typed methods with hardcoded channel constants
- FFprobe JSON parsing logic correctly extracts fields from a well-formed mock payload
- All governance, architecture, lint, typecheck, and unit checks pass
- Production build and `package:dir` succeed

**The evidence does not prove:**
- Mock behavior matches production IPC marshaling
- `updateProjectInspection()` correctly persists all nine media columns (never tested)
- Metadata survives database close/reopen (no such test exists)
- Real ffprobe on user machines emits JSON matching the mock format
- The Electron binary can launch and correctly load the preload script (smoke test failed)
- The current UI renders AC-004 error messages correctly (it does not)
- The current UI shows per-field placeholders for null metadata (it does not)

---

## 7. Computed Verdict Basis

The final verdict of **M1 NOT ACCEPTED** is computed from:

| Factor | Count | Merge-blocking? |
|---|---|---|
| Critical acceptance criteria failures | 4 | YES |
| High acceptance criteria failures | 4 | YES |
| High governance violation (unbounded stdout) | 1 | YES |
| E2E test asserting on wrong behavior | 1 | YES |
| Failed test:electron (environment) | 1 | NO (environment constraint) |
| Failed test:visual sub-2% diffs | 3 | NO (but must not regenerate baselines until AC fixes applied) |

Minimum 9 issues must be resolved before re-audit. See `docs/product/M1_ACCEPTANCE_AUDIT.md` Section 9 for the complete required fix list.
