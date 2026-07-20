# M11 Risk Register

## Overall Risk Classification: Risk 2

Rationale: M11 adds a new DB table (migration), new IPC channels (main process),
new preload methods, and renderer UI. All main-process and IPC touches are risk-2
or higher per AGENTS.md. No changes to existing privileged paths (ffmpeg, file I/O,
dialog) and no secrets/credentials involved. Risk 3 is not triggered (no changes to
existing IPC channel contracts, no Electron security flag changes, no governance
files).

Required checks at risk 2:
- `pnpm typecheck && pnpm lint && pnpm test`
- `pnpm validate`
- Independent verifier (different from implementer)
- Human approval before integration

---

## Risk Items

### R-M11-01 Migration index collision
**Likelihood**: Low. **Impact**: High (build failure, broken DB).
**Mitigation**: Verify current max migration index before writing 0008.
Read `src/database/migrations/meta/_journal.json` to confirm idx=7 is current max.
**Owner**: Implementer must verify before writing migration file.

### R-M11-02 PRAGMA foreign_keys not enabled — CASCADE silently ignored
**Likelihood**: Medium (SQLite default is OFF). **Impact**: Medium (orphan rows).
**Mitigation**: Check `src/main/services/database/databaseService.ts` init sequence
before writing service. Add `PRAGMA foreign_keys = ON` if absent. Add regression
test that deletes project and confirms composition row removed.
**Owner**: Implementer + service unit test (AC-M11-004.7 cascade test).

### R-M11-03 Drizzle schema type mismatch with migration SQL
**Likelihood**: Low. **Impact**: Medium (runtime type errors).
**Mitigation**: Column names in Drizzle schema use camelCase (JS) but must map to
snake_case SQL column names. Verify `.default()` values match SQL DEFAULT literals.
Run `pnpm typecheck` — Drizzle generates types from schema and will catch mismatches.
**Owner**: Implementer + typecheck in required checks.

### R-M11-04 Preload constants drift from shared schemas
**Likelihood**: Low-medium. **Impact**: Low-medium (preload rejects valid inputs or
accepts invalid ones).
**Mitigation**: Preload imports `ALLOWED_*` constants directly from
`@shared/schemas/composition` — not redefined locally. This ensures drift is
impossible; adding a new enum value in the schema automatically updates preload.
**Owner**: Architecture decision in IPC surface doc. Verify no local redefinition.

### R-M11-05 Empty patch accepted by DB layer despite schema rejection
**Likelihood**: Low. **Impact**: Low (NOP update, no corruption).
**Mitigation**: Zod `.refine()` check in `updateCompositionSettingsInputSchema`
rejects empty patch before DB call. Handler uses `registerValidatedHandler` which
returns error without calling service. Unit test in AC-M11-005.3.
**Owner**: Schema + handler unit test.

### R-M11-06 updateForProject resets createdAt via INSERT OR REPLACE
**Likelihood**: Low (if implementer uses UPSERT). **Impact**: Low (data quality).
**Mitigation**: Service uses select-then-update pattern, not `INSERT OR REPLACE`.
DB strategy doc specifies this explicitly. AC-M11-004.5 tests that createdAt not reset.
**Owner**: Implementer must follow service pattern in M11_DATABASE_STRATEGY.md.

### R-M11-07 Renderer sends all 6 fields on every update (over-broad patch)
**Likelihood**: Medium (natural implementation mistake). **Impact**: Low (correct
but wasteful; shadows selective update intent).
**Mitigation**: Component tracks `draft` as only-changed fields. Save submits only
`draft` fields plus `projectId`. Unit test AC-M11-008.5 verifies only changed fields sent.
**Owner**: Component implementation + test.

### R-M11-08 fontColor swatch renders unsafe HTML
**Likelihood**: Low. **Impact**: Low (CSS injection, not JS injection).
**Mitigation**: Swatch is `<span style={{ backgroundColor: settings.fontColor }}>`
where `fontColor` is already validated to `#RRGGBB`. CSS background-color cannot
execute JS. No `dangerouslySetInnerHTML`.
**Owner**: Component implementation.

### R-M11-09 QA bridge composition methods missing — browser QA crashes
**Likelihood**: Low-medium (easy to forget). **Impact**: Medium (QA mode broken).
**Mitigation**: AC-M11-007 acceptance criteria explicitly require QA mock methods.
E2E test runs in browser QA mode and will fail if mock is missing.
**Owner**: Implementer + E2E test.

### R-M11-10 IPC contract test not updated — new channels uncovered
**Likelihood**: Low-medium. **Impact**: Low (test gap, not runtime defect).
**Mitigation**: AC-M11-005.1 requires ipc-contracts.test.ts update. Architecture
reviewer checks for this during verification.
**Owner**: Implementer + architecture-reviewer.

---

## Risk Summary Table

| ID | Risk | Likelihood | Impact | Mitigation Status |
|---|---|---|---|---|
| R-M11-01 | Migration index collision | Low | High | Check journal before write |
| R-M11-02 | CASCADE not active | Medium | Medium | Check DB init + cascade test |
| R-M11-03 | Drizzle/SQL type mismatch | Low | Medium | typecheck catches |
| R-M11-04 | Preload constants drift | Low-Med | Low-Med | Import from shared |
| R-M11-05 | Empty patch reaches DB | Low | Low | Zod refine + test |
| R-M11-06 | createdAt reset | Low | Low | Select-then-update + test |
| R-M11-07 | Over-broad patch | Medium | Low | Draft state + test |
| R-M11-08 | fontColor HTML injection | Low | Low | CSS-only swatch |
| R-M11-09 | QA mock missing | Low-Med | Medium | AC + E2E test |
| R-M11-10 | Contract test not updated | Low-Med | Low | AC + reviewer check |

No risk items require risk-3 escalation. R-M11-02 is the highest-priority item
requiring explicit implementation attention before writing the service.
