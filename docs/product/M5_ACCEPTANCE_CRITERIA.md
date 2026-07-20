# M5 — Transcript Preparation: Acceptance Criteria

**Count**: 28 ACs across 6 groups.

---

## AC-M5-001: Tag Stripping

| AC | Criterion | Pass condition |
|---|---|---|
| AC-M5-001.1 | HTML italic tags stripped | `<i>hello</i>` → `hello` |
| AC-M5-001.2 | HTML bold tags stripped | `<b>hello</b>` → `hello` |
| AC-M5-001.3 | HTML underline tags stripped | `<u>hello</u>` → `hello` |
| AC-M5-001.4 | Font color tags stripped | `<font color="red">hello</font>` → `hello` |
| AC-M5-001.5 | WebVTT voice tags stripped | `<v John>hello</v>` → `hello` |
| AC-M5-001.6 | WebVTT class tags stripped | `<c.loud>hello</c>` → `hello` |
| AC-M5-001.7 | ASS/SSA curly-brace overrides stripped | `{\an8}hello` → `hello` |
| AC-M5-001.8 | Whitespace normalized after stripping | `hello  world` → `hello world` |
| AC-M5-001.9 | Malformed tag (no closing >) does not hang | `<i without closing` → stripped bounded portion or left intact within timeout |
| AC-M5-001.10 | Empty text after stripping returned as empty string | `<i></i>` → `''` |

## AC-M5-002: Cue Merging

| AC | Criterion | Pass condition |
|---|---|---|
| AC-M5-002.1 | Cues with gap ≤ gapThresholdMs merged | gap=400ms, threshold=500ms → merged |
| AC-M5-002.2 | Cues with gap > gapThresholdMs not merged | gap=600ms, threshold=500ms → separate entries |
| AC-M5-002.3 | Merged entry startMs = first cue startMs | Verified in unit test |
| AC-M5-002.4 | Merged entry endMs = last cue endMs | Verified in unit test |
| AC-M5-002.5 | Merged text = space-joined cue texts | `"hello" + "world"` → `"hello world"` |
| AC-M5-002.6 | gapThresholdMs=0 merges only exactly-adjacent cues | gap=0ms merged; gap=1ms not merged |
| AC-M5-002.7 | Single cue input returns single entry | No crash on 1-cue input |
| AC-M5-002.8 | Empty cue array returns empty array | No crash on 0-cue input |

## AC-M5-003: Transcript Generation IPC

| AC | Criterion | Pass condition |
|---|---|---|
| AC-M5-003.1 | Non-UUID projectId rejected by preload | Returns error before IPC invoke |
| AC-M5-003.2 | Project with no subtitle returns empty entries + subtitleStatus | `{ entries: [], subtitleStatus: 'not_selected' }` |
| AC-M5-003.3 | Project with ready subtitle returns entries | At least 1 entry for subtitle with 1+ cues |
| AC-M5-003.4 | gapThresholdMs out of range rejected in main | Input `gapThresholdMs: 99999` → Zod error, structured response |
| AC-M5-003.5 | gapThresholdMs=500 used when not provided | Default applied |

## AC-M5-004: Export IPC

| AC | Criterion | Pass condition |
|---|---|---|
| AC-M5-004.1 | User cancels dialog → `{ exported: false, path: null }` | No error thrown |
| AC-M5-004.2 | Export .txt creates file with cue text | File contains stripped cue text, readable as plain text |
| AC-M5-004.3 | Export .json creates valid JSON array | `JSON.parse(content)` succeeds; each entry has `startMs`, `endMs`, `text` |
| AC-M5-004.4 | Invalid format rejected in main | `format: 'pdf'` → Zod error |
| AC-M5-004.5 | Exported path returned in output | `{ exported: true, path: '/Users/.../transcript.txt' }` |

## AC-M5-005: In-app preview

| AC | Criterion | Pass condition |
|---|---|---|
| AC-M5-005.1 | Transcript route renders in nav | "Transcript" button in nav, `data-testid="transcript-nav"` |
| AC-M5-005.2 | No-subtitle state shows prerequisite message | `data-testid="transcript-not-available"` visible |
| AC-M5-005.3 | Ready state generates and shows entries | `data-testid="transcript-entry"` elements visible after generation |
| AC-M5-005.4 | Gap threshold slider updates preview | Change slider → entries update |
| AC-M5-005.5 | Export .txt button triggers export flow | Button visible, click → export IPC called |

## AC-M5-006: Cross-cutting

| AC | Criterion | Pass condition |
|---|---|---|
| AC-M5-006.1 | All validators exit 0 | `pnpm validate` exits 0 |
| AC-M5-006.2 | No hardcoded file paths | grep for absolute paths in transcript code → 0 matches |
| AC-M5-006.3 | No `shell: true` | grep → 0 matches |
| AC-M5-006.4 | Transcript page persists across navigation | Navigate away and back → page loads correctly |
| AC-M5-006.5 | Visual regression tests pass | 3 new snapshot scenarios pass |
