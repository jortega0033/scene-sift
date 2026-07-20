# M5 — Transcript Preparation: Implementation Plan

---

## Phase 1 — Shared schemas and IPC channels (Risk 1)

### New file: `src/shared/schemas/transcript.ts`

```typescript
import { z } from 'zod';
import { subtitleStatusSchema } from './subtitle';

export const transcriptEntrySchema = z.object({
  startMs: z.number().int().nonnegative(),
  endMs: z.number().int().nonnegative(),
  text: z.string(),
});

export const transcriptGenerateInputSchema = z.object({
  projectId: z.string().uuid(),
  gapThresholdMs: z.number().int().min(0).max(10000).default(500),
});

export const transcriptGenerateOutputSchema = z.object({
  entries: z.array(transcriptEntrySchema),
  subtitleStatus: subtitleStatusSchema,
});

export const transcriptExportInputSchema = z.object({
  projectId: z.string().uuid(),
  gapThresholdMs: z.number().int().min(0).max(10000).default(500),
  format: z.enum(['txt', 'json']),
});

export const transcriptExportOutputSchema = z.object({
  exported: z.boolean(),
  path: z.string().nullable(),
});

export type TranscriptEntry = z.infer<typeof transcriptEntrySchema>;
export type TranscriptGenerateInput = z.infer<typeof transcriptGenerateInputSchema>;
export type TranscriptGenerateOutput = z.infer<typeof transcriptGenerateOutputSchema>;
export type TranscriptExportInput = z.infer<typeof transcriptExportInputSchema>;
export type TranscriptExportOutput = z.infer<typeof transcriptExportOutputSchema>;
```

### Modified: `src/shared/ipc/channels.ts`

Add to `IPC_CHANNELS`:
```typescript
TRANSCRIPT_GENERATE_FOR_PROJECT: 'transcript:generateForProject',
TRANSCRIPT_EXPORT_FOR_PROJECT: 'transcript:exportForProject',
```

---

## Phase 2 — TranscriptService (Risk 3 — main process)

### New file: `src/main/services/transcript/transcriptService.ts`

```typescript
import type { SubtitleCue } from '@shared/schemas/subtitle';
import type { TranscriptEntry } from '@shared/schemas/transcript';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

// Bounded quantifiers — ReDoS safe
const TAG_PATTERN = /(<[^>]{0,256}>|\{[^}]{0,256}\})/g;

export class TranscriptService {
  stripTags(text: string): string {
    return text.replace(TAG_PATTERN, '').replace(/\s+/g, ' ').trim();
  }

  mergeCues(cues: SubtitleCue[], gapThresholdMs: number): TranscriptEntry[] {
    if (cues.length === 0) return [];
    const entries: TranscriptEntry[] = [];
    let current: TranscriptEntry = {
      startMs: cues[0].startMs,
      endMs: cues[0].endMs,
      text: this.stripTags(cues[0].text),
    };
    for (let i = 1; i < cues.length; i++) {
      const gap = cues[i].startMs - current.endMs;
      if (gap <= gapThresholdMs) {
        current.endMs = cues[i].endMs;
        const stripped = this.stripTags(cues[i].text);
        if (stripped) current.text = current.text ? `${current.text} ${stripped}` : stripped;
      } else {
        if (current.text) entries.push(current);
        current = {
          startMs: cues[i].startMs,
          endMs: cues[i].endMs,
          text: this.stripTags(cues[i].text),
        };
      }
    }
    if (current.text) entries.push(current);
    return entries;
  }

  generateTranscript(
    cues: SubtitleCue[],
    options: { gapThresholdMs: number },
  ): TranscriptEntry[] {
    return this.mergeCues(cues, options.gapThresholdMs);
  }

  writeExport(entries: TranscriptEntry[], format: 'txt' | 'json', filePath: string): void {
    const tmpPath = path.join(os.tmpdir(), `scenesift-transcript-${Date.now()}.tmp`);
    let content: string;
    if (format === 'json') {
      content = JSON.stringify(entries, null, 2);
    } else {
      content = entries.map((e) => e.text).join('\n\n');
    }
    fs.writeFileSync(tmpPath, content, 'utf-8');
    fs.renameSync(tmpPath, filePath);
  }
}

export const transcriptService = new TranscriptService();
```

---

## Phase 3 — IPC handlers (Risk 3 — main/IPC)

### Modified: `src/main/ipc/registerIpcHandlers.ts`

Add 2 new handlers after the sync handler.

