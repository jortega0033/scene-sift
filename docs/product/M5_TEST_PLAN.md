# M5 — Transcript Preparation: Test Plan

---

## Coverage targets

| Layer | Test file | Scenarios |
|---|---|---|
| TranscriptService unit | `tests/main/transcriptService.test.ts` | ~27 |
| IPC handler unit | `tests/main/ipc-transcript.test.ts` | ~10 |
| IPC contracts | `tests/main/ipc-contracts.test.ts` | +2 channels |
| Formatter unit | `tests/renderer/transcriptFormatters.test.ts` | ~5 |
| Governance grep | `tests/governance/transcript-security.test.ts` | 2 |
| E2E (browser QA) | `tests/e2e/transcript.e2e.spec.ts` | ~6 |
| Visual regression | `tests/visual/transcript.visual.spec.ts` | 3 |

---

## transcriptService.test.ts

### stripTags

```typescript
describe('stripTags', () => {
  it('strips HTML italic tags')          // '<i>hello</i>' → 'hello'
  it('strips HTML bold tags')            // '<b>hello</b>' → 'hello'
  it('strips HTML underline tags')       // '<u>hello</u>' → 'hello'
  it('strips font color tags')           // '<font color="red">hello</font>' → 'hello'
  it('strips WebVTT voice tags')         // '<v John>hello</v>' → 'hello'
  it('strips WebVTT class tags')         // '<c.loud>hello</c>' → 'hello'
  it('strips ASS curly-brace blocks')    // '{\an8}hello' → 'hello'
  it('normalizes whitespace')            // 'hello  world' → 'hello world'
  it('handles empty string')             // '' → ''
  it('handles no tags')                  // 'hello world' → 'hello world'
  // AC-M5-001.10
  it('strips tags that produce empty string') // '<i></i>' → ''
  // AC-M5-001.9: assert output value, NOT execution time
  // Rationale: the bounded regex guarantees no catastrophic backtracking.
  // A correct test asserts the output is correct, not that it runs fast.
  it('handles malformed unclosed tag — output is correct string without the tag content')
    // '<b>hello' (no closing >) → regex does not match; full text returned as-is
    // 'hello <i world' → regex does not match '<i world' (no '>'); text returned as-is
  // Inequality operators must NOT be stripped
  it('does not strip inequality operators')  // 'temp < 100°C' → 'temp < 100°C'
})
```

### mergeCues

```typescript
describe('mergeCues', () => {
  it('merges adjacent cues within threshold')       // gap=400, thresh=500 → merged
  it('does not merge cues beyond threshold')        // gap=600, thresh=500 → separate
  it('sets merged startMs to first cue startMs')
  it('sets merged endMs to last cue endMs')
  it('joins merged text with space')
  it('handles gapThresholdMs=0')                    // gap=0 merged, gap=1 not merged
  it('handles single cue')                          // returns single entry
  it('handles empty cue array')                     // returns []
  it('skips empty-text entries from output')        // cue with text '' after strip omitted
  it('merges 3+ consecutive cues within threshold')
  // AC-M5-002.9: overlapping cues
  it('merges overlapping cues (negative gap)')      // cue A end=5000, cue B start=3000 → merged; endMs = max(A.end, B.end)
})
```

### generateTranscript

```typescript
describe('generateTranscript', () => {
  it('strips tags then merges')            // integration of strip + merge
  it('uses provided gapThresholdMs')
})
```

### writeExport

```typescript
describe('writeExport', () => {
  it('writes .txt with cue texts joined by double newline')
  it('writes .json as valid indented JSON array with startMs/endMs/text')
  it('tmp file is absent after successful rename')
  // These two tests are distinct:
  //   - first: verify content on disk at filePath is correct
  //   - second: verify tmp file (${filePath}.uuid.tmp) is absent after rename
  it('cleans up tmp file if renameSync fails')
    // mock fs.renameSync to throw EACCES → verify tmp file deleted in finally
})
```

---

## ipc-transcript.test.ts

### Mock strategy

Mock `dialogService` module — do NOT mock the entire `electron` module:

```typescript
vi.mock('@main/services/files/dialogService', () => ({
  showTranscriptExportDialog: vi.fn(),
  selectVideoFile: vi.fn(),
  selectSubtitleFile: vi.fn(),
  selectOutputDirectory: vi.fn(),
  selectBinaryPath: vi.fn(),
}));
```

