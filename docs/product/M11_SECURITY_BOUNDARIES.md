# M11 Security Boundaries

## Trust Model

All trust decisions made in main process. Renderer is untrusted. Preload
performs syntactic pre-validation but is not a security boundary — main
process validates again via Zod schemas on every IPC call.

```
Renderer (untrusted)
  └─ sends patch object via window.sceneSift.composition.*
       └─ Preload: syntactic pre-validation (UUID regex, enum membership, range check)
            └─ Main: Zod full-schema validation in registerValidatedHandler
                 └─ CompositionSettingsService: parameterized DB write (Drizzle)
```

## Renderer Cannot

- Inject arbitrary SQL. Drizzle ORM uses parameterized queries exclusively.
- Pass non-enum strings for `resolution`, `backgroundStyle`, `subtitlePosition`,
  `fontFamily`. Zod `.enum()` rejects at IPC boundary. Unknown strings produce
  a structured IPC error, not a DB write.
- Pass hex strings with embedded SQL, JS, or HTML. `HEX_COLOR_RE = /^#[0-9A-Fa-f]{6}$/`
  accepts exactly 7 chars; length is implicitly bounded.
- Submit an empty patch. The `.refine()` check on `updateCompositionSettingsInputSchema`
  rejects `{}` with a validation error before any DB call.
- Access composition settings for a project it has no reference to. The renderer
  passes a `projectId` UUID; the service does a parameterized lookup. If the
  project does not exist, the SELECT returns null; the INSERT fails on the FK
  constraint **when `PRAGMA foreign_keys = ON` is active** (see Database Strategy
  doc — this pragma must be added to `DatabaseService.initialize()`).
- Cause orphan data. `ON DELETE CASCADE` removes the composition row when the
  project is deleted — **conditional on `PRAGMA foreign_keys = ON` being enabled**.
  Without the pragma, SQLite silently ignores the cascade. The pragma addition is
  a mandatory implementation step, not optional.

## Preload Validation Rationale

Pre-validation in the preload serves UX, not security. It rejects clearly
invalid inputs before they cross the IPC boundary, saving a roundtrip.
It does NOT relax main-process validation. Validation in the main process
is authoritative and runs unconditionally.

Preload validates:
- `projectId`: must match `UUID_RE` (same regex as all other preload bridge methods)
- `resolution`: must be in `ALLOWED_RESOLUTIONS`
- `backgroundStyle`: must be in `ALLOWED_BACKGROUND_STYLES`
- `subtitlePosition`: must be in `ALLOWED_SUBTITLE_POSITIONS`
- `fontFamily`: must be in `ALLOWED_FONT_FAMILIES`
- `fontSize`: must be integer in [16, 72]
- `fontColor`: must match `/^#[0-9A-Fa-f]{6}$/`
- patch must have at least one defined field

## No New Attack Surface

M11 introduces no:
- File path handling (no `path.resolve`, no `fs.*`)
- External process execution (no FFmpeg, no shell)
- Network calls
- New IPC generic pass-through patterns
- Raw renderer access to DB handles
- Secrets, keys, or credentials

The only new capability is read-write access to one table in an existing DB
file that is already accessible to the main process. The FK constraint and
Drizzle's parameterized queries ensure writes are bounded.

## Error Surface

IPC errors returned to renderer are structured:
```
{ error: string }  // e.g. "Validation failed: resolution must be one of ..."
```

Raw Zod error messages are acceptable here (they contain no secrets). Raw DB
exceptions must NOT be surfaced.

**Important**: `toSafeError()` in `src/main/utils/errors.ts` surfaces
`error.message` verbatim for any non-`AppError` exception. Because
`better-sqlite3` error messages may contain table names, column names, or
constraint details, `CompositionSettingsService` and the `DatabaseService`
public composition methods must catch DB-layer exceptions and throw `AppError`
with safe, non-revealing messages before they propagate to `toSafeError`.

Required error codes:
- `COMPOSITION_SETTINGS_NOT_FOUND` — project does not exist
- `COMPOSITION_SETTINGS_WRITE_FAILED` — any other DB write failure

The `registerValidatedHandler` wrapper in `createIpcHandler.ts` catches all
thrown errors and converts them via `toSafeError`; `AppError` instances pass
through with their code+message intact.

## Threat Table

| Threat | Mitigation |
|---|---|
| SQL injection via fontColor | Parameterized query. HEX_COLOR_RE bounds input to `#RRGGBB` (7 chars, no SQL metacharacters). |
| SQL injection via fontFamily | Zod `.enum()` — only 5 known strings accepted. |
| XSS via fontColor in renderer | Renderer consumes `CompositionSettings.fontColor` as a CSS value in controlled context. Not rendered as HTML. |
| Orphan row after project delete | `ON DELETE CASCADE` + `PRAGMA foreign_keys = ON` required in DB init. Verified by cascade regression test. |
| Empty-patch spam | `.refine()` in Zod schema rejects before DB call. |
| Over-large fontSize | `z.number().int().min(16).max(72)` — bounded at IPC. |
| Renderer sends non-UUID projectId | UUID_RE in preload + `z.string().uuid()` in main. |
| Race: two updates in-flight | better-sqlite3 is synchronous and serialized. No concurrent write risk. |
