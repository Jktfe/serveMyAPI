import crypto from 'crypto';
import { Request } from 'express';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';
import { AuthenticationError } from '../errors/index.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';

export interface SecureSession {
  id: string;
  transport: SSEServerTransport;
  clientId: string;
  fingerprint: string;
  csrfToken: string;
  createdAt: Date;
  lastActivityAt: Date;
  apiKeyId?: string;
  permissions?: string[];
}

interface SessionFingerprint {
  userAgent: string;
  acceptLanguage: string;
  acceptEncoding: string;
  ipAddress: string;
}

/**
 * Secure session manager with fingerprinting and CSRF protection
 */
export class SecureSessionManager {
  private sessions = new Map<string, SecureSession>();
  private sessionsByFingerprint = new Map<string, Set<string>>();
  private cleanupInterval: NodeJS.Timeout;
  
  // Security configurations
  private readonly maxSessionsPerFingerprint = 3;
  private readonly sessionTimeout = config.sessionTimeout;
  private readonly cleanupIntervalMs = config.sessionCleanupInterval;

  constructor() {
    this.cleanupInterval = setInterval(
      () => this.cleanupExpiredSessions(),
      this.cleanupIntervalMs
    );
    // Don't let this periodic timer hold the event loop open on its own — the
    // HTTP server keeps the process alive in production, and tests/CLI can exit
    // cleanly instead of hanging on a stray interval.
    this.cleanupInterval.unref();
  }

  /**
   * Generate secure session ID
   */
  private generateSessionId(): string {
    return crypto.randomBytes(32).toString('base64url');
  }

  /**
   * Generate CSRF token
   */
  private generateCsrfToken(): string {
    return crypto.randomBytes(32).toString('base64url');
  }

  /**
   * Create fingerprint from request
   */
  private createFingerprint(req: Request): SessionFingerprint {
    return {
      userAgent: this.normalizeHeader(req.headers['user-agent']) || 'unknown',
      acceptLanguage: this.normalizeHeader(req.headers['accept-language']) || 'unknown',
      acceptEncoding: this.normalizeHeader(req.headers['accept-encoding']) || 'unknown',
      ipAddress: this.getClientIp(req),
    };
  }

  /**
   * Normalize header value to string
   */
  private normalizeHeader(header: string | string[] | undefined): string | undefined {
    if (!header) return undefined;
    return Array.isArray(header) ? header[0] : header;
  }

  /**
   * Hash fingerprint for comparison
   */
  private hashFingerprint(fingerprint: SessionFingerprint): string {
    const data = JSON.stringify(fingerprint);
    return crypto.createHash('sha256').update(data).digest('base64');
  }

  /**
   * Get client IP.
   *
   * Deliberately does NOT read `X-Forwarded-For` directly — that header is
   * client-settable and trusting it lets an attacker spoof the IP that feeds
   * the session fingerprint. `req.ip` already resolves XFF correctly *only*
   * for hops Express is told to trust via `app.set('trust proxy', ...)`, so
   * the proxy configuration (not this code) decides what is trustworthy.
   */
  private getClientIp(req: Request): string {
    return req.ip || 'unknown';
  }

  /**
   * Create a new secure session
   */
  createSession(req: Request, transport: SSEServerTransport): SecureSession {
    const sessionId = this.generateSessionId();
    const fingerprint = this.createFingerprint(req);
    const fingerprintHash = this.hashFingerprint(fingerprint);
    
    // Check for too many sessions from same fingerprint
    const existingSessions = this.sessionsByFingerprint.get(fingerprintHash) || new Set();
    if (existingSessions.size >= this.maxSessionsPerFingerprint) {
      // Remove oldest session
      const oldestSession = Array.from(existingSessions)
        .map(id => this.sessions.get(id))
        .filter(Boolean)
        .sort((a, b) => a!.createdAt.getTime() - b!.createdAt.getTime())[0];
      
      if (oldestSession) {
        this.removeSession(oldestSession.id);
        logger.warn('Removed oldest session due to limit', {
          fingerprint: fingerprintHash,
          removedSessionId: oldestSession.id,
        });
      }
    }
    
    const session: SecureSession = {
      id: sessionId,
      transport,
      clientId: this.getClientIp(req),
      fingerprint: fingerprintHash,
      csrfToken: this.generateCsrfToken(),
      createdAt: new Date(),
      lastActivityAt: new Date(),
    };
    
    this.sessions.set(sessionId, session);
    
    // Track by fingerprint
    if (!this.sessionsByFingerprint.has(fingerprintHash)) {
      this.sessionsByFingerprint.set(fingerprintHash, new Set());
    }
    this.sessionsByFingerprint.get(fingerprintHash)!.add(sessionId);
    
    logger.info('Secure session created', {
      sessionId,
      fingerprint: fingerprintHash,
      clientId: session.clientId,
    });
    
    return session;
  }

