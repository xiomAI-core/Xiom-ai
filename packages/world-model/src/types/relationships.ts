// ──────────────────────────────────────────────────────────────
// XIOM World Model — Relationship Types & Allowed Edge Matrix
// ──────────────────────────────────────────────────────────────

/**
 * All canonical relationship types in the XIOM world model.
 * Use these constants everywhere — never hardcode relationship strings.
 */
export const RELATIONSHIPS = {
  // ─── Human relationships ─────────────────────────────────
  HAS_GOAL:         'HAS_GOAL',
  HAS_RULE:         'HAS_RULE',
  HAS_PATTERN:      'HAS_PATTERN',
  HAS_CONNECTION:   'HAS_CONNECTION',

  // ─── Goal relationships ───────────────────────────────────
  BLOCKED_BY:       'BLOCKED_BY',
  DEPENDS_ON:       'DEPENDS_ON',
  LINKED_TO_ACTION: 'LINKED_TO_ACTION',
  HAS_DEADLINE:     'HAS_DEADLINE',
  ACHIEVED_BY:      'ACHIEVED_BY',

  // ─── Action relationships ─────────────────────────────────
  GENERATED_RECEIPT: 'GENERATED_RECEIPT',
  GOVERNED_BY:       'GOVERNED_BY',
  OCCURRED_IN:       'OCCURRED_IN',
  USED_FACT:         'USED_FACT',

  // ─── Fact relationships ───────────────────────────────────
  SOURCED_FROM:    'SOURCED_FROM',
  INFORMS_DECISION:'INFORMS_DECISION',
  CONTRADICTS:     'CONTRADICTS',
  SUPPORTS:        'SUPPORTS',

  // ─── Policy relationships ─────────────────────────────────
  EVOLVED_FROM:    'EVOLVED_FROM',
  TRIGGERED_BY:    'TRIGGERED_BY',
  GOVERNS_ACTION:  'GOVERNS_ACTION',

  // ─── Audit hash-chain relationships ───────────────────────
  FOLLOWS:     'FOLLOWS',      // AuditEntry → previous AuditEntry
  REFERENCES:  'REFERENCES',   // AuditEntry → any node

  // ─── Pattern relationships ────────────────────────────────
  DETECTED_IN: 'DETECTED_IN',  // Pattern → Session
  INFLUENCES:  'INFLUENCES',   // Pattern → Policy

  // ─── Insight relationships ────────────────────────────────
  DERIVED_FROM: 'DERIVED_FROM',
  LEADS_TO:     'LEADS_TO',
} as const;

export type RelationshipType = typeof RELATIONSHIPS[keyof typeof RELATIONSHIPS];

// ─── Allowed Edge Matrix ──────────────────────────────────────

/**
 * Defines which node types can be connected via each relationship type.
 * Layer 3 of the Guardian enforces this matrix on every CREATE_EDGE operation.
 */
export const ALLOWED_EDGES: Record<string, { from: string[]; to: string[] }> = {
  // Human outgoing
  HAS_GOAL:         { from: ['Human'],  to: ['Goal'] },
  HAS_RULE:         { from: ['Human'],  to: ['Rule', 'Policy'] },
  HAS_PATTERN:      { from: ['Human'],  to: ['Pattern'] },
  HAS_CONNECTION:   { from: ['Human'],  to: ['Connection'] },

  // Goal relationships
  BLOCKED_BY:       { from: ['Goal'],   to: ['Goal', 'Action', 'Deadline'] },
  DEPENDS_ON:       { from: ['Goal'],   to: ['Goal', 'Fact'] },
  LINKED_TO_ACTION: { from: ['Goal'],   to: ['Action'] },
  HAS_DEADLINE:     { from: ['Goal'],   to: ['Deadline'] },
  ACHIEVED_BY:      { from: ['Goal'],   to: ['Action'] },

  // Action relationships
  GENERATED_RECEIPT:{ from: ['Action'], to: ['Receipt'] },
  GOVERNED_BY:      { from: ['Action'], to: ['Policy', 'Rule'] },
  OCCURRED_IN:      { from: ['Action'], to: ['Session', 'Human'] },
  USED_FACT:        { from: ['Action'], to: ['Fact'] },

  // Fact relationships
  SOURCED_FROM:     { from: ['Fact'],   to: ['Session', 'Connection'] },
  INFORMS_DECISION: { from: ['Fact'],   to: ['Action', 'Goal', 'Policy'] },
  CONTRADICTS:      { from: ['Fact'],   to: ['Fact'] },
  SUPPORTS:         { from: ['Fact'],   to: ['Fact', 'Goal', 'Insight'] },

  // Policy relationships
  EVOLVED_FROM:     { from: ['Policy'], to: ['Policy'] },
  TRIGGERED_BY:     { from: ['Policy'], to: ['Action', 'Fact', 'Pattern'] },
  GOVERNS_ACTION:   { from: ['Policy'], to: ['Action'] },

  // Audit hash-chain
  FOLLOWS:          { from: ['AuditEntry'], to: ['AuditEntry'] },
  REFERENCES:       { from: ['AuditEntry'], to: ['Human', 'Goal', 'Action', 'Policy', 'Rule', 'Fact', 'Receipt', 'Pattern', 'Session', 'Deadline', 'Connection', 'Insight'] },

  // Pattern relationships
  DETECTED_IN:      { from: ['Pattern'], to: ['Session'] },
  INFLUENCES:       { from: ['Pattern'], to: ['Policy', 'Rule'] },

  // Insight relationships
  DERIVED_FROM:     { from: ['Insight'], to: ['Fact', 'Action', 'Pattern'] },
  LEADS_TO:         { from: ['Insight'], to: ['Goal', 'Action', 'Policy'] },
};
