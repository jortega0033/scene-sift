# SceneSift Monochrome Design System (Authoritative)

## Authoritative token source

- Runtime token source: `src/renderer/styles/globals.css`
- Validation gate: `pnpm design:validate`
- Any token exception must be documented in `docs/design/VISUAL_CHANGE_POLICY.md`.

## Color + surface model

Tokenized neutral palette only:

- background / foreground
- card / card-foreground
- border
- muted / muted-foreground
- primary / primary-foreground
- danger (monochrome semantic emphasis)
- focus-ring

No gradient tokens and no decorative accent colors.

## Shape, spacing, and controls

- Radius scale: sm=2px, md=4px, lg=6px.
- Standard control height: `--control-height: 36px`.
- Panel architecture uses explicit 1px borders and flat fills.
- Dense desktop spacing defaults with wrapped layouts for compact windows.
- Spacing uses tokenized scale (`--space-1`..`--space-5`).

## Typography

- Primary UI stack: Inter/system sans stack.
- Uppercase micro-labels used for metadata and status sections.
- Monospace usage limited to path/value diagnostics.
- Strong title/body/annotation contrast for hierarchy.
- Tokenized type sizes (`--font-size-xs`..`--font-size-xl`).
- Micro-label size: `--font-size-xs` (11px) via `text-label` utility.
- Monospace path size: `--font-size-mono-path` (12px) via `text-mono-path` utility.
- Status dot size: `--font-size-dot` (9px) via `text-dot` utility.
- Letter-spacing scale: `--tracking-label` (0.06em), `--tracking-heading` (0.08em), `--tracking-brand` (0.12em).
- Arbitrary Tailwind font-size and tracking values (`text-[*]`, `tracking-[*]`) are prohibited; use tokens.

## State language

States are communicated with text + symbol + border treatment (not color alone):

- status pills include semantic marker + label
- disabled controls preserve recognizability and keyboard/focus correctness
- diagnostics presented in explicit system status blocks
- progress uses semantic ARIA progressbar contract

## Accessibility contracts

- role/name based navigation controls
- dialog semantics for destructive confirmation flows
- persistent visible focus outlines
- structural test IDs only where needed for QA contracts

## Layout contracts

- Shell grid with fixed sidebar token and constrained flexible content column
- Content width uses `--layout-content-max`
- Panel children use `min-w-0` to prevent compact-window overflow
- Viewport support validated at 1440×900, 1280×800, 1024×768, 800×700

## Motion, layering, and iconography

- Motion tokens: `--motion-fast`, `--motion-base`.
- Overlay layering token: `--z-overlay`.
- Icon sizing tokens: `--icon-size-sm`, `--icon-size-md`.
- Single icon system: `lucide-react`.
