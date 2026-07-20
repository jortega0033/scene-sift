# M9 — Clip Timing Editor: Scope

## Goal

Allow users to fine-tune the start and end timestamps of an approved clip candidate before rendering.

## In scope

- New IPC channel `ai:updateCandidateTiming` to persist adjusted startMs/endMs
- Timing editor modal accessible from approved candidates in CandidatesSection
- Embedded video player (reuses M4 local video protocol + useVideoPlayer hook)
- "Set in" / "Set out" controls capture current player position as integer ms
- Seek buttons: jump player to current startMs or endMs
- Preview range: play from startMs to endMs, auto-pause at endMs
- Time display in H:MM:SS.mmm / MM:SS.mmm format
- Save/cancel actions
- Timing persists across app restart

## Out of scope

- Drag-handle timeline UI (deferred)
- Frame-accurate scrubbing (blocked on per-frame seeking API, deferred)
- Waveform/thumbnail strip (deferred)
- Clip subtitle editing (M10)
- Rendering (M12)

## Data model

No migration needed. `startMs` and `endMs` already exist in `clip_candidates` table (added in M7).

## IPC channel

`ai:updateCandidateTiming`
- Input: `{ candidateId: UUID, startMs: int >= 0, endMs: int > 0, endMs > startMs, endMs <= 86_400_000 }`
- Output: `{ ok: true }`
- Total ai: channels after this milestone: 12

## Risk classification

- `src/preload/index.ts` — Risk-3 (new contextBridge method)
- `src/shared/ipc/channels.ts` — Risk-3 (new channel)
- `src/main/ipc/registerIpcHandlers.ts` — Risk-3 (new handler)
- `src/main/services/database/databaseService.ts` — Risk-2 (new parameterized query)
- `src/main/services/ai/clipCandidateService.ts` — Risk-2 (new service method)
- `src/renderer/**` — Risk-1 (new UI component + hook)

Required verifiers: electron-security-reviewer (Risk-3), architecture-reviewer (layer boundaries).

## Acceptance criteria

`docs/product/M9_ACCEPTANCE_CRITERIA.md` — 23 ACs across 6 groups.

## Timestamp formatting spec

Source: `docs/research/YOUTUBE_CLIPPER_SKILL_MILESTONE_IMPACT.md` M9 amendment.

SceneSift canonical time unit: integer milliseconds. No float arithmetic in comparisons.

Display format: `H:MM:SS.mmm` (hours >= 1) or `M:SS.mmm` (hours == 0).

Examples:
| ms | Display |
|---|---|
| 5025678 | 1:23:45.678 |
| 1425678 | 23:45.678 |
| 45678 | 0:45.678 |
| 0 | 0:00.000 |
