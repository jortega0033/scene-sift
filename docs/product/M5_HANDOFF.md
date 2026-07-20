# M5 — Transcript Preparation: Handoff

**Status**: Planning — pending specialist review.

---

## Summary

M5 adds a Transcript page that lets the user generate a clean, readable transcript from subtitle cues, preview it in-app, and export as `.txt` or `.json`.

No DB schema change. Transcript is generated on demand from existing `subtitle_documents` data.

---

## Key design decisions

| Decision | Rationale |
|---|---|
| Transcript generated on demand, not stored | No migration needed; re-generation is fast (pure CPU, <10ms for 10k cues) |
| Gap threshold as UI slider, not persisted | User-adjustable per session; not a project setting |
| Export via `dialog.showSaveDialog` in main | File path is OS-native, never constructed from renderer input — prevents path injection |
| Atomic write (tmp + rename) | Prevents partial write visible to OS |
| Tag regex with bounded quantifiers | ReDoS-safe for malformed subtitle content |
| `'transcript'` route added to AppRoute | Follows same pattern as existing routes |

---

## New AC count

28 ACs across AC-M5-001 through AC-M5-006.

---

## New files

| File | Purpose |
|---|---|
| `src/shared/schemas/transcript.ts` | Zod schemas + TypeScript types |
| `src/main/services/transcript/transcriptService.ts` | Business logic (strip, merge, write) |
| `src/renderer/features/transcript/transcriptFormatters.ts` | Formatting helpers |
| `src/renderer/features/transcript/TranscriptPage.tsx` | Main page |
| `src/renderer/features/transcript/TranscriptPreview.tsx` | Entry list |
| `src/renderer/features/transcript/GapThresholdSlider.tsx` | Gap control |
| `tests/main/transcriptService.test.ts` | Service unit tests |
| `tests/main/ipc-transcript.test.ts` | IPC handler tests |
| `tests/e2e/transcript.e2e.spec.ts` | E2E scenarios |
| `tests/visual/transcript.visual.spec.ts` | Visual regression |
| `docs/design/components/TranscriptPage.md` | Usage doc |
| `docs/design/components/TranscriptPreview.md` | Usage doc |
| `docs/design/components/GapThresholdSlider.md` | Usage doc |

---

## Modified files

| File | Change |
|---|---|
| `src/shared/ipc/channels.ts` | +2 channels |
| `src/main/ipc/registerIpcHandlers.ts` | +2 handlers |
| `src/preload/index.ts` | +transcript namespace |
| `src/shared/api/sceneSiftApi.ts` | +transcript type |
| `src/renderer/stores/uiStore.ts` | +'transcript' route |
| `src/renderer/components/Layout.tsx` | +Transcript nav item |
| `src/renderer/qa/mockSceneSiftApi.ts` | +transcript mock methods |
| `src/renderer/qa/fixtures.ts` | +transcript fixture names |
| `tests/main/ipc-contracts.test.ts` | +2 channel contracts |

---

## Risk classification

- Risk 3: channels.ts, registerIpcHandlers.ts, preload/index.ts → require architecture-reviewer + electron-security-reviewer verification
- Risk 1: everything else

---

## Required specialist reviews (implementation)

1. **architecture-reviewer** — verify layer boundaries, no main imports in renderer, IPC channel registration
2. **electron-security-reviewer** — verify preload input validation, no raw IPC exposure, dialog path handling, no shell: true, no command injection

---

## Implementation sequence

Phase 1 → Phase 2 → Phase 3 (requires electron-security-reviewer after Phase 3) → Phase 4 → Phase 5 → Phase 6 → full validation → acceptance audit → integrate into overnight branch.

---

## Prerequisite check

| Dependency | Status |
|---|---|
| M1 (project + video metadata) | ✅ CLOSED |
| M2 (subtitle_documents + getSubtitleDocument) | ✅ CLOSED |
| M3 (sync check) | ✅ CLOSED (informational) |
| M4 (preview workspace — nav pattern) | ✅ CLOSED |
