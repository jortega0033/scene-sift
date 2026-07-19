# SceneSift — Feature Dependency Graph

Date: 2026-07-19

---

## Dependency chain (linear)

```
[Project Creation]          ← DONE (M0)
      |
      ↓ requires: project exists, video path stored
[Media Inspection]          ← M1 (first vertical slice)
      |
      ↓ requires: video duration known, project status = ready
[Subtitle Parsing]          ← M2
      |
      ↓ requires: subtitle entries with timestamps, media duration for bounds validation
[Clip Selection]            ← M3
      |
      ↓ requires: clip records with start_ms/end_ms, FFmpeg available, output dir set
[Clip Generation]           ← M4
      |
      ↓ requires: clips generated and on disk
[Export/Review]             ← Post-MVP
```

The chain is strictly sequential. No feature is viable without its predecessor.

---

## Dependency matrix

| Feature | Depends on | Blocks |
|---|---|---|
| Project creation | None | All features |
| Media inspection | Project creation | Subtitle parsing, clip selection (duration), all downstream |
| Subtitle parsing | Project creation | Clip selection, clip generation |
| Clip selection | Subtitle parsing, media inspection | Clip generation |
| Clip generation | Clip selection, FFmpeg available | Export/review |

---

## Cross-cutting prerequisites

These must be true for any feature to ship:

| Prerequisite | How satisfied |
|---|---|
| FFmpeg/FFprobe available | Settings: binary detection on startup; user can override path |
| DB initialized | `databaseService.initialize()` runs migrations on startup |
| App governance gate green | `pnpm validate` passes before merge |
| Independent verifier approved | AGENTS.md risk workflow for all risk-3 changes |

---

## Internal dependencies per feature

### Media Inspection (M1) internal dependencies

```
ffmpegService.inspectMediaFile()
    ↓ requires
runCommand() [existing, shell: false]
    ↓ requires
ffprobePath [resolved by checkFfmpegAvailability, existing]

databaseService.updateProjectInspection()
    ↓ requires
migration 0001_media_inspection.sql [new]
    ↓ requires
schema.ts media columns [new]

PROJECT_INSPECT IPC handler
    ↓ requires
channels.ts: PROJECT_INSPECT [new]
contracts.ts: inspectProjectInputSchema, mediaInspectionResultSchema [new]

preload bridge: projects.inspect
    ↓ requires
IPC_CHANNELS.PROJECT_INSPECT [new]
SceneSiftApi.projects.inspect type [new]

renderer: media metadata display
    ↓ requires
projects.inspect return value [new]
projectSchema extended with media fields [new]
```

### Subtitle Parsing (M2) internal dependencies (future)

```
subtitleParser.parseSrt(path) [new]
    ↓ requires
node:fs/promises (existing, available in main)
file path stored in projects.subtitle_path [existing]

databaseService.storeSubtitleEntries(projectId, entries) [new]
    ↓ requires
migration 0002_subtitle_entries.sql [new, not in M1]

PROJECT_PARSE_SUBTITLES IPC handler [new, not in M1]
```

---

## Risks from linear dependency

- If M1 is delayed or blocked, M2–M4 cannot start. The vertical slice approach means any failure gates all downstream milestones.
- This is acceptable — each milestone produces user-visible value independently. M1 alone delivers "see video metadata," which is more valuable than no features at all.

---

## What is NOT a dependency (explicitly)

| Not required | For |
|---|---|
| Subtitle parsing | Media inspection — inspection runs on video only |
| Clip selection UI | Media inspection — metadata display is read-only |
| AI providers | Any milestone in scope |
| Network access | Any milestone in scope |
| External NPM packages | Media inspection — FFprobe is already bundled/detected |
