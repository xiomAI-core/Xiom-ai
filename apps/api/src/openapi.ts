/**
 * OpenAPI 3.1 spec for XIOM API — served at /openapi.json, UI at /docs
 */
import { publicApiUrl } from './lib/public-urls.js';

export function buildOpenApiSpec() {
  const server = publicApiUrl();

  return {
    openapi: '3.1.0',
    info: {
      title: 'XIOM API',
      version: '0.1.0',
      description:
        'Constitutional personal AI OS — intake, world model, MCP, guardian, x402 payments.',
    },
    servers: [{ url: server, description: 'Current environment' }],
    tags: [
      { name: 'Health', description: 'Service health' },
      { name: 'Intake', description: 'Onboarding' },
      { name: 'World Model', description: 'Knowledge graph' },
      { name: 'MCP', description: 'JSON-RPC tools' },
      { name: 'Agent Access', description: 'x402 plans and claims' },
      { name: 'Install', description: 'Bootstrap scripts' },
    ],
    paths: {
      '/health': {
        get: {
          tags: ['Health'],
          summary: 'Health check',
          responses: {
            '200': { description: 'Service status and dependency checks' },
          },
        },
      },
      '/api/intake': {
        post: {
          tags: ['Intake'],
          summary: 'Submit onboarding intake',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['lane', 'consent'],
                  properties: {
                    lane: { type: 'string', enum: ['human', 'agent', 'enterprise'] },
                    consent: { type: 'boolean' },
                    email: { type: 'string' },
                    name: { type: 'string' },
                    useCase: { type: 'string' },
                  },
                },
              },
            },
          },
          responses: {
            '201': { description: 'Intake created with provisioning capsule' },
            '400': { description: 'Validation error' },
          },
        },
      },
      '/api/intake/stats': {
        get: {
          tags: ['Intake'],
          summary: 'Intake counts by lane',
          responses: { '200': { description: 'Aggregate stats' } },
        },
      },
      '/api/intake/{intakeId}': {
        get: {
          tags: ['Intake'],
          summary: 'Get intake status',
          parameters: [
            {
              name: 'intakeId',
              in: 'path',
              required: true,
              schema: { type: 'string' },
            },
          ],
          responses: {
            '200': { description: 'Intake record' },
            '404': { description: 'Not found' },
          },
        },
      },
      '/api/worldmodel/live': {
        get: {
          tags: ['World Model'],
          summary: 'Live world model metrics',
          responses: { '200': { description: 'Node/edge counts and freshness' } },
        },
      },
      '/api/context/site-metrics': {
        get: {
          tags: ['World Model'],
          summary: 'Public site metrics (marketing)',
          responses: { '200': { description: 'nodes, edges' } },
        },
      },
      '/mcp': {
        post: {
          tags: ['MCP'],
          summary: 'MCP JSON-RPC 2.0',
          description: 'Methods: initialize, tools/list, tools/call',
          requestBody: {
            required: true,
            content: { 'application/json': { schema: { type: 'object' } } },
          },
          responses: { '200': { description: 'JSON-RPC envelope' } },
        },
      },
      '/api/agent-access/plans': {
        get: {
          tags: ['Agent Access'],
          summary: 'List x402 access plans',
          responses: { '200': { description: 'Plan catalog' } },
        },
      },
      '/install/{provider}': {
        get: {
          tags: ['Install'],
          summary: 'Bootstrap shell script',
          parameters: [
            {
              name: 'provider',
              in: 'path',
              required: true,
              schema: { type: 'string', enum: ['claude', 'codex', 'gemini'] },
            },
          ],
          responses: {
            '200': { description: 'bash install script', content: { 'text/plain': {} } },
          },
        },
      },
      '/.well-known/xiom-public-contract.json': {
        get: {
          tags: ['Health'],
          summary: 'XIOM public contract',
          responses: { '200': { description: 'Well-known metadata' } },
        },
      },
    },
  };
}
