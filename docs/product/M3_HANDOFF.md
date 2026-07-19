# M3 Handoff — Subtitle Synchronization Check

Version: 1.0
Status: Planning — Ready for Implementation
Milestone: M3

---

## 1. What M3 Does

M3 adds a structural timing analysis check between subtitle cue timestamps and video duration. It reads subtitle cues and video duration from data already persisted in SQLite by M1 (video inspection) and M2 (subtitle parsing). It produces one of six states and up to five warning codes, all stored back to the database. The check runs only when a user explicitly clicks a button — never automatically.

---

## 2. What to Read First

Read these documents in order before writing any code:

1. `docs/product/M3_SCOPE.md` — feature boundary definition
2. `docs/product/M3_SYNCHRONIZATION_DEFINITION.md` — what "timing check" means and does not mean
3. `docs/product/M3_TIMING_MODEL.md` — threshold rationale
4. `docs/product/M3_ACCEPTANCE_CRITERIA.md` — testable pass/fail conditions (this milestone)
5. `docs/product/M3_RISK_REGISTER.md` — known risks and mitigations
6. `docs/product/M3_TEST_PLAN.md` — every test case with inputs and expected outputs
7. `docs/product/M3_IMPLEMENTATION_PLAN.md` — ordered phases with exact files and commands

---

## 3. Implementation Order

Follow these phases in sequence. No phase may begin until the previous one passes all required checks.

1. **Phase 1** — Shared types and schemas (Risk 1): Create `sync.ts` types, add IPC channel constant, add Zod contracts.
2. **Phase 2** — Database migration (Risk 3): Write and test `0003_sync_check.sql`, update Drizzle schema.
3. **Phase 3** — Analyzer implementation (Risk 1): Create `SynchronizationAnalyzer.ts` with 20+ unit tests.
4. **Phase 4** — Service implementation (Risk 2): Create `SynchronizationService.ts` with mock DB tests.
5. **Phase 5** — IPC and preload (Risk 3): Register handler, add to preload bridge, add IPC contract test.
6. **Phase 6** — Renderer component (Risk 1): Create `SyncStatusPanel.tsx` and `syncFormatters.ts` with formatter tests.
7. **Phase 7** — E2E and visual tests (Risk 1): QA fixtures for all 6 states, 8 E2E tests, 3+ visual scenarios.
8. **Phase 8** — Final validation (Risk 1): Run `pnpm validate:full` to completion.

---

## 4. Decisions That Are Final

These design decisions are closed and must not be changed without re-review by the project owner and updated planning docs:

- **No global offset**: M3 computes structural timing stats only. It does not compute or apply any offset correction. Offset functionality is deferred to a future milestone.
- **Explicit user trigger only**: The sync check fires only on button click. No automatic checks on project load, on subtitle parse completion, or on any background event.
- **Persisted data only**: Analysis uses `durationSeconds` and cues already in SQLite. No new file reads, no FFprobe calls, no subtitle file re-reads during a sync check.
- **M2 warnings not duplicated**: `NEGATIVE_DURATION_CUE`, `OUT_OF_ORDER_CUES`, and other M2 parse warnings are not re-emitted by the M3 analyzer. M3 only emits the five M3-specific warning codes listed below.
- **Canonical unit is integer milliseconds**: All timing comparisons use integer ms. `durationSeconds` from the DB is multiplied by 1000 and truncated to integer ms. No floating-point seconds in analysis logic.

---

## 5. Key Types

These interfaces are implementation-ready. They belong in `src/shared/schemas/sync.ts`.

```typescript
export type SyncStatus =
  | 'not_available'
  | 'ready_to_check'
  | 'timing_ok'
  | 'needs_review'
  | 'stale'
  | 'check_failed';

export type SyncWarningCode =
  | 'CUES_OUTSIDE_VIDEO_RANGE'
  | 'SUBTITLE_SPAN_SHORT'
  | 'SUBTITLE_SPAN_LONG'
  | 'LARGE_TAIL_GAP'
  | 'LATE_SUBTITLE_START';

export interface SyncWarning {
  code: SyncWarningCode;
  outOfRangeCount?: number; // for CUES_OUTSIDE_VIDEO_RANGE
  spanRatio?: number;       // for SUBTITLE_SPAN_SHORT, SUBTITLE_SPAN_LONG
  gapMs?: number;           // for LARGE_TAIL_GAP
  startRatio?: number;      // for LATE_SUBTITLE_START
}

export interface SyncAnalysisInput {
  durationMs: number;
  cues: Array<{ startMs: number; endMs: number }>;
}

export interface SyncAnalysisResult {
  syncStatus: 'timing_ok' | 'needs_review' | 'check_failed';
  syncWarnings: SyncWarning[];
  syncErrorCode?: string;      // only when check_failed (INVALID_VIDEO_DURATION, NO_CUES_TO_ANALYZE, SYNC_ANALYZER_INTERNAL_ERROR)
  syncAnalysisVersion: number; // always M3_ANALYSIS_VERSION
}

export interface SyncCheckResult {
  success: boolean;
  result?: {
    status: SyncStatus;
    warnings: SyncWarning[];
    checkedAt?: number; // Unix ms
  };
  error?: {
    code: string;
  };
}
```

