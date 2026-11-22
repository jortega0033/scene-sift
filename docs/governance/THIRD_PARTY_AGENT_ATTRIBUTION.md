# Third-Party Agent Attribution

This project adapted ideas from third-party repositories. We did not install global/user-level agents from these projects.

## 1) loop-engineering

- Repository: https://github.com/cobusgreyling/loop-engineering
- Commit inspected: `a0a5932686aeeb45487ef9ad7a1dc51e1bf1d090`
- Inspection date: 2026-07-18
- License: MIT

### Patterns adopted

- Loop state files (`LOOP.md`, `STATE.md`, `loop-budget.md`, `loop-run-log.md`, `loop-constraints.md`)
- Machine-readable gating (`gate.yaml`)
- Maker/verifier separation and attempt caps
- Kill-switch concept and escalation

### Patterns adapted

- Path/risk rules rewritten for SceneSift Electron/FFmpeg/IPC risks.
- Verification checks mapped to SceneSift scripts.
- CI workflows tailored to repository-local policy.

### Patterns rejected

- Direct one-to-one policy path lists from reference repo (not relevant to SceneSift).
- Any assumption of auto-merge defaults.

## 2) agency-agents

- Repository: https://github.com/msitarzewski/agency-agents
- Commit inspected: `459dce837db3bdfdc4763d3fefd1fd854e73c8f1`
- Inspection date: 2026-07-18
- License: MIT

### Patterns adopted

- Specialist-agent concept with explicit roles.

### Patterns adapted

- Created a small SceneSift-specific subset under `.github/agents/`.
- Removed marketing language and broad non-engineering personas.
- Added strict restrictions/evidence requirements for each role.

### Patterns rejected

- Bulk/global installation model (`~/.github/agents`, `~/.copilot/agents`, etc.).
- Full-roster import and unrelated personas.

## 3) agency-agents role definitions installed for Claude Code (2026-11-22)

Sections 1 and 2 describe ideas that were adapted. This section records files that were copied.

- Repository: https://github.com/msitarzewski/agency-agents
- Pinned revision: `8ae6164602c95ca78828b148b9052460ee426885` (main, committed 2026-11-09)
- Inspection date: 2026-11-22
- License: MIT, Copyright (c) 2025 AgentLand Contributors. Full text at that revision: `docs/governance/third-party-licenses/agency-agents-LICENSE.txt`
- Decision record: GD-005 in `docs/governance/GOVERNANCE_DECISIONS.md`

| Project file | Upstream path at the pin | Upstream blob SHA | Upstream `name` |
|---|---|---|---|
| `.claude/agents/codebase-onboarding-engineer.md` | `engineering/engineering-codebase-onboarding-engineer.md` | `cc36ec153ebe38ebf51515d8591a44e1213e5aa1` | Codebase Onboarding Engineer |
| `.claude/agents/software-architect.md` | `engineering/engineering-software-architect.md` | `1a69148c99b2c170e36e035a0c7a341e98e634e9` | Software Architect |
| `.claude/agents/accessibility-auditor.md` | `testing/testing-accessibility-auditor.md` | `350dc3d468b96015a6b3cdefbb06f4a33f673cb1` | Accessibility Auditor |

### What was changed

- Frontmatter replaced: a project-unique kebab-case `name`, a SceneSift-specific `description`, and `tools: Read, Grep, Glob`. Upstream `color`, `emoji` and `vibe` were dropped.
- A provenance comment and a "SceneSift scope" section were added above the role text. That section states the role is read-only and advisory, and that `gate.yaml`, `AGENTS.md` and `loop-constraints.md` win over the upstream text.
- The role text below that section is unmodified.

### Why these three and no others

Only roles the existing nine did not cover were added: onboarding into the code, design advice before a boundary change (the existing `architecture-reviewer` verifies and does not design), and keyboard and assistive-technology review for the planned timeline work. All other needs are covered by existing roles.

### Name collisions

The same upstream roles may be installed at user level (`~/.claude/agents/`) under their upstream names, for example "Software Architect". A project agent with the same `name` would replace the user-level one in this repository. The project copies therefore use different names (`software-architect`), so both stay available and nothing is shadowed. No existing project role name is reused.

### Load check

Observed 2026-11-22 with Claude Code 2.1.323, headless (`claude -p`) from the repository root: all twelve project roles are offered, and the three roles above list exactly `Read, Grep, Glob`. A launched `software-architect` reported the same three tools. During this check `design-system-reviewer` was found not to load because its `description` contained an unquoted colon, which is invalid YAML; the value is now quoted. `pnpm claude:validate:agents` does not parse YAML and did not catch it.

### Updating

Fetch the file at a new revision with `gh api "repos/msitarzewski/agency-agents/contents/<path>?ref=<sha>"`, re-apply the frontmatter and scope section, update the pin and blob SHA in this table, and re-run the load check. This is a governance change (risk 3).

## License note

Both references are MIT-licensed at inspected commits. SceneSift governance files are original adaptations; preserve attribution in this file. The three files listed in section 3 are copies of MIT-licensed text and must keep their provenance comment and the license file named above.
