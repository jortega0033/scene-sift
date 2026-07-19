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
| `projects` (individual media columns: `duration_seconds`, `width`, `height`, `fps`, `bit_rate_bps`, etc.) | Display duration, fps, resolution in preview header — assembled into `mediaMetadata` by database service, no single `media_metadata` column |
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

Only `VideoService` accesses the database. The protocol handler does NOT have a direct `DatabaseService` reference — it takes a `VideoService` parameter at registration time and calls `videoService.resolveVideoPath(projectId)` to get the filesystem path.

This keeps single-responsibility: DB path resolution stays in VideoService, protocol handler only handles HTTP layer concerns (request parsing, streaming, range support). Direct DB access in the protocol handler would bypass VideoService's validation logic.
