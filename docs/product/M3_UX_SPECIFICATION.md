# M3 UX Specification: Sync Status Panel

## Overview

The sync status panel provides a read-only view of structural subtitle timing analysis results and a trigger for running or re-running the timing check. All six sync states have distinct visual representations. The panel never makes synchronization claims — it reports structural timing observations only.

---

## 1. Panel Location

The sync status panel lives inside the existing `ProjectsPage` project detail panel, below the subtitle summary panel (M2 output). It appears whenever a project is selected in the project list. It is never shown when no project is selected.

**Layout position**:
```
ProjectDetailPanel
  VideoSourcePanel       (M1)
  SubtitleSummaryPanel   (M2)
  SyncStatusPanel        (M3) ← new
```

The panel uses the same card/panel visual treatment as the M2 subtitle summary panel above it. It does not float, does not overlay other content, and does not collapse.

---

## 2. Display by State

### State: `not_available`

Displayed when video inspection or subtitle parsing has not been completed for the project.

| Element | Value |
|---------|-------|
| Icon | Circle outline (inactive, muted color) |
| Title | "Sync check unavailable" |
| Subtext — both missing | "Inspect video and parse subtitles first" |
| Subtext — only subtitle missing | "Parse subtitles first" |
| Subtext — only video missing | "Inspect video first" |
| Action button | None |

The subtext variant is selected based on which data is missing. If video duration is null/absent and cue count is zero/absent, show the "both missing" variant. If only one is missing, show the specific variant.

---

### State: `ready_to_check`

Displayed when video duration and subtitle cues are both available and no timing check has been run yet.

| Element | Value |
|---------|-------|
| Icon | Circle filled (ready, accent color) |
| Title | "Timing check available" |
| Subtext | "Run to detect timing issues between subtitles and video" |
| Action button | "Check Timing" — primary style |

---

### State: `timing_ok`

Displayed when the check ran and found no structural timing issues.

| Element | Value |
|---------|-------|
| Icon | Checkmark (success color) |
| Title | "Timing check passed" |
| Subtext | "No structural timing issues detected" |
| Action button | "Re-check" — secondary style |
| Metadata | "Checked [relative time]" (e.g., "Checked 2 minutes ago") |

**Forbidden language**: Do not use "in sync", "synchronized", "timing is correct", or "perfectly aligned" anywhere in this state. The only permitted positive language is "passed" and "no structural timing issues detected".

---

### State: `needs_review`

Displayed when the check ran and found one or more timing warnings.

| Element | Value |
|---------|-------|
| Icon | Warning triangle (caution/warning color) |
| Title | "Timing needs review" |
| Subtext | "N timing issue(s) detected" where N is the count of warnings |
| Warning list | One row per SyncWarning (see warning label definitions below) |
| Action button | "Re-check" — secondary style |
| Metadata | "Checked [relative time]" |

**Warning label definitions** (human-readable string for each SyncWarningCode):

| Code | Display label template |
|------|----------------------|
| `CUES_OUTSIDE_VIDEO_RANGE` | "[count] cue(s) extend beyond video duration" |
| `SUBTITLE_SPAN_SHORT` | "Subtitle span is [ratioPercent]% of video duration" |
| `SUBTITLE_SPAN_LONG` | "Subtitles extend past video end" |
| `LARGE_TAIL_GAP` | "Video ends [gapSeconds]s after last subtitle" |
| `LATE_SUBTITLE_START` | "Subtitles start at [offsetPercent]% of video" |

Template placeholders are filled from the corresponding numeric field in `SyncWarning.metadata`. All values are displayed as integers. Units are appended in the label string, not the metadata object.

Each warning row is displayed as a badge or list item — not as a raw code string. The warning code value (e.g., `CUES_OUTSIDE_VIDEO_RANGE`) is never shown directly to the user.

---

### State: `stale`

Displayed when a timing check was run previously but the video source or subtitle document has since changed (version hashes no longer match).

