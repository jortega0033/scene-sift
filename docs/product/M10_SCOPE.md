# M10 — Subtitle Editing for Selected Clip

## Goal

Display subtitle cues scoped to a clip's time range, allow inline editing of cue text and timing, add and remove cues, and persist changes to the clip record (not the source subtitle file).

## In scope

- `clip_cues` DB table: cues scoped to a candidate, rebased to clip-relative timestamps
- `ai:generateClipCues` — extract subtitle cues for a candidate with overlap/clamp/rebase logic
- `ai:listClipCues` — list cues for a candidate
- `ai:updateClipCue` — update cue text, startMs, or endMs
- `ai:deleteClipCue` — remove a cue
- `ai:addClipCue` — add a new cue
- Cue extraction algorithm per research amendments (overlap handling, rebase, zero-duration exclusion)
- Inline cue editor in the candidate detail view (approved candidates only)
- Generate button: idempotent — regenerating replaces all cues for the candidate

## Out of scope

- SRT file export (M14)
- Subtitle burn-in options (M11)
- Bulk cue import/replace
- Rich text or styled cue text

## Risk classification

- DB migration + schema: Risk-3
- IPC channels + preload: Risk-3
- DB service methods + clip cue service: Risk-2
- Renderer: Risk-1

## Cue extraction algorithm

Input: subtitle document cues, clip [startMs, endMs].

1. **Select cues** that overlap with [clipStart, clipEnd]:
   - Entirely within: include unchanged
   - Starts before clipStart, ends within: clamp startMs = clipStart
   - Starts within, ends after clipEnd: clamp endMs = clipEnd
   - Spans entire clip: clamp both
   - Entirely before clipStart: exclude
   - Entirely after clipEnd: exclude
2. **Exclude zero-duration**: discard cues where clampedEnd <= clampedStart
3. **Rebase**: `rebasedStart = clampedStart - clipStart`, `rebasedEnd = clampedEnd - clipStart`
4. **Renumber**: assign sequential 1-based `sequenceIndex`
5. All timestamps: integer milliseconds

## No DB migration needed for candidates

`clip_cues` references `clip_candidates(id)` with CASCADE delete — cues are automatically removed when candidate is deleted or regenerated.

## IPC channel count after M10

17 total `ai:*` channels (was 12 after M9).
