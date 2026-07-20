# M12 — Acceptance Criteria

## AC-M12-001: Render job creation

### AC-M12-001.1
`render:startForCandidate` with a valid UUID of an accepted candidate:
- Returns `{ jobId: string }` where `jobId` is a UUID
- DB record exists with `status='queued'` or `status='rendering'` before render completes
- `candidateId` on the job row matches the input

### AC-M12-001.2
`render:startForCandidate` with a candidateId whose `candidateStatus !== 'accepted'`:
- Returns structured error with code `CANDIDATE_NOT_ACCEPTED`
- No render job created in DB

### AC-M12-001.3
`render:startForCandidate` with a non-existent candidateId (valid UUID format):
- Returns structured error with code `CANDIDATE_NOT_FOUND`

### AC-M12-001.4
`render:startForCandidate` when a rendering job already exists for that candidateId:
- Returns structured error with code `RENDER_ALREADY_IN_PROGRESS`
- No duplicate render job created

### AC-M12-001.5
`render:startForCandidate` when project has no output directory configured:
- Returns structured error with code `OUTPUT_DIRECTORY_NOT_CONFIGURED`

### AC-M12-001.6
`render:startForCandidate` with a non-UUID candidateId:
- Rejected at preload validation (throws before reaching handler)

## AC-M12-002: Render job status

### AC-M12-002.1
`render:getJob` with a valid job UUID:
- Returns `{ job: RenderJob }` with all fields present
- `status` is one of `queued|rendering|complete|failed`

### AC-M12-002.2
`render:getJob` with a non-existent job UUID:
- Returns structured error with code `JOB_NOT_FOUND`

### AC-M12-002.3
After a successful render:
- `status = 'complete'`
- `progress = 1.0`
- `outputPath` is non-null and points to an `.mp4` file
- `renderErrorCode = null`

### AC-M12-002.4
After a failed render (e.g., FFmpeg error):
- `status = 'failed'`
- `renderErrorCode` is a non-null error code string
- `outputPath = null`

## AC-M12-003: FFmpeg argument construction (unit-tested, pure)

### AC-M12-003.1
`buildFfmpegArgs` with `backgroundStyle='blur'` and target resolution `1080x1920`:
- Args include `-ss`, `-i`, `-t`, `-vf`, `-c:v libx264`, `-preset fast`, `-crf 23`, `-c:a aac`, `-b:a 128k`, `-movflags +faststart`, `-progress pipe:2`, `-y`
- `-vf` includes `split`, `gblur`, `overlay`, `subtitles`
- `-ss` value = `startMs / 1000`
- `-t` value = `(endMs - startMs) / 1000`

### AC-M12-003.2
`buildFfmpegArgs` with `backgroundStyle='crop'`:
- `-vf` does NOT include `split` or `gblur`
- `-vf` includes `scale=W:H:force_original_aspect_ratio=increase,crop=W:H`

### AC-M12-003.3
`buildFfmpegArgs` produces argument array (not command string):
- Return type is `string[]`
- No shell metacharacters in any computed argument value (no `|`, `&`, `;`, `$()`)

### AC-M12-003.4
`buildFfmpegArgs` with `fontColor='#FF3300'`:
- Converts to ASS `&H000033FF` (reversed BGR) in the subtitles force_style

### AC-M12-003.5
`buildFfmpegArgs` with `subtitlePosition='center'`:
- subtitles force_style includes `Alignment=5`

### AC-M12-003.6
`buildFfmpegArgs` with `subtitlePosition='bottom'`:
- subtitles force_style includes `Alignment=2`

### AC-M12-003.7
`buildFfmpegArgs` with `subtitlePosition='top'`:
- subtitles force_style includes `Alignment=8`

### AC-M12-003.8
`buildFfmpegArgs` when temp SRT path contains colon (Windows `C:\path`):
- Colon in path is escaped as `\\:` in the `subtitles=` argument

