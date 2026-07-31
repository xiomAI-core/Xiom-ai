// ──────────────────────────────────────────────────────────────
// XIOM World Model — Domain Taxonomy & Authority Levels
// ──────────────────────────────────────────────────────────────

/**
 * The 7 domains of the XIOM world model.
 * Every node belongs to exactly one domain.
 */
export enum WorldModelDomain {
  /** Identity, values, constraints — the "who I am" layer */
  FOUNDATION = 'FOUNDATION',
  /** Long-term goals, desired futures — the "where I'm going" layer */
  VISION = 'VISION',
  /** Plans, frameworks, approaches — the "how I'll get there" layer */
  STRATEGY = 'STRATEGY',
  /** Tasks, projects, concrete steps — the "what I'm doing" layer */
  TACTICS = 'TACTICS',
  /** Actions taken, in-progress work, tool calls — the "doing it now" layer */
  EXECUTION = 'EXECUTION',
  /** Outcomes, metrics, receipts, history — the "what happened" layer */
  TRACK = 'TRACK',
  /** User model, preferences, policy evolution — the "co-evolution" layer */
  SYMBIOSIS = 'SYMBIOSIS',
}

/**
 * Authority levels granted to AI agents operating within the world model.
 * Each level is a strict superset of permissions from the one below.
 */
export enum AuthorityLevel {
  /** Read-only observer — can only write TRACK domain nodes */
  OBSERVE = 'observe',
  /** Can suggest actions — no direct writes to EXECUTION domain */
  SUGGEST = 'suggest',
  /** Full read/write — but EXECUTION domain writes require human approval */
  CONFIRM = 'confirm',
  /** All operations allowed — but EXECUTE_ACTION always requires human approval */
  SUPERVISED = 'supervised',
  /** Fully autonomous — individual policies may still gate specific operations */
  AUTONOMOUS = 'autonomous',
}
