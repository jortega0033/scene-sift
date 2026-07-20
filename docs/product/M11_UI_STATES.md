# M11 UI States — CompositionSettingsPanel

## State Machine

```
IDLE ──[project selected]──► LOADING
LOADING ──[getForProject resolves]──► CLEAN
LOADING ──[getForProject rejects]──► LOAD_ERROR
CLEAN ──[user changes any field]──► DIRTY
DIRTY ──[user reverts all fields to original]──► CLEAN
DIRTY ──[user clicks Save]──► SAVING
SAVING ──[updateForProject resolves]──► CLEAN (new baseline)
SAVING ──[updateForProject rejects]──► SAVE_ERROR
SAVE_ERROR ──[user clicks Retry / re-edits]──► DIRTY
LOAD_ERROR ──[user clicks Retry]──► LOADING
CLEAN ──[project deselected / panel unmounts]──► (reset, no state)
```

## State Descriptions

### IDLE
No project selected. Panel not mounted.

### LOADING
`getForProject(projectId)` in-flight. All 6 input controls render as disabled
skeleton placeholders (gray, cursor-not-allowed). No Save button visible.

### CLEAN
Settings loaded and not modified by user. All controls show current server values.
Save button absent (or disabled if rendered). No dirty indicator.

### DIRTY
At least one field differs from loaded server value. Save button enabled.
Controls show user-entered values. No error banner.

### SAVING
`updateForProject(projectId, patch)` in-flight. All controls disabled.
Save button shows spinner, labeled "Saving…". User cannot submit again.

### CLEAN (after save)
After successful save, dirty state resets. New server values become new baseline.
Transient success confirmation shown for 2 seconds then auto-dismissed.

### LOAD_ERROR
`getForProject` rejected. Error banner shown with message and Retry button.
Controls not rendered (no partial state to edit).

### SAVE_ERROR
`updateForProject` rejected. Error banner shown with message. Controls re-enabled.
User can edit and retry. Save button re-enabled. Field values revert to what
they were before the save attempt (not to server baseline, preserving edits).

## Component Props

```tsx
interface CompositionSettingsPanelProps {
  projectId: string;
}
```

Panel is a self-contained component. It manages its own loading, data, and
dirty state internally. Parent (`ProjectsPage`) only provides `projectId`.

## Local State Shape

```tsx
interface PanelState {
  loading: boolean;
  loadError: string | null;
  saving: boolean;
  saveError: string | null;
  settings: CompositionSettings | null;  // server baseline
  draft: Partial<CompositionSettings>;   // user edits (only changed fields)
}
```

`dirty`: derived — `Object.keys(draft).length > 0`.

## Controls Mapping

| Field | Control type | Values |
|---|---|---|
| resolution | `<select>` | `1080x1920`, `720x1280` |
| backgroundStyle | `<select>` | `blur`, `crop` |
| subtitlePosition | `<select>` | `bottom`, `center` |
| fontFamily | `<select>` | 5 system font options |
| fontSize | `<input type="number">` min=16 max=72 step=1 | integer |
| fontColor | `<input type="text">` pattern=`#[0-9A-Fa-f]{6}` | `#RRGGBB` |

fontColor also shows a `<span>` color swatch (CSS `background-color`) beside the
text input for visual feedback. No native color picker (`<input type="color">`) —
swatch is read-only display only.

## Error Messages

Load error: "Failed to load composition settings. [Retry]"
Save error: "Failed to save settings. Please try again. [Retry / dismiss]"

Both shown as inline error banner within the panel, not a toast or global modal.

## Accessibility

- `<fieldset>` wrapping all controls with `<legend>Composition Settings</legend>`.
- Each control has an associated `<label>` (for/id pair).
- Disabled controls have `aria-disabled="true"`.
- Save button has `aria-busy="true"` while saving.
- Error banners have `role="alert"` for screen reader announcement.

## Placement in ProjectsPage

Panel renders below existing project detail sections (after `ClipCuesSection`).
Collapsible via `<details>/<summary>` pattern consistent with other panels.
Collapsed by default (saves vertical space; composition settings are non-critical
path for most sessions).
