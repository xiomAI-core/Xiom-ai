#!/usr/bin/env node
/**
 * XIOM MCP CLI — stdio transport entry point
 *
 * Env:
 *   XIOM_HUMAN_ID / AXIOM_HUMAN_ID
 *   XIOM_AUTHORITY_LEVEL (default: supervised)
 *   XIOM_SURFACE_ID (default: desktop-chat)
 *   XIOM_SESSION_ID
 *   NEO4J_URI / NEO4J_USER / NEO4J_PASSWORD
 *   XIOM_MCP_HTTP=1  — also start Streamable HTTP on :54321
 */
import { AxiomMcpServer } from './server.js';

async function main(): Promise<void> {
  const humanId =
    process.env['XIOM_HUMAN_ID'] ??
    process.env['AXIOM_HUMAN_ID'] ??
    'local-human';

  const server = new AxiomMcpServer({
    humanId,
    ...(process.env['XIOM_AUTHORITY_LEVEL'] !== undefined
      ? { authorityLevel: process.env['XIOM_AUTHORITY_LEVEL'] }
      : {}),
    ...(process.env['XIOM_SURFACE_ID'] !== undefined
      ? { surfaceId: process.env['XIOM_SURFACE_ID'] }
      : {}),
    ...(process.env['XIOM_SESSION_ID'] !== undefined
      ? { currentSessionId: process.env['XIOM_SESSION_ID'] }
      : {}),
  });

  const stopHttp =
    process.env['XIOM_MCP_HTTP'] === '1' || process.env['XIOM_MCP_HTTP'] === 'true'
      ? await server.startHttp(Number(process.env['XIOM_MCP_PORT'] ?? 54321))
      : null;

  await server.startStdio();

  const shutdown = async () => {
    if (stopHttp) await stopHttp.close();
    await server.close();
    process.exit(0);
  };

  process.on('SIGINT', () => void shutdown());
  process.on('SIGTERM', () => void shutdown());
}

main().catch((err) => {
  console.error('[xiom-mcp] fatal:', err);
  process.exit(1);
});
