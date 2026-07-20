# YouTube Clipper Skill — External Reference Adoption Audit

**Audit date**: 2026-07-20  
**Auditor**: SceneSift orchestrator + specialist panels (architecture, electron-security, media-pipeline, AI-privacy, dependency, skeptical)  
**Status**: COMPLETE  
**Verdict**: USE SELECT PATTERNS ONLY

---

## 1. Repository Snapshot

| Field | Value |
|---|---|
| URL | https://github.com/op7418/Youtube-clipper-skill |
| Default branch | main |
| Exact commit SHA | f31f077ee0905c95a510a6f34bbd0c3c85b15129 |
| Commit date | 2026-01-22T04:56:19Z |
| License | MIT — Copyright (c) 2026 op7418 |
| Languages | Python 89.2%, Shell 10.8% |
| Stars / Forks | 2,100 / 307 |
| Commits total | Not enumerated — single stable branch |
| Installation model | `npx skills add` OR `bash install_as_skill.sh` to `~/.claude/skills/youtube-clipper` |
| Runtime | Python 3.8+, yt-dlp, pysrt, python-dotenv, FFmpeg+libass, Claude Code skill host |
| Project maturity | Prototype / personal tool — no versioning, no test suite, no CI |

---

## 2. Actual Workflow (Source-Traced)

Actual execution flow traced from SKILL.md, scripts, and README:

```
1. ENVIRONMENT DETECTION (install_as_skill.sh + SKILL.md)
   Check: python3 present
   Check: pip install yt-dlp pysrt python-dotenv
   Check: ffmpeg/ffmpeg-full present
   Check: ffmpeg -filters | grep subtitles (libass capability)

2. VIDEO DOWNLOAD (scripts/download_video.py)
   Input: YouTube URL (validated via regex)
   Tool: yt-dlp Python library
   Format: best MP4 + M4A ≤ 1080p
   Output: {video_id}.mp4 and {video_id}.en.vtt in output dir
   No size limit on download
   No timeout on download

3. CHAPTER ANALYSIS (scripts/analyze_subtitles.py + Claude Code prompt)
   Read: entire VTT file via f.read() — NO SIZE LIMIT
   Strip: WEBVTT header, STYLE blocks, position attrs
   Parse: subtitle blocks into (start, end, text) array
   Format: timestamped text block for Claude
   Claude output: chapter list (title, time range, summary, keywords)
   No structured schema enforced — Claude returns prose/markdown
   No grounding check — timestamps not validated against subtitle bounds

4. USER SELECTION (interactive Claude Code prompt)
   User selects chapters to process
   User selects options: bilingual subtitles, burn subtitles, generate summary

5. VIDEO CLIPPING (scripts/clip_video.py)
   FFmpeg command: [ffmpeg, -ss, start, -i, input, -t, duration, -c copy, -y, output]
   -c copy: stream-copy, NOT frame-accurate
   -y: unconditional overwrite
   No timeout
   No output size limit
   No process cleanup beyond subprocess.run() returning

6. SUBTITLE EXTRACTION (scripts/extract_subtitle_clip.py)
   Input: .vtt file (unbounded read via readlines())
   Filter: cues where sub_start >= start AND sub_end <= end (strict containment only)
   Rebase: adjusted_start = sub_start - start_seconds; max(0.0, adjusted)
   Output: .srt file with sequential index

7. SUBTITLE TRANSLATION (scripts/translate_subtitles.py)
   Batch: 20 subtitles per Claude prompt
   No API key management — relies on Claude Code skill environment
   Prints full subtitle content to stdout (privacy concern)
   No rate limit, no retry, no timeout, no structured output schema

8. BILINGUAL MERGE (scripts/merge_bilingual_subtitles.py)
   Reads both SRT files into memory via f.read() — no size limit
   Merges by index position (assumption: counts match)
   No timestamp validation

9. SUBTITLE BURN-IN (scripts/burn_subtitles.py)
   Copies source video to tempfile.mkdtemp() dir to avoid space-in-path bug
   FFmpeg command: [ffmpeg_path, -i, temp_video, -vf, subtitles=...:force_style=..., -c:a copy, -y, temp_output]
   No timeout
   Cleanup: shutil.rmtree(temp_dir, ignore_errors=True) in finally — cleanup errors suppressed

10. SUMMARY GENERATION (scripts/generate_summary.py)
    Prints JSON chapter data + prompt to stdout for Claude to fill
    Output: Markdown template for Xiaohongshu/TikTok/WeChat
    No structured schema
```

