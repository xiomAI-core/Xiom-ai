# XIOM MCP transports

## Desktop HTTP (primary for local providers)

XIOM Desktop serves JSON-RPC 2.0 MCP on `http://127.0.0.1:54321` (also `/mcp`).
Provider configs in `templates/mcp-config.json` point here. Tool IDs: `axiom_*`.

## Node `@xiom/mcp-server` (stdio + optional HTTP)

- **stdio**: `xiom-mcp` / `axiom-mcp` CLI (`pnpm --filter @xiom/mcp-server start`) — for Codex and other stdio MCP hosts.
- **Streamable HTTP**: set `XIOM_MCP_HTTP=1` to also listen with the SDK `StreamableHTTPServerTransport` on `:54321`. Prefer Desktop HTTP when both would bind the same port.

Library use: `import { AxiomMcpServer, formatContextCapsule } from '@xiom/mcp-server'`.
