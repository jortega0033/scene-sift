# M4 — Video Preview Workspace: Implementation Handoff

Date: 2026-07-20
Status: PLANNING — awaiting specialist review pass

---

## Summary

M4 adds a Preview page to SceneSift. Users can load any project with `status=ready` and a parsed subtitle and watch the video with synchronized cue overlay + cue list navigation. No DB schema changes. No new dependencies.

---

## Branch

`feature/m4-video-preview` (base: `overnight/m3-plus-2026-07-20`)

---

## Key architectural decisions

| Decision | Choice | Rationale |
|---|---|---|
| Video player | HTMLVideoElement | Built-in, no new dep. H.264 sufficient for MVP. |
| File serving | Custom `local://` Electron protocol | Renderer never sees file paths. Range requests (206) support seek. |
| IPC channels | `video:getPlaybackUrl`, `video:getCues` | Narrow API; validated with z.string().uuid() |
| Player state | Local React state only | No DB persistence needed for MVP |
| Cue source | `subtitle_documents.cues_json` | Already populated by M2 subtitle parsing |

---

## Prerequisites before implementation starts

1. Confirm `subtitle_documents.cues_json` field names against Drizzle schema (read `src/database/schema.ts`)
2. Confirm main process entry point file (app.ts / index.ts) for protocol registration
3. Confirm `registerValidatedHandler` utility location for IPC registration
4. Confirm existing `db.getSubtitleDocument(projectId)` method exists or determine correct method name

---

## Implementation sequence (follow phases in M4_IMPLEMENTATION_PLAN.md)

```
Phase 1 — Shared schemas + IPC channels (Risk 1)
  ↓ typecheck + lint
Phase 2 — VideoService + localVideoProtocol (Risk 3)
  ↓ typecheck + lint + test + governance + architecture
  ↓ electron-security-reviewer MUST sign off
  ↓ architecture-reviewer MUST sign off
Phase 3 — Preload bridge (Risk 3)
  ↓ typecheck + lint + test
Phase 4 — Renderer (Risk 1)
  ↓ typecheck + lint + test
Phase 5 — E2E + visual (Risk 1)
  ↓ test:e2e + test:visual
Phase 6 — Full validation
  ↓ pnpm validate + test:electron
```

Never skip Phase 2 independent verification.

---

## Security requirements (non-negotiable)

- UUID regex anchored `^/video/{uuid}$` in protocol handler
- videoPath resolved from DB only — never from URL
- `stat().isFile()` before serving
- No `shell: true`
- No `nodeIntegration: true`
- No raw error strings surfaced to renderer

---

## Known limitations (acceptable for M4)

- H.265/HEVC/MKV likely unsupported by HTMLVideoElement on macOS — user sees error state with message
- Seek performance may be slow on large files / spinning disk — no SLO required
- E2E tests cannot test actual video decode — tests UI state machine only
- Player position not persisted across sessions

---

## Acceptance criteria

33 criteria across AC-M4-001 through AC-M4-008.
See `docs/product/M4_ACCEPTANCE_CRITERIA.md`.

All 33 must pass before M4 can be accepted.
Critical/high audit findings cannot be waived (GD-005 override does not waive audit findings).

---

## Test evidence required

Per `AGENTS.md` and `loop-constraints.md`:
- `pnpm test` exit 0 with observed output
- `pnpm validate` exit 0
- `pnpm test:e2e` exit 0
- `pnpm test:visual` exit 0
- `pnpm test:electron` exit 0
- electron-security-reviewer must provide exact evidence for Phase 2 sign-off

---

## Documents index

| Doc | Purpose |
|---|---|
| M4_SCOPE.md | Goal, in/out scope, prerequisites |
| M4_ARCHITECTURE.md | Layer diagram, protocol, IPC, ADR-014 |
| M4_SECURITY_AND_LIMITS.md | T1-T6 threats + mitigations |
| M4_STATE_MACHINE.md | 6 player states + transitions |
| M4_UX_SPECIFICATION.md | Layout, controls, data-testid attrs |
| M4_ACCEPTANCE_CRITERIA.md | 33 ACs across 8 groups |
| M4_DATABASE_STRATEGY.md | No new schema; existing tables |
| M4_IMPLEMENTATION_PLAN.md | 6-phase plan with file list |
| M4_TEST_PLAN.md | Unit / E2E / visual test coverage |
| M4_USER_STORIES.md | 8 user stories |
| M4_RISK_REGISTER.md | 7 risks; highest residual = Low |
| M4_HANDOFF.md | This document |
