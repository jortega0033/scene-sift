# M12 — Test Plan

## Unit tests (Vitest, node environment)

### tests/main/buildFfmpegArgs.test.ts

Pure function tests — no mocks needed.

| Test | What it verifies |
|---|---|
| blur + 1080x1920: args include split,gblur,overlay | AC-M12-003.1 |
| crop + 1080x1920: no gblur in -vf | AC-M12-003.2 |
| returns string[] not string | AC-M12-003.3 |
| fontColor #FF3300 → ASS &H000033FF | AC-M12-003.4 |
| subtitlePosition=center → Alignment=5 | AC-M12-003.5 |
| subtitlePosition=bottom → Alignment=2 | AC-M12-003.6 |
| subtitlePosition=top → Alignment=8 | AC-M12-003.7 |
| Windows path colon escaped as \\: | AC-M12-003.8 |
| -ss value = startMs/1000 | AC-M12-003.1 |
| -t value = durationMs/1000 | AC-M12-003.1 |

### tests/main/srtWriter.test.ts

| Test | What it verifies |
|---|---|
| 3 cues → valid SRT format | AC-M12-004.1 |
| empty cues → empty string | AC-M12-004.2 |
| HTML tags stripped | AC-M12-004.3 |
| cue with 0 start time | boundary |
| very long text truncated at 500 chars | safety |

### tests/main/progressParser.test.ts

| Test | What it verifies |
|---|---|
| out_time_ms=3456000, dur=10000 → 0.3456 | AC-M12-005.1 |
| non-progress line → null | AC-M12-005.2 |
| out_time_ms exceeds duration → 1.0 | AC-M12-005.3 |
| out_time_ms=0 → 0 | boundary |
| malformed line → null | edge case |

### tests/main/clipRenderService.test.ts

Integration-style unit test with mocked I/O.
- `// @vitest-environment node`
- Mock `runCommand`, `fs/promises`, `os.tmpdir`
- Mock `DatabaseService`

| Test | What it verifies |
|---|---|
| renders blur clip: calls runCommand with correct args | integration |
| creates render job with candidateId | AC-M12-001.1 |
| temp SRT file written and deleted on success | AC-M12-006.2 |
| temp SRT file deleted on FFmpeg failure | AC-M12-006.2 |
| updates job to complete on exitCode 0 | AC-M12-002.3 |
| updates job to failed on PROCESS_TIMEOUT | AC-M12-002.4 |
| updates job to failed on non-zero exitCode | AC-M12-002.4 |
| throws CANDIDATE_NOT_FOUND for unknown candidateId | AC-M12-001.3 |
| throws CANDIDATE_NOT_ACCEPTED for non-accepted status | AC-M12-001.2 |
| throws RENDER_ALREADY_IN_PROGRESS for duplicate | AC-M12-001.4 |
| throws OUTPUT_DIRECTORY_NOT_CONFIGURED | AC-M12-001.5 |

### tests/main/renderHandlers.test.ts

IPC handler registration and dispatch tests (pattern: compositionHandlers.test.ts).

| Test | What it verifies |
|---|---|
| render:startForCandidate registered | registration |
| render:getJob registered | registration |
| render:openOutputFile registered | registration |
| startForCandidate valid uuid → returns jobId | AC-M12-001.1 |
| startForCandidate non-uuid → rejects | AC-M12-001.6 |
| getJob valid uuid → returns job | AC-M12-002.1 |
| getJob non-uuid → rejects | input validation |
| openOutputFile valid jobId → returns opened:true | AC-M12-007.1 |
| openOutputFile jobId with null outputPath → OUTPUT_PATH_NOT_READY | AC-M12-007.2 |
| openOutputFile non-existent jobId → JOB_NOT_FOUND | AC-M12-007.3 |
| openOutputFile non-uuid jobId → rejects at preload | AC-M12-007.4 |

### tests/main/ipc-contracts.test.ts additions (REQUIRED per .claude/rules/preload-ipc.md)

New describe block `render ipc contracts`:
- `render:startForCandidate`: input schema accepts uuid, output schema has `jobId: uuid`
- `render:getJob`: input schema accepts uuid, output schema has `job.status` enum, `job.progress` number
- `render:openOutputFile`: input schema accepts uuid (not string), output schema has `opened: boolean`

### tests/renderer/RenderButton.test.tsx

Component tests with mocked `window.sceneSift.render`.

| Test | What it verifies |
|---|---|
| accepted candidate shows Render button | AC-M12-008.1 |
| suggested candidate hides Render button | AC-M12-008.2 |
| click Render shows rendering state | AC-M12-008.3 |
| complete status shows output path | AC-M12-008.4 |
| failed status shows human-readable error | AC-M12-008.5 |
| Open in Finder calls openOutputFile | AC-M12-008.6 |

### tests/main/database-service.test.ts additions

New describe block for render job DB methods:
- `createRenderJob`: creates row with status='queued', correct candidateId
- `createRenderJob` for same candidateId while one is 'queued' → throws RENDER_ALREADY_IN_PROGRESS (partial unique index)
- `updateRenderJobStatus`: updates status, progress, outputPath, renderErrorCode
- `getRenderJob`: returns null for unknown jobId
- Migration 0009 dry-run: apply migration against pre-existing fixture with demo job rows → verify no data loss, partial index exists

### tests/main/clipRenderService.test.ts additions

- Fire-and-forget error: throw at DB read stage → job row ends up status='failed' (AC-M12-009.9)
- Top-level try/catch covers FFmpeg failure AND pre-render validation failure

## What is NOT tested

- Actual FFmpeg execution on disk (integration/E2E only — requires FFmpeg binary)
- Real `.mp4` output file (integration/E2E)
- OS `shell.openPath` behavior (mocked in handler tests)

## Test count target

+30–35 unit tests, bringing total to ~765+ (from 733 baseline).
