---
globs: ["src/main/services/media/**", "src/main/workers/**"]
---

# Media Pipeline Rule

Risk: 2 default. Risk 3 for changes affecting file access paths, external process execution, or resource limits.

## File and path handling

- Validate all input paths. Reject paths with `..` traversal.
- Restrict file access to user-selected directories and app temp dir.
- Never pass user-provided paths directly to shell commands.

## External process execution

- Use argument arrays (never command strings) for all ffmpeg/ffprobe calls.
- Validate executable paths at startup; fail explicitly if missing.
- No `shell: true`.
- Set resource limits (timeout, memory) on all external processes.
- Surface errors with structured codes, not raw stderr.

## Worker threads

- Workers receive only serializable data — no file handles, no closures.
- Terminate workers on timeout; log termination.
- Worker errors must propagate to main process; no silent failures.

## Tests

Run `pnpm test:media` after any change to processing or path logic.
