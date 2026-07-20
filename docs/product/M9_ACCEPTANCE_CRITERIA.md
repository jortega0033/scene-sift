# M9 — Clip Timing Editor: Acceptance Criteria

## AC-M9-001 — IPC channel integrity

- AC-M9-001.1: `ai:updateCandidateTiming` channel registered in channels.ts; total ai: channels = 12
- AC-M9-001.2: Input validated: candidateId UUID, startMs non-negative integer, endMs positive integer, endMs > startMs, endMs <= 86_400_000
- AC-M9-001.3: Returns { ok: true } on success
- AC-M9-001.4: Updated startMs/endMs persist across app restart (verified by listCandidates after service restart)

## AC-M9-002 — Edit timing access

- AC-M9-002.1: "Edit timing" button visible on approved candidates only (not suggested/rejected/skipped)
- AC-M9-002.2: Opening editor initializes startMs/endMs from current candidate values
- AC-M9-002.3: Opening editor does not modify DB state

## AC-M9-003 — Video preview

- AC-M9-003.1: Timing editor shows embedded video player for project video
- AC-M9-003.2: "Seek to in" button seeks player to current startMs value
- AC-M9-003.3: "Seek to out" button seeks player to current endMs value

## AC-M9-004 — Time controls

- AC-M9-004.1: "Set in" button captures current player position (floor to integer ms) → updates startMs
- AC-M9-004.2: "Set out" button captures current player position (floor to integer ms) → updates endMs
- AC-M9-004.3: Save button disabled when startMs >= endMs
- AC-M9-004.4: Save button updates candidate startMs/endMs in DB, closes editor
- AC-M9-004.5: Cancel button closes editor without saving

## AC-M9-005 — Timestamp formatting

- AC-M9-005.1: Times displayed as M:SS.mmm (< 1 hour) or H:MM:SS.mmm (>= 1 hour)
- AC-M9-005.2: 5025678 ms → "1:23:45.678"
- AC-M9-005.3: 1425678 ms → "23:45.678"
- AC-M9-005.4: 45678 ms → "0:45.678"
- AC-M9-005.5: All timing comparisons use integer milliseconds (no float arithmetic)

## AC-M9-006 — Security

- AC-M9-006.1: candidateId UUID, startMs/endMs integers, endMs > startMs all validated at preload layer before ipcRenderer.invoke
- AC-M9-006.2: updateCandidateTimingInputSchema validated via registerValidatedHandler before main-process handler executes
- AC-M9-006.3: startMs/endMs values not logged to console or surfaced raw in error messages

## Total: 23 ACs
