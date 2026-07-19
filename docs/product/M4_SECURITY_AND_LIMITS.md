# M4 — Video Preview Workspace: Security and Limits

Date: 2026-07-20
Status: PLANNING

---

## Threat model

### T1 — Path traversal via projectId

**Vector**: Renderer constructs `local://video/../../../etc/passwd` or similar.
**Mitigation**: Protocol handler validates projectId with `z.string().uuid()`. Rejects non-UUID on 404. File path comes exclusively from DB (`db.getProject(projectId).videoPath`) — NOT from URL segments.

### T2 — Serving arbitrary files

**Vector**: Attacker controls a `videoPath` in DB to point to sensitive files.
**Mitigation**: `videoPath` was stored at project creation via user-selected file dialog (M1). Path goes through `path.resolve()` + `stat().isFile()` at project creation. Protocol handler re-validates `stat().isFile()` before serving. Does not follow symlinks.

### T3 — SSRF via custom protocol

**Vector**: Renderer uses `local://` protocol to access unexpected resources.
**Mitigation**: Protocol handler only responds to `local://video/{uuid}` pattern. Regex validates path shape before UUID extraction. Returns 404 for all other paths.

### T4 — Large file memory exhaustion

**Vector**: Streaming 50GB video file crashes renderer.
**Mitigation**: Use `fs.createReadStream({start, end})` for byte ranges — never buffer full file. Electron streams response directly. HTMLVideoElement requests small ranges automatically.

### T5 — XSS via subtitle cue text

**Vector**: Subtitle file contains `<script>alert(1)</script>` in cue text.
**Mitigation**: Subtitle cue text is rendered via React (`{cue.text}`) — React escapes HTML by default. No `dangerouslySetInnerHTML`. Line breaks can be split on `\n` and rendered as separate spans.

### T6 — IPC injection via cue text

**Vector**: Subtitle text used to inject IPC commands.
**Mitigation**: Cue text is only displayed in DOM, never passed back to main process as IPC input. The `video:getCues` IPC returns data TO renderer only.

---

## Resource limits

| Resource | Limit | Implementation |
|---|---|---|
| IPC input projectId | UUID format only | z.string().uuid() in Zod schema |
| Protocol path format | `/video/{uuid}` only | Regex match before UUID extraction |
| File existence check | stat().isFile() | Before every protocol response |
| Streaming chunk size | Electron built-in range handling | fs.createReadStream with start/end |
| Cue list size | Up to 50,000 cues | Inherited from M2 subtitle parser limits |
| Active cue display | Max 5 concurrent cues rendered | UI limit (exceeding shows truncated) |

---

## Electron security requirements (unchanged from M1)

- `nodeIntegration: false`
- `contextIsolation: true`
- `sandbox: true`
- `webSecurity: true`

No changes required to BrowserWindow config for M4.

---

## Protocol handler security rules

```typescript
// In protocol handler:
// 1. Validate URL pattern
const match = url.pathname.match(/^\/video\/([0-9a-f-]{36})$/i);
if (!match) return new Response(null, { status: 404 });

// 2. Validate UUID format
const projectId = match[1];
if (!isValidUUID(projectId)) return new Response(null, { status: 404 });

// 3. Resolve path from DB only
const project = db.getProject(projectId);
if (!project?.videoPath) return new Response(null, { status: 404 });

// 4. Validate file existence
const stat = await fsStat(project.videoPath).catch(() => null);
if (!stat?.isFile()) return new Response(null, { status: 404 });

// 5. Stream with range support
// ... (range parsing, 206 response)
```

---

## No new secrets or credentials

M4 introduces no API keys, tokens, or credentials. All data is local.

---

## Privacy

No video content or subtitle text is uploaded anywhere. All processing is local. The custom protocol handler reads files from disk and streams them to the local renderer only.
