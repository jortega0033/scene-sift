# M11 Test Plan

## Test Files

| File | Type | New or Modified |
|---|---|---|
| `tests/main/compositionSettingsService.test.ts` | Unit (Vitest, node env) | New |
| `tests/main/compositionHandlers.test.ts` | Unit (Vitest, node env) | New |
| `tests/main/ipc-contracts.test.ts` | Unit | Modified (add composition block) |
| `tests/renderer/schemas/composition.test.ts` | Unit (Vitest) | New |
| `tests/renderer/CompositionSettingsPanel.test.tsx` | Unit (Vitest + React Testing Library) | New |
| `tests/e2e/composition-settings.e2e.spec.ts` | E2E (Playwright, Browser QA mode) | New |

---

## compositionSettingsService.test.ts

Environment: `// @vitest-environment node`. Uses real in-memory DB
(`databaseService` initialized with temp path + cleanup in afterEach).

### Test cases

1. **getForProject — no existing row — returns defaults**
   - Create project in DB, call `getForProject(projectId)`
   - Expect: resolution='1080x1920', backgroundStyle='blur', subtitlePosition='bottom',
     fontFamily='Arial', fontSize=32, fontColor='#FFFFFF'
   - Expect: `createdAt` and `updatedAt` > 0

2. **getForProject — idempotent — no duplicate insert**
   - Call `getForProject` twice for same projectId
   - Verify no DB error, second call returns same values
   - Verify row count in table = 1 (direct DB query)

3. **getForProject — existing row — returns stored values**
   - Manually insert row with `resolution='720x1280'`
   - `getForProject` returns `resolution='720x1280'`

4. **updateForProject — single field — updates only that field**
   - `updateForProject(projectId, { resolution: '720x1280' })`
   - All other fields remain at default values

5. **updateForProject — multiple fields — updates all provided**
   - `updateForProject(projectId, { fontSize: 48, fontColor: '#000000' })`
   - Both updated; other fields at default

6. **updateForProject — updatedAt increments**
   - Call update, record updatedAt1
   - Call update again, record updatedAt2
   - Expect updatedAt2 >= updatedAt1

7. **updateForProject — does not reset createdAt**
   - Call update twice, compare createdAt before and after second update
   - Expect same value

8. **persistence across DB close and reopen**
   - Write settings, close DB, reopen with same path, `getForProject`
   - Expect saved values returned

9. **CASCADE delete — project deletion removes composition row**
   - Create project, create composition row via `getForProject`
   - Delete project row directly
   - Verify composition table has 0 rows for that projectId

10. **getForProject — nonexistent projectId — throws**
    - Random UUID not in projects table
    - Expect throw (FK constraint violation on insert)

---

## compositionHandlers.test.ts

Uses `registerValidatedHandler` mock (or invokes handler directly).
Tests that Zod validation fires before service call.

### Test cases

1. **COMPOSITION_GET_FOR_PROJECT — valid input — returns settings**
2. **COMPOSITION_GET_FOR_PROJECT — non-UUID projectId — returns validation error**
3. **COMPOSITION_UPDATE_FOR_PROJECT — valid single-field patch — returns settings**
4. **COMPOSITION_UPDATE_FOR_PROJECT — empty patch — returns validation error**
5. **COMPOSITION_UPDATE_FOR_PROJECT — invalid resolution — returns validation error**
6. **COMPOSITION_UPDATE_FOR_PROJECT — fontSize below 16 — returns validation error**
7. **COMPOSITION_UPDATE_FOR_PROJECT — invalid fontColor — returns validation error**

---

## ipc-contracts.test.ts additions

Add `describe('composition')` block asserting:
- Channel `composition:getForProject` is in `ALL_IPC_CHANNELS`
- Channel `composition:updateForProject` is in `ALL_IPC_CHANNELS`
- `getCompositionSettingsInputSchema` parses a valid input
- `getCompositionSettingsOutputSchema` parses a valid output
- `updateCompositionSettingsInputSchema` parses a valid patch
- `updateCompositionSettingsOutputSchema` parses a valid output

---

## tests/renderer/schemas/composition.test.ts

Pure schema unit tests. No DOM, no React.

### Test cases

1. **compositionSettingsSchema — parses full valid object**
2. **compositionSettingsSchema — rejects missing fontColor**
3. **getCompositionSettingsInputSchema — accepts valid UUID**
4. **getCompositionSettingsInputSchema — rejects non-UUID**
5. **updateCompositionSettingsInputSchema — accepts single-field patch**
6. **updateCompositionSettingsInputSchema — rejects empty patch**
7. **updateCompositionSettingsInputSchema — rejects all 5 invalid enum values** (one test each)
8. **updateCompositionSettingsInputSchema — rejects fontSize=15 (below min)**
9. **updateCompositionSettingsInputSchema — rejects fontSize=73 (above max)**
10. **updateCompositionSettingsInputSchema — accepts fontSize=16 (min boundary)**
11. **updateCompositionSettingsInputSchema — accepts fontSize=72 (max boundary)**
12. **updateCompositionSettingsInputSchema — rejects fontColor='#GGG000' (invalid hex)**
13. **updateCompositionSettingsInputSchema — rejects fontColor='123456' (missing #)**
14. **updateCompositionSettingsInputSchema — rejects fontColor='#RRGGBBAA' (8 chars)**
15. **updateCompositionSettingsInputSchema — accepts '#ffffff' (lowercase)**

---

## CompositionSettingsPanel.test.tsx

Uses `@testing-library/react` + `vi.mock` for `window.sceneSift`.

### Test cases

1. **shows loading state while getForProject in-flight**
   - Mock `getForProject` with pending promise
   - Assert controls disabled / loading indicator visible

2. **renders all 6 controls with server values after load**
   - Mock resolves with default settings
   - Assert each control shows correct value

3. **Save button absent / disabled in CLEAN state**

4. **changing a select enables Save button**
   - Change resolution select
   - Assert Save button enabled

5. **Save calls updateForProject with only changed fields**
   - Change fontSize to 48
   - Click Save
   - Assert `updateForProject` called with `{ projectId, fontSize: 48 }` (not all fields)

6. **controls disabled and Save shows spinner while saving**
   - Mock `updateForProject` with pending promise
   - Assert disabled state + aria-busy

7. **after successful save, dirty cleared, success feedback shown**
   - Mock resolves
   - Assert Save disabled again, success text visible

8. **load error shows error banner with Retry button**
   - Mock `getForProject` rejects
   - Assert error banner with role="alert"

9. **save error shows error banner, controls re-enabled**
   - Mock `updateForProject` rejects
   - Assert error banner; controls enabled

10. **accessibility: fieldset, legend, and label associations present**
    - Query by role; assert structure

---

## composition-settings.e2e.spec.ts (Browser QA)

Runs with `VITE_SCENESIFT_BROWSER_QA=1`. Uses mock bridge from `mockSceneSiftApi`.

### Test cases

1. **CompositionSettingsPanel renders in project detail view**
   - Select a project
   - Expand composition settings section
   - Assert all 6 controls visible

2. **changing resolution and saving calls bridge method**
   - Spy on `window.sceneSift.composition.updateForProject`
   - Change resolution
   - Click Save
   - Assert spy called with correct projectId and `{ resolution: '720x1280' }`

3. **no visible errors in browser console during load and save**
   - Check console for errors after load and save sequence

---

## Run Commands

| Suite | Command |
|---|---|
| All unit | `pnpm test` |
| Single file | `pnpm vitest tests/main/compositionSettingsService.test.ts` |
| E2E | `pnpm test:e2e --grep composition` |
| Full validate | `pnpm validate` |