**TRANSCRIPT_GENERATE_FOR_PROJECT handler:**
```typescript
ipcMain.handle(IPC_CHANNELS.TRANSCRIPT_GENERATE_FOR_PROJECT, async (_event, rawInput) => {
  const parsed = transcriptGenerateInputSchema.safeParse(rawInput);
  if (!parsed.success) return { entries: [], subtitleStatus: 'not_selected' };
  const { projectId, gapThresholdMs } = parsed.data;
  const project = db.getProject(projectId);
  if (!project) return { entries: [], subtitleStatus: 'not_selected' };
  if (project.subtitleStatus !== 'ready' && project.subtitleStatus !== 'ready_with_warnings') {
    return { entries: [], subtitleStatus: project.subtitleStatus ?? 'not_selected' };
  }
  const document = db.getSubtitleDocument(projectId);
  if (!document) return { entries: [], subtitleStatus: 'not_selected' };
  const entries = transcriptService.generateTranscript(document.cues, { gapThresholdMs });
  return { entries, subtitleStatus: project.subtitleStatus };
});
```

**TRANSCRIPT_EXPORT_FOR_PROJECT handler:**
```typescript
ipcMain.handle(IPC_CHANNELS.TRANSCRIPT_EXPORT_FOR_PROJECT, async (_event, rawInput) => {
  const parsed = transcriptExportInputSchema.safeParse(rawInput);
  if (!parsed.success) return { exported: false, path: null };
  const { projectId, gapThresholdMs, format } = parsed.data;
  const project = db.getProject(projectId);
  if (!project) return { exported: false, path: null };
  if (project.subtitleStatus !== 'ready' && project.subtitleStatus !== 'ready_with_warnings') {
    return { exported: false, path: null };
  }
  const document = db.getSubtitleDocument(projectId);
  if (!document) return { exported: false, path: null };
  const entries = transcriptService.generateTranscript(document.cues, { gapThresholdMs });
  const { canceled, filePath } = await dialog.showSaveDialog({
    title: 'Export Transcript',
    defaultPath: `transcript.${format}`,
    filters: [
      { name: format === 'json' ? 'JSON' : 'Text', extensions: [format] },
    ],
  });
  if (canceled || !filePath) return { exported: false, path: null };
  try {
    transcriptService.writeExport(entries, format, filePath);
    return { exported: true, path: filePath };
  } catch {
    return { exported: false, path: null };
  }
});
```

---

## Phase 4 — Preload bridge (Risk 3 — preload)

### Modified: `src/preload/index.ts`

Add `transcript` namespace to contextBridge API:

```typescript
transcript: {
  generateForProject: (input: { projectId: string; gapThresholdMs?: number }) => {
    if (typeof input?.projectId !== 'string' || !input.projectId) {
      return Promise.reject(new Error('Invalid projectId'));
    }
    return ipcRenderer.invoke(IPC_CHANNELS.TRANSCRIPT_GENERATE_FOR_PROJECT, {
      projectId: input.projectId.trim(),
      gapThresholdMs: input.gapThresholdMs ?? 500,
    });
  },
  exportForProject: (input: { projectId: string; gapThresholdMs?: number; format: 'txt' | 'json' }) => {
    if (typeof input?.projectId !== 'string' || !input.projectId) {
      return Promise.reject(new Error('Invalid projectId'));
    }
    if (input.format !== 'txt' && input.format !== 'json') {
      return Promise.reject(new Error('Invalid format'));
    }
    return ipcRenderer.invoke(IPC_CHANNELS.TRANSCRIPT_EXPORT_FOR_PROJECT, {
      projectId: input.projectId.trim(),
      gapThresholdMs: input.gapThresholdMs ?? 500,
      format: input.format,
    });
  },
},
```

Update `SceneSiftApi` type declaration in `src/shared/api/sceneSiftApi.ts` with transcript namespace types.

---

## Phase 5 — Renderer (Risk 1)

### New files in `src/renderer/features/transcript/`

**`transcriptFormatters.ts`**:
```typescript
export const formatEntryTime = (ms: number): string => {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
};
```

**`TranscriptPage.tsx`**: Main page component
- State: `gapThresholdMs` (default 500), `exportStatus: idle|exporting|done|error`
- React Query: `useQuery(['transcript', projectId, gapThresholdMs], generateForProject)`
- Prereq check: show `data-testid="transcript-not-available"` if no subtitle or not ready
- Shows: GapThresholdSlider + TranscriptPreview + export buttons (.txt and .json)
- Export button calls `exportForProject`, shows success/error feedback

**`TranscriptPreview.tsx`**:
- `data-testid="transcript-preview"` wrapper
- List of entries: each `data-testid="transcript-entry"`
- Shows formatted timestamp + text
- Empty state: `data-testid="transcript-empty"` with "No cues found" message