| Element | Value |
|---------|-------|
| Icon | Clock or refresh icon (neutral/stale color) |
| Title | "Timing check is outdated" |
| Subtext | "Video or subtitles changed since last check" |
| Previous result | Previous status and warning count shown dimmed, if a previous result exists |
| Action button | "Re-check" — primary style (higher urgency than `timing_ok` re-check) |

The previous result display is informational only. It uses reduced opacity to signal that it may no longer be accurate. A `stale` state with no previous result (e.g., if the result row was cleared) displays only the title, subtext, and button.

---

### State: `check_failed`

Displayed when the analysis could not complete due to an error (e.g., Zod parse failure on cues_json, null durationSeconds).

| Element | Value |
|---------|-------|
| Icon | X circle (error color) |
| Title | "Timing check failed" |
| Subtext | Human-readable reason (see failure reason mapping below) |
| Action button | "Retry" — secondary style |

**Failure reason mapping** (error code → user-facing subtext):

| Error code | Display subtext |
|------------|----------------|
| `INVALID_CUE_DATA` | "Subtitle data could not be read. Try re-parsing the subtitle file." |
| `INVALID_VIDEO_DATA` | "Video duration data is unavailable. Try re-inspecting the video." |
| `PROJECT_NOT_FOUND` | "Project data could not be found. Try restarting SceneSift." |
| `UNKNOWN_ERROR` | "An unexpected error occurred. Try again." |

Raw error codes, exception messages, and stack traces are never shown to the user.

---

## 3. Loading State

While the IPC call (`SYNC_CHECK_FOR_PROJECT`) is in progress:

| Element | Value |
|---------|-------|
| Button | Disabled, shows spinner icon |
| Button label | "Checking..." |
| Panel title | Previous title remains (no flicker to empty) |
| Panel subtext | Previous subtext remains |

The loading state replaces only the button. The rest of the panel retains its pre-check display content to avoid layout shift. If this is the first check (state was `ready_to_check`), the title and subtext from `ready_to_check` remain visible during loading.

---

## 4. Terminology Rules

### Forbidden phrases

The following phrases must never appear in the sync status panel or any related UI text:

- "in sync"
- "perfectly synchronized"
- "timing is correct"
- "subtitles are aligned"
- "synchronization confirmed"

### Allowed phrases

| Intent | Allowed phrasing |
|--------|-----------------|
| Check passed | "Timing check passed" |
| No issues | "No structural timing issues detected" |
| Issues found | "Timing needs review" |
| Issues found | "N timing issue(s) detected" |
| Outdated | "Timing check is outdated" |
| Unavailable | "Sync check unavailable" |

The distinction is intentional and must be preserved in all copy, including tooltip text, accessibility labels, and error messages.

---

## 5. Accessibility Requirements

### Keyboard navigation

- The "Check Timing", "Re-check", and "Retry" buttons must be reachable via keyboard Tab navigation in document order.
- Buttons must be activatable with Enter and Space keys.
- During loading, the disabled button retains its position in the tab order with `aria-disabled="true"` (not `disabled` attribute, which removes it from tab order).

### ARIA labels

- The sync status icon must have `aria-label` describing the current state (e.g., `aria-label="Timing check passed"` for the checkmark). Do not rely on icon alone to convey status.
- The entire panel should have `role="region"` with `aria-label="Subtitle timing check"`.
- When status changes (e.g., after check completes), use a live region (`aria-live="polite"`) to announce the new status to screen reader users.

### Warning list

- The warning list must be a `<ul>` element.
- Each warning item must be a `<li>` with descriptive text content (not just a badge).
- The list must not be a `<div>` with visual-only list styling.

### Button labels

Button labels must be self-descriptive. "Check Timing", "Re-check", and "Retry" are acceptable. "Check", "Go", or unlabeled icon buttons are not acceptable.

---

## 6. Component Structure

Component tree (logical, not implementation detail):

