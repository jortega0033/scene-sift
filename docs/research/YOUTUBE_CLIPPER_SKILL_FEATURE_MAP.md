# YouTube Clipper Skill — Feature Map

**Audit commit**: f31f077ee0905c95a510a6f34bbd0c3c85b15129  
**Date**: 2026-07-20

---

## Component-to-Milestone Matrix

| External component | External file | Purpose | SceneSift milestone | SceneSift equivalent today | Potential benefit | Security concerns | Architecture concerns | License concerns | Classification | Recommended action |
|---|---|---|---|---|---|---|---|---|---|---|
| Installation script | install_as_skill.sh | Copy files to ~/.claude/skills/, install Python deps | N/A | N/A — Electron packaged app | None | Modifies user-level Claude config (forbidden) | Claude Code skill model incompatible | MIT | REJECT | Do not use |
| Utility: time_to_seconds | scripts/utils.py | String timestamp → float seconds | M9 | None yet | Test-case reference | None | Need TypeScript port | MIT (algo free) | ADAPT | Port as pure TS utility with unit tests |
| Utility: seconds_to_time | scripts/utils.py | Float seconds → formatted string | M9 | None yet | Test-case reference | None | Need TypeScript port | MIT (algo free) | ADAPT | Port as pure TS utility |
| Utility: parse_time_range | scripts/utils.py | "HH:MM - HH:MM" string → (start, end) seconds | M9 | None yet | Test-case reference | Unbounded parse | Need TypeScript port | MIT (algo free) | ADAPT | Port with input validation |
| Utility: adjust_subtitle_time | scripts/utils.py | Rebase cue time by subtracting clip start | M10 | None yet | Core rebase algorithm | None | Clean-room port | MIT (algo free) | ADAPT | Port as pure TS with integer-ms semantics |
| Utility: sanitize_filename | scripts/utils.py | Remove illegal chars, cap length | M14 | None yet | Deterministic naming | Regex `[<>:"/\\|?*]` is unbounded on long strings (low risk) | Need TypeScript port | MIT (algo free) | ADAPT | Port with length and input guards |
| Utility: format_file_size | scripts/utils.py | Bytes → human-readable string | Already in M1 mediaFormatters.ts | formatFileSize already implemented | None | None | Duplicate | MIT | REFERENCE ONLY | Already done in SceneSift |
| Utility: create_output_dir | scripts/utils.py | Per-session timestamped output directory | M14 | None yet | Output organization | None | Need TypeScript port; use crypto.randomUUID not timestamp | MIT (algo free) | ADAPT | Port with project-scoped dir instead of timestamp |
| VTT analysis | scripts/analyze_subtitles.py | Read whole VTT, format for Claude | M7 | M5 TranscriptService | Chapter transcript format | f.read() unbounded; regex `<[^>]+>` unbounded | Superseded by M5 accepted implementation | MIT | REFERENCE ONLY | Use M5 SubtitleDocument as input, not VTT file |
| Video download | scripts/download_video.py | yt-dlp YouTube download | Post-M14 | None | N/A for M6–M14 | Network call, no consent gate, no timeout | Architecture incompatible | MIT (yt-dlp is unlicense) | DEFER | Not in M6–M14 scope |
| Video clip | scripts/clip_video.py | FFmpeg stream-copy clip | M12 | None yet | FFmpeg argument pattern reference | -c copy not frame-accurate; -y silent overwrite; no timeout | Need TypeScript implementation | MIT (algo only) | REJECT as-is; pattern REFERENCE ONLY | Reimplement with transcoding, no -y, with timeout |
| Subtitle range extraction | scripts/extract_subtitle_clip.py | Filter VTT cues within time range → SRT | M10 | None yet | Algorithm reference | Strict-containment-only drops boundary cues | Need TypeScript port using M2 SubtitleDocument | MIT (algo free) | ADAPT | Port with boundary-overlap handling added |
| Subtitle rebase | scripts/extract_subtitle_clip.py + utils.py | Subtract clip start from all timestamps | M10 | None yet | Algorithm reference | None | Clean-room port needed | MIT (algo free) | ADAPT | Port with integer-ms arithmetic |
| SRT serialization | scripts/extract_subtitle_clip.py | Write sequential SRT with comma timestamps | M10 | None yet | Output format reference | None | Need TypeScript port | MIT (algo free) | ADAPT | Port |
| Subtitle translation | scripts/translate_subtitles.py | Batch subtitle translation via Claude | M19 | None yet | Batch 20/request reduces API calls 95% | Logs full subtitle content; no rate limit | Not in M6–M14 | MIT | DEFER | Note batch-20 strategy for M19 |
| Bilingual merge | scripts/merge_bilingual_subtitles.py | Merge EN+CN SRT by index | M19 | None yet | Simple algorithm when needed | f.read() unbounded; no timestamp validation | Not in M6–M14 | MIT | DEFER | Re-evaluate at M19 |
| Subtitle burn-in | scripts/burn_subtitles.py | FFmpeg libass subtitle burn into video | M12 | None yet | libass detection + command concept | Full-video tempdir copy; no timeout; -y overwrite | Need TypeScript implementation | MIT (algo only) | ADAPT (concept only) | Adapt command concept; reject tempdir strategy |
| libass detection | burn_subtitles.py + install_as_skill.sh | `ffmpeg -filters | grep subtitles` | M12 | None yet | Detection strategy confirmed | None | Need TypeScript port | MIT (concept free) | ADAPT | Port as capability-check in ffmpegService |
| Summary generation | scripts/generate_summary.py | Social media caption prompt | Post-M14 | None yet | N/A for M6–M14 | Logs chapter content | Not in scope | MIT | DEFER | M15 or later |
| Chapter prompt concept | SKILL.md | AI semantic chapter analysis at 2-5 min granularity | M7 | None yet | Prompt design reference | No structured schema; no grounding | Need redesign with Zod schema | MIT (concept free) | REFERENCE ONLY | Adapt concept with structured output contract |
| FFmpeg guide | references/ffmpeg-guide.md | Platform-specific FFmpeg notes | M12 | TECHNICAL_NOTES in existing docs | libass install advice | None | Reference only | MIT | REFERENCE ONLY | Useful for M12 implementation notes |
| Subtitle format guide | references/subtitle-formatting.md | VTT/SRT differences | M10 | docs/product/M2_* | VTT→SRT conversion reference | None | Reference only | MIT | REFERENCE ONLY | Useful for M10 AC design |
| Summary template | templates/summary-template.md | Xiaohongshu/TikTok/WeChat output template | Post-M14 | None | N/A for M6–M14 | None | Not in scope | MIT | DEFER | M15 or later |
| .env config | .env.example | Config structure | M6 | None yet | Config key reference | Includes API keys in .env file — SceneSift uses keychain | Cannot copy config model | MIT | REFERENCE ONLY | Config keys inform M6 settings UI |

