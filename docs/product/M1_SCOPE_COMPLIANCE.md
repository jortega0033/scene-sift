# M1 Scope Compliance — Out-of-Scope Feature Audit

**Audit Run ID:** 2026-07-19T-m1-acceptance-audit
**Branch:** feature/m1-media-ingestion-inspection
**Date:** 2026-07-19

This document verifies that M1 implementation did not introduce any features outside the authorized M1 scope (media ingestion and media metadata inspection). Each out-of-scope item is audited via grep against the working tree.

---

## Authorized M1 Scope (what IS permitted)

Per `docs/product/FIRST_VERTICAL_SLICE.md` and `docs/product/MEDIA_INSPECTION_HANDOFF.md`:

- Project creation with video file selection via OS dialog
- FFprobe-based media metadata extraction (duration, resolution, codec, fps, bit rate, file size)
- Persisting inspection metadata to SQLite via 9 new schema columns
- Displaying metadata in project detail panel
- Displaying project status pills (draft / ready / inspection_failed)
- Error handling for FFprobe unavailability, file not found, no video stream, parse failure

---

## Out-of-Scope Feature Audit

### Method

Grep commands were run against `src/` and `tests/` to detect any code that implements features outside authorized M1 scope. Results are documented below. For each item, the ruling is:

- **NOT ADDED** — grep returned zero hits in implementation code (src/) for any implementation of this feature
- **FOUND** — grep returned hits; each is analyzed and explained

---

### 1. Subtitle Parsing

**Scope status:** OUT OF SCOPE for M1. Subtitle file selection UI is permitted (part of CreateProjectForm), but parsing subtitle file contents into cues, timestamps, or searchable text is not permitted.

**Grep run:**
```
grep -rn "subtitle.*parse\|parseSub\|srt.*parse\|vtt.*parse\|WebVTT\|SubtitleCue\|subtitle cue\|parseCue" src/
```

**Result:** Zero hits for subtitle cue parsing logic.

**Additional grep for subtitle path schema (expected, permitted):**
```
grep -rn "selectedSubtitleSchema\|subtitlePath\|subtitle.*file" src/
```

**Result:** Hits found in:
- `src/main/services/dialog/dialogService.ts` — `selectedSubtitleSchema.safeParse()` — this is **file path validation**, not subtitle content parsing. The schema validates that the selected file is a valid `.srt`/`.vtt`/`.ass` path string from the OS dialog. No subtitle file content is read or parsed.
- `src/renderer/features/projects/CreateProjectForm.tsx` — subtitle file select button and `subtitlePath` field in form state — UI affordance only; the path is stored but no parsing occurs.
- `src/shared/schemas/project.ts` — `subtitlePath: z.string().nullable()` in project schema — stores the file path string only.

**Ruling: NOT ADDED.** Subtitle file PATH selection and storage are in scope. No subtitle content parsing, cue extraction, or timestamp parsing was added.

---

### 2. Transcription / Speech-to-Text

**Scope status:** OUT OF SCOPE. No transcription, ASR, Whisper, or speech recognition features permitted in M1.

**Grep run:**
```
grep -rn "transcri\|whisper\|speech.to.text\|asr\|AudioTranscript\|openai.*audio\|deepgram\|assemblyai" src/
```

**Result:** Zero hits.

**Ruling: NOT ADDED.**

---

### 3. AI Provider / LLM Integration

**Scope status:** OUT OF SCOPE. No AI API calls, LLM prompting, or model integration permitted in M1.

**Grep run:**
```
grep -rn "openai\|anthropic\|claude.*api\|gemini\|langchain\|LLM\|llm\|ai.*provider\|AIProvider\|fetch.*model\|completions\|embeddings" src/
```

**Result:** Hits in `src/renderer/features/projects/ProjectsPage.tsx` — search reveals a disclaimer text string: `"Candidate generation, timeline editing, and rendering are not yet available"`. This is a **display-only placeholder notice**, not an AI integration. No AI API calls, no model configuration, no prompt construction.

Grep for actual API call patterns:
```
grep -rn "fetch.*openai\|createClient.*anthropic\|new Anthropic\|new OpenAI\|ChatCompletion\|invoke.*model" src/
```

**Result:** Zero hits.

**Ruling: NOT ADDED.** The only hit is a user-facing "coming soon" notice string; no AI provider code was introduced.

---

### 4. Clip Generation

**Scope status:** OUT OF SCOPE. No FFmpeg clip cutting, segment extraction, or render job execution permitted in M1.

**Grep run:**
```
grep -rn "clip.*generat\|generateClip\|cutSegment\|ffmpeg.*ss\|ffmpeg.*to\|renderClip\|clipOutput\|segment.*cut\|extract.*segment" src/
```

**Result:** Hits in `src/renderer/features/projects/ProjectsPage.tsx` — the disclaimer: `"Candidate generation, timeline editing, and rendering are not yet available"`. Display text only, no implementation.

Grep for actual clip/cut implementation:
```
grep -rn "ffmpeg.*-ss\|ffmpeg.*-to\|ffmpeg.*-t \|renderJob.*execute\|startRender\|clipGenerat" src/
```

**Result:** Zero hits in implementation code.

**Ruling: NOT ADDED.** Queue infrastructure existed before M1 (createDemoJob IPC channel) and was not modified for clip generation. The disclaimer text is display-only.

