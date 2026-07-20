# M7 — Clip Candidate Generation: Acceptance Criteria

## AC-M7-001 — Generation trigger prerequisites

- AC-M7-001.1: Generate button absent / disabled when project status ≠ 'ready'
- AC-M7-001.2: Generate button absent / disabled when subtitleStatus not in ['ready', 'ready_with_warnings']
- AC-M7-001.3: Generate button absent / disabled when AI configurationStatus ≠ 'available'
- AC-M7-001.4: Generate button enabled when all three prerequisites met

## AC-M7-002 — Generation state transitions

- AC-M7-002.1: Clicking Generate sets candidateGenerationStatus = 'generating' before AI call starts
- AC-M7-002.2: Successful generation sets status = 'done', persists candidateGeneratedAt
- AC-M7-002.3: AI error sets status = 'failed', persists candidateGenerationError code
- AC-M7-002.4: User cancel sets status = 'cancelled'
- AC-M7-002.5: Generation status persists across app restart

## AC-M7-003 — AI input

- AC-M7-003.1: Transcript derived from project subtitle cues using TranscriptService (gapThreshold 500ms)
- AC-M7-003.2: Empty transcript returns error without calling AI
- AC-M7-003.3: Transcript content not logged to console or persisted beyond request
- AC-M7-003.4: Video duration (ms) passed to AI as upper bound context

## AC-M7-004 — AI output validation

- AC-M7-004.1: Rejects output where candidates array is missing or not an array
- AC-M7-004.2: Rejects candidate where startMs < 0
- AC-M7-004.3: Rejects candidate where endMs > videoDurationMs
- AC-M7-004.4: Rejects candidate where endMs - startMs < 5000
- AC-M7-004.5: Rejects candidate where endMs - startMs > 180000
- AC-M7-004.6: Rejects candidate where startMs >= endMs
- AC-M7-004.7: Rejects candidate where title exceeds 120 chars
- AC-M7-004.8: Rejects candidate where reason exceeds 500 chars
- AC-M7-004.9: Rejects candidate where score outside [0.0, 1.0]
- AC-M7-004.10: Count limit 1–20 enforced (excess candidates truncated or rejected)
- AC-M7-004.11: Duplicate ranges (>50% overlap within same generation) collapsed

## AC-M7-005 — Candidate persistence

- AC-M7-005.1: Candidates saved to clip_candidates table with correct projectId, generationId
- AC-M7-005.2: Regeneration replaces previous candidates for same project
- AC-M7-005.3: Candidates survive app restart — same list on reopen
- AC-M7-005.4: Project deletion cascades to candidate deletion
- AC-M7-005.5: Each candidate records modelId, promptVersion, sortOrder

## AC-M7-006 — Candidate display

- AC-M7-006.1: Candidate list displays startMs/endMs as human-readable timestamps (MM:SS or HH:MM:SS)
- AC-M7-006.2: Candidate title, reason, and score displayed
- AC-M7-006.3: Candidates sorted by score descending by default
- AC-M7-006.4: 'suggested' candidates shown with neutral indicator
- AC-M7-006.5: 'approved' candidates shown with positive indicator
- AC-M7-006.6: 'rejected' candidates shown with negative indicator
- AC-M7-006.7: Empty state when no candidates generated yet
- AC-M7-006.8: Error state shown when generation failed

## AC-M7-007 — Candidate status update

- AC-M7-007.1: Approve button sets candidateStatus = 'approved', persists to DB
- AC-M7-007.2: Reject button sets candidateStatus = 'rejected', persists to DB
- AC-M7-007.3: Status update persists across app restart

## AC-M7-008 — Cancellation

- AC-M7-008.1: Cancel button visible during generation
- AC-M7-008.2: Cancel terminates in-progress AI request
- AC-M7-008.3: After cancel, previous candidates (if any) remain intact
- AC-M7-008.4: Generation status = 'cancelled' after cancel

## AC-M7-009 — Security and privacy

- AC-M7-009.1: No transcript content in IPC response payload
- AC-M7-009.2: No API key in renderer state or IPC response
- AC-M7-009.3: No candidate data in logs beyond structured error codes

## AC-M7-010 — Error handling

- AC-M7-010.1: AI_NOT_CONFIGURED returns error without calling AI
- AC-M7-010.2: AI_CONSENT_REQUIRED returns error without calling AI
- AC-M7-010.3: AI provider errors shown as human-readable message to user
- AC-M7-010.4: Non-retryable errors (schema validation) not retried

## Total: 36 ACs
