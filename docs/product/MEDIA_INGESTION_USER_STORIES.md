# SceneSift — Media Ingestion User Stories

Milestone: M1 — Project Media Ingestion and Inspection
Date: 2026-07-19

---

## User story format

> As a [user type], I want [goal] so that [reason].
>
> **Acceptance criteria**: (see `MEDIA_INSPECTION_ACCEPTANCE_CRITERIA.md` for full testable criteria)

---

## Stories

### US-001 — Automatic media inspection on project creation

> As a video editor, I want the app to automatically inspect a video file when I create a project, so that I don't have to trigger a separate analysis step.

**Priority**: Must-have
**Status**: Not implemented

**Scenario**: I create a project with `/recordings/episode-04.mp4`. Within a few seconds, the project detail shows "42:17, 1920×1080, H.264, 23.97fps." I did not have to click anything after saving.

**Acceptance criteria**: see AC-001

---

### US-002 — Media metadata display in project detail

> As a video editor, I want to see video duration, resolution, codec, and fps for each project, so that I can verify the source file before selecting clips.

**Priority**: Must-have
**Status**: Not implemented

**Scenario**: I open the Projects page and click "Episode 04." The right panel shows:
- Duration: 42:17
- Resolution: 1920 × 1080
- Codec: H.264
- Frame rate: 23.97 fps
- File size: 4.2 GB
- Bit rate: 14.2 Mbps

**Acceptance criteria**: see AC-002

---

### US-003 — Metadata persists across app restarts

> As a video editor, I want media metadata to be stored locally, so that I don't have to re-inspect files every time I open the app.

**Priority**: Must-have
**Status**: Not implemented

**Scenario**: I inspect episode-04.mp4, close the app, reopen it, and see the same metadata without any re-inspection.

**Acceptance criteria**: see AC-003

---

### US-004 — Clear error when inspection fails

> As a video editor, I want to see a clear error message when video inspection fails, so that I can understand the problem and fix it.

**Priority**: Must-have
**Status**: Not implemented

**Scenario A (FFprobe unavailable)**: I created a project but FFprobe is not installed. The project shows "Inspection failed: FFprobe unavailable. Configure FFprobe path in Settings."

**Scenario B (file inaccessible)**: The video file was on a USB drive that was ejected. The project shows "Inspection failed: file not found or inaccessible."

**Scenario C (unsupported format)**: I gave it a `.txt` file (via malformed path). The project shows "Inspection failed: no video stream found."

**Acceptance criteria**: see AC-004

---

### US-005 — Project status reflects inspection result

> As a video editor, I want the project status badge to reflect whether media inspection succeeded, so that I can quickly see which projects are ready for clip selection.

**Priority**: Must-have
**Status**: Not implemented

**Scenario A**: Inspection succeeded. Status badge shows "Ready" (green).

**Scenario B**: Inspection failed. Status badge shows "Draft" (neutral). Failure message visible in detail.

**Acceptance criteria**: see AC-005

---

### US-006 — Inspection failure does not corrupt the project

> As a video editor, I want inspection failure to be non-destructive, so that the project record is not lost if a file is temporarily inaccessible.

**Priority**: Must-have
**Status**: Not implemented

**Scenario**: Inspection fails (network share unavailable). I remount the share. I click "Re-inspect." The inspection now succeeds and the project moves to Ready.

**Note**: The "Re-inspect" button is a planned enhancement, not required for M1 slice completion. M1 delivers automatic inspection on create only. Manual re-inspection is documented as a gap.

**Acceptance criteria**: see AC-006

---

### US-007 — No raw error messages surfaced to renderer

> As a user, I want error messages to be human-readable, not raw FFprobe stderr output, so that I can act on them without understanding FFprobe internals.

**Priority**: Must-have (security + UX)
**Status**: Not implemented

**Scenario**: FFprobe exits non-zero. The renderer shows "Inspection failed: video file could not be read." It does NOT show the raw FFprobe stderr.

**Acceptance criteria**: see AC-007

---

### US-008 — Projects with no metadata handled gracefully (upgrade path)

> As an existing user upgrading from a pre-M1 build, I want projects created before media inspection was available to display gracefully, so that I don't see broken UI.

**Priority**: Should-have
**Status**: Not implemented

**Scenario**: I upgrade the app. Existing projects show "Not yet inspected" for metadata fields. The project detail panel does not crash.

**Acceptance criteria**: see AC-008
