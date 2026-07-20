# M5 — Transcript Preparation: Test Plan

---

## Coverage targets

| Layer | Test file | Scenarios |
|---|---|---|
| TranscriptService unit | `tests/main/transcriptService.test.ts` | ~25 |
| IPC handler unit | `tests/main/ipc-transcript.test.ts` | ~10 |
| IPC contracts | `tests/main/ipc-contracts.test.ts` | +2 channels |
| Formatter unit | `tests/renderer/transcriptFormatters.test.ts` | ~5 |
| E2E (browser QA) | `tests/e2e/transcript.e2e.spec.ts` | ~5 |
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
  it('handles malformed tag — no catastrophic slowdown') // bounded regex
})
```

### mergeCues

```typescript
describe('mergeCues', () => {
  it('merges adjacent cues within threshold')     // gap=400, thresh=500 → merged
  it('does not merge cues beyond threshold')      // gap=600, thresh=500 → separate
  it('sets merged startMs to first cue')
  it('sets merged endMs to last cue')
  it('joins merged text with space')
  it('handles gapThresholdMs=0')                  // gap=0 merged, gap=1 not merged
  it('handles single cue')                         // returns single entry
  it('handles empty cue array')                    // returns []
  it('skips empty-text entries from output')       // cue with text '' after strip omitted
  it('merges 3+ consecutive cues within threshold')
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
  it('writes .json as valid JSON array with startMs/endMs/text')
  it('removes tmp file after successful write')
  it('tmp file absent after rename')
})
```

---

## ipc-transcript.test.ts

```typescript
describe('TRANSCRIPT_GENERATE_FOR_PROJECT handler', () => {
  it('returns empty entries for project without subtitle')
  it('returns entries for project with ready subtitle')
  it('uses default gapThresholdMs=500 when not provided')
  it('rejects invalid projectId with structured error response')
  it('rejects gapThresholdMs > 10000')
})

describe('TRANSCRIPT_EXPORT_FOR_PROJECT handler', () => {
  it('returns exported:false when dialog cancelled')
  it('returns exported:true with path when .txt exported')
  it('returns exported:true with path when .json exported')
  it('returns exported:false for project without subtitle')
  it('rejects invalid format with structured error response')
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

## transcript.e2e.spec.ts

```typescript
test('transcript nav button visible in app')
test('no-subtitle state shows transcript-not-available')
test('ready subtitle shows transcript entries after page load')
test('gap threshold slider changes entry count')
test('export button triggers save flow (browser QA mock)')
```

For E2E in browser QA mode, `exportForProject` returns `{ exported: true, path: '/mock/transcript.txt' }` from mock bridge.

---

## transcript.visual.spec.ts

```typescript
test('transcript not available state')    // transcript-not-available.png
test('transcript ready state')            // transcript-ready.png
test('transcript with entries')           // transcript-with-entries.png
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

## Mock bridge additions (browser QA mode)

In `tests/fixtures/sceneSiftApi.ts`, add fixture state entries:
- `transcriptNotAvailable` — `{ projects: [projectNoSubtitle], ui: 'transcript' }`
- `transcriptReady` — `{ projects: [projectReadySubtitle], ui: 'transcript' }`

In `src/renderer/qa/mockBridge.ts`:
```typescript
transcript: {
  generateForProject: async (input) => ({
    entries: getMockTranscriptEntries(input.projectId),
    subtitleStatus: getMockSubtitleStatus(input.projectId),
  }),
  exportForProject: async () => ({ exported: true, path: '/mock/transcript.txt' }),
},
```
