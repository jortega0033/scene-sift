# M2 — Subtitle Parsing and Validation: Scope

**Milestone:** M2 — Subtitle Parsing and Validation
**Spec date:** 2026-07-19
**Prerequisite:** M1 merged (video inspection complete)

---

## Primary objective

When a project has a subtitle file path stored, the user can trigger parsing. The main process reads the file, parses it into a normalized cue list, validates structure and limits, calculates a summary, and persists the result. The renderer displays a truthful subtitle status panel with summary fields and human-readable errors. The parse state survives app restart.

---

## Bounded workflow

```
User opens project with subtitle file selected
→ user triggers "Parse subtitle" action
→ IPC: subtitle:parseForProject(projectId)
→ main: look up project, verify subtitlePath set
→ main: path.resolve() + stat() + isFile() + size check
→ main: read file bytes (bounded)
→ main: detect format from extension
→ main: select parser (SRT or WebVTT)
→ main: parse cues with resource limits enforced
→ main: normalize timestamps to milliseconds
→ main: strip presentation tags from cue text
→ main: validate cue structure (order, bounds, limits)
→ main: calculate summary (cue count, start/end, warnings)
→ main: persist parse state to DB
→ IPC: return parse result to renderer
→ renderer: invalidate project query (TanStack Query)
→ renderer: display subtitle summary panel with parse state
→ app restart: project loads with persisted parse state
```

---

## In scope

- Subtitle file re-validation at parse time (stat + isFile + size)
- SRT parsing (`.srt`)
- WebVTT parsing (`.vtt`)
- Cue normalization: timestamps to milliseconds, text stripping
- Structural validation: order, overlap detection (warning not error), zero-duration, negative timestamps
- Resource limits: file size, cue count, cue text length, total text size
- Parse state persistence: status, cue count, parse error, parsed_at
- Cue document persistence: bounded JSON blob in a separate DB table
- Subtitle summary display in project detail panel
- Human-readable error messages (never raw error codes)
- Always-rendered subtitle section with placeholders when not parsed
- Subtitle parse state recovery after app restart (integration test required)
- Pure formatter functions for subtitle fields (independently tested)
- Browser QA mock/fixture updates for subtitle parse states
- IPC contract tests for new subtitle channels
- Unit tests for parsers, formatters, DB methods
- E2E tests for parse workflow
- Visual regression tests for subtitle summary panel

---

## Explicitly out of scope (deferred)

| Feature | Deferred to |
|---|---|
| ASS/SSA parsing | M3 or later |
| Global subtitle–video sync offset | M3 |
| Automatic sync check (subtitle vs video duration) | M3 |
| Cue-level timing editor | M9 |
| Subtitle text editing | M10 |
| Subtitle burn-in / rendering | M11/M12 |
| AI-assisted translation | M19 |
| Transcription from audio | Not on roadmap for SceneSift v1 |
| Binary subtitle formats (EBU-STL, TTML) | Not planned |
| Subtitle track selection (multi-track video) | Not M2 |
| Cloud upload or sync of subtitle contents | Never without explicit consent gate |

---

## Scope guard — M3 must not appear in M2

M3 adds sync checking: comparing subtitle last-cue end time to video duration. M2 provides the data M3 needs (parsed cues, last end timestamp). M2 must NOT:

- Compute any sync result or flag
- Display any "in sync" or "out of sync" status
- Compare subtitle timestamps to video duration
- Introduce a `synchronized` or `sync_status` field

---

## Definition of done

M2 is complete when:

1. User can parse a supported subtitle file (SRT or WebVTT) from a project with a subtitle path.
2. Parse runs in the main process; renderer never reads subtitle file directly.
3. File path is re-validated at parse time (path.resolve + stat + isFile + size).
4. Resource limits are enforced (file size, cue count, text length).
5. Normalized cues use a single internal model (startMs, endMs, text, lines).
6. Malformed cues generate structured warnings, not silent data corruption.
7. Internal error codes map to human-readable UI messages.
8. Subtitle summary panel always renders with placeholders when not parsed.
9. Parse state (status, cue count, error, parsed_at) persists to DB.
10. Parse state survives database close and reopen.
11. Source subtitle file is never modified.
12. Subtitle text is never uploaded or logged in raw form.
13. Browser mocks reflect all subtitle parse states.
14. `updateProjectSubtitle*` DB methods have direct unit tests.
15. Restart persistence has an integration test (close + reopen).
16. Browser E2E tests assert user-visible behavior (not internal codes).
17. Visual tests pass for all subtitle states.
18. Full validation passes (`pnpm validate` exit 0).
19. No M3 or later capability was introduced.
