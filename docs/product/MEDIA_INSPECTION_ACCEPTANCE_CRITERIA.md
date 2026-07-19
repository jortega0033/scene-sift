# SceneSift — Media Inspection Acceptance Criteria

Milestone: M1 — Project Media Ingestion and Inspection
Date: 2026-07-19

---

## Format

Each criterion is a testable pass/fail condition. "AC" = Acceptance Criterion. Reference user story IDs from `MEDIA_INGESTION_USER_STORIES.md`.

---

## AC-001 — Automatic inspection on creation (US-001)

| # | Condition | Pass if |
|---|---|---|
| AC-001-A | Inspection triggers after project creation | `projects.inspect(projectId)` is called by renderer immediately after `projects.create()` resolves |
| AC-001-B | No manual trigger required | Metadata appears without additional user action |
| AC-001-C | Inspection does not block project creation response | `projects.create()` resolves before inspection starts |
| AC-001-D | Project appears in list immediately (as `draft`) | List updates before inspection completes |

---

## AC-002 — Metadata display (US-002)

| # | Condition | Pass if |
|---|---|---|
| AC-002-A | Duration displayed | Project detail shows duration in `HH:MM:SS` or `MM:SS` format, matching FFprobe `format.duration` |
| AC-002-B | Resolution displayed | Project detail shows `{width} × {height}` in pixels |
| AC-002-C | Codec displayed | Project detail shows FFprobe `streams[].codec_name` for the video stream |
| AC-002-D | Frame rate displayed | Project detail shows fps derived from `streams[].avg_frame_rate` (e.g., 23.97) |
| AC-002-E | File size displayed | Project detail shows file size in human-readable form (e.g., 4.2 GB) |
| AC-002-F | Bit rate displayed | Project detail shows bit rate (e.g., 14.2 Mbps) |
| AC-002-G | All metadata uses design tokens | No hardcoded hex, px, or rgb values in new renderer code |
| AC-002-H | Long values truncate gracefully | A very long codec name (>30 chars) does not break layout |

---

## AC-003 — Metadata persistence (US-003)

| # | Condition | Pass if |
|---|---|---|
| AC-003-A | Metadata survives restart | `listProjects()` returns metadata-populated records after app restart |
| AC-003-B | Metadata stored in SQLite | `SELECT duration_seconds, width, height FROM projects WHERE id = ?` returns non-null for an inspected project |
| AC-003-C | `inspected_at` timestamp stored | `inspected_at` column is populated with Unix ms timestamp |

---

## AC-004 — Inspection failure errors (US-004)

| # | Condition | Pass if |
|---|---|---|
| AC-004-A | FFprobe unavailable → user-visible message | Project detail shows `"Inspection failed: FFprobe unavailable"` |
| AC-004-B | File not found → user-visible message | Project detail shows `"Inspection failed: file not found or inaccessible"` |
| AC-004-C | No video stream → user-visible message | Project detail shows `"Inspection failed: no video stream found"` |
| AC-004-D | Raw FFprobe stderr NOT shown | `inspectionError` field contains a structured code string, not raw process output |
| AC-004-E | Inspection failure → project record intact | The project record still exists with its original name and videoPath after failed inspection |

---

## AC-005 — Status badge (US-005)

| # | Condition | Pass if |
|---|---|---|
| AC-005-A | Successful inspection → `ready` status | `projectSchema.status` = `'ready'` after successful inspect call |
| AC-005-B | Failed inspection → `inspection_failed` status | `projectSchema.status` = `'inspection_failed'` after failed inspect call |
| AC-005-C | `ready` status shows "ok" indicator | `StatusPill` receives `status="ok"` variant for `'ready'` |
| AC-005-D | `inspection_failed` shows neutral/error indicator | `StatusPill` receives appropriate variant |
| AC-005-E | Status visible in project list row | Status pill shown in list row, not only in detail panel |

---

## AC-006 — Non-destructive failure (US-006)

| # | Condition | Pass if |
|---|---|---|
| AC-006-A | Failed inspection does not delete project | Project record still exists and is listable after inspection fails |
| AC-006-B | Failed inspection does not corrupt other projects | Other project records are unaffected |
| AC-006-C | `videoPath` unchanged after failed inspection | `projects.videoPath` retains the original value |
| AC-006-D | Multiple failed inspections idempotent | Calling inspect twice on a `'draft'` project does not create duplicate records or errors |

---

## AC-007 — No raw errors to renderer (US-007)

| # | Condition | Pass if |
|---|---|---|
| AC-007-A | FFprobe stderr not passed through IPC | The `inspectionError` field returned by the IPC handler is a structured code, not raw stderr text |
| AC-007-B | Raw exception message not surfaced | No `Error.message` containing FFprobe internal details sent to renderer |
| AC-007-C | IPC contract validates output | Zod validation on handler output rejects unstructured error strings |

---

## AC-008 — Upgrade path (US-008)

| # | Condition | Pass if |
|---|---|---|
| AC-008-A | Existing projects display without crash | Projects with null metadata columns render without throwing in renderer |
| AC-008-B | "Not yet inspected" placeholder shown | Project detail shows a placeholder for each metadata field when metadata is null |
| AC-008-C | Migration safe on existing DB | Running `0001_media_inspection.sql` on a DB with existing project rows does not fail |

---

## AC-009 — Test coverage

| # | Condition | Pass if |
|---|---|---|
| AC-009-A | Unit tests for `inspectMediaFile` | `tests/main/ffmpegService.inspect.test.ts` exists and covers: happy path, file not found, no video stream, FFprobe unavailable |
| AC-009-B | IPC contract test updated | `tests/main/ipc-contracts.test.ts` includes `PROJECT_INSPECT` channel |
| AC-009-C | DB method unit test | `databaseService.updateProjectInspection()` tested with valid + null metadata |
| AC-009-D | E2E golden path | `tests/e2e/media-inspection.e2e.spec.ts` covers: create project → inspect → see metadata |
| AC-009-E | Visual test updated | At least one visual test baseline updated to include metadata display |

---

## AC-010 — Governance gate

| # | Condition | Pass if |
|---|---|---|
| AC-010-A | `pnpm governance:validate` exits 0 | No new forbidden patterns, valid gate.yaml, CI pinning intact |
| AC-010-B | `pnpm typecheck` exits 0 | No type errors in any modified file |
| AC-010-C | `pnpm lint` exits 0 | max-warnings=0 |
| AC-010-D | `pnpm test` passes all tests | No new failures, no `.skip`/`.only` introduced |
| AC-010-E | `pnpm build` exits 0 | Production build succeeds |
| AC-010-F | Independent verifier approved | Verifier is a different agent/role than implementer; ran real commands |
| AC-010-G | Human approved | Human review and approval before merge |