## AC-M12-004: SRT writer (unit-tested, pure)

### AC-M12-004.1
`writeSrt(cues)` with 3 cues:
- Output is valid SRT format (sequence number, timestamp line, text, blank line separator)
- Timestamps format: `HH:MM:SS,mmm --> HH:MM:SS,mmm`

### AC-M12-004.2
`writeSrt([])` with empty cues:
- Returns empty string (no header lines)

### AC-M12-004.3
`writeSrt` with cue text containing `<b>bold</b>`:
- HTML tags stripped from output

## AC-M12-005: Progress parser (unit-tested, pure)

### AC-M12-005.1
`parseProgress('out_time_ms=3456000\n', clipDurationMs=10000)`:
- Returns `0.3456` (within floating point tolerance)

### AC-M12-005.2
`parseProgress('frame=123\n', clipDurationMs=10000)`:
- Returns `null` (non-progress line)

### AC-M12-005.3
`parseProgress('out_time_ms=99999999\n', clipDurationMs=10000)`:
- Returns `1.0` (clamped to 1.0)

## AC-M12-006: Render output file

### AC-M12-006.1
After successful render, output file exists on disk:
- Path matches `{outputDirectory}/{jobId}.mp4`
- File is non-empty (> 0 bytes)

### AC-M12-006.2
Temp SRT file is deleted after render completes (success or failure):
- `os.tmpdir()/{jobId}.srt` does not exist after render returns

## AC-M12-007: Open output file

### AC-M12-007.1
`render:openOutputFile` with a jobId of a completed render job:
- Returns `{ opened: true }`
- `shell.openPath` called with the `outputPath` read from the DB row for that jobId
- Renderer never passes a path string — only a UUID

### AC-M12-007.2
`render:openOutputFile` with a jobId of a job whose `outputPath` is null (not yet complete):
- Returns structured error `OUTPUT_PATH_NOT_READY`

### AC-M12-007.3
`render:openOutputFile` with a jobId that does not exist:
- Returns structured error `JOB_NOT_FOUND`

### AC-M12-007.4
`render:openOutputFile` input schema rejects non-UUID jobId at preload validation.

## AC-M12-008: Renderer UI

### AC-M12-008.1
Candidate with `candidateStatus='accepted'` shows "Render" button in detail view.

### AC-M12-008.2
Candidate with `candidateStatus='suggested'` or `'skipped'` does not show "Render" button.

### AC-M12-008.3
Click "Render" → button shows loading/rendering state, "Render" button disabled.

### AC-M12-008.4
After render completes (`status='complete'`): output path displayed, "Open in Finder" button visible.

### AC-M12-008.5
After render fails (`status='failed'`): human-readable error message shown (not raw error code).

### AC-M12-008.6
"Open in Finder" click calls `render.openOutputFile(outputPath)`.

## AC-M12-009: Security invariants

### AC-M12-009.1
No `shell: true` in any FFmpeg spawn call.

### AC-M12-009.2
FFmpeg binary path is resolved server-side; not controllable from renderer payload.

### AC-M12-009.3
Output path constructed server-side from job UUID + project output directory; not passed in IPC payload.

### AC-M12-009.4
`render:startForCandidate` payload contains `candidateId` only — no paths, no binary names.

### AC-M12-009.6
`render:openOutputFile` payload contains `jobId` only — no path strings from renderer to main.

### AC-M12-009.7
Path containment check uses `path.relative(base, target)` + `!isAbsolute && !startsWith('..')` — not `startsWith(base)` string comparison.

### AC-M12-009.8
Orphaned `rendering`/`queued` jobs from a prior crash are updated to `status='failed', renderErrorCode='INTERRUPTED_BY_RESTART'` on startup.

### AC-M12-009.9
Fire-and-forget async render body has a top-level `try/catch` that writes `status='failed'` to DB on any uncaught error.

### AC-M12-009.5
Render timeout and output byte cap are hardcoded server-side; renderer cannot override.