  /**
   * Validate session with fingerprint
   */
  validateSession(sessionId: string, req: Request): SecureSession {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new AuthenticationError('Invalid session');
    }
    
    // Check session timeout
    const now = Date.now();
    if (now - session.lastActivityAt.getTime() > this.sessionTimeout) {
      this.removeSession(sessionId);
      throw new AuthenticationError('Session expired');
    }
    
    // Validate fingerprint
    const currentFingerprint = this.createFingerprint(req);
    const currentFingerprintHash = this.hashFingerprint(currentFingerprint);
    
    if (session.fingerprint !== currentFingerprintHash) {
      logger.warn('Session fingerprint mismatch', {
        sessionId,
        expectedFingerprint: session.fingerprint,
        actualFingerprint: currentFingerprintHash,
      });
      
      this.removeSession(sessionId);
      throw new AuthenticationError('Session validation failed');
    }
    
    // Update last activity
    session.lastActivityAt = new Date();
    
    return session;
  }

  /**
   * Validate CSRF token
   */
  validateCsrfToken(sessionId: string, csrfToken: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new AuthenticationError('Invalid session');
    }
    
    if (!csrfToken || !crypto.timingSafeEqual(
      Buffer.from(session.csrfToken),
      Buffer.from(csrfToken)
    )) {
      throw new AuthenticationError('Invalid CSRF token');
    }
  }

  /**
   * Get session by ID
   */
  getSession(sessionId: string): SecureSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Update session authentication
   */
  updateSessionAuth(
    sessionId: string, 
    apiKeyId: string, 
    permissions: string[]
  ): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.apiKeyId = apiKeyId;
      session.permissions = permissions;
      session.lastActivityAt = new Date();
    }
  }

  /**
   * Remove session
   */
  removeSession(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (session) {
      // Remove from fingerprint tracking
      const fingerprintSessions = this.sessionsByFingerprint.get(session.fingerprint);
      if (fingerprintSessions) {
        fingerprintSessions.delete(sessionId);
        if (fingerprintSessions.size === 0) {
          this.sessionsByFingerprint.delete(session.fingerprint);
        }
      }
      
      logger.info('Session removed', {
        sessionId,
        fingerprint: session.fingerprint,
        duration: Date.now() - session.createdAt.getTime(),
      });
    }
    
    return this.sessions.delete(sessionId);
  }

  /**
   * Clean up expired sessions
   */
  private cleanupExpiredSessions(): void {
    const now = Date.now();
    let cleaned = 0;
    
    for (const [id, session] of this.sessions.entries()) {
      if (now - session.lastActivityAt.getTime() > this.sessionTimeout) {
        this.removeSession(id);
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      logger.info('Cleaned up expired sessions', { count: cleaned });
    }
  }

  /**
   * Get session statistics
   */
  getStats(): {
    totalSessions: number;
    uniqueFingerprints: number;
    sessionsPerFingerprint: Record<string, number>;
  } {
    const sessionsPerFingerprint: Record<string, number> = {};
    
    for (const [fingerprint, sessions] of this.sessionsByFingerprint.entries()) {
      sessionsPerFingerprint[fingerprint] = sessions.size;
    }
    
    return {
      totalSessions: this.sessions.size,
      uniqueFingerprints: this.sessionsByFingerprint.size,
      sessionsPerFingerprint,
    };
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
export const secureSessionManager = new SecureSessionManager();