# M7 — Clip Candidate Generation: Scope

## Goal

Use the M6 AI provider to identify clip-worthy segments from a project's subtitle transcript. Users explicitly trigger generation, review AI-suggested candidates, and can mark each as approved or rejected. Candidates persist across app restart.

## In scope

- Explicit user-triggered generation (no auto-start)
- Transcript derived from existing subtitle cues (M2/M5 pipeline)
- Versioned clip-candidate prompt (clipCandidates v1.0.0)
- Structured output: array of {startMs, endMs, title, reason, score}
- Timestamp validation: startMs >= 0, endMs <= videoDuration, endMs > startMs
- Duration limits: 5 000 ms minimum, 180 000 ms maximum per candidate
- Count limits: 1–20 candidates per generation
- Duplicate detection by overlapping time range within same generation
- Persistence: `clip_candidates` table, survives restart
- Generation status on project: null | generating | done | failed | cancelled
- Provider/model/prompt version metadata per candidate
- Safe failures: non-retryable errors show user-facing message
- Human-review status: candidates start as 'suggested'; user sets 'approved' | 'rejected'
- Cancellation of in-progress generation
- Error recovery: failed generation leaves previous candidates intact

## IPC channels (4 new)

- `ai:generateCandidates` — trigger generation
- `ai:cancelGeneration` — cancel in-progress
- `ai:listCandidates` — get candidates + generation status
- `ai:updateCandidateStatus` — approve/reject a candidate

## Not in scope (M8+)

- Rich card-per-candidate review UI (M8)
- Batch accept/reject (M8)
- Filter by score threshold (M8)
- Candidate notes (M8)
- Timing adjustments (M9)
- Subtitle editing for clip (M10)
- Rendering (M12)

## Prerequisites

- Project status = 'ready' (M1)
- subtitleStatus in ['ready', 'ready_with_warnings'] (M2)
- AI provider configurationStatus = 'available' (M6)
- Video durationSeconds > 0

## Risk classification

Risk 3 — touches main process services, new IPC channels/contracts, new DB migration