---

## 3. Component Inventory

| Component | File | Purpose | Language |
|---|---|---|---|
| Installation | install_as_skill.sh | Copy to ~/.claude/skills/, install Python deps, detect FFmpeg | Shell |
| Utilities | scripts/utils.py | time_to_seconds, seconds_to_time, sanitize_filename, adjust_subtitle_time, etc. | Python |
| VTT analysis | scripts/analyze_subtitles.py | Parse VTT → formatted transcript for Claude | Python |
| Video download | scripts/download_video.py | yt-dlp wrapper | Python |
| Video clip | scripts/clip_video.py | FFmpeg stream-copy clip | Python |
| Subtitle extract | scripts/extract_subtitle_clip.py | VTT range filter + SRT export | Python |
| Subtitle translate | scripts/translate_subtitles.py | Batch prompt for translation | Python |
| Bilingual merge | scripts/merge_bilingual_subtitles.py | Merge EN+CN SRT by index | Python |
| Subtitle burn | scripts/burn_subtitles.py | FFmpeg libass burn-in | Python |
| Summary gen | scripts/generate_summary.py | Platform-specific caption prompt | Python |
| Skill prompt | SKILL.md | Claude Code skill instructions | Markdown |
| FFmpeg guide | references/ffmpeg-guide.md | Reference docs | Markdown |
| Subtitle format | references/subtitle-formatting.md | VTT/SRT conversion reference | Markdown |
| Summary template | templates/summary-template.md | Social media output template | Markdown |
| Config | .env.example | FFmpeg path, output dir, quality, batch size | Env |

---

## 4. Classification Summary

### ADAPT (high value — reimplement in TypeScript)

| Pattern | Source | Target milestone |
|---|---|---|
| Subtitle cue range-filter algorithm | extract_subtitle_clip.py | M10 |
| Timestamp rebase to clip-relative zero | utils.py `adjust_subtitle_time` + extract_subtitle_clip.py | M10 |
| VTT→SRT timestamp format conversion (period→comma) | extract_subtitle_clip.py, references/subtitle-formatting.md | M10 |
| SRT sequential index regeneration | extract_subtitle_clip.py | M10 |
| `time_to_seconds` and `seconds_to_time` pure functions | utils.py | M9 |
| `sanitize_filename` with illegal-char removal + length cap | utils.py | M14 |
| libass detection via `ffmpeg -filters \| grep subtitles` | burn_subtitles.py + install_as_skill.sh | M12 |
| ffmpeg-full path priority on macOS for libass | burn_subtitles.py | M12 |
| Subtitle burn-in FFmpeg filter concept: `subtitles=path:force_style=...` | burn_subtitles.py | M12 |
| Per-project timestamped output directory | utils.py `create_output_dir` | M14 |
| Batch subtitle translation (20/request) | translate_subtitles.py | M19 (deferred) |
| Chapter semantic analysis prompt concept | SKILL.md, analyze_subtitles.py | M7 |

### REFERENCE ONLY (understand, do not port)

| Pattern | Source | Why reference only |
|---|---|---|
| Claude Code skill orchestration model | SKILL.md, install_as_skill.sh | SceneSift is Electron, not a Claude Code skill |
| Python synchronous pipeline | All scripts | Runtime incompatible with SceneSift's main-process service model |
| Social media summary template | templates/summary-template.md, generate_summary.py | Not in M6–M14 scope |
| yt-dlp format selection config | download_video.py, .env.example | SceneSift uses local media only |
| VTT header/style stripping logic | analyze_subtitles.py | M5 already implemented and accepted with better bounds |
| Semantic chapter prompt wording | SKILL.md | Prompt concept useful; Python scaffolding is not |
| Bilingual merge algorithm | merge_bilingual_subtitles.py | M19 deferred; algorithm simple when needed |

### REJECT (unsafe, incompatible, or out of scope)