```
SyncStatusPanel
  SyncStatusHeader
    SyncStatusIcon          (icon variant based on state)
    SyncStatusTitle         (title string based on state)
  SyncStatusSubtext         (subtext string based on state)
  SyncWarningList           (rendered only when state = needs_review)
    SyncWarningItem × N     (one per SyncWarning in result)
  SyncStatusMeta            (timestamp, rendered when checkedAt is non-null)
  SyncCheckButton           (rendered when state has an available action)
    LoadingSpinner          (rendered only during loading)
```

`SyncStatusPanel` owns all state transitions. It receives the current `SyncCheckResult` (or null) as a prop and derives display configuration from it. It calls `window.sceneSift.syncCheckForProject` when the button is clicked and manages the loading flag locally.

`SyncWarningList` and `SyncWarningItem` are pure presentational components — they receive a `SyncWarning[]` array and render it. They do not call IPC.

---

## 7. Test IDs (data-testid)

All `data-testid` attributes are required for E2E test targeting. They must be present in the rendered DOM regardless of state (the element may be conditionally rendered, but when rendered it must carry the correct testid).

| Element | data-testid |
|---------|-------------|
| Entire panel root | `sync-status-panel` |
| Status title text | `sync-status-label` |
| Check/Re-check/Retry button | `sync-check-button` |
| Warning list `<ul>` | `sync-warning-list` |
| Each warning `<li>` | `sync-warning-item` |
| Timestamp metadata | `sync-status-meta` |

`sync-warning-item` appears N times (one per warning). E2E tests should use `getAllByTestId('sync-warning-item')` to collect the list and assert count.

---

## 8. Browser QA Fixture Data

Browser QA mode (`VITE_SCENESIFT_BROWSER_QA=1`) requires fixture data for all six sync states so that every panel variant can be tested without running real FFprobe or analysis. The mock bridge (`window.__sceneSiftMock`) should expose the following fixture projects, each representing one state:

### Fixture: `not_available`
```ts
{
  projectId: 'fixture-sync-not-available',
  syncStatus: 'not_available',
  syncWarnings: [],
  syncCheckedAt: null,
  // video: null, subtitle: null (to trigger "both missing" subtext)
}
```

### Fixture: `ready_to_check`
```ts
{
  projectId: 'fixture-sync-ready',
  syncStatus: 'ready_to_check',
  syncWarnings: [],
  syncCheckedAt: null,
  // video: { durationSeconds: 3600 }, subtitle: { cueCount: 842 }
}
```

### Fixture: `timing_ok`
```ts
{
  projectId: 'fixture-sync-ok',
  syncStatus: 'timing_ok',
  syncWarnings: [],
  syncCheckedAt: '2026-07-20T10:00:00.000Z',
}
```

### Fixture: `needs_review`
```ts
{
  projectId: 'fixture-sync-needs-review',
  syncStatus: 'needs_review',
  syncWarnings: [
    { code: 'CUES_OUTSIDE_VIDEO_RANGE', metadata: { count: 14 } },
    { code: 'LARGE_TAIL_GAP', metadata: { gapSeconds: 47 } },
  ],
  syncCheckedAt: '2026-07-20T10:00:00.000Z',
}
```

### Fixture: `stale`
```ts
{
  projectId: 'fixture-sync-stale',
  syncStatus: 'stale',
  syncWarnings: [],           // previous result was timing_ok
  syncCheckedAt: '2026-07-19T08:30:00.000Z',
  previousStatus: 'timing_ok',
}
```

### Fixture: `check_failed`
```ts
{
  projectId: 'fixture-sync-failed',
  syncStatus: 'check_failed',
  syncWarnings: [],
  syncCheckedAt: null,
  error: { code: 'INVALID_CUE_DATA', message: 'Subtitle data could not be read. Try re-parsing the subtitle file.' }
}
```

Each fixture project should also include enough video/subtitle metadata for the project detail panel (M1/M2 panels above) to render in a plausible state. The sync check mock should simulate a 400ms delay on `syncCheckForProject` calls to allow loading state testing.
