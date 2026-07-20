# M5 — Transcript Preparation: Implementation Plan

---

## Phase 1a — Shared schemas (Risk 1)

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
  subtitleStatus: subtitleStatusSchema.nullable(),
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

---

## Phase 1b — IPC channel registration (Risk 3)

### Modified: `src/shared/ipc/channels.ts`

Add to `IPC_CHANNELS` const object:
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
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';

// Bounded quantifiers + letter/slash first-char requirement — ReDoS safe, avoids stripping bare < > operators
const TAG_PATTERN = /(<[a-zA-Z/][^>]{0,255}>|\{[^}]{0,256}\})/g;

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
      // Negative gap (overlapping cues) satisfies <= threshold and is merged intentionally.
      // Overlapping cues appear in multi-track ASS files; merging is the correct behavior.
      if (gap <= gapThresholdMs) {
        current.endMs = Math.max(current.endMs, cues[i].endMs);
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
    // Same-directory tmp prevents EXDEV on cross-filesystem rename (e.g. save to external drive).
    const tmpPath = path.join(path.dirname(filePath), `${crypto.randomUUID()}.tmp`);
    let content: string;
    if (format === 'json') {
      content = JSON.stringify(entries, null, 2);
    } else {
      content = entries.map((e) => e.text).join('\n\n');
    }
    try {
      fs.writeFileSync(tmpPath, content, 'utf-8');
      fs.renameSync(tmpPath, filePath);
    } finally {
      // Clean up tmp file if rename failed (e.g. EACCES, EDQUOT).
      try { fs.unlinkSync(tmpPath); } catch { /* already renamed or never written */ }
    }
  }
}

export const transcriptService = new TranscriptService();
```

---

## Phase 3 — IPC handlers (Risk 3 — main/IPC)

### Modified: `src/main/services/files/dialogService.ts`

Add this export after the existing `selectBinaryPath` export:

```typescript
import type { SaveDialogOptions } from 'electron';

export const showTranscriptExportDialog = async (
  format: 'txt' | 'json',
): Promise<{ canceled: boolean; filePath?: string }> => {
  const browserWindow = BrowserWindow.getFocusedWindow();
  const options: SaveDialogOptions = {
    title: 'Export Transcript',
    defaultPath: `transcript.${format}`,
    filters: [{ name: format === 'json' ? 'JSON' : 'Text', extensions: [format] }],
  };
  const result = browserWindow
    ? await dialog.showSaveDialog(browserWindow, options)
    : await dialog.showSaveDialog(options);
  return { canceled: result.canceled, filePath: result.filePath };
};
```

### Modified: `src/main/ipc/registerIpcHandlers.ts`

Import additions at top:
```typescript
import { showTranscriptExportDialog } from '@main/services/files/dialogService';
import { transcriptService } from '@main/services/transcript/transcriptService';
import {
  transcriptGenerateInputSchema,
  transcriptGenerateOutputSchema,
  transcriptExportInputSchema,
  transcriptExportOutputSchema,
} from '@shared/schemas/transcript';
```

Add 2 handlers using `registerValidatedHandler` (not raw `ipcMain.handle`):

```typescript
registerValidatedHandler(
  IPC_CHANNELS.TRANSCRIPT_GENERATE_FOR_PROJECT,
  transcriptGenerateInputSchema,
  transcriptGenerateOutputSchema,
  async (input) => {
    const { projectId, gapThresholdMs } = input;
    const project = databaseService.getProject(projectId);
    if (!project) return { entries: [], subtitleStatus: null };
    if (project.subtitleStatus !== 'ready' && project.subtitleStatus !== 'ready_with_warnings') {
      return { entries: [], subtitleStatus: project.subtitleStatus };
    }
    const document = databaseService.getSubtitleDocument(projectId);
    if (!document) return { entries: [], subtitleStatus: null };
    const entries = transcriptService.generateTranscript(document.cues, { gapThresholdMs });
    return { entries, subtitleStatus: project.subtitleStatus };
  },
);

