# Memory Audit Skill

Invoke: `/memory-audit`

Audits Claude Code memory for stale entries, policy violations, and accuracy.

## Steps

1. List all memory files in `.claude/projects/*/memory/`.
2. For each entry: check if referenced file paths still exist (`ls` or `find`).
3. Flag stale entries: references to removed files, outdated architecture claims, old decisions superseded by newer records.
4. Check no memory entry contains: API keys, tokens, passwords, personal data, approved-override claims.
5. Check MEMORY.md index is consistent with actual files.
6. Report: stale count, policy violations found, recommended deletions.

## Output

Audit report listing: stale entries (with file path), policy violations, entries to delete. Does not delete — presents findings for human review.