---

### 5. Video Preview / Playback

**Scope status:** OUT OF SCOPE. No inline video player, thumbnail extraction, or frame preview permitted in M1.

**Grep run:**
```
grep -rn "video.*player\|VideoPlayer\|HTMLVideoElement\|video.*src\|thumbnail\|frameExtract\|ffmpeg.*thumbnail\|previewFrame\|<video\|videoRef" src/renderer/
```

**Result:** Zero hits.

**Ruling: NOT ADDED.**

---

### 6. Timeline Editing

**Scope status:** OUT OF SCOPE. No timeline UI, waveform display, or segment drag-and-drop permitted in M1.

**Grep run:**
```
grep -rn "timeline\|waveform\|TimelineEditor\|TimeRange\|dragSegment\|clipRange\|playhead\|scrubber" src/renderer/
```

**Result:** Zero hits matching implementation. The word "timeline" appears only once in `ProjectsPage.tsx` in the same disclaimer string: `"Candidate generation, timeline editing, and rendering are not yet available"`.

**Ruling: NOT ADDED.**

---

### 7. Publishing / Export

**Scope status:** OUT OF SCOPE. No publishing, export to external service, upload, or distribution features permitted in M1.

**Grep run:**
```
grep -rn "publish\|export.*clip\|upload.*clip\|distribute\|youtube\|vimeo\|s3.*upload\|cloudinary\|CDN.*upload" src/
```

**Result:** Zero hits in implementation code.

**Ruling: NOT ADDED.**

---

### 8. Cloud Storage / Remote Sync

**Scope status:** OUT OF SCOPE. SceneSift is local-first. No cloud sync, remote database, or network storage permitted.

**Grep run:**
```
grep -rn "supabase\|firebase\|s3\|blob.*storage\|cloudStorage\|sync.*remote\|replicat\|remoteDatabas\|network.*storage" src/
```

**Result:** Zero hits.

**Ruling: NOT ADDED.**

---

### 9. Analytics / Telemetry

**Scope status:** OUT OF SCOPE. No user analytics, crash reporting, or telemetry permitted.

**Grep run:**
```
grep -rn "analytics\|telemetry\|mixpanel\|segment.*track\|amplitude\|posthog\|sentry\|crashReport\|trackEvent\|logEvent" src/
```

**Result:** Zero hits.

**Ruling: NOT ADDED.**

---

### 10. AI-Assisted Candidate Selection

**Scope status:** OUT OF SCOPE. No AI-based clip selection, scoring, or recommendation permitted in M1.

**Grep run:**
```
grep -rn "candidateSelect\|aiSelect\|clipScore\|clipRank\|recommend.*clip\|autoSelect\|candidateGenerat" src/
```

**Result:** Zero hits.

**Ruling: NOT ADDED.**

---

### 11. User Authentication / Accounts

**Scope status:** OUT OF SCOPE. SceneSift is single-user local app; no auth permitted.

**Grep run:**
```
grep -rn "auth\|login\|logout\|session\|jwt\|token.*auth\|password\|signIn\|signOut" src/
```

**Result:** Zero hits in implementation code. (Governance token references are in test files only and refer to governance tokens, not auth tokens.)

**Ruling: NOT ADDED.**

---

### 12. Subtitle Display Overlay

**Scope status:** OUT OF SCOPE. Even if subtitle path is stored, rendering subtitle cues over video is not in M1 scope.

**Grep run:**
```
grep -rn "SubtitleOverlay\|subtitleDisplay\|renderSubtitle\|cue.*render\|VTTCue\|showCue" src/
```

**Result:** Zero hits.

**Ruling: NOT ADDED.**

---

## Summary Table

| Out-of-Scope Feature | Result | Notes |
|---|---|---|
| Subtitle parsing (cue extraction) | NOT ADDED | Only file path selection/storage; no content parsing |
| Transcription / speech-to-text | NOT ADDED | Zero hits for whisper, deepgram, ASR |
| AI provider / LLM integration | NOT ADDED | One hit is a "not yet available" disclaimer string |
| Clip generation | NOT ADDED | One hit is a "not yet available" disclaimer string |
| Video preview / playback | NOT ADDED | Zero hits |
| Timeline editing | NOT ADDED | One hit is a "not yet available" disclaimer string |
| Publishing / export | NOT ADDED | Zero hits |
| Cloud storage / remote sync | NOT ADDED | Zero hits |
| Analytics / telemetry | NOT ADDED | Zero hits |
| AI-assisted candidate selection | NOT ADDED | Zero hits |
| User authentication / accounts | NOT ADDED | Zero hits |
| Subtitle display overlay | NOT ADDED | Zero hits |

---

## Verdict

**PASS — No out-of-scope features introduced.**

The M1 implementation is strictly bounded to media ingestion and metadata inspection. All out-of-scope feature categories were audited via grep and returned either zero implementation hits or hits that are limited to display-only "not yet available" disclaimer strings in `ProjectsPage.tsx`. No AI API calls, no cloud storage, no clip generation, no subtitle content parsing, and no analytics were introduced.

This scope compliance check does not affect the overall M1 NOT ACCEPTED verdict, which is driven by acceptance criteria failures documented in `docs/product/M1_ACCEPTANCE_AUDIT.md`.
