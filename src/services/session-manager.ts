import { SessionInfo } from '../types/index.js';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';

/**
 * Manages active SSE sessions
 */
export class SessionManager {
  private sessions = new Map<string, SessionInfo>();
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    // Set up periodic cleanup
    this.cleanupInterval = setInterval(
      () => this.cleanupExpiredSessions(),
      config.sessionCleanupInterval
    );
  }

  /**
   * Add a new session
   */
  addSession(sessionId: string, session: SessionInfo): void {
    this.sessions.set(sessionId, session);
    logger.info('Session added', { sessionId, clientId: session.clientId });
  }

  /**
   * Get a session by ID
   */
  getSession(sessionId: string): SessionInfo | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Find a session by client ID (most recent)
   */
  findSessionByClient(clientId: string): SessionInfo | undefined {
    for (const session of this.sessions.values()) {
      if (session.clientId === clientId) {
        return session;
      }
    }
    return undefined;
  }

  /**
   * Remove a session
   */
  removeSession(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (session) {
      logger.info('Session removed', { sessionId, clientId: session.clientId });
    }
    return this.sessions.delete(sessionId);
  }

  /**
   * Get the number of active sessions
   */
  getSessionCount(): number {
    return this.sessions.size;
  }

  /**
   * Clean up expired sessions
   */
  private cleanupExpiredSessions(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [id, session] of this.sessions.entries()) {
      if (now - session.createdAt.getTime() > config.sessionTimeout) {
        this.sessions.delete(id);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      logger.info('Cleaned up expired sessions', { count: cleaned });
    }
  }

  /**
   * Stop the cleanup interval
   */
  stop(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }
}

// Export singleton instance
export const sessionManager = new SessionManager();