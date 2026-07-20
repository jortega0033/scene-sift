# M11 Architecture — Vertical Composition Settings

## Layer Diagram

```
Renderer
  CompositionSettingsPanel.tsx
    └─ window.sceneSift.composition.getForProject / updateForProject
         └─ src/preload/index.ts  (composition namespace)
              └─ IPC: composition:getForProject / composition:updateForProject
                   └─ src/main/ipc/compositionHandlers.ts
                        └─ CompositionSettingsService
                             └─ src/main/services/compositionSettings/compositionSettingsService.ts
                                  └─ projectCompositionSettingsTable  (schema.ts)
                                       └─ SQLite via Drizzle ORM
```

## New Table vs. More Columns on `projects`

Decision: **New table `project_composition_settings`.**

The `projects` table already carries 30+ columns covering media metadata, subtitle
state, sync state, and candidate state. Adding 6–8 composition columns would further
bloat a table that is read on every `project:list` call.

A separate table:
- Keeps `projects` list queries lean.
- Makes the composition domain self-contained and easily removable.
- Allows a clean FK with `ON DELETE CASCADE` (matching the `subtitle_documents` pattern).
- Is consistent with how the codebase already handles one-to-one per-project data.

## New Files

| File | Purpose |
|---|---|
| `src/database/migrations/0008_composition_settings.sql` | Migration |
| `src/shared/schemas/composition.ts` | Zod schemas + types |
| `src/main/services/compositionSettings/compositionSettingsService.ts` | Service |
| `src/main/ipc/compositionHandlers.ts` | IPC handlers |
| `src/renderer/features/projects/CompositionSettingsPanel.tsx` | UI component |
| `tests/main/compositionSettingsService.test.ts` | Service unit tests |
| `tests/renderer/CompositionSettingsPanel.test.tsx` | Renderer unit tests |

## Modified Files

| File | Change |
|---|---|
| `src/database/schema.ts` | Export `projectCompositionSettingsTable` |
| `src/database/migrations/meta/_journal.json` | Add entry idx=8 |
| `src/shared/ipc/channels.ts` | Add 2 channel constants (total: 46) |
| `src/preload/index.ts` | Add `composition` namespace |
| `src/shared/api/sceneSiftApi.ts` | Extend `SceneSiftApi` with `composition` namespace |
| `src/main/services/database/databaseService.ts` | Add PRAGMA foreign_keys ON; add 2 public composition methods |
| `src/renderer/features/projects/ProjectsPage.tsx` | Mount `CompositionSettingsPanel` |
| `src/renderer/qa/mockSceneSiftApi.ts` | Add 2 composition mock methods |
| `tests/main/ipc-contracts.test.ts` | Add composition namespace describe block + schema assertions |

## Service Design

**DB access boundary**: `DatabaseService.db` and `DatabaseService.orm` are both
`private`. `CompositionSettingsService` must NOT access them directly. Following
the established pattern of `SubtitleService` and `SynchronizationService`, two new
public methods are added to `DatabaseService`:

```ts
// New public methods on DatabaseService
getProjectCompositionSettings(projectId: string): CompositionSettings
upsertProjectCompositionSettings(projectId: string, patch: CompositionSettingsPatch): CompositionSettings
```

These methods live inside `databaseService.ts` and have access to `this.orm`.

`CompositionSettingsService` exposes two public methods that delegate to `DatabaseService`:

```ts
getForProject(projectId: string): CompositionSettings
updateForProject(projectId: string, patch: CompositionSettingsPatch): CompositionSettings
```

`getForProject` — calls `databaseService.getProjectCompositionSettings(projectId)`.
`updateForProject` — calls `databaseService.upsertProjectCompositionSettings(projectId, patch)`.

The service wraps all DB calls in try/catch and throws `AppError` with structured
codes, preventing raw `better-sqlite3` exception messages from reaching the renderer.

All DB access uses Drizzle ORM parameterized queries. No raw SQL string construction.
Methods are synchronous (better-sqlite3 is sync) — consistent with all other DB services.

## ADR Determination

**No new ADR required.** M11 does not cross existing layer boundaries. It adds a new
column family to the DB layer (accessed only through `DatabaseService` public methods),
two new channels in the established IPC pattern, and a new renderer component using
only `window.sceneSift.*`. The `CompositionSettingsService` placement in
`src/main/services/compositionSettings/` is consistent with the existing service
topology without introducing any new architectural seam. Compare: M4 required ADR-014
because it introduced a new URL protocol scheme. M11 introduces no equivalent.

## Renderer Component Design

`CompositionSettingsPanel` is a controlled component that:
1. On mount: calls `window.sceneSift.composition.getForProject(projectId)`.
2. Holds local state for the 6 settings fields + a `dirty` boolean.
3. On user change: marks dirty, enables Save button.
4. On Save click: calls `updateForProject` with only the changed fields as patch,
   then resets dirty state and shows transient confirmation.

The panel uses local `useState` + `useEffect`. No global state manager needed.

## QA Bridge

The QA mock bridge under `src/renderer/qa/mockSceneSiftApi.ts` must implement:
- `composition.getForProject(projectId)` → resolves with the full defaults object.
- `composition.updateForProject(projectId, patch)` → resolves with defaults merged
  with patch.

Both implementations are synchronous resolves (no simulated delay required).

## Drizzle Schema Entry

```ts
// src/database/schema.ts
export const projectCompositionSettingsTable = sqliteTable(
  'project_composition_settings',
  {
    projectId: text('project_id')
      .primaryKey()
      .references(() => projectsTable.id, { onDelete: 'cascade' }),
    resolution: text('resolution').notNull().default('1080x1920'),
    backgroundStyle: text('background_style').notNull().default('blur'),
    subtitlePosition: text('subtitle_position').notNull().default('bottom'),
    fontFamily: text('font_family').notNull().default('Arial'),
    fontSize: integer('font_size').notNull().default(32),
    fontColor: text('font_color').notNull().default('#FFFFFF'),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  }
);
```
