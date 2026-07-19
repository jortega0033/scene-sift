# SceneSift — Media Inspection Risk Register

Milestone: M1 — Project Media Ingestion and Inspection
Date: 2026-07-19

---

## Risk classification

| Rating | Likelihood | Impact | Action threshold |
|---|---|---|---|
| Critical | High + High | — | Must mitigate before implementation |
| High | High + Medium, or Medium + High | — | Must mitigate in implementation |
| Medium | Medium + Medium, or Low + High | — | Mitigate or accept with documented rationale |
| Low | Low + Low, Low + Medium | — | Accept with note |

---

## Risks

### R-001 — FFprobe path injection via videoPath

| Field | Value |
|---|---|
| **Rating** | Critical |
| **Description** | `videoPath` is user-supplied at project creation and stored in DB. `selectedVideoSchema.path` is `z.string().min(1)` — completely unconstrained. A renderer can call `projects.create({video:{path:'/etc/passwd',...}})`, store an arbitrary absolute path, then call `projects.inspect(uuid)` to run FFprobe against it. The `..`-substring check does not mitigate this: it has false positives on benign filenames (e.g. `Directors.Cut..mp4`) and misses direct absolute paths to device nodes, named pipes, and special files. |
| **Likelihood** | Medium (renderer can call `project:create` with arbitrary `video.path` without going through dialog) |
| **Impact** | High (unauthorized file access, file-existence oracle, DoS via device/pipe) |
| **Mitigation** | (1) At `PROJECT_CREATE` handler: validate `video.path` using `stat().isFile()` — rejects device nodes, named pipes, directories, non-existent paths. (2) At `PROJECT_INSPECT` handler: re-validate DB-retrieved `videoPath` using `path.resolve()` + `stat().isFile()` before passing to FFprobe. (3) Pass resolved path as positional argument to `runCommand` argument array. (4) `shell: false` on the spawn call. (5) Add test cases for device path, named pipe, and directory inputs at both create and inspect time. |
| **Status** | Must implement (electron-security-reviewer confirmed) |
| **Owner** | Implementer |

---

### R-002 — FFprobe not available; project stuck in `draft`

| Field | Value |
|---|---|
| **Rating** | High |
| **Description** | If FFprobe is not installed, all new projects will fail inspection and stay `draft`. The user has no way to proceed without fixing the FFprobe configuration. |
| **Likelihood** | High (default Electron packaged build bundles FFprobe; but bundled binary may be wrong arch or missing on first dev run) |
| **Impact** | High (entire vertical slice is non-functional) |
| **Mitigation** | (1) System capabilities panel already shows FFprobe availability — user can identify the problem. (2) Settings page already allows FFprobe path override. (3) Inspection error message must include "Configure FFprobe path in Settings." (4) Document in HANDOFF doc. |
| **Status** | Accept with mitigation |
| **Owner** | Implementer |

---

### R-003 — Video file inaccessible after project creation

| Field | Value |
|---|---|
| **Rating** | Medium |
| **Description** | The video file path is stored at creation time. If the file is moved, renamed, or on a USB drive that is ejected before inspection, inspection fails. |
| **Likelihood** | Medium (local files are common; network shares and removable drives less so) |
| **Impact** | Medium (project stays `draft` or `inspection_failed`; user must fix manually) |
| **Mitigation** | (1) Return `FILE_NOT_FOUND` error code with clear message. (2) Document "Re-inspect" as future feature for when file is restored. (3) Project record not corrupted by failure. |
| **Status** | Accept with mitigation |
| **Owner** | Implementer |

---

### R-004 — FFprobe hangs on large or malformed files

| Field | Value |
|---|---|
| **Rating** | High (elevated from Medium — see R-001 fix rationale) |
| **Description** | `runCommand` has no timeout. FFprobe on a device file (`/dev/zero`), named pipe, or malformed media hangs indefinitely. Elevated from Medium because R-001 mitigation (`stat().isFile()`) catches most device/pipe inputs, but defense-in-depth requires a hard timeout regardless. `runCommand` must be extended to accept a `timeoutMs` option that kills the child and rejects with a timeout error. |
| **Likelihood** | Low after R-001 mitigation; Medium without it |
| **Impact** | High (hung IPC handler; UI unresponsive) |
| **Mitigation** | Add `timeoutMs` option to `runCommand`. All FFprobe inspection calls use 15 000 ms. Kill child process (via `AbortController` + `AbortSignal`) on expiry; return `FFPROBE_ERROR`. This is required before merge — not deferred. |
| **Status** | Must implement before merge |
| **Owner** | Implementer |

---

### R-005 — Raw FFprobe stderr surfaced to renderer