---

## 6. Key Thresholds

These constants belong in `src/shared/schemas/sync.ts` as `SYNC_THRESHOLDS`.

```typescript
export const SYNC_THRESHOLDS = {
  /** Tolerance beyond video end before a cue is considered out-of-range (ms) */
  TAIL_TOLERANCE_MS: 2000,
  /** Minimum cue count required before span/tail checks are applied */
  SPAN_CHECK_MIN_CUES: 10,
  /** Span shorter than this ratio of video duration triggers SUBTITLE_SPAN_SHORT */
  SPAN_SHORT_RATIO: 0.5,
  /** Span longer than this ratio of video duration triggers SUBTITLE_SPAN_LONG */
  SPAN_LONG_RATIO: 1.2,
  /** Gap between last cue end and video end, beyond which LARGE_TAIL_GAP fires (ms) */
  LARGE_TAIL_GAP_MS: 10000,
  /** First cue starting after this fraction of video duration triggers LATE_SUBTITLE_START */
  LATE_START_THRESHOLD_RATIO: 0.15,
} as const;
```

All threshold comparisons use strict inequalities. See AC-M3-002 for exact boundary behaviors.

---

## 7. Test Count Targets

| Test Suite | File | Minimum |
|---|---|---|
| SynchronizationAnalyzer unit | `tests/main/sync/SynchronizationAnalyzer.test.ts` | 20 |
| SynchronizationService unit | `tests/main/sync/SynchronizationService.test.ts` | 5 |
| Sync formatters unit | `tests/renderer/syncFormatters.test.ts` | 12 |
| E2E sync | `tests/e2e/sync.spec.ts` | 8 |
| Visual regression | `tests/visual/sync.visual.spec.ts` | 3 |
| IPC contract | `tests/main/ipc-contracts.test.ts` | 1 new contract |
| Migration | `tests/database/migrations/0003_sync_check.test.ts` | 3 |

---

## 8. Acceptance Criteria Location

`docs/product/M3_ACCEPTANCE_CRITERIA.md`

All 6 acceptance groups (AC-M3-001 through AC-M3-006) must be passed before M3 is marked done. Each criterion is testable by automated test or deterministic manual verification.

---

## 9. Risk Register

`docs/product/M3_RISK_REGISTER.md`

Ten risks tracked (RISK-M3-01 through RISK-M3-10). The highest-severity risk is RISK-M3-05 (misleading sync language, Governance, High). It must be verified by the governance-verifier role before Phase 6 is marked done.

---

## 10. Gate.yaml Risk Levels

| Work | Risk Level | Key Requirement |
|---|---|---|
| DB migration (`0003_sync_check.sql`, schema.ts) | Risk 3 | Independent DB reviewer + full validate |
| IPC handler + preload bridge | Risk 3 | `electron-security-reviewer` + full validate |
| SynchronizationAnalyzer (pure computation) | Risk 1 | typecheck + test |
| Renderer component (SyncStatusPanel, formatters) | Risk 1 | design-system-reviewer for copy + lint + test |
| SynchronizationService (DB access) | Risk 2 | Independent verifier + full validate |
| Shared types/schemas | Risk 1 | typecheck + lint |

---

## 11. Owner Override

The project owner has waived manual human approval gates for individual phases of M3. This override is recorded as **GD-005** in `docs/governance/GOVERNANCE_DECISIONS.md`. This override means:

- Phase transitions do NOT require a human to click "approve" before proceeding.
- Automated validation is NOT waived. Every phase's required checks must pass with observed output.
- Independent verifier requirements for Risk 2 and Risk 3 phases are NOT waived. A different agent/role must verify those phases.
- If any phase exceeds 3 attempts without passing, escalation to the project owner is required — the override does not apply to stuck phases.
- This waiver applies to M3+ on the overnight/m3-plus-2026-07-20 branch only, not to main.
