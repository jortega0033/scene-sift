# UI quality rules

Binding rules for every SceneSift screen, set by the owner on 2026-11-22 (`docs/owner-decisions.md`, entry 12). They apply to new and changed renderer code under `src/renderer/**` and to user-facing copy. Where `docs/design/DESIGN_SYSTEM.md` or `docs/design/UI_COPY_GUIDELINES.md` says otherwise, this file wins. Known conflict: `DESIGN_SYSTEM.md` lists "Uppercase micro-labels used for metadata and status sections", which rule 6 forbids; the existing screens are brought in line by a separate ticket.

## The rules

1. No thick accent border on one side of a card, callout, alert, list item or quote (for example `border-left: 4px solid <accent>` or `border-l-4`). Use spacing, type weight, an icon or a full hairline border instead.
2. No "soft tinted background with a thin border of the same hue" as the default way to mark a status, tag, callout or card. One neutral surface and one clear signal (text, icon or a solid chip) is enough.
3. No gradient text and no purple-to-blue gradient as a default accent.
4. No blur or glass panels, and no drop shadow plus large radius on every card.
5. No emoji used as icons or bullets, and no sparkle marks.
6. No pill or badge on things that are not states. No all-caps, letter-spaced micro labels as section decoration.
7. No centred hero with a slogan in an application screen. Screens open on the user's task.
8. One accent colour, used for the primary action and the current selection. Status colours only for status.
9. Dense, aligned layouts on a consistent spacing scale. No card grid where a table or a list is the right form.
10. User-facing copy is plain and specific: no filler, no exclamation marks, and the same word for the same thing everywhere.

Rules 1 and 2 were stated by the owner. Rules 3 to 10 were proposed by the orchestrator and approved by the owner on 2026-11-22; they have the same standing.

## How they are applied here

- A ticket that changes a screen starts with the `ui-ux-pro-max` skill (`.claude/skills/ui-ux-pro-max/`): a design-system search for this product type, for example `python .claude/skills/ui-ux-pro-max/scripts/search.py "desktop video review tool dense monochrome" --design-system`. Its output is advice; the tokens in `src/renderer/styles/globals.css` and `docs/design/DESIGN_SYSTEM.md` stay the source of truth for values.
- The same ticket ends with a check of every changed screen against the ten rules, file and line for each breach, done by `design-system-reviewer` and reported in the pull request. `accessibility-auditor` and `visual-qa-reviewer` name any breach they see.
- User-facing copy, documentation and pull request text go through the `unslop` skill (`.claude/skills/unslop/`) before the pull request is opened.
- Enforcement is by review: `architecture-reviewer` (review gate) refuses a diff with an unreported breach. No script checks these rules. Rule 1 could be linted; rule 2 cannot be detected reliably from CSS.
- Changing a screen usually changes a visual baseline. Baselines exist only for `chromium-darwin` (`tests/visual/`); say in the pull request which platform produced any new baseline, as `CLAUDE.md` asks.

## Where the current screens stand

The read-only check on 2026-11-22 found breaches of rules 6 and 10 and one borderline case of rule 5. They are listed with file and line in the implementation ticket "Bring the existing screens in line with docs/ui-quality.md" under epic #8, not fixed here.