---

## Pattern-Level Audit

### Pattern: Subtitle Cue Range Selection

**External implementation**: `if sub_start >= start_seconds and sub_end <= end_seconds` — strict containment only  
**Intended behavior**: Select all cues within the clip's time window  
**Strengths**: Simple, deterministic  
**Weaknesses**: **Drops cues that cross the clip boundary** — a cue starting at clip_start - 0.1s is excluded entirely; a cue ending at clip_end + 0.1s is excluded entirely. This silently drops the first and last subtitle words of almost every clip.  
**Edge cases**: Cue starts before clip start but ends inside; cue starts inside but ends after clip end; cue spans entire clip range  
**Security risks**: None  
**Performance risks**: O(n) over cues — acceptable  
**SceneSift target**: M10  
**Classification**: ADAPT  
**Safe adaptation**: Include cues where start < clip_end AND end > clip_start (overlap detection). For cues crossing the start boundary, clamp start to clip_start. For cues crossing the end boundary, clamp end to clip_end. Verify cue text is non-empty after clamping before including.  
**Required acceptance criteria**:  
- Cue crossing clip start is included with clamped start time  
- Cue crossing clip end is included with clamped end time  
- Cue completely spanning clip range is included  
- Cue entirely before clip range is excluded  
- Cue entirely after clip range is excluded  
- Empty cue after clamping is excluded  

---

### Pattern: Timestamp Rebase

