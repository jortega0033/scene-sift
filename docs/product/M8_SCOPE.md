# M8 — Candidate Review Workflow: Scope

## Goal

Structured review UI for accepting, rejecting, and skipping clip candidates.

## In Scope

- Add 'skipped' to candidate status values (no DDL migration — stored as TEXT, enum expanded in schema)
- Candidate notes: free-text annotation per candidate (DB migration 0006: add `notes` TEXT NULLABLE to `clip_candidates`)
- AI_UPDATE_CANDIDATE_NOTES IPC channel + service method
- AI_UPDATE_CANDIDATE_STATUS gains 'skipped' as valid status input
- Score filter: numeric threshold input (0.0–1.0) in CandidatesSection; candidates below threshold hidden
- Batch actions: "Approve all" and "Reject all" buttons acting on all currently-filtered candidates
- Skip control: per-candidate Skip button (sets candidateStatus = 'skipped')
- Inline notes textarea per candidate (rendered below reason, saves on blur)
- Sort controls: sort by score, startMs, or status
- "Review summary" row: count of suggested/approved/rejected/skipped
- Filter persistence: score threshold stored in React state (not DB), resets on navigation

## Out of Scope

- Clip timing editor (M9)
- Subtitle cue editing (M10)
- FFmpeg rendering (M12)
- Any new AI calls
- "Advance to timing editor" navigation (M9 doesn't exist yet)

## DB changes (Risk 3)

Migration 0006: `ALTER TABLE clip_candidates ADD COLUMN notes TEXT`

## IPC changes (Risk 3)

New channel: `ai:updateCandidateNotes`
Input: `{ candidateId: string }` (UUID) + `{ notes: string }`
Output: `{ ok: true }`

## Architecture

Unidirectional. No new dependencies. No renderer → node imports.

## Risk

- Risk 3: DB migration + IPC changes (main/preload paths)
- Risk 1: renderer UI

## Acceptance criteria

See M8_ACCEPTANCE_CRITERIA.md.
