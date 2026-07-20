# YouTube Clipper Skill — Security Review

**Audit commit**: f31f077ee0905c95a510a6f34bbd0c3c85b15129  
**Date**: 2026-07-20  
**Reviewer**: electron-security-reviewer + media-pipeline specialist + AI-privacy reviewer  
**Verdict**: Multiple critical defects. No security model is compatible with SceneSift governance. All patterns must be reimplemented with SceneSift controls applied.

---

## S1 — Unbounded File Reads (CRITICAL)

**Location**: `analyze_subtitles.py` line ~15, `merge_bilingual_subtitles.py`

**Pattern**:
```python
with open(vtt_path, 'r', encoding='utf-8') as f:
    content = f.read()
```

**Risk**: No file-size check before reading. A 500 MB subtitle file (possible with malformed or adversarial input) is read entirely into memory. On a low-memory system this exhausts available RAM, kills the process, or causes OS swap thrashing.

**SceneSift requirement**: All file reads must be bounded. M2 already implements bounded reads with configurable limits. Subtitle operations in M10 must use M2's normalized `SubtitleDocument` as the authoritative source — not raw file reads.

**Classification**: REJECT

---

## S2 — Unconditional Output Overwrite (CRITICAL)

**Location**: `clip_video.py` and `burn_subtitles.py`

**Pattern**: `-y` flag hardcoded in all FFmpeg commands.

**Risk**: Silently overwrites any existing file at the output path without confirmation. If the output path accidentally targets an existing important file, it is destroyed without warning.

**SceneSift requirement**: M12 and M14 require explicit collision policy. Options: fail-fast if output exists, prompt user, or use atomic temp-then-rename with unique suffix. Never silent overwrite.

**Classification**: REJECT

---

## S3 — No FFmpeg Process Timeout (CRITICAL)

**Location**: `clip_video.py`, `burn_subtitles.py`

**Pattern**: `subprocess.run(cmd, capture_output=True, text=True)` — no `timeout=` parameter.

**Risk**: Hung or infinite-loop FFmpeg process (possible with corrupted input) blocks indefinitely. On Windows this can lock output file handles. Resource leak: CPU, memory, file descriptors.

**SceneSift requirement**: `media-pipeline.md` requires timeout + process cleanup on all external process execution. M1's `runCommand` already implements this via `timeoutMs` and `maxOutputBytes`. M12 must apply the same controls.

**Classification**: REJECT

---

## S4 — Full-Video Copy to Tempdir (CRITICAL)

**Location**: `burn_subtitles.py`

**Pattern**:
```python
temp_dir = tempfile.mkdtemp(prefix='youtube_clipper_')
shutil.copy2(video_path, temp_video)  # copies entire source video
```

**Risk**:
- A 2 GB source video is copied to `/tmp` (often on the root partition). If disk space is insufficient, the copy fails mid-way and may leave a partial file. No disk-space check is performed before copying.
- Cross-volume copy (e.g., source on external drive, tmp on system volume) may fail or be extremely slow.
- On failure the temp directory may not be cleaned up (if cleanup itself raises an exception that `ignore_errors=True` masks).

**SceneSift requirement**: M12 must not copy source video to a temporary location. The correct fix for the space-in-path FFmpeg filter bug is to properly escape the subtitle path in the filter argument, not to copy the video. Stage only the subtitle file (small) to a sanitized temp path if needed.

**Classification**: REJECT

---

## S5 — Transcript Content in Logs (HIGH)

**Location**: `translate_subtitles.py`

**Pattern**: Prints full subtitle content to stdout before and during translation batches. `generate_summary.py` prints full chapter JSON to stdout.

**Risk**: Subtitle and transcript text is user content. Logging it to stdout violates user privacy. In a production Electron app, stdout may be captured by crash reporters, logging services, or accessible via DevTools.

**SceneSift requirement**: `loop-constraints.md` and M5 security plan explicitly prohibit logging cue content. Prompt templates (not content) may be logged. Structured error codes only.

**Classification**: REJECT

---

## S6 — Silent Cleanup Failure (MEDIUM)

**Location**: `burn_subtitles.py`

**Pattern**: `shutil.rmtree(temp_dir, ignore_errors=True)` in `finally` block.

**Risk**: If cleanup fails (locked file on Windows, permission issue), the error is completely suppressed. The temp directory with a potentially gigabyte-sized video copy is silently left on disk.

**SceneSift requirement**: Cleanup failures must be logged at debug level (without content). Temp files must be tracked and cleaned up at app exit via a registered cleanup handler if per-operation cleanup fails.

**Classification**: REJECT (adopt pattern of finally-cleanup, but remove ignore_errors)

---

## S7 — No Structured AI Output Schema (HIGH)

**Location**: `analyze_subtitles.py`, SKILL.md chapter analysis prompt

**Pattern**: Claude returns free-form markdown with chapters. No JSON schema enforced. Timestamps in returned chapters are not validated against video duration or subtitle cue bounds.

**Risk**:
- Claude may hallucinate timestamps that don't correspond to actual subtitle content.
- Chapter start/end may exceed video duration.
- Downstream processing will produce corrupt output if timestamps are wrong.

**SceneSift requirement**: All AI output must be validated with Zod schema before use. Timestamps must be validated against video duration bounds.

**Classification**: REJECT as-is; prompt concept REFERENCE ONLY; structured output requirement is additive M7 work

---

## S8 — Stream-Copy Accuracy Claim (HIGH)

**Location**: `clip_video.py`, `references/ffmpeg-guide.md`

