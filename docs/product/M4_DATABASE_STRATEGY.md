# M4 — Video Preview Workspace: Database Strategy

Date: 2026-07-20
Status: PLANNING

---

## Summary

M4 requires NO new database schema. All data needed for video preview is already in existing tables.

---

## Existing data used

| Column / Table | Used for |
|---|---|
| `projects.video_path` | Resolved by protocol handler to serve video bytes |
| `projects.status` | prerequisitesMet check (must be 'ready') |
| `projects.subtitle_status` | prerequisitesMet check (must be 'ready'/'ready_with_warnings') |
| `projects.media_metadata` | Display duration, fps, resolution in preview header |
| `subtitle_documents.cues_json` | Cue list + overlay display |
| `subtitle_documents.project_id` | Lookup key |

---

## No new schema

No `ALTER TABLE` migrations needed. No new tables. M4 adds a `video:getCues` IPC channel that reads from the existing `subtitle_documents` table via `db.getSubtitleDocument(projectId)`.

---

## No persistence of player state

Player position, speed, volume, and mute are NOT persisted. Each preview session starts fresh. Rationale: M4 is review-only; persistent position would require project-level schema changes with unclear benefit at this stage.

---

## DB access pattern

`VideoService.getCues(projectId)`:
1. `db.getProject(projectId)` — verify prerequisites (status, subtitleStatus)
2. `db.getSubtitleDocument(projectId)` — get cue array
3. Map to `VideoCueItem[]` — extract `index`, `startMs`, `endMs`, `text`

`VideoService.getPlaybackUrl(projectId)`:
1. `db.getProject(projectId)` — verify videoPath is present
2. Return `local://video/${projectId}` (no file access here — deferred to protocol handler)

---

## DB layer boundary

Only `VideoService` accesses the database. The protocol handler does NOT have a reference to `DatabaseService` directly — it receives the resolved file path through `VideoService` at registration time OR it is initialized with a db reference and calls `db.getProject(projectId).videoPath` directly (to be determined in implementation plan — see security constraint: the protocol handler must have access to DB to validate project paths without trusting the URL).

Recommended: protocol handler is initialized with `DatabaseService` reference at app startup, so it can validate projectId → videoPath independently of the IPC path.
