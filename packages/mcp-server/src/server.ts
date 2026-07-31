// ──────────────────────────────────────────────────────────────
// AxiomMcpServer — MCP JSON-RPC server for the XIOM provider lane
// Stdio (Node) + optional Streamable HTTP on :54321
// Desktop Rust MCP also serves HTTP JSON-RPC on 127.0.0.1:54321
// ──────────────────────────────────────────────────────────────
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { randomUUID } from 'node:crypto';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import {
  createConnectionManager,
  type Neo4jConnectionManager,
  type AuthorityLevel,
} from '@xiom/world-model';
import type { SurfacePermissions } from '@xiom/guardian';
import { createAllTools, type ToolContext } from './tools/index.js';
import { createDefaultSessionStore } from './session-store.js';
import { DEFAULT_MCP_SURFACE, parseAuthorityLevel } from './soft-check.js';
import type {
  AxiomMcpServerOptions,
  RegisteredTool,
  SessionStore,
} from './types.js';

const MCP_SERVER_INFO = { name: 'xiom-mcp', version: '0.1.0' } as const;

export class AxiomMcpServer {
  private readonly tools = new Map<string, RegisteredTool>();
  private readonly server: Server;
  private conn: Neo4jConnectionManager;
  private sessionStore: SessionStore;
  private humanId: string;
  private authorityLevel: AuthorityLevel;
  private surfaceId: string;
  private currentSessionId: string;
  private actorId: string;
  private surfacePermissions: SurfacePermissions;
  private ownsConnection: boolean;

  constructor(options: AxiomMcpServerOptions) {
    this.humanId = options.humanId;
    this.authorityLevel = parseAuthorityLevel(options.authorityLevel);
    this.surfaceId = options.surfaceId ?? 'desktop-chat';
    this.currentSessionId = options.currentSessionId ?? randomUUID();
    this.actorId = options.actorId ?? 'xiom-mcp';
    this.sessionStore = options.sessionStore ?? createDefaultSessionStore();
    this.ownsConnection = !options.conn;

    this.conn =
      options.conn ??
      createConnectionManager({
        uri: options.neo4jUri ?? process.env['NEO4J_URI'] ?? 'bolt://localhost:7687',
        user: options.neo4jUser ?? process.env['NEO4J_USER'] ?? 'neo4j',
        password: options.neo4jPassword ?? process.env['NEO4J_PASSWORD'] ?? 'xiom',
      });

    this.surfacePermissions = {
      ...DEFAULT_MCP_SURFACE,
      surfaceId: this.surfaceId,
    };

    this.server = new Server(MCP_SERVER_INFO, {
      capabilities: { tools: {} },
      instructions:
        'XIOM MCP server — constitutional world model, Guardian-gated writes, hash-chained receipts.',
    });

    this.registerTools();
    this.bindHandlers();
  }

  private toolContext(): ToolContext {
    return {
      conn: this.conn,
      sessionStore: this.sessionStore,
      humanId: this.humanId,
      authorityLevel: this.authorityLevel,
      surfaceId: this.surfaceId,
      currentSessionId: this.currentSessionId,
      actorId: this.actorId,
      surfacePermissions: this.surfacePermissions,
    };
  }

  private registerTools(): void {
    for (const tool of createAllTools(this.toolContext())) {
      this.tools.set(tool.name, tool);
    }
  }

  private bindHandlers(): void {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [...this.tools.values()].map((t) => ({
        name: t.name,
        description: t.description,
        inputSchema: t.inputSchema,
      })),
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const name = request.params.name;
      const args = (request.params.arguments ?? {}) as Record<string, unknown>;
      const tool = this.tools.get(name);

      if (!tool) {
        return {
          content: [{ type: 'text' as const, text: `Unknown tool: ${name}` }],
          isError: true,
        };
      }

      try {
        // Refresh handlers so session state mutations are visible
        const fresh = createAllTools(this.toolContext()).find((t) => t.name === name);
        const handler = fresh?.handler ?? tool.handler;
        const result = await handler(args);

        const structuredJson = JSON.stringify(result.structured, null, 2);
        const content =
          result.text === structuredJson
            ? [{ type: 'text' as const, text: result.text }]
            : [
                { type: 'text' as const, text: result.text },
                { type: 'text' as const, text: structuredJson },
              ];

        return {
          content,
          ...(result.isError ? { isError: true } : {}),
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: 'text' as const, text: `Tool error: ${message}` }],
          isError: true,
        };
      }
    });
  }

  /** Update session identity fields (e.g. after pairing). */
  setSessionState(partial: {
    humanId?: string;
    authorityLevel?: string | AuthorityLevel;
    surfaceId?: string;
    currentSessionId?: string;
  }): void {
    if (partial.humanId !== undefined) this.humanId = partial.humanId;
    if (partial.authorityLevel !== undefined) {
      this.authorityLevel = parseAuthorityLevel(partial.authorityLevel);
    }
    if (partial.surfaceId !== undefined) {
      this.surfaceId = partial.surfaceId;
      this.surfacePermissions = { ...this.surfacePermissions, surfaceId: this.surfaceId };
    }
    if (partial.currentSessionId !== undefined) {
      this.currentSessionId = partial.currentSessionId;
    }
    // Refresh tool handlers with new context
    this.tools.clear();
    this.registerTools();
  }

  listToolNames(): string[] {
    return [...this.tools.keys()];
  }

  get underlying(): Server {
    return this.server;
  }

  async connect(transport: StdioServerTransport | StreamableHTTPServerTransport): Promise<void> {
    if (this.ownsConnection) {
      await this.conn.connect();
    }
    // SDK Transport optional callbacks conflict with exactOptionalPropertyTypes
    await this.server.connect(transport as Parameters<Server['connect']>[0]);
  }

  async startStdio(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.connect(transport);
  }

  /**
   * Optional Streamable HTTP transport on the given port (default 54321).
   * Note: XIOM Desktop also serves a simpler JSON-RPC HTTP MCP on the same
   * port — prefer desktop HTTP for local providers; use this for Node-only
   * deployments or stdio for Claude Code / Codex bridges.
   */
  async startHttp(port = 54321): Promise<{ close: () => Promise<void> }> {
    if (this.ownsConnection) {
      await this.conn.connect();
    }

    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
    });
    await this.server.connect(transport as Parameters<Server['connect']>[0]);

    const httpServer = createServer(async (req: IncomingMessage, res: ServerResponse) => {
      try {
        await transport.handleRequest(req, res);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (!res.headersSent) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: message }));
        }
      }
    });

    await new Promise<void>((resolve, reject) => {
      httpServer.listen(port, '127.0.0.1', () => resolve());
      httpServer.on('error', reject);
    });

    // eslint-disable-next-line no-console
    console.error(`[xiom-mcp] Streamable HTTP listening on http://127.0.0.1:${port}`);

    return {
      close: async () => {
        await new Promise<void>((resolve, reject) => {
          httpServer.close((e) => (e ? reject(e) : resolve()));
        });
        await transport.close();
      },
    };
  }

  async close(): Promise<void> {
    await this.server.close();
    if (this.ownsConnection) {
      await this.conn.disconnect().catch(() => undefined);
    }
  }
}