**Pattern**: `-ss start -i input -t duration -c copy` described as producing precise clips.

**Risk**: This is technically incorrect. `-c copy` seeks to the nearest preceding keyframe (GOP boundary), not the exact timestamp. For H.264 with default GOP size (2-4 seconds), the actual clip start can be 0-4 seconds earlier than requested.

**SceneSift requirement**: M12 must use transcoding as the default rendering mode for user-facing clips. Stream copy may be offered as a fast-preview mode with explicit labeling that it is not frame-accurate.

**Classification**: REJECT as frame-accurate strategy

---

## S9 — Regex Without Quantifier Bounds (LOW/Informational)

**Location**: `analyze_subtitles.py`

**Pattern**: `re.sub(r'<[^>]+>', '', ...)` — removes HTML tags.

**Risk**: `[^>]+` is a character class without a quantifier bound. On a line with a malformed tag containing thousands of characters before `>`, this will be slow but not catastrophic (character classes do not cause catastrophic backtracking).

**SceneSift**: M5's `TAG_PATTERN` already uses bounded quantifiers `{0,255}`. This is strictly better. Do not regress.

**Classification**: Informational — M5 already superior

---

## S10 — shell=False Correctly Used (Positive Finding)

**Location**: All Python subprocess calls

**Pattern**: All subprocess calls pass argument lists (not strings) and do not use `shell=True`.

**Finding**: The external repository correctly avoids shell injection. This is consistent with SceneSift's `media-pipeline.md` requirement and confirms the pattern to continue.

**Classification**: No action needed

---

## AI Privacy Reviewer Findings

1. **No consent gate** — subtitle/transcript content is sent to Claude via Claude Code skill environment without explicit user disclosure or opt-in. SceneSift requires consent gate before any AI API call (M6).
2. **No PII stripping** — subtitle content may contain speaker names, locations, or personally identifying information. No PII detection or stripping is performed before sending to AI.
3. **No data retention disclosure** — user is not informed whether Claude processes data in-memory or retains it.

**SceneSift M6 requirement**: These gaps must be addressed in the consent gate and privacy disclosure before any AI features ship. M6 acceptance criteria must include verifiable evidence that: (a) no AI call is made without recorded consent, (b) a privacy disclosure is shown to the user before the first AI call, (c) no transcript content appears in logs.

---

## Media-Pipeline Reviewer Findings

1. **No process cancellation** — once `subprocess.run()` is called, the process cannot be cancelled. SceneSift M12/M13 require cancellation support via kill signal.
2. **No output file verification** — after FFmpeg exits 0, the script does not verify the output file exists and has non-zero size.
3. **No stderr structured parsing** — FFmpeg errors are captured but not structured. Raw FFmpeg error messages must never reach the renderer.
4. **No progress reporting** — no mechanism to report render progress to the UI.

---

## Architecture Reviewer Findings

1. **Python runtime incompatibility** — SceneSift uses Electron + TypeScript. Requiring Python would mean bundling Python, managing a virtual environment, and maintaining cross-platform binary distribution. REJECT Python as runtime.
2. **File access model** — scripts access files by arbitrary path without restriction. SceneSift's security model restricts file access to user-selected paths validated at the IPC boundary.
3. **No persistence layer** — all state is implicit in filesystem structure. SceneSift uses SQLite for all persisted state.

---

## Skeptical Reviewer Findings

1. **Is the external repository being overvalued?** — Yes, somewhat. The "95% API call reduction from batch translation" claim is marketing language for a standard batching technique. The subtitle range extraction algorithm is simple enough to implement from specification. The main value is confirming that boundary-overlap cue selection is required (something the strict-containment-only implementation in the skill gets wrong).
2. **Would copying these scripts save time?** — No. The security defects mean any copy requires a full rewrite anyway. The time saved is from specification clarity, not code reuse.
3. **Does the Python runtime add packaging burden?** — Yes, significant. Bundling Python in an Electron app requires either shipping a Python runtime (~100-200 MB) or requiring it to be pre-installed. Neither is acceptable for a consumer desktop app.
4. **Are the FFmpeg commands technically accurate?** — Stream-copy accuracy claim is incorrect (S8). Subtitle burn-in command concept is correct but requires path escaping and safety controls.
5. **Is the tempfile strategy safe?** — No. Multi-GB source video copying without disk space check (S4).

---

## Summary Table

| Finding | Severity | Source | SceneSift impact |
|---|---|---|---|
| S1: Unbounded file reads | CRITICAL | analyze_subtitles.py, merge_bilingual_subtitles.py | Reject; use M2 SubtitleDocument |
| S2: -y unconditional overwrite | CRITICAL | clip_video.py, burn_subtitles.py | Reject; explicit collision policy |
| S3: No FFmpeg timeout | CRITICAL | clip_video.py, burn_subtitles.py | Reject; use runCommand with timeoutMs |
| S4: Full-video tempdir copy | CRITICAL | burn_subtitles.py | Reject; stage subtitle file only |
| S5: Transcript content in logs | HIGH | translate_subtitles.py, generate_summary.py | Reject; structured codes only |
| S6: Silent cleanup failure | MEDIUM | burn_subtitles.py | Reject; log cleanup failures |
| S7: No structured AI schema | HIGH | analyze_subtitles.py, SKILL.md | Reject; Zod schema required |
| S8: Stream-copy accuracy claim | HIGH | clip_video.py, ffmpeg-guide.md | Reject; transcode as default |
| S9: Regex without bounds | LOW | analyze_subtitles.py | Informational; M5 already better |
| S10: shell=False correct | Positive | All scripts | Continue applying |
