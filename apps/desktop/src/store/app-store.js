// ──────────────────────────────────────────────────────────────
// XIOM Desktop — Global Zustand Store
// ──────────────────────────────────────────────────────────────
import { create } from 'zustand';
export const useAppStore = create((set) => ({
    // ─── View routing ─────────────────────────────────────────
    activeView: 'Dashboard',
    setActiveView: (view) => set({ activeView: view }),
    // ─── Neo4j ────────────────────────────────────────────────
    neo4jStatus: null,
    setNeo4jStatus: (neo4jStatus) => set({ neo4jStatus }),
    // ─── Settings defaults ────────────────────────────────────
    neo4jUri: 'bolt://localhost:7687',
    neo4jUser: 'neo4j',
    mcpPort: 54321,
    mcpRunning: false,
    authorityLevel: 'supervised',
    humanId: '',
    setNeo4jUri: (neo4jUri) => set({ neo4jUri }),
    setNeo4jUser: (neo4jUser) => set({ neo4jUser }),
    setMcpPort: (mcpPort) => set({ mcpPort }),
    setMcpRunning: (mcpRunning) => set({ mcpRunning }),
    setAuthorityLevel: (authorityLevel) => set({ authorityLevel }),
    setHumanId: (humanId) => set({ humanId }),
    // ─── Dashboard data ───────────────────────────────────────
    projection: null,
    health: null,
    goals: [],
    setProjection: (projection) => set({ projection }),
    setHealth: (health) => set({ health }),
    setGoals: (goals) => set({ goals }),
    // ─── Sessions ─────────────────────────────────────────────
    sessions: [],
    selectedSessionId: null,
    setSessions: (sessions) => set({ sessions }),
    setSelectedSessionId: (selectedSessionId) => set({ selectedSessionId }),
    // ─── Receipts ─────────────────────────────────────────────
    receipts: [],
    setReceipts: (receipts) => set({ receipts }),
    // ─── Toasts ───────────────────────────────────────────────
    toasts: [],
    pushToast: (message, type = 'info') => set((s) => ({
        toasts: [
            ...s.toasts,
            { id: `${Date.now()}-${Math.random()}`, message, type },
        ],
    })),
    dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));
//# sourceMappingURL=app-store.js.map