| Pattern | Source | Reason |
|---|---|---|
| Python as SceneSift runtime | All scripts | Architecture incompatible; packaging burden; governance mismatch |
| Global Claude skill installation | install_as_skill.sh | Forbidden by loop-constraints.md; user-level Claude config modification |
| yt-dlp downloading | download_video.py | Not in M6–M14; network call without consent gate |
| `f.read()` unbounded subtitle file read | analyze_subtitles.py, merge_bilingual_subtitles.py | Memory exhaustion on large inputs; SceneSift requires bounded reads |
| `-c copy` as frame-accurate clipping | clip_video.py | Stream copy is GOP-bounded only — NOT frame-accurate |
| `-y` unconditional overwrite | clip_video.py, burn_subtitles.py | Silent data loss; SceneSift requires explicit collision policy |
| No timeout on FFmpeg subprocess | clip_video.py, burn_subtitles.py | Orphan process risk; violates media-pipeline.md |
| No output byte cap | clip_video.py, burn_subtitles.py | No protection against runaway output |
| `tempfile.mkdtemp()` full video copy | burn_subtitles.py | Multi-GB source video copied to temp — no disk space check, no cross-volume safety |
| `shutil.rmtree(ignore_errors=True)` | burn_subtitles.py | Suppresses cleanup failures silently |
| `capture_output=True` without bound | burn_subtitles.py | Unbounded stdout/stderr capture |
| Logging full subtitle content to stdout | translate_subtitles.py | Privacy violation — transcript content in logs |
| No structured JSON schema for AI output | analyze_subtitles.py, translate_subtitles.py | No validation; hallucinated timestamps cannot be detected |
| Claude Code skill prompt delivery | generate_summary.py, translate_subtitles.py | stdout-based "API call" is not real structured invocation |
| Subtitle translate with no rate limit or retry | translate_subtitles.py | Fragile in production |
| extract_subtitle_clip.py strict-containment only | extract_subtitle_clip.py | Drops cues that cross clip boundary — loses first and last words |
| re-parse VTT from disk | All scripts | M5 already built normalized SubtitleDocument; re-parsing discards accepted bounds |
| No process cancellation | clip_video.py, burn_subtitles.py | Cannot cancel in-progress render |
| Regex `<[^>]+>` without quantifier bound | analyze_subtitles.py | Potentially slow on malformed tag strings |
| Space-in-path workaround via tempfile | burn_subtitles.py | Full-video copy is unsafe; correct fix is proper path escaping in filter argument |

### DEFER (post-M14)

| Pattern | Source | Target |
|---|---|---|
| Subtitle translation | translate_subtitles.py, merge_bilingual_subtitles.py | M19 |
| Social media summary generation | generate_summary.py, templates/summary-template.md | M15 or post-M14 |
| yt-dlp downloading | download_video.py | Separate download milestone if ever scoped |

---

## 5. Security Findings

See `YOUTUBE_CLIPPER_SKILL_SECURITY_REVIEW.md` for full detail.

**Critical security defects (REJECT)**:
- S1: `f.read()` unbounded file read — memory exhaustion
- S2: `-y` unconditional overwrite — silent data loss
- S3: No FFmpeg timeout — orphan process
- S4: Full-video copy to tempdir — no disk space check
- S5: Logging full subtitle content — privacy violation
- S6: `cleanup_errors=True` — suppresses filesystem errors silently
- S7: No structured AI output schema — hallucinated timestamps undetected
- S8: `-c copy` presented as accurate — incorrect accuracy claim

**Informational findings (noted, do not adopt)**:
- I1: No process cancellation
- I2: No retry or rate limiting on AI calls
- I3: `shell=False` correctly used throughout Python subprocess calls (positive finding)

---

## 6. FFmpeg Review

See `YOUTUBE_CLIPPER_SKILL_FFMPEG_REVIEW.md` for full detail.

**Clipping accuracy**: `-ss -i -t -c copy` is GOP-seeking stream copy. NOT frame-accurate. Must NOT be adopted as SceneSift's rendering strategy.

**Burn-in command**: `-vf subtitles=path:force_style='FontSize=N,MarginV=N' -c:a copy -y` is correct in concept. The `force_style` options are useful. The `-y` flag must be removed.

**libass detection**: `ffmpeg -filters 2>&1 | grep -q "subtitles"` is the correct detection strategy. ADAPT.

**Temporary full-video copy**: Entire source video copied to tempdir to work around space-in-path. Unsafe at scale. The path-escaping problem should be solved differently (properly escape the subtitles filter argument or stage only the subtitle file, not the video).

---

## 7. AI and Prompt Review

**Chapter analysis prompt**: SKILL.md instructs Claude to generate chapters with title, time range, summary, keywords at 2-5 min granularity. Useful concept. No structured JSON schema enforced — output is free-form markdown. SceneSift must enforce structured schema with Zod validation.

**Translation batch strategy**: 20 subtitles per prompt reduces API calls by ~95%. Algorithm useful for M19. Not applicable to M6–M14.

**Privacy**: Full subtitle text is logged and printed to stdout. SceneSift must not log transcript or subtitle content.

