# YouTube Clipper Skill — FFmpeg Review

**Audit commit**: f31f077ee0905c95a510a6f34bbd0c3c85b15129  
**Date**: 2026-07-20

---

## Command Inventory

### Command 1 — Video Clipping (clip_video.py)

```
ffmpeg -ss {start_seconds} -i {input_path} -t {duration_seconds} -c copy -y {output_path}
```

| Attribute | Value | SceneSift verdict |
|---|---|---|
| Executable | `ffmpeg` (system PATH) | Needs validation at startup |
| Seek placement | `-ss` BEFORE `-i` (input seek) | Fast but GOP-bounded — see accuracy note below |
| `-t` vs `-to` | `-t` (duration, not end timestamp) | Acceptable — requires duration calculation |
| Codec strategy | `-c copy` stream copy | **NOT frame-accurate** — REJECT as production strategy |
| Overwrite | `-y` unconditional | **REJECT** — use collision policy |
| Timeout | None | **REJECT** — add `timeoutMs` |
| Output size cap | None | **REJECT** — add `maxOutputBytes` |
| Cancellation | None | **REJECT** — need kill handle |
| Progress | None | Need `-progress pipe:1` or stderr parsing |
| stderr handling | `capture_output=True` unbounded | **REJECT** — bound stderr |
| Temporary files | None for clip step | Acceptable |
| Cleanup | N/A | Acceptable |
| Path escaping | None (paths passed as list items) | Acceptable for most paths; subtitle filter needs additional escaping |
| Platform | Assumes ffmpeg on PATH | Need configurable path with validation |

**Seek accuracy note**: When `-ss` is placed BEFORE `-i`, FFmpeg seeks to the nearest keyframe (GOP boundary) before the requested timestamp. For H.264 video with default GOP size (typically 2-4 seconds), the clip will start 0-4 seconds earlier than requested. The rendered output contains frames before the intended start.

If `-ss` is placed AFTER `-i` (output seek), seeking is frame-accurate but slow (must decode from beginning). For production clips, the correct approach is:
1. Use input seek (`-ss` before `-i`) for efficient seeking to approximate position
2. Then use `-ss` again after `-i` for fine-grained frame accuracy (two-pass seek)
OR
3. Transcode with `-ss` before `-i` and accept the first keyframe as the real start

SceneSift M12 must document this tradeoff and default to accurate mode for user-facing clips.

---

### Command 2 — Subtitle Burn-in (burn_subtitles.py)

```
{ffmpeg_path} -i {temp_video} -vf "subtitles={temp_subtitle}:force_style='FontSize={size},MarginV={margin}'" -c:a copy -y {temp_output}
```

| Attribute | Value | SceneSift verdict |
|---|---|---|
| Executable | `ffmpeg_path` (resolved at startup) | Good pattern — configurable path |
| Input | Video from temp directory | Source video copied to temp — REJECT strategy |
| Video filter | `subtitles=path:force_style='...'` | Correct filter syntax — ADAPT concept |
| FontSize | Configurable (default 24) | Useful default |
| MarginV | Configurable (default 30) | Useful default |
| Audio codec | `-c:a copy` (copy audio, re-encode video) | Correct — subtitle burn requires video re-encode |
| Video codec | Implicit — libx264 default | Need explicit codec in SceneSift |
| Overwrite | `-y` unconditional | **REJECT** — use collision policy |
| Timeout | None | **REJECT** — add `timeoutMs` |
| Cancellation | None | **REJECT** |
| Progress | None | Need progress reporting |
| stderr | `capture_output=True` unbounded | **REJECT** — bound stderr |
| Temporary files | Full video copy via `tempfile.mkdtemp()` | **REJECT** — see below |
| Cleanup | `shutil.rmtree(ignore_errors=True)` | REJECT ignore_errors; log failures |
| Path escaping | None on filter argument | **RISK** — subtitle paths with colons or backslashes break filter parser |
| Platform | ffmpeg-full path hardcoded for macOS | Adapt: configurable + libass detection |

**Subtitle filter path escaping**: The FFmpeg `subtitles` filter uses ASS filter format for its argument. In this format, colons `:` are parameter separators and backslashes `\` are escape characters. A Windows subtitle path like `C:\Users\Jake\clip.srt` will break the filter parser. Required escaping:
- `\` → `\\`
- `:` → `\:`
- `'` → `\'`

The external skill's workaround (copy everything to a tempdir with a space-free path) partially addresses the space issue but does NOT address Windows drive letter colons. The correct approach is to escape the subtitle path properly, and for the subtitle file only (small), a sanitized temp copy is acceptable.

---

### Command 3 — libass Detection (install_as_skill.sh, burn_subtitles.py)

Shell version:
```bash
ffmpeg -filters 2>&1 | grep -q "subtitles"
```

Python version:
```python
result = subprocess.run([ffmpeg_path, '-filters'], capture_output=True, text=True)
'subtitles' in result.stdout
```

| Attribute | Value | SceneSift verdict |
|---|---|---|
| Pattern | Check for 'subtitles' in `-filters` output | Correct |
| Timeout | None (fast command, low risk) | Add short timeout (5s) for safety |
| shell | False in Python version | Correct |
| Accuracy | 'subtitles' filter requires libass | Correct — this is the right proxy |
| Caching | Not implemented | SceneSift should cache result per session |

