# M11 Scope — Vertical Composition Settings

## In Scope

### Settings Fields (all per-project)

1. **resolution** — output resolution enum: `1080x1920` | `720x1280`. Default: `1080x1920`.
2. **backgroundStyle** — enum: `blur` | `crop`. Default: `blur`.
3. **subtitlePosition** — subtitle burn-in vertical anchor enum: `bottom` | `center`. Default: `bottom`.
4. **fontFamily** — safe system font enum (5 options). Default: `Arial`.
5. **fontSize** — integer pixels, range [16, 72]. Default: `32`.
6. **fontColor** — hex color string `#RRGGBB`. Default: `#FFFFFF`.

### Storage

Settings persist to SQLite in a new dedicated table `project_composition_settings`
(migration 0008). One row per project, keyed on `project_id`. Not electron-store,
not a config file, not columns on the existing `projects` table.

### IPC Surface

Two new channels in the `composition:` namespace:
- `composition:getForProject` — returns current settings (or row-with-defaults if
  not yet written) for a project.
- `composition:updateForProject` — partial update; returns full updated settings.

Current total: 44 channels → after M11: **46 channels**.

### Preload Bridge

`window.sceneSift.composition.getForProject(projectId)` and
`window.sceneSift.composition.updateForProject(projectId, patch)` with input
validation in preload before IPC invocation.

### Renderer UI

A `CompositionSettingsPanel` component rendered as a collapsible section inside the
selected-project detail area in `ProjectsPage.tsx`. No new page or route. The panel
is consistent in placement with `CandidatesSection`, `SyncPanel`, and `ClipCuesSection`.

### QA Mock

Both `composition` methods added to the QA bridge in `src/renderer/qa/`.

### Test Coverage

Service unit tests, shared schema unit tests, IPC contract tests (new composition
namespace describe block + schema assertions), and renderer component tests.

---

## Out of Scope (M12 or later)

- FFmpeg command construction using these settings — M12 renders; M11 only stores.
- Preview rendering of the vertical layout with applied settings.
- Per-candidate override of composition settings (all candidates in a project share
  project-level settings).
- User-supplied font file upload or arbitrary font paths (security risk; deferred).
- Native color picker widget beyond a validated hex text field.
- Global composition defaults not tied to a project.
- Export/import of composition settings JSON.
- Validation that the stored font is actually installed on the OS (deferred to M12
  render service).

---

## Settings Storage Rationale

SQLite is the only acceptable store. Consistency with all other project data,
survives app reinstall if the DB file is preserved, transactional, no new dependency.

Rows are created lazily: the service inserts a defaults row on first `getForProject`
call if none exists. This avoids a data-migration step to pre-populate existing projects.
