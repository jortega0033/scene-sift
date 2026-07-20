# M5 — Transcript Preparation: Architecture

---

## Layer overview

```
src/renderer/features/transcript/
  TranscriptPage.tsx          ← route 'transcript' in uiStore
  TranscriptPreview.tsx       ← scrollable entry list
  GapThresholdSlider.tsx      ← 100–2000 ms input
  transcriptFormatters.ts     ← formatEntryTime(ms): string

src/preload/index.ts
  window.sceneSift.transcript.generateForProject(input)
  window.sceneSift.transcript.exportForProject(input)

src/shared/
  ipc/channels.ts             ← TRANSCRIPT_GENERATE_FOR_PROJECT, TRANSCRIPT_EXPORT_FOR_PROJECT
  schemas/transcript.ts       ← TranscriptEntry, GenerateInput/Output, ExportInput/Output

src/main/
  ipc/registerIpcHandlers.ts  ← 2 new handlers wired
  services/transcript/
    transcriptService.ts      ← stripTags, mergeCues, generateTranscript, writeExport
```

---

## Data flow — generate

```
renderer: window.sceneSift.transcript.generateForProject({ projectId, gapThresholdMs })
  → preload: validates input, ipcRenderer.invoke(TRANSCRIPT_GENERATE_FOR_PROJECT, payload)
    → main IPC handler: validates with Zod
      → DatabaseService.getSubtitleDocument(projectId) → SubtitleDocument | null
      → TranscriptService.generateTranscript(document.cues, options) → TranscriptEntry[]
      → returns { entries: TranscriptEntry[] }
  → preload: returns output
renderer: displays entries in TranscriptPreview
```

## Data flow — export

```
renderer: window.sceneSift.transcript.exportForProject({ projectId, gapThresholdMs, format })
  → preload: validates input, ipcRenderer.invoke(TRANSCRIPT_EXPORT_FOR_PROJECT, payload)
    → main IPC handler: validates with Zod
      → DatabaseService.getSubtitleDocument(projectId) → SubtitleDocument | null
      → TranscriptService.generateTranscript(document.cues, options) → TranscriptEntry[]
      → dialog.showSaveDialog({ filters: [{ name: format, extensions: [format] }] }) → { filePath }
      → if filePath: TranscriptService.writeExport(entries, format, filePath)
        → atomic write: fs.writeFileSync(tmpPath), fs.renameSync(tmpPath, filePath)
      → returns { exported: true, path: filePath } | { exported: false }
  → preload: returns output
renderer: shows success/cancel feedback
```

---

## TranscriptService methods

```typescript
interface TranscriptOptions {
  gapThresholdMs: number;  // 0–10000, validated in schema
}

interface TranscriptEntry {
  startMs: number;
  endMs: number;
  text: string;
}

// Strip HTML tags, VTT cue tags, ASS curly-brace formatting
stripTags(text: string): string

// Merge adjacent cues where gap between endMs[i] and startMs[i+1] <= gapThresholdMs
mergeCues(cues: SubtitleCue[], gapThresholdMs: number): TranscriptEntry[]

// Full pipeline: stripTags each cue.text, then mergeCues
generateTranscript(cues: SubtitleCue[], options: TranscriptOptions): TranscriptEntry[]

// Write entries to filePath in requested format, atomic temp-file pattern
writeExport(entries: TranscriptEntry[], format: 'txt' | 'json', filePath: string): void
```

---

## Schemas

```typescript
// src/shared/schemas/transcript.ts

transcriptEntrySchema = z.object({
  startMs: z.number().int().nonnegative(),
  endMs: z.number().int().nonnegative(),
  text: z.string(),
})

generateInputSchema = z.object({
  projectId: z.string().uuid(),
  gapThresholdMs: z.number().int().min(0).max(10000).default(500),
})

generateOutputSchema = z.object({
  entries: z.array(transcriptEntrySchema),
  subtitleStatus: subtitleStatusSchema,  // for error display
})

exportInputSchema = z.object({
  projectId: z.string().uuid(),
  gapThresholdMs: z.number().int().min(0).max(10000).default(500),
  format: z.enum(['txt', 'json']),
})

exportOutputSchema = z.object({
  exported: z.boolean(),
  path: z.string().nullable(),
})
```

---

## IPC channels

| Channel | Key | Input | Output |
|---|---|---|---|
| `transcript:generateForProject` | `TRANSCRIPT_GENERATE_FOR_PROJECT` | `GenerateInput` | `GenerateOutput` |
| `transcript:exportForProject` | `TRANSCRIPT_EXPORT_FOR_PROJECT` | `ExportInput` | `ExportOutput` |

---

## Tag stripping regex

```typescript
const TAG_PATTERN = /(<[^>]{0,256}>|\{[^}]{0,256}\})/g;
```

- Angle-bracket tags capped at 256 chars between `<` and `>` → no catastrophic backtracking
- Curly-brace blocks capped at 256 chars → handles ASS/SSA overrides
- After stripping, normalize whitespace: `.replace(/\s+/g, ' ').trim()`

---

## Renderer route

- `AppRoute` union extended with `'transcript'`
- Nav item added to `Layout.tsx` (between Preview and Queue)
- `TranscriptPage` loads only when a project is selected and subtitle status is `ready` or `ready_with_warnings`
- Otherwise shows "No subtitle ready" state

---

## No DB schema change

Transcript is generated on demand from `subtitle_documents`. Not persisted. No migration needed.