registerValidatedHandler(
  IPC_CHANNELS.TRANSCRIPT_EXPORT_FOR_PROJECT,
  transcriptExportInputSchema,
  transcriptExportOutputSchema,
  async (input) => {
    const { projectId, gapThresholdMs, format } = input;
    const project = databaseService.getProject(projectId);
    if (!project) return { exported: false, path: null };
    if (project.subtitleStatus !== 'ready' && project.subtitleStatus !== 'ready_with_warnings') {
      return { exported: false, path: null };
    }
    const document = databaseService.getSubtitleDocument(projectId);
    if (!document) return { exported: false, path: null };
    const entries = transcriptService.generateTranscript(document.cues, { gapThresholdMs });
    const dialogResult = await showTranscriptExportDialog(format);
    if (dialogResult.canceled || !dialogResult.filePath) return { exported: false, path: null };
    try {
      transcriptService.writeExport(entries, format, dialogResult.filePath);
      return { exported: true, path: dialogResult.filePath };
    } catch {
      return { exported: false, path: null };
    }
  },
);
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

Update `SceneSiftApi` type in `src/shared/api/sceneSiftApi.ts` with transcript namespace:

```typescript
transcript: {
  generateForProject: (input: { projectId: string; gapThresholdMs?: number }) => Promise<TranscriptGenerateOutput>;
  exportForProject: (input: { projectId: string; gapThresholdMs?: number; format: 'txt' | 'json' }) => Promise<TranscriptExportOutput>;
};
```

Import `TranscriptGenerateOutput` and `TranscriptExportOutput` from `@shared/schemas/transcript`.

---

## Phase 5 — Renderer (Risk 2)

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
- `ready_with_warnings`: show `data-testid="transcript-warning"` warning banner above preview
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

### Modified: `src/renderer/stores/uiStore.ts` (Risk 2)

Add `'transcript'` to `AppRoute` union.

### Modified: `src/renderer/components/Layout.tsx` (Risk 2)

Add "Transcript" nav button between Preview and Queue.

### Modified: `src/renderer/qa/fixtures.ts`

Add to `qaFixtureNames` array:
```typescript
'transcript-not-available',
'transcript-ready',
'transcript-ready-with-warnings',
```

Add to `fixtureMap`:
```typescript
'transcript-not-available': {
  name: 'transcript-not-available',
  projects: [{ ...projectB }],   // projectB has no subtitle
  queue: [],
  settings: baseSettings,
  capabilities: baseCapabilities,
  subtitleSelection: null,
},
'transcript-ready': {
  name: 'transcript-ready',
  projects: [{
    ...projectA,
    subtitleStatus: 'ready',
    subtitleCueCount: 3,
    subtitleLastCueEndMs: 12_000,
    subtitleParsedAt: now - 5_000,
  }],
  queue: [],
  settings: baseSettings,
  capabilities: baseCapabilities,
  subtitleSelection: null,
},
'transcript-ready-with-warnings': {
  name: 'transcript-ready-with-warnings',
  projects: [{
    ...projectA,
    subtitleStatus: 'ready_with_warnings',
    subtitleCueCount: 317,
    subtitleLastCueEndMs: 1_620_000,
    subtitleParsedAt: now - 8_000,
  }],
  queue: [],
  settings: baseSettings,
  capabilities: baseCapabilities,
  subtitleSelection: null,
},
```

### Modified: `tests/fixtures/sceneSiftApi.ts`

Add to `FIXTURES` object:
```typescript
transcriptNotAvailable: 'transcript-not-available',
transcriptReady: 'transcript-ready',
transcriptReadyWithWarnings: 'transcript-ready-with-warnings',
```

### Modified: `src/renderer/qa/mockSceneSiftApi.ts`

Add `transcript` namespace to the mock API object:
```typescript
transcript: {
  generateForProject: async (input) => {
    if (fixture.name === 'transcript-ready' || fixture.name === 'transcript-ready-with-warnings') {
      return {
        entries: [
          { startMs: 1_000, endMs: 3_000, text: 'Previously on SceneSift…' },
          { startMs: 5_000, endMs: 12_000, text: 'The quick brown fox jumped over the lazy dog.' },
        ],
        subtitleStatus: fixture.name === 'transcript-ready-with-warnings'
          ? ('ready_with_warnings' as const)
          : ('ready' as const),
      };
    }
    return { entries: [], subtitleStatus: null };
  },
  exportForProject: async () => ({ exported: true, path: '/mock/transcript.txt' }),
},
```

### Modified: `src/shared/api/sceneSiftApi.ts`

Add transcript namespace to `SceneSiftApi` type (see Phase 4 above).

---

## Phase 6 — Tests (Risk 1)

### New: `tests/main/transcriptService.test.ts`

Tests for `stripTags`, `mergeCues`, `generateTranscript`, `writeExport`:
- All AC-M5-001 and AC-M5-002 scenarios as unit tests (~27 tests)
- writeExport: creates file, correct format, atomic (tmp file cleaned after rename), renameSync failure returns cleanly