**SceneSift adaptation**: Run `[ffmpegPath, '-filters']` via `runCommand` with `{ timeoutMs: 5000, maxOutputBytes: 65536 }`. Parse stdout for string `'subtitles'`. Cache boolean result in ffmpegService instance. Expose as `ffmpegService.supportsSubtitleBurnIn(): Promise<boolean>`.

---

### Command 4 — FFmpeg Version Check (inferred from install_as_skill.sh)

```bash
ffmpeg -version | head -n 1
```

| Attribute | Value |
|---|---|
| Purpose | Verify FFmpeg present and get version string |
| SceneSift | M1 already does this via `ffmpegService.detectBinaries()` |

No change needed — already implemented.

---

## Cross-Platform FFmpeg Path Handling

The external skill handles macOS separately:
```python
if os.path.exists("/opt/homebrew/opt/ffmpeg-full/bin/ffmpeg"):
    return "/opt/homebrew/opt/ffmpeg-full/bin/ffmpeg"  # Apple Silicon
elif os.path.exists("/usr/local/opt/ffmpeg-full/bin/ffmpeg"):
    return "/usr/local/opt/ffmpeg-full/bin/ffmpeg"  # Intel Mac
elif shutil.which("ffmpeg"):
    return "ffmpeg"  # PATH
```

**SceneSift**: M1 already implements FFmpeg binary detection. M12 should add an additional check specifically for libass-capable builds on macOS (prefer `ffmpeg-full` if present). If libass is unavailable, subtitle burn-in is disabled in the UI — not an error.

---

## Temporary File Strategy Assessment

The full-video copy approach:
```
Source video (potentially 2+ GB)
→ shutil.copy2() to tempfile.mkdtemp()
→ FFmpeg reads temp copy
→ shutil.rmtree() temp on success/failure
```

**Problems**:
1. No disk-space check before copy — fails silently on full disk
2. Full-video copy is slow and unnecessary — only the subtitle file needs a sanitized path
3. Cross-volume copy is O(size) — may take minutes for large videos
4. On copy failure mid-way, partial file is left in temp
5. `ignore_errors=True` suppresses cleanup failures

**Correct approach for SceneSift M12**:
1. Copy only the subtitle file to a temp path with sanitized name
2. Pass the original video path directly to FFmpeg input
3. Escape the subtitle file path for the filter argument (backslash/colon escaping)
4. Apply cleanup to subtitle temp file only
5. Log cleanup failures at debug level (no content)

---

## Stream-Copy vs Transcode Comparison

| Strategy | Command | Speed | Frame accuracy | When to use |
|---|---|---|---|---|
| Stream copy | `-c copy` | Fast (no decode/encode) | GOP-bounded (~0-4s error) | NOT for user-facing clips |
| Input seek + transcode | `-ss {start} -i {input} -t {duration} -c:v libx264 -c:a aac` | Moderate | Approximate (nearest keyframe) | Default SceneSift mode |
| Two-pass seek | `-ss {approx_start} -i {input} -ss {fine_offset} -t {duration} -c:v libx264` | Slightly slower | Frame-accurate | Precision mode |
| Re-encode from 0 | `-i {input} -ss {start} -t {duration} -c:v libx264` | Slow for long files | Frame-accurate | Reference mode |

**SceneSift M12 recommendation**: Default to single-pass input seek + transcode (`-ss before -i`, `-c:v libx264 -crf 18-23 -c:a aac`). This balances speed and accuracy. Document that clips may start up to one GOP length before the requested timestamp for streams with long GOPs.

---

## Subtitle Burn-in Filter Evaluation

The `subtitles` filter with `force_style` is the standard libass subtitle rendering approach:

```
-vf "subtitles=path/to/file.srt:force_style='FontSize=24,MarginV=30'"
```

**Strengths**:
- Uses libass for high-quality rendering
- force_style overrides are well-supported
- Works with SRT (not just ASS)
- FontSize and MarginV are the most important controls for vertical video

**Additional style parameters useful for M11 (vertical composition)**:
- `Alignment=2` — center-bottom (default, usually desired)
- `Bold=1` — bold font
- `OutlineColour=&H40000000` — semi-transparent outline
- `Fontname=Arial` — cross-platform fallback font

**Limitations**:
- Requires libass-enabled FFmpeg
- Path escaping is critical (colons, backslashes)
- Font rendering varies by system fonts
- Does not support complex ASS animations

**SceneSift verdict**: This is the correct approach for M11/M12 subtitle burn-in. ADAPT the command concept with proper escaping and governance controls.

---

## Progress Reporting Gap

Neither `clip_video.py` nor `burn_subtitles.py` implements FFmpeg progress reporting. The FFmpeg `-progress pipe:1` flag outputs structured key-value progress to a file descriptor:

```
out_time=00:00:05.250000
frame=132
speed=2.5x
progress=continue
```

SceneSift M12 must implement progress reporting. Options:
1. Parse `-progress pipe:1` stdout stream (most reliable)
2. Parse `stderr` for `time=HH:MM:SS` lines (simpler but fragile)
3. Named pipe for progress + stderr for errors

Recommend option 1 with `-progress pipe:1` to stdout and stderr captured separately for error detection.
