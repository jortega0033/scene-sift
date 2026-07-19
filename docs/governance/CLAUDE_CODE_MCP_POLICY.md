# Claude Code MCP Policy

## Configured MCP servers

Two servers: `chrome-devtools` and `playwright`. Both mirror `.vscode/mcp.json` exactly.

## Security requirements for all MCP servers

- Must use `--isolated` mode (no cross-session state persistence).
- Must be restricted to localhost (`127.0.0.1`, `localhost`) URLs only.
- Must not have access to production systems, external APIs, or file system paths outside the project.
- Must not transmit usage statistics.

## chrome-devtools-mcp

- Version: 1.6.0 (pinned in devDependencies)
- Restriction: `--allowedUrlPattern http://127.0.0.1:*` and `http://localhost:*` only.
- No external URL access.
- `--no-usage-statistics`, `--no-performance-crux`.

## @playwright/mcp

- Version: 0.0.78 (pinned in devDependencies)
- Host: `127.0.0.1`, port `3123`.
- Allowed hosts: `127.0.0.1`, `localhost`.
- Allowed origins: `http://127.0.0.1:4173`, `http://localhost:4173` (dev/QA server only).
- Output mode: file (no inline content).
- Block service workers.

## Adding new MCP servers

Risk 3. Requires:
1. Security review of server scope and access
2. `--isolated` mode verified
3. Network restrictions verified (localhost-only)
4. Updated in `.mcp.json` AND `.vscode/mcp.json` simultaneously
5. Human approval
6. Updated adversarial tests

## Forbidden MCP configurations

- Servers with unrestricted file system access
- Servers with external network access
- Servers without isolation mode
- Servers accessing production databases or APIs
- Servers with credential or secret access