**External implementation**: `adjusted = time_seconds - offset; return max(0.0, adjusted)`  
**Intended behavior**: Convert absolute video timestamps to clip-relative timestamps  
**Strengths**: Simple, correct for well-formed inputs  
**Weaknesses**: Floating-point arithmetic — accumulates small errors across many cues  
**Edge cases**: Cue start before offset (yields 0 correctly); cue end before offset (yields 0 — produces zero-duration cue that should be dropped)  
**Security risks**: None  
**Performance risks**: None  
**SceneSift target**: M10  
**Classification**: ADAPT  
**Safe adaptation**: Use integer milliseconds (already SceneSift's canonical time unit from M2). Rebase: `adjustedMs = cueStartMs - clipStartMs; clamp to [0, clipDurationMs]`. Drop cues where adjustedStartMs >= adjustedEndMs after rebasing.  
**Required acceptance criteria**:  
- Rebased timestamps use integer milliseconds  
- No negative timestamps after rebase  
- Cues that become zero-duration after rebase are dropped  
- Sequential SRT indices start at 1 after rebase  

---

### Pattern: VTT→SRT Timestamp Conversion

**External implementation**: Split on '.', replace with ',' for milliseconds; use `timedelta` for formatting  
**Intended behavior**: Convert WebVTT period-separated timestamps to SRT comma-separated  
**Strengths**: Correct  
**Weaknesses**: Manual string manipulation — fragile if timestamp format varies  
**SceneSift target**: M10  
**Classification**: ADAPT  
**Safe adaptation**: Port as pure TypeScript function operating on integer milliseconds; format to `HH:MM:SS,mmm` directly without string replace.  

---

### Pattern: libass Capability Detection

**External implementation**: `ffmpeg -filters 2>&1 | grep -q "subtitles"` (shell); Python version: `subprocess.run([ffmpeg_path, '-filters'], capture_output=True)` then `'subtitles' in result.stdout`  
**Intended behavior**: Detect whether installed FFmpeg supports subtitle burn-in  
**Strengths**: Correct detection method; works cross-platform  
**Weaknesses**: Checks only for filter name 'subtitles' — doesn't verify libass specifically, but 'subtitles' filter requires libass  
**Security risks**: None — argument array, no user input  
**SceneSift target**: M12  
**Classification**: ADAPT  
**Safe adaptation**: Run `[ffmpegPath, '-filters']` via runCommand with short timeout (5s) and small output cap. Search stdout for 'subtitles'. Cache result per session.  

---

### Pattern: FFmpeg Subtitle Burn-in Command

**External implementation**:
```python
cmd = [ffmpeg_path, '-i', temp_video, '-vf',
       f"subtitles={temp_subtitle}:force_style='FontSize={font_size},MarginV={margin_v}'",
       '-c:a', 'copy', '-y', temp_output]
```
**Intended behavior**: Burn subtitle file into video using libass  
**Strengths**: Correct filter syntax; `force_style` approach is standard  
**Weaknesses**: `-y` unconditional overwrite; no timeout; full-video tempdir copy to avoid space-in-path; `capture_output=True` unbounded  
**Security risks**: Path injection into subtitles filter value (filter argument parsing is sensitive to special chars including colons and backslashes)  
**SceneSift target**: M12  
**Classification**: ADAPT (command concept only; reject tempdir strategy and -y flag)  
**Safe adaptation**:  
- Stage only the subtitle file (not the video) in a sanitized temp path  
- Escape the subtitle path for the ASS filter: replace `:` with `\:`, `\` with `\\`, `'` with `\'`  
- Use argument array  
- Add timeout and output cap  
- Use collision policy instead of `-y`  
- Transcode video (do not `-c copy` with subtitle filter — requires re-encode anyway)  

---

### Pattern: Chapter Analysis Prompt

**External implementation**: SKILL.md instructs Claude to analyze timestamped transcript and output chapters with title, time_range (HH:MM:SS format), summary, keywords, target 2-5 min granularity  
**Intended behavior**: AI identifies natural topic transitions rather than mechanical time divisions  
**Strengths**: Semantic rather than mechanical; granularity guidance useful  
**Weaknesses**: No structured output schema; timestamps not validated against subtitle bounds; no grounding check; no confidence signal  
**Security risks**: No input bounds on transcript sent to AI; no output validation  
**SceneSift target**: M7  
**Classification**: REFERENCE ONLY  
**Safe adaptation**: Require structured JSON output with Zod schema: `{ chapters: Array<{ title: string; startMs: number; endMs: number; summary: string; keywords: string[] }> }`. Validate all timestamps against actual video duration. Reject candidates where endMs <= startMs or endMs > videoDurationMs.  

---

### Pattern: Filename Sanitization

**External implementation**: Remove `[<>:"/\\|?*]`, replace spaces with `_`, collapse `__`, cap length at 100 chars, preserve extension  
**Intended behavior**: Safe cross-platform filename from arbitrary string  
**Strengths**: Covers Windows/macOS/Linux forbidden chars; handles Unicode (tested with Chinese)  
**Weaknesses**: `re.sub(r'_+', '_', ...)` is linear — fine. `re.sub(illegal_chars, ...)` is linear — fine. No path traversal prevention (but function operates on filename component only, not path)  
**SceneSift target**: M14  
**Classification**: ADAPT  
**Safe adaptation**: Port to TypeScript. Operate on filename component only (callers must pass `path.basename()`). Add explicit prohibition on `.` and `..` output. Test with Unicode, emojis, and null bytes.  
