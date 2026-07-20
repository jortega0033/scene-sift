# M8 — Candidate Review Workflow: Acceptance Criteria

## AC-M8-001 — Candidate status values

- AC-M8-001.1: candidateStatus accepts 'suggested', 'approved', 'rejected', 'skipped'
- AC-M8-001.2: Skip button sets candidateStatus = 'skipped', persists to DB
- AC-M8-001.3: Skipped candidates shown with distinct neutral indicator
- AC-M8-001.4: Status updates persist across app restart

## AC-M8-002 — Candidate notes

- AC-M8-002.1: Each candidate has a notes text field (visible in review UI)
- AC-M8-002.2: Saving notes persists to clip_candidates.notes column
- AC-M8-002.3: Notes survive app restart
- AC-M8-002.4: Notes field is optional (null = no note entered)
- AC-M8-002.5: Notes saved on blur (not requiring explicit Save button)
- AC-M8-002.6: Notes input max length 1000 characters enforced

## AC-M8-003 — Score filter

- AC-M8-003.1: Score threshold input visible when candidates exist
- AC-M8-003.2: Candidates with scoreRaw < threshold hidden from display
- AC-M8-003.3: Threshold default is 0.0 (show all)
- AC-M8-003.4: Threshold accepts 0.0–1.0 input range
- AC-M8-003.5: Filter applies to displayed list only; does not delete or change DB records
- AC-M8-003.6: Filter state resets when switching projects

## AC-M8-004 — Batch actions

- AC-M8-004.1: "Approve all" button approves all currently-displayed (filtered) suggested candidates
- AC-M8-004.2: "Reject all" button rejects all currently-displayed (filtered) suggested candidates
- AC-M8-004.3: Batch actions do not affect already-approved, already-rejected, or skipped candidates
- AC-M8-004.4: Batch actions persist to DB (call updateCandidateStatus per affected candidate)
- AC-M8-004.5: "Approve all" / "Reject all" buttons absent when no suggested candidates in filtered view

## AC-M8-005 — Sort controls

- AC-M8-005.1: Candidates sortable by score (default, descending)
- AC-M8-005.2: Candidates sortable by start time (ascending)
- AC-M8-005.3: Candidates sortable by status group (approved > suggested > skipped > rejected)
- AC-M8-005.4: Sort choice resets when switching projects

## AC-M8-006 — Review summary

- AC-M8-006.1: Summary row shows count of suggested, approved, rejected, skipped candidates
- AC-M8-006.2: Summary row updates immediately on status change
- AC-M8-006.3: Summary row visible when candidates exist (any count)

## AC-M8-007 — Security

- AC-M8-007.1: Notes content not logged to console
- AC-M8-007.2: Notes IPC payload validated with Zod before main-process handler executes
- AC-M8-007.3: No notes content in any error message surfaced to renderer beyond structured codes

## Total: 24 ACs
