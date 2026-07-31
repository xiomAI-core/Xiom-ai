/**
 * API Request/Response types with Zod validation schemas
 */
import { z } from 'zod';

// ─── Intake ─────────────────────────────────────────────────────────────────

export const IntakeRequestSchema = z.object({
  lane: z.enum(['human', 'agent', 'enterprise']),
  consent: z.literal(true),
  // Human lane
  email: z.string().email().optional(),
  name: z.string().min(1).max(128).optional(),
  useCase: z.string().min(1).max(1024).optional(),
  // Agent lane
  agentId: z.string().min(1).max(128).optional(),
  operatorAddress: z.string().regex(/^0x[0-9a-fA-F]{40}$/).optional(),
  // Enterprise lane
  organizationName: z.string().min(1).max(256).optional(),
  contactEmail: z.string().email().optional(),
});

export type IntakeRequest = z.infer<typeof IntakeRequestSchema>;

export interface IntakeResponse {
  ok: true;
  intakeId: string;
  lane: string;
  status: string;
  provisioningCapsule: ProvisioningCapsule;
  createdAt: string;
}

export interface ProvisioningCapsule {
  intakeId: string;
  lane: string;
  endpoints: {
    api: string;
    mcp: string;
    worldModel: string;
  };
  instructions: string;
  createdAt: string;
}

export interface IntakeStatusResponse {
  ok: true;
  intakeId: string;
  lane: string;
  status: string;
  createdAt: string;
  activatedAt: string | null;
}

// ─── Agent Access ────────────────────────────────────────────────────────────

export const QuoteRequestSchema = z.object({
  planId: z.string(),
  payerAddress: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
  agentId: z.string().optional(),
  callbackUrl: z.string().url().optional(),
});

export type QuoteRequest = z.infer<typeof QuoteRequestSchema>;

export interface QuoteResponse {
  ok: true;
  quoteId: string;
  planId: string;
  amount: string;
  currency: string;
  network: string;
  paymentAddress: string;
  quoteHash: string;
  paymentRequirementHash: string;
  signature: string;
  expiresAt: string;
  createdAt: string;
}

export const ClaimRequestSchema = z.object({
  quoteId: z.string().uuid(),
  quoteHash: z.string().min(1),
  transactionHash: z.string().regex(/^0x[0-9a-fA-F]{64}$/),
  payerAddress: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
});

export type ClaimRequest = z.infer<typeof ClaimRequestSchema>;

export interface ActivationPacket {
  claimId: string;
  planId: string;
  jwtToken: string;
  apiKey: string;
  expiresAt: string;
  endpoints: {
    api: string;
    mcp: string;
    worldModel: string;
  };
  rateLimit: {
    requestsPerDay: number;
  };
}

export interface ClaimResponse {
  ok: true;
  claimId: string;
  activationPacket: ActivationPacket;
  createdAt: string;
}

// ─── World Model ─────────────────────────────────────────────────────────────

export const WorldModelQueryRequestSchema = z.object({
  query: z.string().min(1).max(512),
  domain: z.string().optional(),
  limit: z.number().int().min(1).max(100).default(20),
});

export type WorldModelQueryRequest = z.infer<typeof WorldModelQueryRequestSchema>;

export interface WorldModelQueryResponse {
  ok: true;
  query: string;
  results: Array<{
    id: string;
    type: string;
    label: string;
    domain: string;
    score: number;
    properties: Record<string, unknown>;
  }>;
  total: number;
  queryMs: number;
}

export const SignalRequestSchema = z.object({
  content: z.string().min(1).max(4096),
  domain: z.string().optional(),
  source: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type SignalRequest = z.infer<typeof SignalRequestSchema>;

export interface SignalResponse {
  ok: true;
  factId: string;
  guardianResult: {
    allowed: boolean;
    violatedRules: string[];
  };
  nodeCreated: boolean;
  createdAt: string;
}

// ─── Knowledge Graph ─────────────────────────────────────────────────────────

export const KnowledgeGraphBuildRequestSchema = z.object({
  nodes: z.array(z.object({
    type: z.string(),
    label: z.string(),
    domain: z.string().optional(),
    properties: z.record(z.unknown()).optional(),
  })),
  edges: z.array(z.object({
    from: z.string(),
    to: z.string(),
    type: z.string(),
    properties: z.record(z.unknown()).optional(),
  })).optional(),
});

export type KnowledgeGraphBuildRequest = z.infer<typeof KnowledgeGraphBuildRequestSchema>;

// ─── Memory ──────────────────────────────────────────────────────────────────

export const MemoryDesignRequestSchema = z.object({
  description: z.string().min(1).max(2048),
  context: z.record(z.unknown()).optional(),
  tags: z.array(z.string()).optional(),
});

export type MemoryDesignRequest = z.infer<typeof MemoryDesignRequestSchema>;

// ─── Guardian / Guardrail ─────────────────────────────────────────────────────

export const GuardianCheckRequestSchema = z.object({
  action: z.string().min(1).max(512),
  agent: z.string().optional(),
  context: z.record(z.unknown()).optional(),
  constitutionId: z.string().optional(),
});

export type GuardianCheckRequest = z.infer<typeof GuardianCheckRequestSchema>;

export interface GuardianCheckResponse {
  ok: true;
  allowed: boolean;
  reason: string;
  violatedRules: string[];
  receiptId: string;
  dryRun: true;
  checkedAt: string;
}

// ─── MCP ─────────────────────────────────────────────────────────────────────

export interface McpEnvelope {
  jsonrpc: '2.0';
  id: string | number;
  method: string;
  params?: unknown;
}

export interface McpResult {
  jsonrpc: '2.0';
  id: string | number;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

// ─── Blink / Solana Actions ──────────────────────────────────────────────────

export interface BlinkActionResponse {
  title: string;
  icon: string;
  description: string;
  label: string;
  links?: {
    actions: Array<{
      label: string;
      href: string;
      parameters?: Array<{ name: string; label: string; required?: boolean }>;
    }>;
  };
}