Handler invocation: mock `electron`'s `ipcMain.handle` to capture the registered handler callbacks, register handlers by calling `registerIpcHandlers(deps)`, then invoke the captured handler with a fake `_event = {}` and raw input.

```typescript
const registeredHandlers = new Map<string, Function>();
vi.mock('electron', () => ({
  app: { getPath: vi.fn(() => '/tmp'), isPackaged: false },
  ipcMain: {
    handle: (channel: string, fn: Function) => registeredHandlers.set(channel, fn),
  },
}));
```

```typescript
describe('TRANSCRIPT_GENERATE_FOR_PROJECT handler', () => {
  it('returns empty entries for project without subtitle')
  it('returns entries for project with ready subtitle')
  it('returns entries with ready_with_warnings status')
  it('uses default gapThresholdMs=500 when not provided')
  it('throws AppError on invalid projectId — renderer gets typed error, not silent default')
  it('throws AppError on gapThresholdMs > 10000')
})

describe('TRANSCRIPT_EXPORT_FOR_PROJECT handler', () => {
  it('returns exported:false when dialog cancelled')
  it('returns exported:true with path when .txt exported')
  it('returns exported:true with path when .json exported')
  it('returns exported:false for project without subtitle')
  it('throws AppError for invalid format — not silent default')
})
```

---

## transcriptFormatters.test.ts

```typescript
describe('formatEntryTime', () => {
  it('formats sub-hour as M:SS')              // 65000ms → '1:05'
  it('formats hour+ as H:MM:SS')              // 3661000ms → '1:01:01'
  it('formats zero as 0:00')
  it('handles large values')
  it('pads minutes and seconds')
})
```

---

## transcript-security.test.ts

Following the pattern of `tests/main/subtitle/subtitle-security.test.ts`:

```typescript
describe('transcript security static assertions', () => {
  it('transcript service source contains no hardcoded absolute paths')
    // grep src/main/services/transcript/ for /^[/\\]/ pattern → 0 matches
  it('transcript service source contains no shell:true')
    // grep src/main/services/transcript/ for 'shell: true' or 'shell:true' → 0 matches
})
```

---

## transcript.e2e.spec.ts

```typescript
test('transcript nav button visible in app')
test('no-subtitle state shows transcript-not-available')
test('ready subtitle shows transcript entries after page load')
test('gap threshold slider changes entry count')
test('export button triggers save flow (browser QA mock)')
test('navigate away and back — transcript page loads correctly')  // AC-M5-006.4
```

For browser QA mode: `exportForProject` in mock returns `{ exported: true, path: '/mock/transcript.txt' }`.
For cancelled export: the mock does not simulate a cancelled state — the browser QA mock always succeeds.
If a distinct cancelled-state UI is added, add a fixture and test then.

---

## transcript.visual.spec.ts

```typescript
test('transcript not available state')    // transcript-not-available.png
test('transcript ready state')            // transcript-ready.png
test('transcript ready with warnings')    // transcript-ready-with-warnings.png
```

After adding nav item to Layout.tsx, regenerate **all** existing snapshots (same cascade as M4 nav addition).

---

## ipc-contracts.test.ts

Add assertions:
```typescript
it('TRANSCRIPT_GENERATE_FOR_PROJECT is registered')
it('TRANSCRIPT_EXPORT_FOR_PROJECT is registered')
```

---

## Fixture additions (browser QA mode)

In `src/renderer/qa/fixtures.ts`, add 3 new entries to `qaFixtureNames` and `fixtureMap`:
- `'transcript-not-available'` — project with no subtitle (use projectB shape)
- `'transcript-ready'` — project with `subtitleStatus: 'ready'`
- `'transcript-ready-with-warnings'` — project with `subtitleStatus: 'ready_with_warnings'`

`QaFixtureState` shape (no `ui` field — use standard fields only):
```typescript
{
  name: 'transcript-ready',
  projects: [{ ...projectA, subtitleStatus: 'ready', ... }],
  queue: [],
  settings: baseSettings,
  capabilities: baseCapabilities,
  subtitleSelection: null,
}
```

In `src/renderer/qa/mockSceneSiftApi.ts`, add `transcript` namespace (see M5_IMPLEMENTATION_PLAN.md Phase 5).

In `tests/fixtures/sceneSiftApi.ts`, add `transcriptNotAvailable`, `transcriptReady`, `transcriptReadyWithWarnings` entries.
