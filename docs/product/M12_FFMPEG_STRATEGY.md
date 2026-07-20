# M12 — FFmpeg Filter Graph Strategy

## Input assumptions

- Source video: arbitrary resolution (e.g., 1920×1080 landscape, or already vertical)
- Target resolution: one of `['1080x1920', '720x1280', '1080x1080', '1920x1080']` from composition settings
- Clip bounds: `startMs` / `endMs` from clip_candidates (accurate to millisecond)
- Subtitle cues: from clip_cues (sequenceIndex, startMs, endMs, text)
- Composition: backgroundStyle ∈ {blur, crop}, subtitlePosition ∈ {bottom, center, top}, fontFamily, fontSize, fontColor

## Timing precision

Use `-ss` before `-i` (input seeking) for fast seek to keyframe, then `-to` with the target end time (relative to stream start). This is the correct form for accurate short-clip extraction:

```
ffmpeg -ss {startSec} -i {videoPath} -t {durationSec} ...
```

Where `startSec = startMs / 1000`, `durationSec = (endMs - startMs) / 1000`.

Note: `-ss` before `-i` uses stream timestamps; `-t` specifies duration from the sought point.

## Filter graph construction

### Blur background (default)

Target width W, height H (e.g., 1080x1920):

```
[0:v]split=2[bg][fg];
[bg]scale=W:H:force_original_aspect_ratio=increase,crop=W:H,gblur=sigma=20[blurred];
[fg]scale=W:H:force_original_aspect_ratio=decrease,pad=W:H:(ow-iw)/2:(oh-ih)/2:color=black@0.0[padded];
[blurred][padded]overlay=(W-w)/2:(H-h)/2[composed]
```

Then `[composed]` → subtitle filter → output.

### Crop background

```
[0:v]scale=W:H:force_original_aspect_ratio=increase,crop=W:H[composed]
```

### Subtitle burn-in

Write cues to a temp `.srt` file in `os.tmpdir()`:

```
{seqNum}
{HH:MM:SS,mmm} --> {HH:MM:SS,mmm}
{text}
```

Then append to filter chain:

```
[composed]subtitles={escapedTmpPath}:force_style='FontName={fontFamily},FontSize={fontSize},PrimaryColour={assColor},Outline=1,Shadow=0,MarginV={marginV}[out]
```

Where:
- `escapedTmpPath`: POSIX path, colon escaped as `\\:` on all platforms (subtitles filter requires this)
- `assColor`: convert `#RRGGBB` → `&H00BBGGRR` (ASS color format is reversed BGR with `&H00` prefix)
- `marginV`: bottom=40, center=0 (vposition=4/8 via Style Alignment instead — see below)
- Subtitle alignment: bottom=2 (bottom-center ASS alignment), center=5 (screen-center), top=8

ASS Alignment field via `force_style`:
- bottom: `Alignment=2`
- center: `Alignment=5,MarginV=0`  
- top: `Alignment=8,MarginV=40`

## Full FFmpeg argument array (blur example, 1080x1920)

```typescript
[
  '-ss', String(startSec),
  '-i', videoPath,
  '-t', String(durationSec),
  '-vf', [blurFilterChain, subtitlesFilter].join(','),
  '-c:v', 'libx264',
  '-preset', 'fast',
  '-crf', '23',
  '-c:a', 'aac',
  '-b:a', '128k',
  '-movflags', '+faststart',
  '-progress', 'pipe:2',
  '-y',
  outputPath,
]
```

`-progress pipe:2` sends machine-readable progress to stderr. `-y` overwrites existing output without prompting.

## Progress parsing

FFmpeg with `-progress pipe:2` writes lines like:
```
out_time_ms=3456789
```

Parse `out_time_ms=(\d+)` lines. Divide by clip duration µs to get 0.0–1.0 progress:

```typescript
const match = line.match(/^out_time_ms=(\d+)$/);
if (match) {
  const elapsedMs = parseInt(match[1], 10) / 1000;
  progress = Math.min(1.0, elapsedMs / clipDurationMs);
}
```

Since FFmpeg writes progress incrementally and `runCommand` buffers all stderr at end, M12 progress will only update to 1.0 on completion. Incremental progress requires streaming stderr — deferred to M13.

For M12: progress = 0.0 while rendering, 1.0 on success. The DB is updated once after completion.

## Path safety

- `outputPath = path.join(resolvedOutputDir, `${candidateId}.mp4`)`
- `resolvedOutputDir = path.resolve(project.outputDirectory)` — must not contain `..`
- Validate: resolved path starts with known safe prefix (project output dir)
- Temp SRT path: `path.join(os.tmpdir(), `${jobId}.srt`)` — os.tmpdir() is safe

## Resource limits

- `timeoutMs`: `Math.max(60_000, durationSec * 10 * 1000)` capped at `300_000` (5 min)
  - Rationale: libx264 fast preset typically 5–8× realtime; 10× gives headroom
- `maxOutputBytes`: `10_485_760` (10 MB) for FFmpeg stderr + progress output

## Temp file cleanup

Always clean up temp SRT in a `finally` block after `runCommand` returns. Use `fs.unlink` (ignore ENOENT).
