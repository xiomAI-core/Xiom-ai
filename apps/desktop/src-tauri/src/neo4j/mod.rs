// ──────────────────────────────────────────────────────────────
// XIOM Desktop — Neo4j Connection Manager
// Wraps neo4rs for world model graph operations.
// ──────────────────────────────────────────────────────────────
use anyhow::{anyhow, Result};
use neo4rs::{query, Graph};
use serde::{Deserialize, Serialize};
use std::sync::Arc;

// ─── Public types ─────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NodeData {
    pub id: String,
    pub node_type: String,
    pub domain: String,
    pub label: String,
    pub properties: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EdgeData {
    pub from_id: String,
    pub to_id: String,
    pub rel_type: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorldModelData {
    pub nodes: Vec<NodeData>,
    pub edges: Vec<EdgeData>,
    pub node_count: i64,
    pub edge_count: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GoalData {
    pub id: String,
    pub name: String,
    pub description: String,
    pub progress: f64,
    pub status: String,
    pub priority: i64,
    pub domain: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReceiptData {
    pub id: String,
    pub receipt_number: String,
    pub intent: String,
    pub action: String,
    pub result: String,
    pub policy: String,
    pub hash: String,
    pub prev_hash: String,
    pub is_approved: bool,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Neo4jStatus {
    pub connected: bool,
    pub node_count: i64,
    pub version: String,
}

// ─── Manager ──────────────────────────────────────────────────

pub struct Neo4jManager {
    graph: Arc<Graph>,
}

impl Neo4jManager {
    /// Connect to a running Neo4j instance and verify connectivity.
    pub async fn connect(uri: &str, user: &str, password: &str) -> Result<Self> {
        let graph = Graph::new(uri, user, password)
            .await
            .map_err(|e| anyhow!("Neo4j connect failed: {e}"))?;

        // Verify connectivity
        let mut result = graph
            .execute(query("RETURN 1 AS ping"))
            .await
            .map_err(|e| anyhow!("Neo4j ping failed: {e}"))?;

        result
            .next()
            .await
            .map_err(|e| anyhow!("Neo4j ping result error: {e}"))?
            .ok_or_else(|| anyhow!("Neo4j returned empty ping result"))?;

        tracing::info!("Neo4j connected to {uri}");
        Ok(Self {
            graph: Arc::new(graph),
        })
    }

    /// Returns true if the database is reachable.
    pub async fn health_check(&self) -> Result<bool> {
        let mut result = self
            .graph
            .execute(query("MATCH (n) RETURN count(n) AS count LIMIT 1"))
            .await?;
        Ok(result.next().await.is_ok())
    }

    /// Count of total non-deleted nodes.
    pub async fn count_nodes(&self) -> Result<i64> {
        let mut result = self
            .graph
            .execute(query(
                "MATCH (n) WHERE coalesce(n.isDeleted, false) = false RETURN count(n) AS count",
            ))
            .await?;
        if let Ok(Some(row)) = result.next().await {
            let count: i64 = row.get("count").unwrap_or(0);
            return Ok(count);
        }
        Ok(0)
    }

    /// Count of total active edges.
    pub async fn count_edges(&self) -> Result<i64> {
        let mut result = self
            .graph
            .execute(query("MATCH ()-[r]->() RETURN count(r) AS count"))
            .await?;
        if let Ok(Some(row)) = result.next().await {
            let count: i64 = row.get("count").unwrap_or(0);
            return Ok(count);
        }
        Ok(0)
    }

    /// Get a lightweight world model projection for the graph viewer.
    pub async fn get_world_model_graph(&self, human_id: &str) -> Result<WorldModelData> {
        let node_count = self.count_nodes().await?;
        let edge_count = self.count_edges().await?;

        // Fetch nodes with essential fields
        let mut node_result = self
            .graph
            .execute(
                query(
                    "MATCH (:Human {id: $humanId})-[*0..4]->(n)
                     WHERE coalesce(n.isDeleted, false) = false
                     RETURN DISTINCT
                       coalesce(n.id, '') AS id,
                       coalesce(n.nodeType, labels(n)[0]) AS nodeType,
                       coalesce(n.domain, 'FOUNDATION') AS domain,
                       coalesce(n.name, n.content, n.receiptNumber, n.id) AS label
                     LIMIT 300",
                )
                .param("humanId", human_id),
            )
            .await?;

        let mut nodes = Vec::new();
        while let Ok(Some(row)) = node_result.next().await {
            let id: String = row.get("id").unwrap_or_default();
            if id.is_empty() {
                continue;
            }
            nodes.push(NodeData {
                id,
                node_type: row.get("nodeType").unwrap_or_default(),
                domain: row.get("domain").unwrap_or_default(),
                label: row.get("label").unwrap_or_default(),
                properties: serde_json::Value::Null,
            });
        }

        // Fetch edges
        let mut edge_result = self
            .graph
            .execute(
                query(
                    "MATCH (:Human {id: $humanId})-[*0..4]->(a)-[r]->(b)
                     WHERE coalesce(a.isDeleted, false) = false
                       AND coalesce(b.isDeleted, false) = false
                     RETURN DISTINCT
                       coalesce(a.id, '') AS fromId,
                       coalesce(b.id, '') AS toId,
                       type(r) AS relType
                     LIMIT 500",
                )
                .param("humanId", human_id),
            )
            .await?;

        let mut edges = Vec::new();
        while let Ok(Some(row)) = edge_result.next().await {
            let from_id: String = row.get("fromId").unwrap_or_default();
            let to_id: String = row.get("toId").unwrap_or_default();
            if from_id.is_empty() || to_id.is_empty() {
                continue;
            }
            edges.push(EdgeData {
                from_id,
                to_id,
                rel_type: row.get("relType").unwrap_or_default(),
            });
        }

        Ok(WorldModelData {
            nodes,
            edges,
            node_count,
            edge_count,
        })
    }

    /// Return active goals for a human.
    pub async fn get_active_goals(&self, human_id: &str) -> Result<Vec<GoalData>> {
        let mut result = self
            .graph
            .execute(
                query(
                    "MATCH (:Human {id: $humanId})-[:HAS_GOAL]->(g:Goal)
                     WHERE coalesce(g.isDeleted, false) = false
                       AND g.status IN ['active', 'paused']
                     RETURN g.id          AS id,
                            g.name        AS name,
                            g.description AS description,
                            g.progress    AS progress,
                            g.status      AS status,
                            g.priority    AS priority,
                            g.domain      AS domain
                     ORDER BY g.priority DESC
                     LIMIT 50",
                )
                .param("humanId", human_id),
            )
            .await?;

        let mut goals = Vec::new();
        while let Ok(Some(row)) = result.next().await {
            goals.push(GoalData {
                id:          row.get("id").unwrap_or_default(),
                name:        row.get("name").unwrap_or_default(),
                description: row.get("description").unwrap_or_default(),
                progress:    row.get("progress").unwrap_or(0.0),
                status:      row.get("status").unwrap_or_default(),
                priority:    row.get("priority").unwrap_or(5),
                domain:      row.get("domain").unwrap_or_default(),
            });
        }
        Ok(goals)
    }

    /// Return receipts ordered by creation time.
    pub async fn get_receipts(&self, limit: i64) -> Result<Vec<ReceiptData>> {
        let mut result = self
            .graph
            .execute(
                query(
                    "MATCH (r:Receipt)
                     WHERE coalesce(r.isDeleted, false) = false
                     RETURN r.id            AS id,
                            r.receiptNumber AS receiptNumber,
                            r.intent        AS intent,
                            r.action        AS action,
                            r.result        AS result,
                            r.policy        AS policy,
                            r.hash          AS hash,
                            r.prevHash      AS prevHash,
                            r.isApproved    AS isApproved,
                            r.createdAt     AS createdAt
                     ORDER BY r.createdAt DESC
                     LIMIT $limit",
                )
                .param("limit", limit),
            )
            .await?;

        let mut receipts = Vec::new();
        while let Ok(Some(row)) = result.next().await {
            receipts.push(ReceiptData {
                id:             row.get("id").unwrap_or_default(),
                receipt_number: row.get("receiptNumber").unwrap_or_default(),
                intent:         row.get("intent").unwrap_or_default(),
                action:         row.get("action").unwrap_or_default(),
                result:         row.get("result").unwrap_or_default(),
                policy:         row.get("policy").unwrap_or_default(),
                hash:           row.get("hash").unwrap_or_default(),
                prev_hash:      row.get("prevHash").unwrap_or_default(),
                is_approved:    row.get("isApproved").unwrap_or(false),
                created_at:     row.get("createdAt").unwrap_or_default(),
            });
        }
        Ok(receipts)
    }

    /// Return active policies for a human.
    pub async fn get_active_policies(&self, human_id: &str) -> Result<Vec<serde_json::Value>> {
        let mut result = self
            .graph
            .execute(
                query(
                    "MATCH (:Human {id: $humanId})-[:HAS_RULE]->(p:Policy)
                     WHERE coalesce(p.isDeleted, false) = false
                       AND coalesce(p.isActive, true) = true
                     RETURN p.id            AS id,
                            p.name          AS name,
                            p.description   AS description,
                            p.condition     AS condition,
                            p.effect        AS effect,
                            p.policyVersion AS version,
                            p.approvedBy    AS approvedBy,
                            p.createdAt     AS createdAt
                     ORDER BY p.policyVersion DESC",
                )
                .param("humanId", human_id),
            )
            .await?;

        let mut policies = Vec::new();
        while let Ok(Some(row)) = result.next().await {
            policies.push(serde_json::json!({
                "id":          row.get::<String>("id").unwrap_or_default(),
                "name":        row.get::<String>("name").unwrap_or_default(),
                "description": row.get::<String>("description").unwrap_or_default(),
                "condition":   row.get::<String>("condition").unwrap_or_default(),
                "effect":      row.get::<String>("effect").unwrap_or_default(),
                "version":     row.get::<i64>("version").unwrap_or(1),
                "approvedBy":  row.get::<String>("approvedBy").unwrap_or_default(),
                "createdAt":   row.get::<String>("createdAt").unwrap_or_default(),
            }));
        }
        Ok(policies)
    }

    /// Fulltext search over fact_content index.
    pub async fn search_facts(
        &self,
        search_query: &str,
        limit: i64,
    ) -> Result<Vec<serde_json::Value>> {
        let mut result = self
            .graph
            .execute(
                query(
                    "CALL db.index.fulltext.queryNodes('fact_content', $query)
                     YIELD node AS f, score
                     WHERE coalesce(f.isStale, false) = false
                       AND coalesce(f.isDeleted, false) = false
                     RETURN f.id         AS id,
                            f.content    AS content,
                            f.sourceType AS sourceType,
                            f.createdAt  AS createdAt,
                            score
                     ORDER BY score DESC
                     LIMIT $limit",
                )
                .param("query", search_query)
                .param("limit", limit),
            )
            .await?;

        let mut facts = Vec::new();
        while let Ok(Some(row)) = result.next().await {
            facts.push(serde_json::json!({
                "id":         row.get::<String>("id").unwrap_or_default(),
                "content":    row.get::<String>("content").unwrap_or_default(),
                "sourceType": row.get::<String>("sourceType").unwrap_or_default(),
                "createdAt":  row.get::<String>("createdAt").unwrap_or_default(),
                "score":      row.get::<f64>("score").unwrap_or(0.0),
            }));
        }
        Ok(facts)
    }

    /// Write a new Fact node to the graph.
    pub async fn write_fact(
        &self,
        human_id: &str,
        id: &str,
        content: &str,
        source_type: &str,
        source_ref: Option<&str>,
        now: &str,
    ) -> Result<()> {
        let source_ref_val = source_ref.unwrap_or("");
        self.graph
            .run(
                query(
                    "MATCH (h:Human {id: $humanId})
                     CREATE (f:Fact {
                       id: $id, nodeType: 'Fact', content: $content,
                       sourceType: $sourceType, sourceRef: $sourceRef,
                       isStale: false, domain: 'TRACK',
                       confidence: 1.0, version: 1, isDeleted: false,
                       createdAt: $now, updatedAt: $now
                     })
                     CREATE (h)-[:USED_FACT]->(f)",
                )
                .param("humanId", human_id)
                .param("id", id)
                .param("content", content)
                .param("sourceType", source_type)
                .param("sourceRef", source_ref_val)
                .param("now", now),
            )
            .await
            .map_err(|e| anyhow!("write_fact failed: {e}"))?;
        Ok(())
    }

    /// Write a new Receipt node and return the sequence number.
    pub async fn write_receipt(
        &self,
        human_id: &str,
        id: &str,
        receipt_number: &str,
        intent: &str,
        context: &str,
        policy: &str,
        action: &str,
        result: &str,
        prev_hash: &str,
        hash: &str,
        now: &str,
    ) -> Result<()> {
        self.graph
            .run(
                query(
                    "CREATE (r:Receipt {
                       id: $id, nodeType: 'Receipt',
                       receiptNumber: $receiptNumber,
                       intent: $intent, context: $context,
                       policy: $policy, action: $action, result: $result,
                       prevHash: $prevHash, hash: $hash,
                       isApproved: true, rollbackAvailable: false,
                       domain: 'TRACK', confidence: 1.0,
                       version: 1, isDeleted: false,
                       createdAt: $now, updatedAt: $now
                     })",
                )
                .param("id", id)
                .param("receiptNumber", receipt_number)
                .param("intent", intent)
                .param("context", context)
                .param("policy", policy)
                .param("action", action)
                .param("result", result)
                .param("prevHash", prev_hash)
                .param("hash", hash)
                .param("now", now),
            )
            .await
            .map_err(|e| anyhow!("write_receipt failed: {e}"))?;

        // Link to human if possible
        let _ = self
            .graph
            .run(
                query(
                    "MATCH (h:Human {id: $humanId}), (r:Receipt {id: $id})
                     MERGE (h)-[:HAS_GOAL]->(r)",
                )
                .param("humanId", human_id)
                .param("id", id),
            )
            .await;

        Ok(())
    }

    /// Get the most recent receipt hash for chain linking.
    pub async fn latest_receipt_hash(&self, human_id: &str) -> Result<String> {
        let mut result = self
            .graph
            .execute(
                query(
                    "MATCH (r:Receipt)
                     WHERE r.createdAt IS NOT NULL
                     RETURN r.hash AS hash
                     ORDER BY r.createdAt DESC LIMIT 1",
                )
                .param("humanId", human_id),
            )
            .await?;
        if let Ok(Some(row)) = result.next().await {
            return Ok(row.get("hash").unwrap_or_else(|_| "0".repeat(64)));
        }
        Ok("0".repeat(64))
    }

    /// Count receipts for a given date prefix (for sequential numbering).
    pub async fn count_receipts_today(&self, date_prefix: &str) -> Result<i64> {
        let mut result = self
            .graph
            .execute(
                query(
                    "MATCH (r:Receipt) WHERE r.receiptNumber STARTS WITH $prefix
                     RETURN count(r) AS count",
                )
                .param("prefix", date_prefix),
            )
            .await?;
        if let Ok(Some(row)) = result.next().await {
            return Ok(row.get("count").unwrap_or(0));
        }
        Ok(0)
    }

    /// Fulltext search over goal_search index.
    pub async fn search_goals(
        &self,
        search_query: &str,
        limit: i64,
    ) -> Result<Vec<serde_json::Value>> {
        let mut result = self
            .graph
            .execute(
                query(
                    "CALL db.index.fulltext.queryNodes('goal_search', $query)
                     YIELD node AS g, score
                     WHERE coalesce(g.isDeleted, false) = false
                     RETURN g.id AS id, g.name AS name, g.description AS description,
                            g.domain AS domain, score
                     ORDER BY score DESC
                     LIMIT $limit",
                )
                .param("query", search_query)
                .param("limit", limit),
            )
            .await?;

        let mut goals = Vec::new();
        while let Ok(Some(row)) = result.next().await {
            goals.push(serde_json::json!({
                "id":          row.get::<String>("id").unwrap_or_default(),
                "name":        row.get::<String>("name").unwrap_or_default(),
                "description": row.get::<String>("description").unwrap_or_default(),
                "domain":      row.get::<String>("domain").unwrap_or_default(),
                "score":       row.get::<f64>("score").unwrap_or(0.0),
            }));
        }
        Ok(goals)
    }

    /// Create a Goal linked to Human via HAS_GOAL.
    pub async fn write_goal(
        &self,
        human_id: &str,
        name: &str,
        description: &str,
        priority: i64,
    ) -> Result<String> {
        let id = uuid::Uuid::new_v4().to_string();
        let now = chrono::Utc::now().to_rfc3339();
        self.graph
            .run(
                query(
                    "MATCH (h:Human {id: $humanId})
                     CREATE (g:Goal {
                       id: $id, nodeType: 'Goal', name: $name, description: $description,
                       progress: 0.0, status: 'active', priority: $priority,
                       successCriteria: [], blockers: [],
                       domain: 'VISION', confidence: 1.0, version: 1, isDeleted: false,
                       createdAt: $now, updatedAt: $now
                     })
                     CREATE (h)-[:HAS_GOAL]->(g)",
                )
                .param("humanId", human_id)
                .param("id", id.clone())
                .param("name", name)
                .param("description", description)
                .param("priority", priority)
                .param("now", now),
            )
            .await
            .map_err(|e| anyhow!("write_goal failed: {e}"))?;
        Ok(id)
    }

    /// Create an Action linked via OCCURRED_IN.
    pub async fn write_action(
        &self,
        human_id: &str,
        action_type: &str,
        intent: &str,
        tool_name: &str,
        status: &str,
    ) -> Result<String> {
        let id = uuid::Uuid::new_v4().to_string();
        let now = chrono::Utc::now().to_rfc3339();
        self.graph
            .run(
                query(
                    "MATCH (h:Human {id: $humanId})
                     CREATE (a:Action {
                       id: $id, nodeType: 'Action', actionType: $actionType,
                       intent: $intent, toolName: $toolName,
                       executionStatus: $status, domain: 'EXECUTION',
                       confidence: 1.0, version: 1, isDeleted: false,
                       createdAt: $now, updatedAt: $now
                     })
                     CREATE (a)-[:OCCURRED_IN]->(h)",
                )
                .param("humanId", human_id)
                .param("id", id.clone())
                .param("actionType", action_type)
                .param("intent", intent)
                .param("toolName", tool_name)
                .param("status", status)
                .param("now", now),
            )
            .await
            .map_err(|e| anyhow!("write_action failed: {e}"))?;
        Ok(id)
    }

    pub async fn approve_action(&self, action_id: &str) -> Result<()> {
        let now = chrono::Utc::now().to_rfc3339();
        self.graph
            .run(
                query(
                    "MATCH (a:Action {id: $actionId})
                     SET a.executionStatus = 'approved', a.updatedAt = $now, a.version = coalesce(a.version, 0) + 1",
                )
                .param("actionId", action_id)
                .param("now", now),
            )
            .await
            .map_err(|e| anyhow!("approve_action failed: {e}"))?;
        Ok(())
    }

    pub async fn complete_action(&self, action_id: &str, result: &str) -> Result<()> {
        let now = chrono::Utc::now().to_rfc3339();
        self.graph
            .run(
                query(
                    "MATCH (a:Action {id: $actionId})
                     SET a.executionStatus = 'completed', a.result = $result,
                         a.updatedAt = $now, a.version = coalesce(a.version, 0) + 1",
                )
                .param("actionId", action_id)
                .param("result", result)
                .param("now", now),
            )
            .await
            .map_err(|e| anyhow!("complete_action failed: {e}"))?;
        Ok(())
    }

    /// Proposed actions for a human in the last 24 hours.
    pub async fn get_pending_approvals(&self, human_id: &str) -> Result<Vec<serde_json::Value>> {
        let since = (chrono::Utc::now() - chrono::Duration::hours(24)).to_rfc3339();
        let mut result = self
            .graph
            .execute(
                query(
                    "MATCH (:Human {id: $humanId})<-[:OCCURRED_IN]-(a:Action)
                     WHERE coalesce(a.isDeleted, false) = false
                       AND a.executionStatus = 'proposed'
                       AND a.createdAt > $since
                     RETURN a.id AS id, a.actionType AS actionType, a.intent AS intent,
                            a.toolName AS toolName, a.createdAt AS createdAt
                     ORDER BY a.createdAt DESC",
                )
                .param("humanId", human_id)
                .param("since", since),
            )
            .await?;

        let mut actions = Vec::new();
        while let Ok(Some(row)) = result.next().await {
            actions.push(serde_json::json!({
                "id":         row.get::<String>("id").unwrap_or_default(),
                "actionType": row.get::<String>("actionType").unwrap_or_default(),
                "intent":     row.get::<String>("intent").unwrap_or_default(),
                "toolName":   row.get::<String>("toolName").unwrap_or_default(),
                "createdAt":  row.get::<String>("createdAt").unwrap_or_default(),
            }));
        }
        Ok(actions)
    }

    /// Return the Neo4j server version string.
    pub async fn get_version(&self) -> String {
        let mut result = match self
            .graph
            .execute(query("CALL dbms.components() YIELD versions RETURN versions[0] AS v"))
            .await
        {
            Ok(r) => r,
            Err(_) => return "unknown".to_string(),
        };
        if let Ok(Some(row)) = result.next().await {
            row.get::<String>("v").unwrap_or_else(|_| "unknown".to_string())
        } else {
            "unknown".to_string()
        }
    }
}
