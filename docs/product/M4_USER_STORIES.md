# M4 — Video Preview Workspace: User Stories

Date: 2026-07-20
Status: PLANNING

---

## US-M4-001 — Preview navigation

**As a** clip workflow operator,
**I want** a Preview nav item in the left bar,
**so that** I can reach video preview from any page without extra clicks.

**Acceptance**: AC-M4-001.1, AC-M4-001.2

---

## US-M4-002 — Prerequisites gate

**As a** clip workflow operator,
**I want** to see a clear message when preview is unavailable and why,
**so that** I know exactly what to fix before preview becomes accessible.

**Acceptance**: AC-M4-001.3, AC-M4-001.4, AC-M4-001.5

---

## US-M4-003 — Video playback

**As a** clip workflow operator,
**I want** to play, pause, and seek through a project's video,
**so that** I can review specific moments during subtitle QA.

**Acceptance**: AC-M4-002.1, AC-M4-002.2, AC-M4-002.3, AC-M4-002.5, AC-M4-002.6, AC-M4-002.7

---

## US-M4-004 — Playback speed

**As a** clip workflow operator,
**I want** to change playback speed from 0.5× to 2×,
**so that** I can scan content quickly or slow it down for verification.

**Acceptance**: AC-M4-002.4

---

## US-M4-005 — Subtitle overlay

**As a** clip workflow operator,
**I want** to see subtitle cue text overlaid on the video frame at the correct moment,
**so that** I can judge synchronization by eye without consulting a separate panel.

**Acceptance**: AC-M4-003.1, AC-M4-003.2, AC-M4-003.3, AC-M4-003.4

---

## US-M4-006 — Cue list navigation

**As a** clip workflow operator,
**I want** to see all subtitle cues listed in a scrollable panel with timestamps,
**so that** I can jump directly to any cue for inspection.

**Acceptance**: AC-M4-004.1, AC-M4-004.2, AC-M4-004.3, AC-M4-004.4, AC-M4-004.5

---

## US-M4-007 — Video error handling

**As a** clip workflow operator,
**I want** to see a helpful error message when a video file cannot be loaded,
**so that** I understand the failure without seeing raw technical codes.

**Acceptance**: AC-M4-005.1, AC-M4-005.2, AC-M4-005.3

---

## US-M4-008 — File path privacy

**As a** clip workflow operator (and as a security-conscious user),
**I want** the renderer layer to never see raw file system paths,
**so that** local filesystem structure is not exposed through the UI or in errors.

**Acceptance**: AC-M4-006.4

---

## Out of scope for M4

- Export / clip generation
- Subtitle editing via preview
- Frame-accurate seek (depends on codec/container)
- Waveform display
- Persistent player position across sessions
