# Current UI Audit (Pre-Redesign Baseline)

Date: 2026-07-19  
Mode: Browser QA harness (`VITE_SCENESIFT_BROWSER_QA=1`) with deterministic fixtures.

## Baseline artifact references

- `tests/visual/app-shell.visual.spec.ts-snapshots/app-shell-chromium-darwin.png`
- `tests/visual/projects.visual.spec.ts-snapshots/projects-empty-chromium-darwin.png`
- `tests/visual/projects.visual.spec.ts-snapshots/projects-populated-chromium-darwin.png`
- `tests/visual/dialogs.visual.spec.ts-snapshots/create-project-dialog-chromium-darwin.png`
- `tests/visual/queue.visual.spec.ts-snapshots/queue-populated-chromium-darwin.png`
- `tests/visual/settings.visual.spec.ts-snapshots/settings-defaults-chromium-darwin.png`
- `tests/visual/settings.visual.spec.ts-snapshots/settings-ffmpeg-unavailable-chromium-darwin.png`

Viewports exercised: 1440x900, 1280x800, 1024x768, 800x700.

## Screen inventory and findings

### Application shell

- Purpose: global navigation and status summary.
- Strengths: clear page switching, visible FFmpeg/DB status, predictable structure.
- Problems:
  - heavy dark/purple styling conflicts with requested monochrome direction.
  - sidebar hierarchy is weak; status and navigation compete visually.
  - status semantics depend partly on color.

### Projects page

- Purpose: core early workflow for project creation, selection, and deletion.
- Strengths: all required fields exist; form validation works; detail panel present.
- Problems:
  - oversized card-like surfaces and mixed spacing rhythm.
  - project list density and scanning can improve for desktop use.
  - delete confirmation is inline and not strongly modal/contained.
  - long-path handling is functional but visually noisy.

### Create-project workflow

- Purpose: collect project name, video, subtitle, output directory.
- Strengths: native-picker actions exposed; required validation present.
- Problems:
  - labels/help/error structure is basic and inconsistent.
  - action hierarchy (primary vs secondary) is unclear.
  - escape handling existed only after test hardening and still needs cleaner dialog semantics.

### Queue page

- Purpose: show job lifecycle state.
- Strengths: mixed statuses render with errors and progress.
- Problems:
  - row information hierarchy is flat and repetitive.
  - status readability depends on plain text only; no coherent status component language.
  - dense operational metadata (times/output) is not surfaced clearly.

### Settings page

- Purpose: configure media tools/output/theme/diagnostics and inspect system status.
- Strengths: all current settings are editable; status panel exists.
- Problems:
  - grouping is implementation-first, not user-intent-first.
  - form controls lack consistent spacing/typographic hierarchy.
  - system status presentation is plain text without robust structure.

### Error, empty, disabled, and compact states

- Empty states: present but generic and sparse.
- Error states: renderer boundary and settings-save errors exist; wording can be more actionable.
- Disabled states: available but not always explanatory.
- Compact window (800x700): usable but visually crowded; hierarchy weak.

## Accessibility and usability baseline issues

- Focus visibility exists but lacks strong, consistent treatment.
- Some controls rely on visual style differences more than structural semantics.
- Confirmation/dialog patterns are not yet fully standardized.
- Information density is inconsistent between list and detail regions.

## Baseline functional coverage status

Protected by tests before redesign:

- Navigation between Projects/Queue/Settings
- Project form validation/create/delete
- Queue rendering and mixed statuses
- Settings edit + save failure path
- Keyboard interaction path (including Escape close)
- Compact viewport behavior
- Visual snapshots for major screens