**No API key management**: The skill relies on Claude Code's ambient credential handling. SceneSift requires keychain-stored secrets and explicit consent gate.

---

## 8. License and Dependency Review

See `YOUTUBE_CLIPPER_SKILL_LICENSE_AND_DEPENDENCIES.md` for full detail.

**License**: MIT. Copyright (c) 2026 op7418. Permissive — ideas and algorithms can be reimplemented freely. If source code is substantially copied, license notice must be preserved.

**Recommendation**: Reimplement all adapted algorithms clean-room in TypeScript. No source code copy required. No license obligation for algorithmic ideas or utility functions reimplemented from scratch.

---

## 9. Milestone Impact

See `YOUTUBE_CLIPPER_SKILL_MILESTONE_IMPACT.md` for per-milestone detail.

| Milestone | Decision | Summary |
|---|---|---|
| M6 AI Provider Infrastructure | NO CHANGE | Skill has no real API key management. M6 plan remains authoritative. |
| M7 Clip Candidate Generation | MINOR AMENDMENT | Add structured JSON schema requirement with mandatory Zod validation. Adopt chapter-prompt concept. |
| M8 Candidate Review | NO CHANGE | Skill has no review workflow. |
| M9 Clip Timing Editor | MINOR AMENDMENT | Pure utility functions (time_to_seconds, seconds_to_time, parse_time_range) provide test cases. |
| M10 Subtitle Editing | SIGNIFICANT AMENDMENT | Adopt boundary-overlap handling, rebase algorithm, SRT serialization as required acceptance criteria. |
| M11 Vertical Composition | MINOR AMENDMENT | libass detection strategy and burn-in FontSize/MarginV defaults are useful. |
| M12 FFmpeg Clip Rendering | SIGNIFICANT AMENDMENT | libass detection, subtitle burn-in command concept ADAPT. Stream-copy accuracy claim REJECT. Tempfile copy REJECT. |
| M13 Render Queue | NO CHANGE | Skill has no queue or recovery. |
| M14 Export | MINOR AMENDMENT | sanitize_filename and per-project output dir naming are useful. |

---

## 10. Estimated Value by Milestone

| Milestone | Value | Basis |
|---|---|---|
| M6 | NONE | Skill provides no keychain, no consent gate, no provider abstraction |
| M7 | MEDIUM | Chapter prompt concept accelerates spec; structured output requirement is additive work |
| M8 | NONE | No review workflow in skill |
| M9 | LOW | Timestamp utility functions clarify test cases |
| M10 | HIGH | Subtitle range extraction + rebase algorithm is nontrivial; skill provides tested reference |
| M11 | LOW | Defaults useful; no real composition model |
| M12 | MEDIUM | libass detection + burn-in command concept save investigation time |
| M13 | NONE | No queue or recovery |
| M14 | LOW | Filename sanitization and output dir naming ideas useful |

---

## 11. Risks Introduced by Adoption

Risks from adopting ANY pattern without redesign:

- R1: Copying `-c copy` clipping without understanding GOP boundaries will produce clips that start on wrong frames. The error is silent and visually obvious only on certain content.
- R2: Copying the full-video tempdir strategy will fail silently on multi-GB inputs when disk space is exhausted.
- R3: Using `f.read()` on subtitle files will pass unit tests but exhaust memory on pathological inputs in production.
- R4: Adopting strict-containment-only cue selection (sub_start >= start AND sub_end <= end) will silently drop the first and last subtitle cues of nearly every clip.
- R5: Translating batch strategy before M6 AI infrastructure exists creates an ordering dependency.

---

## 12. Final Verdict

**USE SELECT PATTERNS ONLY**

The repository provides genuine reference value for M7, M10, M12, and M14 through its demonstration of:
- Subtitle cue range selection and timestamp rebasing
- libass detection strategy
- FFmpeg subtitle burn-in command structure
- Chapter-analysis prompt concept
- Filename sanitization and output directory organization

It does not replace M6–M14 planning. Its security model, process execution, AI integration, and memory handling are all inadequate for SceneSift's governance requirements. All adopted patterns must be reimplemented clean-room in TypeScript with bounded inputs, typed outputs, argument arrays, timeouts, and Zod validation.

---

## 13. Immediate Next Step

**Amend M6 planning** — proceed immediately with M6 implementation planning using the existing SceneSift roadmap plus the minor amendments documented in `YOUTUBE_CLIPPER_SKILL_MILESTONE_IMPACT.md`.

Do not prototype or experiment with the skill.  
Do not install the skill globally.  
Do not delay M6 for further external research.
