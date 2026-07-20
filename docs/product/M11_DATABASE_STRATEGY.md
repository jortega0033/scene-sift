# M11 Database Strategy

## Migration Index and Filename

Migration index: **8**
Filename: `src/database/migrations/0008_composition_settings.sql`

## Raw SQL

```sql
CREATE TABLE `project_composition_settings` (
	`project_id` text PRIMARY KEY NOT NULL,
	`resolution` text NOT NULL DEFAULT '1080x1920',
	`background_style` text NOT NULL DEFAULT 'blur',
	`subtitle_position` text NOT NULL DEFAULT 'bottom',
	`font_family` text NOT NULL DEFAULT 'Arial',
	`font_size` integer NOT NULL DEFAULT 32,
	`font_color` text NOT NULL DEFAULT '#FFFFFF',
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
```

No index is needed. `project_id` is the PK; all lookups are by PK.

Note: Use the backtick-quoted, tab-indented Drizzle format consistent with existing migrations
(e.g., `0007_clip_cues.sql`). No `CREATE INDEX` statement needed for a PK lookup.

## Column Rationale

| Column | SQLite type | NOT NULL | Default | Notes |
|---|---|---|---|---|
| `project_id` | TEXT | YES | — | PK, FK → projects.id CASCADE |
| `resolution` | TEXT | YES | `'1080x1920'` | Enum enforced at app layer |
| `background_style` | TEXT | YES | `'blur'` | Enum enforced at app layer |
| `subtitle_position` | TEXT | YES | `'bottom'` | Enum enforced at app layer |
| `font_family` | TEXT | YES | `'Arial'` | Enum enforced at app layer |
| `font_size` | INTEGER | YES | `32` | Range [16,72] at app layer |
| `font_color` | TEXT | YES | `'#FFFFFF'` | #RRGGBB at app layer |
| `created_at` | INTEGER | YES | — | Unix ms, set on first insert |
| `updated_at` | INTEGER | YES | — | Unix ms, set on every write |

SQLite does not have reliable CHECK constraint enforcement. Enum and range constraints
are enforced at the Zod + service layer, not via SQL CHECK.

## NULL Handling

No nullable columns. All fields have application defaults. The service creates a
row with all defaults on the first access. The renderer always receives a complete
`CompositionSettings` object — never a partial or null.

## Row Lifecycle

- **Created**: On first `getForProject` or `updateForProject` call for a project.
  Not created at project creation time (lazy). The service uses a select-then-insert pattern.
- **Updated**: On every `updateForProject`. `updated_at` is always set to
  `Date.now()` (Unix ms integer).
- **Deleted**: Automatically via `ON DELETE CASCADE` when the parent project row
  is deleted. No explicit deletion logic required in the composition service.

## Journal Entry

Add to `src/database/migrations/meta/_journal.json` entries array:

```json
{
  "idx": 8,
  "version": "6",
  "when": 1753394400000,
  "tag": "0008_composition_settings",
  "breakpoints": true
}
```

Use `version: "6"` (consistent with migrations 0004–0007 which use version "6").

## Service Upsert Pattern

`getForProject` method:

```
1. SELECT * FROM project_composition_settings WHERE project_id = ?
2. If row found → return mapped row.
3. If no row → INSERT with all defaults and created_at = updated_at = Date.now()
4. Return the inserted row.
```

`updateForProject` method:

```
1. Call getForProject(projectId) to ensure row exists (creates defaults if needed).
2. UPDATE project_composition_settings SET <patch fields>, updated_at = ? WHERE project_id = ?
3. SELECT * to return the full updated row.
```

This avoids a SQL UPSERT (`INSERT OR REPLACE`) which would reset `created_at` on every update.

## PRAGMA foreign_keys — Required Change

`PRAGMA foreign_keys = ON` is **not currently set** in
`src/main/services/database/databaseService.ts`. SQLite defaults this pragma OFF
per connection, so `ON DELETE CASCADE` declarations on existing tables
(`clip_candidates` → `projects`, `clip_cues` → `clip_candidates`) are currently
silently inert.

**Implementer MUST add this pragma** to `DatabaseService.initialize()` immediately
after `this.db = new Database(this.dbPath)`:

```ts
this.db.pragma('foreign_keys = ON');
```

This activates FK enforcement globally for all existing and new FK declarations.
It is a risk-3 change to `src/main/services/database/databaseService.ts`.

**Cascade side effect**: Enabling the pragma activates `ON DELETE CASCADE` for the
existing `clip_candidates` and `clip_cues` tables that also declare it. The existing
`DatabaseService.deleteProject()` already manually deletes `subtitle_documents` and
`render_jobs` in its transaction. After enabling the pragma, `clip_candidates` and
`clip_cues` will also cascade-delete when a project is deleted. The manual deletion
steps in `deleteProject()` for `subtitle_documents`/`render_jobs` remain (they have
FK declarations too and were relying on explicit deletes). No change to
`deleteProject()` transaction logic is needed, but regression tests must verify the
existing cascade paths still work correctly.

## Migration Verification Checklist

- [ ] Fresh DB (no prior migrations): `pnpm validate` runs end-to-end successfully.
- [ ] Existing DB (migrations 0000–0007 applied): migration 0008 applies cleanly.
- [ ] `this.db.pragma('foreign_keys = ON')` added to `DatabaseService.initialize()`.
- [ ] Delete a project → confirm composition row deleted (no orphan). [New test]
- [ ] Delete a project → confirm clip_candidates rows deleted (cascade now active). [Regression]
- [ ] Delete a clip_candidate → confirm clip_cues rows deleted (cascade now active). [Regression]
- [ ] Drizzle schema type-checks against the SQL (`pnpm typecheck` passes).
