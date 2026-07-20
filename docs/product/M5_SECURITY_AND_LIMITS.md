# M5 — Transcript Preparation: Security and Limits

---

## Input validation

All IPC inputs validated with Zod schemas before any processing:

| Field | Validation |
|---|---|
| `projectId` | `z.string().uuid()` — rejects non-UUID in preload + main |
| `gapThresholdMs` | `z.number().int().min(0).max(10000)` — prevents absurd merge ranges |
| `format` | `z.enum(['txt', 'json'])` — no other format accepted |

Preload validates `typeof projectId === 'string'` and coerces to trimmed string before forwarding. Main-process handler re-validates with full Zod schema and returns structured error for any mismatch.

---

## Tag stripping

**ReDoS guard**: Tag regex uses bounded quantifiers: `<[^>]{0,256}>` and `\{[^}]{0,256}\}`. Prevents catastrophic backtracking on pathological input like `<<<<<<<<<<<...`.

Input cue text is already bounded at subtitle parse time (`CUE_TEXT_TRUNCATED` warning at 1000 chars/cue). Strip operates on pre-bounded strings.

No `eval`. No dynamic regex construction from user input.

---

## File export

**Path source**: `dialog.showSaveDialog` returns OS-native path chosen by the user. Not constructed from any renderer-provided string.

**No path injection**: Renderer sends only `{ projectId, gapThresholdMs, format }`. The file path is chosen entirely in the main process via native dialog. Renderer cannot inject an arbitrary path.

**Atomic write**: 
1. Write to `${filePath}.tmp`
2. `fs.renameSync(tmpPath, filePath)` — atomic on same filesystem

**No `shell: true`**. No child process execution. No command string construction.

**Symlink rejection**: Not applicable — file path comes from save dialog, user is writing a new file.

---

## Transcript content

Transcript text contains only cue text content (post-strip). No file paths, no API keys, no PII beyond what the user's subtitle file contains. User chose the subtitle file explicitly.

No upload. Export writes to local disk only, path chosen by user.

---

## Error surfaces

| Error | Renderer sees | Details |
|---|---|---|
| Subtitle not ready | `{ entries: [], subtitleStatus: 'not_selected' }` | Renderer shows prerequisite message |
| Export cancelled | `{ exported: false, path: null }` | No error; user dismissed dialog |
| Write failure | `{ exported: false, path: null }` | Caught, logged to main; structured error to renderer |

No raw exceptions surfaced to renderer. All errors return typed `ExportOutput`.

---

## Resource limits

| Resource | Limit | Rationale |
|---|---|---|
| Input subtitle cues | Already capped at 10k cues / 2 MB at parse time | No additional limit needed |
| Generated transcript entries | Cannot exceed input cue count | Merging only reduces count |
| Export file size | Effectively bounded by input size (post-strip < input text) | No additional limit needed |
| Processing time | Synchronous string operations; typically < 10ms for 10k cues | No timeout needed |

---

## No new runtime dependencies

All operations use Node.js built-ins (`fs`, `path`, `os`) and existing Electron APIs (`dialog.showSaveDialog`). No new packages.