**`GapThresholdSlider.tsx`**:
- `<input type="range" min="0" max="2000" step="100">`
- Label: "Merge gap: {value}ms"
- `data-testid="gap-threshold-slider"`

### Modified: `src/renderer/stores/uiStore.ts`

Add `'transcript'` to `AppRoute` union.

### Modified: `src/renderer/components/Layout.tsx`

Add "Transcript" nav button between Preview and Queue.

### Modified: `src/renderer/qa/fixtures.ts`

Add to `qaFixtureNames` array:
```typescript
'transcript-not-available',
'transcript-ready',
```

### Modified: `tests/fixtures/sceneSiftApi.ts`

Add to `FIXTURES` object:
```typescript
transcriptNotAvailable: 'transcript-not-available',
transcriptReady: 'transcript-ready',
```

### Modified: `src/renderer/qa/mockSceneSiftApi.ts`

Add `transcript` namespace to the mock API object:
```typescript
transcript: {
  generateForProject: async (input) => {
    if (fixture.name === 'transcript-ready') {
      return {
        entries: [
          { startMs: 1_000, endMs: 3_000, text: 'Previously on SceneSift…' },
          { startMs: 5_000, endMs: 12_000, text: 'The quick brown fox jumped over the lazy dog. End of clip.' },
        ],
        subtitleStatus: 'ready' as const,
      };
    }
    return { entries: [], subtitleStatus: 'not_selected' as const };
  },
  exportForProject: async () => ({ exported: true, path: '/mock/transcript.txt' }),
},
```

### Modified: `src/shared/api/sceneSiftApi.ts`

Add transcript namespace to `SceneSiftApi` interface.

---

## Phase 6 — Tests (Risk 1)

### New: `tests/main/transcriptService.test.ts`

Tests for `stripTags`, `mergeCues`, `generateTranscript`, `writeExport`:
- All AC-M5-001 and AC-M5-002 scenarios as unit tests (~25 tests)
- writeExport: creates file, correct format, atomic (tmp file cleaned)

### New: `tests/main/ipc-transcript.test.ts`

IPC handler tests:
- Generate: missing subtitle, ready subtitle, default gapThreshold
- Export: cancelled dialog, successful .txt export, successful .json export
- Invalid input rejection

### Modified: `tests/main/ipc-contracts.test.ts`

Add 2 new channel contract entries.

### New: `tests/e2e/transcript.e2e.spec.ts`

E2E scenarios:
1. Transcript nav button visible
2. No-subtitle state shows prerequisite message
3. Ready state: entries visible after generation
4. Gap threshold slider changes entries
5. Export .txt (mock save dialog in browser QA mode)

### New: `tests/visual/transcript.visual.spec.ts`

3 visual scenarios:
1. `transcript-not-available.png`
2. `transcript-ready.png`
3. `transcript-with-entries.png`

Regenerate all snapshots after Layout.tsx nav change.

---

## Modified files summary

| Action | Path | Risk |
|---|---|---|
| New | `src/shared/schemas/transcript.ts` | 1 |
| Modify | `src/shared/ipc/channels.ts` | 3 |
| New | `src/main/services/transcript/transcriptService.ts` | 3 |
| Modify | `src/main/ipc/registerIpcHandlers.ts` | 3 |
| Modify | `src/preload/index.ts` | 3 |
| Modify | `src/shared/api/sceneSiftApi.ts` | 1 |
| New | `src/renderer/features/transcript/transcriptFormatters.ts` | 1 |
| New | `src/renderer/features/transcript/TranscriptPage.tsx` | 1 |
| New | `src/renderer/features/transcript/TranscriptPreview.tsx` | 1 |
| New | `src/renderer/features/transcript/GapThresholdSlider.tsx` | 1 |
| Modify | `src/renderer/stores/uiStore.ts` | 1 |
| Modify | `src/renderer/components/Layout.tsx` | 1 |
| Modify | `src/renderer/qa/mockSceneSiftApi.ts` | 1 |
| Modify | `src/renderer/qa/fixtures.ts` | 1 |
| New | `tests/main/transcriptService.test.ts` | 1 |
| New | `tests/main/ipc-transcript.test.ts` | 1 |
| Modify | `tests/main/ipc-contracts.test.ts` | 1 |
| New | `tests/e2e/transcript.e2e.spec.ts` | 1 |
| New | `tests/visual/transcript.visual.spec.ts` | 1 |
| New | `docs/design/components/TranscriptPage.md` | 1 |
| New | `docs/design/components/TranscriptPreview.md` | 1 |
| New | `docs/design/components/GapThresholdSlider.md` | 1 |
