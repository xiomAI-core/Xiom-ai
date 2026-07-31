import type { AppHealth, AuthorityLevel, GoalData, Neo4jStatus, ReceiptData, SessionSummary, WorldModelProjection } from '../types/index.js';
interface AppStore {
    activeView: string;
    setActiveView: (view: string) => void;
    neo4jStatus: Neo4jStatus | null;
    setNeo4jStatus: (s: Neo4jStatus) => void;
    neo4jUri: string;
    neo4jUser: string;
    mcpPort: number;
    mcpRunning: boolean;
    authorityLevel: AuthorityLevel;
    humanId: string;
    setNeo4jUri: (uri: string) => void;
    setNeo4jUser: (user: string) => void;
    setMcpPort: (port: number) => void;
    setMcpRunning: (running: boolean) => void;
    setAuthorityLevel: (level: AuthorityLevel) => void;
    setHumanId: (id: string) => void;
    projection: WorldModelProjection | null;
    health: AppHealth | null;
    goals: GoalData[];
    setProjection: (p: WorldModelProjection) => void;
    setHealth: (h: AppHealth) => void;
    setGoals: (goals: GoalData[]) => void;
    sessions: SessionSummary[];
    selectedSessionId: string | null;
    setSessions: (sessions: SessionSummary[]) => void;
    setSelectedSessionId: (id: string | null) => void;
    receipts: ReceiptData[];
    setReceipts: (receipts: ReceiptData[]) => void;
    toasts: Array<{
        id: string;
        message: string;
        type: 'success' | 'error' | 'info';
    }>;
    pushToast: (message: string, type?: 'success' | 'error' | 'info') => void;
    dismissToast: (id: string) => void;
}
export declare const useAppStore: import("zustand").UseBoundStore<import("zustand").StoreApi<AppStore>>;
export {};
//# sourceMappingURL=app-store.d.ts.map