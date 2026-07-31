// ──────────────────────────────────────────────────────────────
// XIOM Desktop — Global Zustand Store
// ──────────────────────────────────────────────────────────────
import { create } from 'zustand';
import type {
  AppHealth,
  AuthorityLevel,
  GoalData,
  Neo4jStatus,
  ReceiptData,
  SessionSummary,
  WorldModelProjection,
} from '../types/index.js';

interface AppStore {
  // ─── View routing ─────────────────────────────────────────
  activeView: string;
  setActiveView: (view: string) => void;

  // ─── Neo4j ────────────────────────────────────────────────
  neo4jStatus: Neo4jStatus | null;
  setNeo4jStatus: (s: Neo4jStatus) => void;

  // ─── Settings ─────────────────────────────────────────────
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

  // ─── Dashboard data ───────────────────────────────────────
  projection: WorldModelProjection | null;
  health: AppHealth | null;
  goals: GoalData[];
  setProjection: (p: WorldModelProjection) => void;
  setHealth: (h: AppHealth) => void;
  setGoals: (goals: GoalData[]) => void;

  // ─── Sessions ─────────────────────────────────────────────
  sessions: SessionSummary[];
  selectedSessionId: string | null;
  setSessions: (sessions: SessionSummary[]) => void;
  setSelectedSessionId: (id: string | null) => void;

  // ─── Receipts ─────────────────────────────────────────────
  receipts: ReceiptData[];
  setReceipts: (receipts: ReceiptData[]) => void;

  // ─── Notifications ────────────────────────────────────────
  toasts: Array<{ id: string; message: string; type: 'success' | 'error' | 'info' }>;
  pushToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  dismissToast: (id: string) => void;
}

export const useAppStore = create<AppStore>((set) => ({
  // ─── View routing ─────────────────────────────────────────
  activeView: 'Dashboard',
  setActiveView: (view) => set({ activeView: view }),

  // ─── Neo4j ────────────────────────────────────────────────
  neo4jStatus: null,
  setNeo4jStatus: (neo4jStatus) => set({ neo4jStatus }),

  // ─── Settings defaults ────────────────────────────────────
  neo4jUri:       'bolt://localhost:7687',
  neo4jUser:      'neo4j',
  mcpPort:        54321,
  mcpRunning:     false,
  authorityLevel: 'supervised',
  humanId:        '',
  setNeo4jUri:        (neo4jUri)       => set({ neo4jUri }),
  setNeo4jUser:       (neo4jUser)      => set({ neo4jUser }),
  setMcpPort:         (mcpPort)        => set({ mcpPort }),
  setMcpRunning:      (mcpRunning)     => set({ mcpRunning }),
  setAuthorityLevel:  (authorityLevel) => set({ authorityLevel }),
  setHumanId:         (humanId)        => set({ humanId }),

  // ─── Dashboard data ───────────────────────────────────────
  projection: null,
  health: null,
  goals: [],
  setProjection: (projection) => set({ projection }),
  setHealth:     (health)     => set({ health }),
  setGoals:      (goals)      => set({ goals }),

  // ─── Sessions ─────────────────────────────────────────────
  sessions: [],
  selectedSessionId: null,
  setSessions:          (sessions)          => set({ sessions }),
  setSelectedSessionId: (selectedSessionId) => set({ selectedSessionId }),

  // ─── Receipts ─────────────────────────────────────────────
  receipts: [],
  setReceipts: (receipts) => set({ receipts }),

  // ─── Toasts ───────────────────────────────────────────────
  toasts: [],
  pushToast: (message, type = 'info') =>
    set((s) => ({
      toasts: [
        ...s.toasts,
        { id: `${Date.now()}-${Math.random()}`, message, type },
      ],
    })),
  dismissToast: (id) =>
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));
