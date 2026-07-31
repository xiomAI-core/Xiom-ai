// ──────────────────────────────────────────────────────────────
// XIOM — Shared TypeScript Types
// ──────────────────────────────────────────────────────────────

// ─── User / Identity ───────────────────────────────────────────
export interface XiomUser {
  id: string;
  address: `0x${string}`;
  name?: string;
  createdAt: string;
  tier: 'free' | 'pro' | 'enterprise';
}

// ─── World Model ───────────────────────────────────────────────
export interface WorldModelNode {
  id: string;
  type: string;
  label: string;
  properties: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface WorldModelEdge {
  id: string;
  from: string;
  to: string;
  type: string;
  properties?: Record<string, unknown>;
}

export interface WorldModelGraph {
  nodes: WorldModelNode[];
  edges: WorldModelEdge[];
  meta?: { count: number; queried_at: string };
}

// ─── Guardian / Policy ─────────────────────────────────────────
export interface ConstitutionalRule {
  id: string;
  name: string;
  description: string;
  condition: string;
  priority: number;
  enabled: boolean;
}

export interface PolicyCheck {
  action: string;
  agent?: string;
  context?: Record<string, unknown>;
  constitutionId?: string;
}

export interface PolicyOutcome {
  allowed: boolean;
  reason: string;
  violatedRules: string[];
  receiptId: string;
  timestamp: string;
}

// ─── Receipts ──────────────────────────────────────────────────
export interface XiomReceipt {
  id: string;
  action: string;
  agent?: string;
  allowed: boolean;
  hash: string;
  chainTxHash?: `0x${string}`;
  timestamp: string;
  signature?: string;
}

// ─── MCP ───────────────────────────────────────────────────────
export interface McpTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export interface McpRequest {
  jsonrpc: '2.0';
  id: string | number;
  method: string;
  params?: unknown;
}

export interface McpResponse {
  jsonrpc: '2.0';
  id: string | number;
  result?: unknown;
  error?: { code: number; message: string };
}

// ─── Blockchain ────────────────────────────────────────────────
export interface TokenInfo {
  symbol: string;
  name: string;
  address: `0x${string}`;
  chain: string;
  chainId: number;
  decimals: number;
}

export interface BidWallState {
  totalDeposited: bigint;
  currentBid: bigint;
  topBidder: `0x${string}` | null;
}

// ─── x402 ──────────────────────────────────────────────────────
export interface X402PaymentRequest {
  x402Version: number;
  scheme: 'exact' | 'upto';
  network: string;
  maxAmountRequired: string;
  resource: string;
  description?: string;
}

export interface X402PaymentProof {
  txHash: `0x${string}`;
  from: `0x${string}`;
  amount: string;
  timestamp: string;
}

// ─── API Responses ─────────────────────────────────────────────
export interface ApiError {
  error: string;
  code?: string;
  details?: unknown;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}