### New: `tests/main/ipc-transcript.test.ts`

Mock strategy for dialog:
```typescript
vi.mock('@main/services/files/dialogService', () => ({
  showTranscriptExportDialog: vi.fn(),
  // other exports not needed by transcript handlers
}));
```

Handler invocation pattern: mock `ipcMain` to capture registered handler callbacks, then invoke directly with test data.

Tests:
- Generate: missing subtitle, ready subtitle, ready_with_warnings subtitle, default gapThreshold
- Export: cancelled dialog, successful .txt export, successful .json export
- Invalid input rejection (thrown AppError, not silent default)

### Modified: `tests/main/ipc-contracts.test.ts`

Add 2 new channel contract entries:
```typescript
it('TRANSCRIPT_GENERATE_FOR_PROJECT is registered')
it('TRANSCRIPT_EXPORT_FOR_PROJECT is registered')
```

### New: `tests/renderer/transcriptFormatters.test.ts`

Tests for `formatEntryTime`: sub-hour, hour+, zero, large values, padding.

### New: `tests/governance/transcript-security.test.ts`

Static assertions for AC-M5-006.2 and AC-M5-006.3 (following existing `subtitle-security.test.ts` pattern):
- No hardcoded absolute paths in transcript service code (grep)
- No `shell: true` in transcript service code (grep)

### New: `tests/e2e/transcript.e2e.spec.ts`

E2E scenarios:
1. Transcript nav button visible
2. No-subtitle state shows `transcript-not-available`
3. Ready state generates and shows entries
4. Gap threshold slider changes entries
5. Export .txt (mock returns success in browser QA mode)
6. Navigate away and back — transcript page loads correctly (AC-M5-006.4)

### New: `tests/visual/transcript.visual.spec.ts`

3 visual scenarios:
1. `transcript-not-available.png`
2. `transcript-ready.png`
3. `transcript-ready-with-warnings.png`

Regenerate all snapshots after Layout.tsx nav change.

---

## ADR decision

No new ADR required. `TranscriptService` is a pure CPU computation service (no filesystem path traversal, no new IPC pattern, no new security boundary). The two new channels follow the identical pattern established by all existing `registerValidatedHandler` registrations. Compare with ADR-013 (SynchronizationService — read-only DB service) and ADR-014 (LocalVideoProtocol — new Electron protocol). TranscriptService introduces neither.

---

## Modified files summary

| Action | Path | Risk |
|---|---|---|
| New | `src/shared/schemas/transcript.ts` | 1 |
| Modify | `src/shared/ipc/channels.ts` | 3 |
| New | `src/main/services/transcript/transcriptService.ts` | 3 |
| Modify | `src/main/services/files/dialogService.ts` | 3 |
| Modify | `src/main/ipc/registerIpcHandlers.ts` | 3 |
| Modify | `src/preload/index.ts` | 3 |
| Modify | `src/shared/api/sceneSiftApi.ts` | 1 |
| New | `src/renderer/features/transcript/transcriptFormatters.ts` | 2 |
| New | `src/renderer/features/transcript/TranscriptPage.tsx` | 2 |
| New | `src/renderer/features/transcript/TranscriptPreview.tsx` | 2 |
| New | `src/renderer/features/transcript/GapThresholdSlider.tsx` | 2 |
| Modify | `src/renderer/stores/uiStore.ts` | 2 |
| Modify | `src/renderer/components/Layout.tsx` | 2 |
| Modify | `src/renderer/qa/mockSceneSiftApi.ts` | 1 |
| Modify | `src/renderer/qa/fixtures.ts` | 1 |
| New | `tests/main/transcriptService.test.ts` | 1 |
| New | `tests/main/ipc-transcript.test.ts` | 1 |
| Modify | `tests/main/ipc-contracts.test.ts` | 1 |
| New | `tests/renderer/transcriptFormatters.test.ts` | 1 |
| New | `tests/governance/transcript-security.test.ts` | 1 |
| New | `tests/e2e/transcript.e2e.spec.ts` | 1 |
| New | `tests/visual/transcript.visual.spec.ts` | 1 |
| New | `docs/design/components/TranscriptPage.md` | 1 |
| New | `docs/design/components/TranscriptPreview.md` | 1 |
| New | `docs/design/components/GapThresholdSlider.md` | 1 |
