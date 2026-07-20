# M11 Acceptance Criteria

## AC-M11-001: Migration

### AC-M11-001.1
Migration `0008_composition_settings.sql` exists in `src/database/migrations/`.
SQL creates table `project_composition_settings` with columns: `project_id`,
`resolution`, `background_style`, `subtitle_position`, `font_family`, `font_size`,
`font_color`, `created_at`, `updated_at`.

### AC-M11-001.2
`project_id` is PRIMARY KEY and FOREIGN KEY referencing `projects.id` with
`ON DELETE CASCADE`.

### AC-M11-001.3
Journal entry idx=8, tag=`0008_composition_settings` exists in
`src/database/migrations/meta/_journal.json`.

### AC-M11-001.4
`PRAGMA foreign_keys = ON` is active in the database initialization sequence.
Deleting a project row cascades and removes the corresponding composition row.
Verified by test.

---

## AC-M11-002: Drizzle Schema and Channels

### AC-M11-002.1
`projectCompositionSettingsTable` exported from `src/database/schema.ts` with
all 9 columns, correct types (text/integer), correct defaults, and FK reference.

### AC-M11-002.2
`IPC_CHANNELS.COMPOSITION_GET_FOR_PROJECT` = `'composition:getForProject'` and
`IPC_CHANNELS.COMPOSITION_UPDATE_FOR_PROJECT` = `'composition:updateForProject'`
added to `src/shared/ipc/channels.ts`. Total channel count is 46.

---

## AC-M11-003: Shared Schemas

### AC-M11-003.1
`src/shared/schemas/composition.ts` exists and exports:
`ALLOWED_RESOLUTIONS`, `ALLOWED_BACKGROUND_STYLES`, `ALLOWED_SUBTITLE_POSITIONS`,
`ALLOWED_FONT_FAMILIES`, `HEX_COLOR_RE`, `compositionSettingsSchema`,
`getCompositionSettingsInputSchema`, `getCompositionSettingsOutputSchema`,
`updateCompositionSettingsInputSchema`, `updateCompositionSettingsOutputSchema`,
`CompositionSettings`, `CompositionSettingsPatch`.

### AC-M11-003.2
`compositionSettingsSchema` parses a valid full settings object. Fails on
missing fields.

### AC-M11-003.3
`getCompositionSettingsInputSchema` accepts `{ projectId: validUUID }`. Rejects
non-UUID projectId.

### AC-M11-003.4
`updateCompositionSettingsInputSchema` accepts a patch with at least one field.
Rejects empty patch `{}`. Rejects unknown resolutions. Rejects fontSize outside
[16, 72]. Rejects fontColor not matching `#RRGGBB`. Rejects non-UUID projectId.

### AC-M11-003.5
`updateCompositionSettingsInputSchema` accepts partial patch (only one field
besides projectId). All 6 settings fields are independently optional.

---

## AC-M11-004: CompositionSettingsService

### AC-M11-004.1
`getForProject` with no existing row creates defaults row. Returns object with
all 6 settings at their default values. `projectId` matches input. `createdAt`
and `updatedAt` are non-zero integers.

### AC-M11-004.2
`getForProject` called twice: second call returns same values, does NOT insert
a new row (select-then-insert, not unconditional insert).

### AC-M11-004.3
`updateForProject` with `{ resolution: '720x1280' }` returns settings with
`resolution === '720x1280'` and all other fields at defaults.

### AC-M11-004.4
`updateForProject` increments `updatedAt` on each call. After two updates,
`updatedAt` of second call >= `updatedAt` of first call.

### AC-M11-004.5
`updateForProject` does NOT reset `createdAt` on subsequent calls. `createdAt`
after second update === `createdAt` after first update.

### AC-M11-004.6
Settings persist across DB close and reopen. Write settings, close DB, reopen,
`getForProject` returns same values.

### AC-M11-004.7
`getForProject` for nonexistent projectId throws (FK constraint on insert) or
returns an error result. Does NOT silently return defaults for a project that
doesn't exist.

---

## AC-M11-005: IPC Handlers

### AC-M11-005.1
`ipc-contracts.test.ts` has a `composition` describe block that asserts:
- `composition.getForProject` is registered and returns `{ settings: CompositionSettings }`
- `composition.updateForProject` is registered and returns `{ settings: CompositionSettings }`

### AC-M11-005.2
Handler for `COMPOSITION_GET_FOR_PROJECT` validates input via
`getCompositionSettingsInputSchema`. Returns structured error for invalid input.
Does NOT call service with invalid data.

### AC-M11-005.3
Handler for `COMPOSITION_UPDATE_FOR_PROJECT` validates input via
`updateCompositionSettingsInputSchema`. Returns structured error for empty patch.
Does NOT call service with empty patch.

---

## AC-M11-006: Preload Bridge

### AC-M11-006.1
`window.sceneSift.composition.getForProject` exists in preload. Rejects
non-UUID projectId before IPC invocation.

### AC-M11-006.2
`window.sceneSift.composition.updateForProject` exists in preload. Rejects
each invalid field type before IPC invocation: invalid resolution, invalid
backgroundStyle, invalid subtitlePosition, invalid fontFamily, out-of-range
fontSize, invalid fontColor format, empty patch.

### AC-M11-006.3
`SceneSiftApi` type in `src/shared/api/sceneSiftApi.ts` includes `composition`
namespace with correct method signatures. `pnpm typecheck` passes.

---

## AC-M11-007: QA Bridge

### AC-M11-007.1
`src/renderer/qa/mockSceneSiftApi.ts` implements
`composition.getForProject(projectId)` → resolves with defaults object.

### AC-M11-007.2
`mockSceneSiftApi.ts` implements
`composition.updateForProject(projectId, patch)` → resolves with defaults
merged with patch.

### AC-M11-007.3
Browser QA mode (`VITE_SCENESIFT_BROWSER_QA=1`) renders `CompositionSettingsPanel`
without errors. All 6 controls visible.

---

## AC-M11-008: Renderer Component

### AC-M11-008.1
`CompositionSettingsPanel` renders with loading state while `getForProject`
is in-flight. Controls disabled during load.

### AC-M11-008.2
After load, all 6 controls display server values. Save button absent or disabled.

### AC-M11-008.3
Changing any field enables Save button and marks panel dirty.

### AC-M11-008.4
Clicking Save calls `updateForProject` with only changed fields. Disables
controls during save. Shows spinner.

### AC-M11-008.5
After successful save, dirty state cleared. Save button disabled again.
Transient success indication shown.

### AC-M11-008.6
Load error shows error banner with Retry button. Controls not rendered.

### AC-M11-008.7
Save error shows error banner. Controls re-enabled. User can retry.

### AC-M11-008.8
Panel has `<fieldset>` + `<legend>`. Each control has associated `<label>`.
Error banners have `role="alert"`. Save button has `aria-busy` while saving.

---

## AC-M11-009: Validation

### AC-M11-009.1
`pnpm typecheck` exits 0. No type errors in any modified or new file.

### AC-M11-009.2
`pnpm lint` exits 0 (max-warnings=0).

### AC-M11-009.3
`pnpm test` exits 0. Test count >= prior baseline + new M11 tests.

### AC-M11-009.4
`pnpm governance:validate` exits 0.

### AC-M11-009.5
`pnpm architecture:validate` exits 0. No cross-layer imports.

### AC-M11-009.6
`pnpm build` exits 0 (clean production build).
