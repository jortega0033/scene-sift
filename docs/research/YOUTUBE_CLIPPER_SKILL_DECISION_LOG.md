# YouTube Clipper Skill — Decision Log

**Audit commit**: f31f077ee0905c95a510a6f34bbd0c3c85b15129  
**Date**: 2026-07-20

---

## DL-001 — Do not install the skill globally

**Decision**: The skill must not be installed via `bash install_as_skill.sh` or `npx skills add`.

**Reason**: The installation script modifies `~/.claude/skills/` (user-level Claude configuration). This is explicitly prohibited by `loop-constraints.md` and CLAUDE.md universal prohibitions: "No modification of `~/.claude/**` or user-level Claude settings."

**Outcome**: Audit conducted via web fetch of raw repository content. No files installed.

---

## DL-002 — Do not adopt Python as SceneSift runtime

**Decision**: Python scripts from the external repository are not adopted as SceneSift runtime components.

**Reason**: SceneSift is an Electron application packaged with `electron-builder`. Adding Python as a required runtime dependency would require either bundling a Python interpreter (100–200 MB addition to app bundle) or requiring users to install Python separately. This violates the local-first, self-contained desktop app design. The governance overhead of maintaining a Python environment inside an Electron app is not justified.

**Outcome**: All patterns classified ADAPT are reimplemented in TypeScript.

---

## DL-003 — Do not add new dependencies to package.json

**Decision**: No new npm, Python, or system dependencies are added to SceneSift as a result of this audit.

**Reason**: `DEPENDENCY_POLICY.md` requires governance review before adding dependencies. The audit is documentation-only. `pnpm add` is prohibited during this task.

**Outcome**: No dependency changes. libass detection at M12 uses the already-present FFmpeg binary.

---

## DL-004 — Stream copy is not frame-accurate

**Decision**: SceneSift must not use `-c copy` as its default or advertised-as-accurate clip rendering mode.

**Reason**: FFmpeg `-c copy` with input seek (`-ss` before `-i`) produces clips starting at the nearest keyframe before the requested timestamp, not at the exact timestamp. For H.264 video with 2-4 second GOP, the clip will start 0-4 seconds early. This produces a visually incorrect clip and is technically misleading.

**Outcome**: M12 implementation plan must specify transcoding (`-c:v libx264`) as the default rendering mode. Stream copy may be offered only as an explicitly-labeled "fast preview mode" with documented accuracy limitations.

---

## DL-005 — Subtitle range extraction requires boundary overlap handling

**Decision**: M10 subtitle range extraction must handle cues that cross clip boundaries (partial overlap), not just cues that are strictly contained within the range.

**Reason**: `extract_subtitle_clip.py` uses strict containment only (`sub_start >= start AND sub_end <= end`). This silently drops the first and last subtitle cues of nearly every clip — cues that start slightly before the clip boundary or end slightly after it. SceneSift must include boundary-overlap cues, clamping start/end to the clip boundary.

**Outcome**: M10 acceptance criteria must explicitly cover all four overlap cases: fully contained, overlap-start, overlap-end, fully spanning.

---

## DL-006 — Use M2 SubtitleDocument as subtitle source

**Decision**: M10 subtitle operations source from M2's normalized `SubtitleDocument` (already in SQLite), not from re-reading the raw subtitle file from disk.

**Reason**: The external skill re-reads VTT files using unbounded `f.read()`. SceneSift's M2 already parsed, bounded, and persisted the subtitle document. Re-reading the file from disk at M10 would bypass M2's bounds, discard the parsed structure, and potentially fail if the file has been moved or modified since it was originally attached.

**Outcome**: M10 service interface receives `SubtitleDocument` from `DatabaseService.getSubtitleDocument()`, not a file path.

---

## DL-007 — Full-video tempdir copy rejected for subtitle burn-in

**Decision**: SceneSift M12 must not copy the source video to a temporary directory as a workaround for FFmpeg subtitle filter path issues.

**Reason**: The external skill's workaround copies the entire source video to `tempfile.mkdtemp()` to avoid spaces in the file path. For a 2 GB video file, this requires 2 GB of free disk space on the temp volume, may be slow on cross-volume copies, and has no disk-space check. The correct solution is to escape the subtitle file path for the FFmpeg `subtitles` filter argument (escape colons and backslashes), and optionally stage only the small subtitle file to a sanitized temp path.

**Outcome**: M12 implementation plan must document subtitle path escaping requirements for the `subtitles` filter: `\` → `\\`, `:` → `\:`, `'` → `\'`.

---

## DL-008 — Transcript content must not appear in logs

**Decision**: Any SceneSift M7–M14 code that sends subtitle or transcript content to an AI provider must ensure that content does not appear in any log at any level.

**Reason**: The external skill prints complete subtitle batches to stdout before translation. Subtitle content is user content. SceneSift's M5 security constraints already prohibit logging cue content. This prohibition extends to all AI-related features in M6–M14.

**Outcome**: M6–M14 security ACs must include: "AI request payloads containing transcript or subtitle text must not appear in any log."

---

## DL-009 — yt-dlp downloading deferred

**Decision**: YouTube downloading via yt-dlp is not added to M6–M14.

**Reason**: `ROADMAP.md` specifies that SceneSift is currently focused on local media. M6–M14 implement the AI analysis and clip rendering pipeline for locally ingested video. Adding a download workflow would require a new milestone (post-M14 or as a separate M15+ capability), its own consent model, network error handling, download quota/rate management, and format compatibility testing.

**Outcome**: yt-dlp classified DEFER. No action in current roadmap.

---

## DL-010 — Translation deferred to M19

**Decision**: Subtitle translation (bilingual merge, batch translation) is not added to M6–M14.

**Reason**: `ROADMAP.md` already lists M19 as the subtitle translation milestone. No new scope is added to M6–M14 based on this audit. The batch-20-subtitles translation optimization is noted for use when M19 is implemented.

**Outcome**: Translation patterns classified DEFER. M19 planning can reference `YOUTUBE_CLIPPER_SKILL_FEATURE_MAP.md` for the batch algorithm.

---

## DL-011 — Verdict: USE SELECT PATTERNS ONLY

**Decision**: Overall audit verdict is USE SELECT PATTERNS ONLY.

**Reason**: The repository provides genuine reference value for five specific areas (M7 chapter prompt concept, M9 timestamp utilities, M10 subtitle range extraction and rebase, M12 libass detection and subtitle burn-in command concept, M14 filename sanitization). It does not replace M6–M14 planning, its security model is inadequate, and its architecture is incompatible with SceneSift's Electron+TypeScript design.

**Outcome**: Seven research documents created in `docs/research/`. Amendments noted for M7, M9, M10, M11, M12, M14. M6 unchanged. Do not use external skill as runtime.
