// ──────────────────────────────────────────────────────────────
// Injectable SessionStore — in-memory default for Node MCP
// Desktop injects a SQLite-backed implementation.
// ──────────────────────────────────────────────────────────────
import type { SessionManifestSummary, SessionMessage, SessionStore } from './types.js';

export class InMemorySessionStore implements SessionStore {
  private messages = new Map<string, SessionMessage[]>();
  private sessionCount = 0;
  private lastSessionAt = '';

  seedSession(sessionId: string, messages: SessionMessage[]): void {
    this.messages.set(sessionId, [...messages]);
    this.sessionCount = Math.max(this.sessionCount, 1);
    const last = messages[messages.length - 1];
    if (last) this.lastSessionAt = last.timestamp;
  }

  async getSessionHistory(sessionId: string, limit: number): Promise<SessionMessage[]> {
    const all = this.messages.get(sessionId) ?? [];
    return all.slice(-limit);
  }

  async getSessionManifestSummary(): Promise<SessionManifestSummary> {
    const previousSessions = this.sessionCount;
    const hasHistory = previousSessions > 0 && this.lastSessionAt !== '';
    return {
      previousSessions,
      lastSessionAt: this.lastSessionAt || new Date(0).toISOString(),
      continuityScore: hasHistory ? Math.min(1, 0.4 + previousSessions * 0.1) : 0.2,
    };
  }

  async countPreviousSessions(): Promise<number> {
    return this.sessionCount;
  }

  recordSessionStarted(at = new Date().toISOString()): void {
    this.sessionCount += 1;
    this.lastSessionAt = at;
  }
}

export function createDefaultSessionStore(): SessionStore {
  return new InMemorySessionStore();
}
