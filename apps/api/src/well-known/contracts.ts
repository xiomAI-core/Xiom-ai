/**
 * Well-known JSON objects served at /.well-known/* routes
 */

import {
  publicApiUrl,
  publicMarketingUrl,
  publicMcpUrl,
} from '../lib/public-urls.js';

export function getXiomPublicContract() {
  const api = publicApiUrl();
  return {
    name: 'XIOM',
    version: '1.0.0',
    type: 'personal-ai-os',
    description: 'XIOM — constitutional personal AI operating system',
    homepage: publicMarketingUrl(),
    api,
    mcp: publicMcpUrl(),
    token: {
      symbol: 'XIOM',
      chain: 'robinhood_chain',
      chainId: 4663,
    },
    nativeStablecoin: 'USDG',
    capabilities: ['world-model', 'guardian', 'mcp', 'x402', 'agent-access'],
    license: 'MIT',
  };
}

/** @deprecated Use getXiomPublicContract() for env-aware URLs */
export const xiomPublicContract = getXiomPublicContract();

export const x402Contract = {
  accepts: ['usdg'],
  chain: 'robinhood_chain',
  chainId: 4663,
  nativeStablecoin: 'USDG',
  version: 'x402/1.0',
  recipient: process.env['XIOM_TREASURY_ADDRESS'] ?? '0x0000000000000000000000000000000000000000',
  description: 'XIOM API x402 payment metadata',
  resources: [
    { path: '/api/v2/*', scheme: 'exact', currency: 'USDG' },
  ],
};

export const agentContract = {
  name: 'XIOM Guardian',
  type: 'constitutional-ai',
  version: '1.0.0',
  mcp: '/mcp',
  capabilities: ['guardrail-check', 'world-model-query', 'public-context'],
  homepage: publicMarketingUrl(),
  x402: '/.well-known/x402.json',
};

export const mcpContract = {
  endpoint: '/mcp',
  transport: 'http',
  version: '2024-11-05',
  serverInfo: {
    name: 'xiom-mcp',
    version: '0.1.0',
    description: 'XIOM MCP server — constitutional AI access layer',
  },
  capabilities: {
    tools: {},
    resources: {},
    prompts: {},
  },
  tools: [
    {
      name: 'xiom_world_model_query',
      description: 'Query the XIOM world model graph',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string' },
          domain: { type: 'string' },
          limit: { type: 'number' },
        },
        required: ['query'],
      },
    },
    {
      name: 'xiom_guardrail_check',
      description: 'Run a dry-run Guardian policy check',
      inputSchema: {
        type: 'object',
        properties: {
          action: { type: 'string' },
          context: { type: 'object' },
        },
        required: ['action'],
      },
    },
    {
      name: 'xiom_public_context',
      description: 'Get XIOM public context snapshot',
      inputSchema: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
  ],
};
