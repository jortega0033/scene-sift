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
| `src/renderer/features/projects/ProjectsPage.tsx` | Mount `CompositionSettingsPanel` |
| `src/renderer/qa/mockSceneSiftApi.ts` | Add 2 composition mock methods |
| `tests/main/ipc-contracts.test.ts` | Add composition namespace describe block + schema assertions |

## Service Design

`CompositionSettingsService` exposes two public methods:

```ts
getForProject(projectId: string): CompositionSettings
updateForProject(projectId: string, patch: CompositionSettingsPatch): CompositionSettings
```

`getForProject` — attempts SELECT; if no row found, inserts defaults, returns
the resulting row. This is the canonical "get or create defaults" pattern.

`updateForProject` — calls `getForProject` to ensure a row exists (triggering defaults
creation if needed), then applies a partial update with `updated_at = Date.now()`,
returns the full updated row.

All DB access uses Drizzle ORM parameterized queries. No raw SQL string construction.
Methods are synchronous (better-sqlite3 is sync) — consistent with all other DB services.

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
