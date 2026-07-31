import type { AppHealth, ContextCapsule, GoalData, GuardianInput, GuardianResult, Message, Neo4jStatus, ReceiptData, SessionSummary, WorldModelGraphData, WorldModelProjection } from '../types/index.js';
export declare const connectNeo4j: (uri: string, user: string, password: string) => Promise<boolean>;
export declare const getNeo4jStatus: () => Promise<Neo4jStatus>;
export declare const getWorldModelProjection: () => Promise<WorldModelProjection>;
export declare const getWorldModelGraph: () => Promise<WorldModelGraphData>;
export declare const getContextCapsule: () => Promise<ContextCapsule>;
export declare const getActiveGoals: () => Promise<GoalData[]>;
export declare const createSession: (provider: string) => Promise<string>;
export declare const getSessionHistory: (sessionId: string, limit?: number) => Promise<Message[]>;
export declare const getSessionList: () => Promise<SessionSummary[]>;
export declare const getReceiptChain: (limit?: number) => Promise<ReceiptData[]>;
export declare const startMcpServer: (port?: number) => Promise<number>;
export declare const stopMcpServer: () => Promise<void>;
export declare const runGuardianCheck: (input: GuardianInput) => Promise<GuardianResult>;
export declare const getAppHealth: () => Promise<AppHealth>;
//# sourceMappingURL=useTauri.d.ts.map