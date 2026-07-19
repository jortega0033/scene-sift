# M4 — Video Preview Workspace: Risk Register

Date: 2026-07-20
Status: PLANNING

---

## R-M4-001 — Codec incompatibility

**Category**: Product
**Likelihood**: High (mkv/HEVC/AV1 common in wild)
**Impact**: Medium (preview silently fails for non-H.264 files)
**Risk level**: Medium

**Description**: HTMLVideoElement on macOS supports H.264, AAC, WebM/VP9, but NOT H.265/HEVC or most MKV content. Users with H.265 clips will get an `error` event with no useful codec info.

**Mitigation**:
- Error state message explicitly calls out H.265/MKV as known-unsupported (see UX spec)
- `preview-retry` button visible
- Future M4+ can add FFmpeg transcode-to-HLS fallback

**Residual risk**: Users with unsupported codecs cannot preview. Acceptable for MVP — not a data loss or security risk.

---

## R-M4-002 — Range request implementation defect

**Category**: Security / Correctness
**Likelihood**: Low (parseRange logic is straightforward)
**Impact**: High (incorrect range → incorrect bytes → corrupted seeking or protocol security issue)
**Risk level**: Medium

**Description**: Custom `parseRange` helper must correctly clamp values, handle open-ended ranges (`bytes=100-`), and reject invalid format. A defect could cause wrong-byte responses or buffer overruns.

**Mitigation**:
- Unit tests TC-LP-002, TC-LP-008 cover boundary cases
- `Math.min(start, total - 1)` clamps prevent out-of-range access
- electron-security-reviewer must verify `parseRange` logic in Phase 2 independent review
- Integration test via `pnpm test:electron`

**Residual risk**: Edge cases in multi-range or invalid header formats. Mitigated by returning full file (200) if header parse fails.

---

## R-M4-003 — Path traversal in protocol handler

**Category**: Security
**Likelihood**: Low (URL path is extracted from trusted local URL)
**Impact**: Critical (arbitrary file read from user filesystem)
**Risk level**: High

**Description**: If UUID regex can be bypassed or protocol handler uses path outside of `projectId → db.getProject → videoPath` chain, attacker-controlled renderer could read arbitrary files.

**Mitigation**:
- UUID regex `[0-9a-f]{8}-...-[0-9a-f]{12}` anchored with `^` and `$` — no partial match possible
- videoPath resolved from DB only (not from URL) — renderer cannot supply a path
- `stat().isFile()` check before serving
- Unit TC-LP-006 tests `../../etc` traversal → 404
- electron-security-reviewer required for Phase 2 sign-off

**Residual risk**: Low. Defense-in-depth: UUID gate + DB path resolution + isFile() guard.

---

## R-M4-004 — Protocol not registered before BrowserWindow

**Category**: Correctness / Implementation
**Likelihood**: Medium (easy mistake during wiring)
**Impact**: High (preview page shows error; protocol silently not working)
**Risk level**: Medium

**Description**: Electron requires custom protocols registered via `protocol.handle` before `app.whenReady()` / before BrowserWindow is created. Registering afterward silently fails.

**Mitigation**:
- Implementation plan Phase 2 explicitly notes registration order requirement
- Smoke test (`pnpm test:electron`) will catch if protocol returns 404 for all requests
- Unit TC-LP-001 tests handler logic independently

**Residual risk**: Low if implementation plan followed.

---

## R-M4-005 — Seek performance on large files

**Category**: Performance
**Likelihood**: Medium (large MKV containers on spinning disk)
**Impact**: Low (seek lag, not data loss)
**Risk level**: Low

**Description**: Large video files (>4 GB) over local disk may have slow seek-to-position response on first access. HTMLVideoElement range requests trigger disk I/O for each seek.

**Mitigation**:
- Out of scope for M4 — no performance SLO required for MVP
- Known limitation; document in handoff

**Residual risk**: Accepted. Users on slow disk may notice seek lag.

---

## R-M4-006 — QA mock video src causes HTMLVideoElement error

**Category**: Testing
**Likelihood**: Medium (browser QA mode returns `local://video/{projectId}` as src; browser cannot serve `local://`)
**Impact**: Medium (E2E tests see error state instead of ready state)
**Risk level**: Medium

**Description**: In browser QA mode, `window.sceneSift.video.getPlaybackUrl()` returns `local://video/{projectId}`. Browser does not have a `local://` protocol handler, so `<video src="local://...">` fires `error` event immediately.

**Mitigation**:
- E2E tests for video load (TC-E2E-004) should use a fixture where `preview-video` src is set to a blank/silent mp4 data URI or a static mock video in tests/fixtures/
- mockSceneSiftApi.video.getPlaybackUrl() returns a test-local video fixture path or data URI in QA mode
- E2E tests avoid testing actual playback; test presence of elements and state machine transitions

**Residual risk**: E2E cannot fully test video decode. Accepted: video decode tested manually; E2E tests UI state.

---

## R-M4-007 — cues_json schema mismatch

**Category**: Correctness
**Likelihood**: Low (cues_json schema defined in M2 subtitle parsing)
**Impact**: Medium (getCues returns empty or throws if cues_json format changed)
**Risk level**: Low

**Description**: `subtitle_documents.cues_json` format established in M2. If M4 assumes different field names (startMs vs start_ms etc.), mapping will silently return wrong data or throw.

**Mitigation**:
- VideoService.getCues maps from existing `doc.cues` type — typed from Drizzle schema
- TC-VS-004 validates field mapping in unit test
- Read actual cues_json schema before implementation

**Residual risk**: Low if Drizzle types used correctly.

---

## Risk summary

| ID | Title | Level |
|---|---|---|
| R-M4-001 | Codec incompatibility | Medium |
| R-M4-002 | Range request defect | Medium |
| R-M4-003 | Path traversal | High → Mitigated → Low residual |
| R-M4-004 | Protocol not registered early | Medium → Low if plan followed |
| R-M4-005 | Seek performance | Low (accepted) |
| R-M4-006 | QA mock video src error | Medium → Low with fixture design |
| R-M4-007 | cues_json schema mismatch | Low |

No risk 4 (critical autonomous-execution-forbidden) items. Highest residual = R-M4-003 (path traversal), mitigated to low by defense-in-depth design.
