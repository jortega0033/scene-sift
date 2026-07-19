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

## License note

Both references are MIT-licensed at inspected commits. SceneSift governance files are original adaptations; preserve attribution in this file.
