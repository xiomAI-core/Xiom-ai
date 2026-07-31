/**
 * Drizzle ORM Schema — XIOM PostgreSQL tables
 */
import {
  pgTable,
  text,
  timestamp,
  boolean,
  integer,
  jsonb,
  uuid,
  varchar,
  bigint,
  numeric,
  index,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// ─── Users ─────────────────────────────────────────────────────
export const users = pgTable('users', {
  id:         uuid('id').primaryKey().defaultRandom(),
  address:    varchar('address', { length: 42 }).notNull().unique(),
  name:       varchar('name', { length: 64 }),
  tier:       varchar('tier', { length: 16 }).notNull().default('free'),
  createdAt:  timestamp('created_at').notNull().defaultNow(),
  updatedAt:  timestamp('updated_at').notNull().defaultNow(),
}, (t) => ({
  addressIdx: index('users_address_idx').on(t.address),
}));

// ─── Receipts ──────────────────────────────────────────────────
export const receipts = pgTable('receipts', {
  id:          uuid('id').primaryKey().defaultRandom(),
  userId:      uuid('user_id').references(() => users.id).notNull(),
  action:      text('action').notNull(),
  agent:       varchar('agent', { length: 128 }),
  allowed:     boolean('allowed').notNull(),
  hash:        varchar('hash', { length: 64 }).notNull(),
  chainTxHash: varchar('chain_tx_hash', { length: 66 }),
  metadata:    jsonb('metadata'),
  createdAt:   timestamp('created_at').notNull().defaultNow(),
}, (t) => ({
  userIdx:    index('receipts_user_idx').on(t.userId),
  createdIdx: index('receipts_created_idx').on(t.createdAt),
}));

// ─── Constitutional Rules ──────────────────────────────────────
export const rules = pgTable('rules', {
  id:          uuid('id').primaryKey().defaultRandom(),
  userId:      uuid('user_id').references(() => users.id).notNull(),
  name:        varchar('name', { length: 128 }).notNull(),
  description: text('description'),
  condition:   text('condition').notNull(),
  priority:    integer('priority').notNull().default(0),
  enabled:     boolean('enabled').notNull().default(true),
  createdAt:   timestamp('created_at').notNull().defaultNow(),
  updatedAt:   timestamp('updated_at').notNull().defaultNow(),
});

// ─── Revenue ───────────────────────────────────────────────────
export const revenueEvents = pgTable('revenue_events', {
  id:        uuid('id').primaryKey().defaultRandom(),
  source:    varchar('source', { length: 32 }).notNull(),
  amountRaw: bigint('amount_raw', { mode: 'bigint' }).notNull(),
  txHash:    varchar('tx_hash', { length: 66 }),
  metadata:  jsonb('metadata'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// ─── Token snapshots ───────────────────────────────────────────
export const tokenSnapshots = pgTable('token_snapshots', {
  id:          uuid('id').primaryKey().defaultRandom(),
  priceUsd:    text('price_usd'),
  holderCount: integer('holder_count'),
  metadata:    jsonb('metadata'),
  snapshotAt:  timestamp('snapshot_at').notNull().defaultNow(),
});

// ─── Intakes ───────────────────────────────────────────────────────
export const intakes = pgTable('intakes', {
  id:                  text('id').primaryKey(), // ULID
  lane:                text('lane').notNull(), // 'human' | 'agent' | 'enterprise'
  email:               text('email'),
  organizationName:    text('organization_name'),
  useCase:             text('use_case'),
  agentId:             text('agent_id'),
  operatorAddress:     text('operator_address'),
  consentGiven:        boolean('consent_given').notNull().default(false),
  status:              text('status').notNull().default('pending'),
  provisioningCapsule: jsonb('provisioning_capsule'),
  createdAt:           timestamp('created_at').defaultNow().notNull(),
  activatedAt:         timestamp('activated_at'),
}, (t) => ({
  idxIntakesLane:    index('idx_intakes_lane').on(t.lane),
  idxIntakesCreated: index('idx_intakes_created').on(t.createdAt),
}));

// ─── Agent Access Quotes ────────────────────────────────────────────
export const agentAccessQuotes = pgTable('agent_access_quotes', {
  id:                     uuid('id').primaryKey().defaultRandom(),
  planId:                 text('plan_id').notNull(),
  payerAddress:           text('payer_address').notNull(),
  agentId:                text('agent_id'),
  callbackUrl:            text('callback_url'),
  amount:                 numeric('amount', { precision: 18, scale: 6 }).notNull(),
  currency:               text('currency').notNull().default('USDG'),
  network:                text('network').notNull().default('robinhood_chain'),
  quoteHash:              text('quote_hash').notNull(),
  paymentRequirementHash: text('payment_requirement_hash').notNull(),
  signature:              text('signature').notNull(),
  status:                 text('status').notNull().default('pending'),
  expiresAt:              timestamp('expires_at').notNull(),
  createdAt:              timestamp('created_at').defaultNow().notNull(),
}, (t) => ({
  idxQuotesPayer:  index('idx_quotes_payer').on(t.payerAddress),
  idxQuotesStatus: index('idx_quotes_status').on(t.status),
}));

// ─── Agent Access Claims ────────────────────────────────────────────
export const agentAccessClaims = pgTable('agent_access_claims', {
  id:               uuid('id').primaryKey().defaultRandom(),
  quoteId:          uuid('quote_id').notNull().references(() => agentAccessQuotes.id),
  transactionHash:  text('transaction_hash').notNull().unique(),
  planId:           text('plan_id').notNull(),
  payerAddress:     text('payer_address').notNull(),
  jwtToken:         text('jwt_token').notNull(),
  apiKeyHash:       text('api_key_hash').notNull(),
  activationPacket: jsonb('activation_packet'),
  expiresAt:        timestamp('expires_at').notNull(),
  createdAt:        timestamp('created_at').defaultNow().notNull(),
}, (t) => ({
  idxClaimsPayer: index('idx_claims_payer').on(t.payerAddress),
}));

// ─── API Credentials ────────────────────────────────────────────────
export const apiCredentials = pgTable('api_credentials', {
  id:         uuid('id').primaryKey().defaultRandom(),
  humanId:    text('human_id').notNull(),
  claimId:    uuid('claim_id').references(() => agentAccessClaims.id),
  apiKeyHash: text('api_key_hash').notNull(),
  isActive:   boolean('is_active').notNull().default(true),
  dailyQuota: integer('daily_quota').notNull().default(1000),
  usedToday:  integer('used_today').notNull().default(0),
  planId:     text('plan_id').notNull(),
  expiresAt:  timestamp('expires_at'),
  createdAt:  timestamp('created_at').defaultNow().notNull(),
}, (t) => ({
  idxCredsHuman:  index('idx_creds_human').on(t.humanId),
  idxCredsActive: index('idx_creds_active').on(t.isActive),
}));

// ─── Holder Snapshots ───────────────────────────────────────────────
export const holderSnapshots = pgTable('holder_snapshots', {
  id:          uuid('id').primaryKey().defaultRandom(),
  snapshotAt:  timestamp('snapshot_at').defaultNow().notNull(),
  holderCount: integer('holder_count').notNull(),
  topHolders:  jsonb('top_holders'),
  source:      text('source').notNull().default('blockscout'),
  chainId:     integer('chain_id').notNull().default(4663),
});

// ─── Loops (Phase 5 Evolve — scheduled agent loops) ──────────────────
export const loops = pgTable('loops', {
  id:              uuid('id').primaryKey().defaultRandom(),
  humanId:         text('human_id').notNull(),
  name:            text('name').notNull(),
  schedule:        text('schedule').notNull(), // cron
  triggerType:     text('trigger_type').notNull().default('schedule'), // schedule | event | threshold
  triggerConfig:   jsonb('trigger_config').$type<Record<string, unknown>>().default({}),
  actionToolName:  text('action_tool_name').notNull(),
  actionToolInput: jsonb('action_tool_input').$type<Record<string, unknown>>().default({}),
  authorityLevel:  text('authority_level').notNull().default('supervised'),
  lastRunAt:       timestamp('last_run_at'),
  nextRunAt:       timestamp('next_run_at').notNull(),
  isActive:        boolean('is_active').notNull().default(true),
  runCount:        integer('run_count').notNull().default(0),
  successCount:    integer('success_count').notNull().default(0),
  failureCount:    integer('failure_count').notNull().default(0),
  createdAt:       timestamp('created_at').defaultNow().notNull(),
}, (t) => ({
  humanIdx: index('idx_loops_human').on(t.humanId),
  dueIdx:   index('idx_loops_due').on(t.isActive, t.nextRunAt),
}));

// ─── Relations ─────────────────────────────────────────────────────────────
export const usersRelations = relations(users, ({ many }) => ({
  receipts: many(receipts),
  rules:    many(rules),
}));

export const receiptsRelations = relations(receipts, ({ one }) => ({
  user: one(users, { fields: [receipts.userId], references: [users.id] }),
}));

export const rulesRelations = relations(rules, ({ one }) => ({
  user: one(users, { fields: [rules.userId], references: [users.id] }),
}));

export const agentAccessClaimsRelations = relations(agentAccessClaims, ({ one }) => ({
  quote: one(agentAccessQuotes, { fields: [agentAccessClaims.quoteId], references: [agentAccessQuotes.id] }),
}));

export const apiCredentialsRelations = relations(apiCredentials, ({ one }) => ({
  claim: one(agentAccessClaims, { fields: [apiCredentials.claimId], references: [agentAccessClaims.id] }),
}));
