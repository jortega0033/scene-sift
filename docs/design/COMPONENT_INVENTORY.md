# SceneSift Component Inventory (Baseline)

## Authoritative UI components

| Component         | Responsibility                            | File                                                   | Stability | Accessibility contract                    | Variants                 | Visual coverage        | Owner role    |
| ----------------- | ----------------------------------------- | ------------------------------------------------------ | --------- | ----------------------------------------- | ------------------------ | ---------------------- | ------------- |
| Layout            | App shell, nav, global status framing     | `src/renderer/components/Layout.tsx`                   | Stable    | nav landmarks, active-page semantics      | N/A                      | app-shell visual + e2e | Frontend + UX |
| StatusPill        | Compact textual status with symbol marker | `src/renderer/components/StatusPill.tsx`               | Stable    | readable status text, non-color semantics | ok/warning/neutral/error | queue/settings visuals | Frontend      |
| ErrorBoundary     | top-level fatal error fallback            | `src/renderer/app/ErrorBoundary.tsx`                   | Stable    | user-visible fallback, no raw stack dump  | N/A                      | renderer tests         | Frontend      |
| CreateProjectForm | project creation form fields + validation | `src/renderer/features/projects/CreateProjectForm.tsx` | Stable    | labeled controls + alert errors           | N/A                      | dialogs visual + e2e   | Frontend      |

## Page components

| Component    | Responsibility                             | File                                              | Stability | Accessibility contract                        | Visual coverage            |
| ------------ | ------------------------------------------ | ------------------------------------------------- | --------- | --------------------------------------------- | -------------------------- |
| ProjectsPage | list/create/select/delete project workflow | `src/renderer/features/projects/ProjectsPage.tsx` | Stable    | modal dialog semantics + keyboard escape/trap | projects + dialogs visuals |
| QueuePage    | queue list, status, progress, errors       | `src/renderer/features/queue/QueuePage.tsx`       | Stable    | progressbar semantics + status text           | queue visual               |
| SettingsPage | local settings + diagnostics               | `src/renderer/features/settings/SettingsPage.tsx` | Stable    | labeled inputs + error alert surface          | settings visual            |

## Hooks

| Hook          | Responsibility                              | File                                            | Stability |
| ------------- | ------------------------------------------- | ----------------------------------------------- | --------- |
| useFocusTrap  | Modal focus containment + Escape/Tab cycling | `src/renderer/hooks/useFocusTrap.ts`            | Stable    |

Focus trap is shared by ProjectsPage (create dialog + delete confirm). Extracted from duplicate inline `useEffect` implementations.

## Deprecation / duplication status

- No second icon family allowed (single `lucide-react` baseline).
- No duplicate button component families currently accepted.
- `data-testid` remains structural only (`app-shell`, page roots, major regions).