| Field | Value |
|---|---|
| **Rating** | High |
| **Description** | FFprobe stderr can contain file paths, codec licensing errors, or detailed system information. Passing raw stderr to the renderer is a information leakage risk and a security-relevant boundary violation. |
| **Likelihood** | High (easy mistake; natural to forward error message) |
| **Impact** | Medium (information leakage; not a direct exploit in local Electron app, but violates defense-in-depth) |
| **Mitigation** | (1) IPC handler converts FFprobe failure to structured error code only. (2) Zod contract validation on handler output rejects strings longer than a fixed limit. (3) Adversarial test: verify `inspectionError` field is a known code, not raw stderr. |
| **Status** | Must implement |
| **Owner** | Implementer; confirmed by governance-verifier |

---

### R-006 — DB migration breaks existing project data

| Field | Value |
|---|---|
| **Rating** | High |
| **Description** | Migration `0001_media_inspection.sql` adds nullable columns and reclassifies `'active'` status rows. If the migration is not reversible or is applied incorrectly, existing project records could be corrupted. |
| **Likelihood** | Low (adding nullable columns is safe in SQLite; `UPDATE SET status = 'draft'` is reversible) |
| **Impact** | High (data loss or corruption; no cloud backup in local-first app) |
| **Mitigation** | (1) Migration adds nullable columns only (no DROP or NOT NULL with no default). (2) `UPDATE projects SET status = 'draft' WHERE status = 'active'` before schema change. (3) Include rollback SQL in migration comments. (4) Test migration against fixture DB with all pre-M1 status values. |
| **Status** | Must implement + test |
| **Owner** | Implementer; database-reviewer must confirm |

---

### R-007 — IPC surface expansion introduces new attack surface

| Field | Value |
|---|---|
| **Rating** | Medium |
| **Description** | Adding `PROJECT_INSPECT` channel expands the IPC surface. A compromised renderer could call `project:inspect` with a crafted `projectId` or a path it shouldn't access. |
| **Likelihood** | Low (Electron sandbox + context isolation; `projectId` is UUID-validated by contract) |
| **Impact** | Medium (potential unauthorized file access via FFprobe on arbitrary paths) |
| **Mitigation** | (1) Input validated with `inspectProjectInputSchema` (UUID only). (2) Handler looks up `project.videoPath` from DB using the UUID — renderer cannot supply a direct file path. (3) Path validation on the DB-retrieved path (reject `..`). (4) electron-security-reviewer must sign off. |
| **Status** | Must implement + independent review |
| **Owner** | electron-security-reviewer |

---

### R-008 — New project status values break existing Zod validation

| Field | Value |
|---|---|
| **Rating** | Medium |
| **Description** | Existing renderer code that patterns-matches on `project.status` may not handle new values `'ready'` or `'inspection_failed'`. TypeScript compilation will catch missing cases in exhaustive switches, but runtime Zod validation will reject old-format data from pre-M1 DB rows. |
| **Likelihood** | Medium (pre-M1 DB rows have `'draft'`; `'active'` was never populated in production) |
| **Impact** | Medium (renderer crash or unexpected behavior) |
| **Mitigation** | (1) `projectStatusSchema` must include ALL valid values including `'draft'`. (2) Renderer must handle `'draft'` gracefully (never assumes all projects have been inspected). (3) TypeScript exhaustive check on status in `StatusPill` mapping. |
| **Status** | Must implement |
| **Owner** | Implementer |

---

### R-009 — No `runCommand` timeout (merged into R-004)

| Field | Value |
|---|---|
| **Rating** | N/A — superseded by R-004 |
| **Description** | Originally deferred as low-risk technical debt. Superseded: R-001 resolution elevated the threat surface (arbitrary paths possible if creation-time validation is missing), and R-004 was elevated to "must implement" accordingly. See R-004. |
| **Status** | Resolved: timeout is required — see R-004 |
| **Owner** | N/A |

---

## Risk summary

| Risk | Rating | Status |
|---|---|---|
| R-001 Path injection + arbitrary-path oracle | Critical | Must implement (stat().isFile() at create + resolve at inspect + shell:false) |
| R-002 FFprobe unavailable | High | Accept with mitigation (error message + settings link) |
| R-003 File inaccessible | Medium | Accept with mitigation (error code + future re-inspect) |
| R-004 FFprobe hang / timeout | High | Must implement before merge (AbortController 15s timeout in runCommand) |
| R-005 Raw stderr to renderer | High | Must implement (structured codes + max(64) schema bound) |
| R-006 Migration breaks data | High | Must test (reversible migration) |
| R-007 IPC surface expansion | Medium | Reviewed (electron-security-reviewer confirmed, see R-001 fix) |
| R-008 Status value changes | Medium | Must implement (exhaustive status handling, 'active' removed) |
| R-009 No timeout (deferred) | N/A | Superseded by R-004 — must implement |
