const NOW = new Date().toISOString();
const DEMO_GOALS = [
    {
        id: 'goal-1',
        name: 'Ship XIOM onboarding',
        description: 'Complete marketing → app → API flow',
        progress: 0.72,
        status: 'active',
        priority: 1,
        domain: 'EXECUTION',
    },
    {
        id: 'goal-2',
        name: 'Govern agent payments',
        description: 'USDG x402 on Robinhood Chain',
        progress: 0.45,
        status: 'active',
        priority: 2,
        domain: 'STRATEGY',
    },
];
const DEMO_SESSIONS = [
    {
        id: 'sess-claude-001',
        provider: 'claude-code',
        started_at: new Date(Date.now() - 3_600_000).toISOString(),
        message_count: 24,
        is_recoverable: true,
        status: 'active',
    },
    {
        id: 'sess-codex-002',
        provider: 'codex',
        started_at: new Date(Date.now() - 86_400_000).toISOString(),
        ended_at: new Date(Date.now() - 82_800_000).toISOString(),
        message_count: 11,
        is_recoverable: false,
        status: 'closed',
    },
];
const DEMO_RECEIPTS = [
    {
        id: 'rcpt-1',
        receipt_number: '2026-07-30-0001',
        intent: 'world_model.update',
        action: 'merge_fact',
        result: 'approved',
        policy: 'constitutional-v1',
        hash: 'a3f2…9c01',
        prev_hash: 'genesis',
        is_approved: true,
        created_at: NOW,
    },
];
function demoGraph() {
    const nodes = [
        { id: 'n1', node_type: 'Human', domain: 'FOUNDATION', label: 'You' },
        { id: 'n2', node_type: 'Goal', domain: 'EXECUTION', label: 'XIOM Launch' },
        { id: 'n3', node_type: 'Policy', domain: 'SYMBIOSIS', label: 'Guardian L1-9' },
        { id: 'n4', node_type: 'Fact', domain: 'TRACK', label: 'Robinhood Chain' },
        { id: 'n5', node_type: 'Agent', domain: 'TACTICS', label: 'Claude Code' },
    ];
    const edges = [
        { from_id: 'n1', to_id: 'n2', rel_type: 'PURSUES' },
        { from_id: 'n2', to_id: 'n3', rel_type: 'GOVERNED_BY' },
        { from_id: 'n5', to_id: 'n1', rel_type: 'ASSISTS' },
        { from_id: 'n4', to_id: 'n2', rel_type: 'SUPPORTS' },
    ];
    return { nodes, edges, node_count: nodes.length, edge_count: edges.length };
}
export async function mockTauriInvoke(cmd, args) {
    await new Promise((r) => setTimeout(r, 80));
    switch (cmd) {
        case 'get_app_health':
            return {
                neo4j: false,
                sqlite: true,
                mcp: true,
                node_count: 5,
                session_count: DEMO_SESSIONS.length,
            };
        case 'get_neo4j_status':
            return {
                connected: false,
                node_count: 0,
                version: 'not connected (browser dev mode)',
            };
        case 'connect_neo4j':
            return false;
        case 'get_world_model_projection':
            return {
                node_count: 5,
                edge_count: 4,
                active_goal_count: DEMO_GOALS.length,
                active_policy_count: 3,
                generated_at: NOW,
            };
        case 'get_world_model_graph':
            return demoGraph();
        case 'get_context_capsule':
            return {
                human_id: 'demo-human',
                active_goals: DEMO_GOALS,
                recent_facts: [],
                active_policies: [],
                pending_actions: [],
                patterns: [],
                generated_at: NOW,
            };
        case 'get_active_goals':
            return DEMO_GOALS;
        case 'create_session':
            return `sess-${String(args?.['provider'] ?? 'custom')}-${Date.now()}`;
        case 'get_session_list':
            return DEMO_SESSIONS;
        case 'get_session_history': {
            const sessionId = String(args?.['session_id'] ?? 'sess-claude-001');
            const messages = [
                {
                    id: 'm1',
                    session_id: sessionId,
                    role: 'user',
                    content: 'Summarize my active goals.',
                    timestamp: NOW,
                    seq: 1,
                },
                {
                    id: 'm2',
                    session_id: sessionId,
                    role: 'assistant',
                    content: 'You have 2 active goals: XIOM onboarding (72%) and agent payments (45%).',
                    timestamp: NOW,
                    seq: 2,
                },
            ];
            return messages;
        }
        case 'get_receipt_chain':
            return DEMO_RECEIPTS;
        case 'start_mcp_server_cmd':
            return Number(args?.['port'] ?? 54321);
        case 'stop_mcp_server':
            return undefined;
        case 'run_guardian_check': {
            const input = args?.['input'];
            const blocked = input?.operation?.includes('delete');
            return {
                allowed: !blocked,
                requires_human_approval: false,
                denied_layers: blocked ? [3] : [],
                reason: blocked ? 'Destructive action blocked by policy' : '',
                warnings: [],
            };
        }
        default:
            throw new Error(`[browser-dev] Unknown command: ${cmd}`);
    }
}
export function isBrowserDevMode() {
    if (typeof window === 'undefined')
        return false;
    const w = window;
    return !w.__TAURI_INTERNALS__ || w.__XIOM_BROWSER_DEV__ === true;
}
//# sourceMappingURL=tauri-bridge.js.map