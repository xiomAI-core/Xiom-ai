// ──────────────────────────────────────────────────────────────
// XIOM Desktop — Guardian (Rust mirror of the 9-layer pipeline)
// Used by the MCP server for local policy checks.
// Full enforcement is done in packages/guardian (TypeScript).
// ──────────────────────────────────────────────────────────────
use anyhow::Result;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PolicyCheck {
    pub action: String,
    pub context: serde_json::Value,
    pub authority_level: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PolicyOutcome {
    pub allowed: bool,
    pub reason: String,
    pub violated_rules: Vec<String>,
    pub requires_approval: bool,
    pub warnings: Vec<String>,
}

pub struct Guardian;

impl Guardian {
    pub fn new() -> Self { Self }

    /// Simplified read-only check (layers 4, 5, 6 only).
    pub async fn soft_check(&self, check: &PolicyCheck) -> Result<PolicyOutcome> {
        let mut warnings = Vec::new();

        // Layer 6 — Authority tier
        let requires_approval = matches!(check.authority_level.as_str(), "confirm" | "supervised");

        // Layer 4 — payment block
        if check.action.contains("payment") || check.action.contains("transfer") {
            return Ok(PolicyOutcome {
                allowed: false,
                reason: "Payment operations not permitted on this surface".into(),
                violated_rules: vec!["L4:payment-surface-required".into()],
                requires_approval: false,
                warnings: vec![],
            });
        }

        // AUTONOMOUS: flag for review but allow
        if check.authority_level == "autonomous" {
            warnings.push("Operating at AUTONOMOUS authority level — audit this action".into());
        }

        Ok(PolicyOutcome {
            allowed: true,
            reason: "Soft check passed".into(),
            violated_rules: vec![],
            requires_approval,
            warnings,
        })
    }
}

impl Default for Guardian {
    fn default() -> Self { Self::new() }
}
