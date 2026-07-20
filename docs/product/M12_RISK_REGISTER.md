# M12 — Risk Register

## R-M12-001: Filter graph complexity / FFmpeg argument injection

**Severity**: HIGH  
**Likelihood**: LOW  
**Description**: The FFmpeg `-vf` filter graph string is constructed from DB-stored enum values. If any value escapes enum validation, a crafted string could inject filter graph syntax or (if shell were used) shell commands.  
**Mitigation**: All composition settings values are validated at IPC input (Zod enum) and at write time. `shell: false` always. Filter graph values are from enums with no special characters. fontColor is regex `^#[0-9A-Fa-f]{6}$` → pure hex transformation.  
**Residual**: ACCEPTED — enum validation + shell: false + argument array provide defense-in-depth.

## R-M12-002: Path traversal via outputDirectory

**Severity**: HIGH  
**Likelihood**: LOW  
**Description**: If `project.outputDirectory` contains `..` or a symlink to a sensitive location, the output file could be written outside the intended directory.  
**Mitigation**: `path.resolve()` before use. File is `{jobId}.mp4` (UUID filename — no user-controlled components). Path containment check uses `path.relative(base, target)` + `!isAbsolute && !startsWith('..')` (not `startsWith(base)` string comparison which can be bypassed by sibling directories sharing a prefix). Renderer never passes a path string over IPC — all paths resolved server-side from DB.  
**Residual**: LOW — UUID filename + resolve + relative-path containment check.

## R-M12-003: Temp SRT file leakage

**Severity**: MEDIUM  
**Likelihood**: MEDIUM  
**Description**: If render crashes before cleanup, temp SRT file remains in `os.tmpdir()`. Contains subtitle text from the project.  
**Mitigation**: `try/finally` ensures cleanup even on exception. On next render for the same job, previous temp file is overwritten.  
**Residual**: LOW — subtitle text is not sensitive in the local-first context; tmpdir is user-owned.

## R-M12-004: FFmpeg process orphan on main process crash

**Severity**: MEDIUM  
**Likelihood**: LOW  
**Description**: If Electron main process crashes while FFmpeg is running, the child process may continue consuming resources.  
**Mitigation**: `child.kill()` is called on timeout. OS will typically reap orphan children when parent dies. No mitigation for unclean crash.  
**Residual**: ACCEPTED — local-first desktop app; user can kill FFmpeg via OS if needed.

## R-M12-004b: Orphaned rendering jobs on crash — permanent candidate lock

**Severity**: HIGH  
**Likelihood**: MEDIUM (crash during render)  
**Description**: If the app crashes while a job's `status='rendering'`, that row stays `'rendering'` forever. The partial unique index then blocks re-rendering the candidate indefinitely.  
**Mitigation**: Startup reconciliation: `DatabaseService.initialize()` runs `UPDATE render_jobs SET status='failed', render_error_code='INTERRUPTED_BY_RESTART' WHERE status IN ('queued','rendering')` before any handler is registered. Also, the partial unique index only covers one active row per candidate; after reconciliation, a new render job can be created.  
**Residual**: ACCEPTED — crash is unpreventable; reconciliation on restart fully recovers the candidate.

## R-M12-005: Progress polling overhead

**Severity**: LOW  
**Likelihood**: MEDIUM  
**Description**: Renderer polls `render:getJob` every 1 second. Each call is a DB read (fast). With multiple candidates rendering, polling multiplies.  
**Mitigation**: M12 enforces only one concurrent render per candidate. Polling stops when `status` is terminal (`complete`/`failed`).  
**Residual**: ACCEPTABLE — single concurrent render + fast SQLite read.

## R-M12-006: Large subtitle cue count in SRT

**Severity**: LOW  
**Likelihood**: LOW  
**Description**: A clip with many subtitle cues (up to 10k limit from M2) could produce a large temp SRT file. FFmpeg reads it all into memory.  
**Mitigation**: In practice, a clip is seconds-to-minutes; subtitle cues per clip are bounded by the clip duration. Short clip = few cues. Clip cues are a subset of the full project subtitle (already bounded at 10k total).  
**Residual**: ACCEPTED.

## R-M12-007: FFmpeg not available

**Severity**: HIGH  
**Likelihood**: LOW  
**Description**: User has no FFmpeg installed and no bundled binary.  
**Mitigation**: `render:startForCandidate` checks FFmpeg availability (via `checkFfmpegAvailability`) before creating the job. Returns `FFMPEG_NOT_AVAILABLE` structured error if not found. UI shows human-readable message.  
**Residual**: HANDLED — graceful error, no crash.

## R-M12-008: ASS color format conversion error

**Severity**: MEDIUM  
**Likelihood**: LOW  
**Description**: fontColor `#RRGGBB` must be converted to ASS `&H00BBGGRR`. Off-by-one in byte reversal would produce wrong color or corrupt filter arg.  
**Mitigation**: Pure function `hexToAssColor(hex: string): string` with unit tests for known values including `#FF0000 → &H000000FF`, `#00FF00 → &H0000FF00`, `#FFFFFF → &H00FFFFFF`.  
**Residual**: LOW — unit tested with multiple known-value assertions.

## R-M12-009: drizzle-kit generate not run before implementation

**Severity**: HIGH  
**Likelihood**: MEDIUM (prior incidents with hand-written migrations)  
**Description**: If drizzle-kit generate is skipped, the migration journal will be out of sync and the schema snapshot won't match the hand-written SQL.  
**Mitigation**: Implementation plan explicitly requires `pnpm drizzle-kit generate` as the first step of database phase. Independent reviewer checks journal consistency.  
**Residual**: LOW — documented requirement, verified in architecture review.
