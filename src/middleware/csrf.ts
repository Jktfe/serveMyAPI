import { Request, Response, NextFunction, CookieOptions } from 'express';
import crypto from 'crypto';
import { AuthenticationError } from '../errors/index.js';
import { secureSessionManager } from '../services/secure-session-manager.js';
import { logger } from '../utils/logger.js';

// CSRF token header name
const CSRF_HEADER = 'x-csrf-token';
const CSRF_COOKIE = 'csrf-token';

/**
 * CSRF Protection Middleware
 */
export class CsrfProtection {
  private readonly safeMethods = ['GET', 'HEAD', 'OPTIONS'];
  private readonly cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict' as const,
    maxAge: 3600000, // 1 hour
  };

  /**
   * Generate CSRF token middleware
   */
  generateToken() {
    return (req: Request, res: Response, next: NextFunction) => {
      // Skip for safe methods
      if (this.safeMethods.includes(req.method)) {
        return next();
      }

      // Get session if exists
      const sessionId = req.headers['x-session-id'] as string;
      const session = sessionId 
        ? secureSessionManager.getSession(sessionId)
        : undefined;

      if (!session) {
        return next(new AuthenticationError('Invalid session'));
      }

      // Set CSRF token in response header and cookie
      res.setHeader(CSRF_HEADER, session.csrfToken);
      res.cookie(CSRF_COOKIE, session.csrfToken, this.cookieOptions);

      next();
    };
  }

  /**
   * Validate CSRF token middleware
   */
  validateToken() {
    return (req: Request, res: Response, next: NextFunction) => {
      // Skip validation for safe methods
      if (this.safeMethods.includes(req.method)) {
        return next();
      }

      // Skip for API endpoints that use JWT auth
      if (req.path.startsWith('/api/') && req.headers.authorization?.startsWith('Bearer ')) {
        return next();
      }

      try {
        // Get session
        const sessionId = req.headers['x-session-id'] as string;
        if (!sessionId) {
          throw new AuthenticationError('Missing session ID');
        }

        // Validate session with fingerprint
        secureSessionManager.validateSession(sessionId, req);

        // Get CSRF token from header or body
        const token = req.headers[CSRF_HEADER] as string || 
                     req.body?._csrf || 
                     req.query?._csrf;

        if (!token) {
          throw new AuthenticationError('Missing CSRF token');
        }

        // Validate CSRF token
        secureSessionManager.validateCsrfToken(sessionId, token as string);

        logger.debug('CSRF validation successful', {
          sessionId,
          method: req.method,
          path: req.path,
        });

        next();
      } catch (error) {
        if (error instanceof AuthenticationError) {
          logger.warn('CSRF validation failed', {
            error: error.message,
            method: req.method,
            path: req.path,
            origin: req.headers.origin,
            referer: req.headers.referer,
          });
          
          res.status(403).json({ error: 'CSRF validation failed' });
        } else {
          next(error);
        }
      }
    };
  }

  /**
   * Double submit cookie pattern validation
   */
  doubleSubmitValidation() {
    return (req: Request, res: Response, next: NextFunction) => {
      // Skip for safe methods
      if (this.safeMethods.includes(req.method)) {
        return next();
      }

      const headerToken = req.headers[CSRF_HEADER] as string;
      const cookieToken = req.cookies?.[CSRF_COOKIE];

      if (!headerToken || !cookieToken) {
        return res.status(403).json({ error: 'Missing CSRF token' });
      }

      // Constant-time comparison, length-guarded (timingSafeEqual throws on
      // unequal-length buffers, and the header token length is attacker-controlled).
      const headerBuf = Buffer.from(headerToken);
      const cookieBuf = Buffer.from(cookieToken);
      if (headerBuf.length !== cookieBuf.length || !crypto.timingSafeEqual(headerBuf, cookieBuf)) {
        logger.warn('CSRF double submit validation failed', {
          method: req.method,
          path: req.path,
        });
        
        return res.status(403).json({ error: 'CSRF validation failed' });
      }

      next();
    };
  }

  /**
   * Origin validation middleware
   */
  validateOrigin(allowedOrigins: string[]) {
    return (req: Request, res: Response, next: NextFunction) => {
      // Skip for safe methods
      if (this.safeMethods.includes(req.method)) {
        return next();
      }

      const origin = req.headers.origin || req.headers.referer;

      if (!origin) {
        // Fail closed: an unsafe (state-changing) method with no Origin/Referer
        // cannot be origin-validated, so reject rather than wave it through.
        // Same-origin clients that omit Origin must use the double-submit
        // cookie/header check (doubleSubmitValidation) instead.
        logger.warn('Origin validation failed: missing Origin/Referer', {
          method: req.method,
          path: req.path,
        });
        return res.status(403).json({ error: 'Missing origin' });
      }

      // Parse origin URL
      try {
        const originUrl = new URL(origin);
        const originBase = `${originUrl.protocol}//${originUrl.host}`;
        
        if (!allowedOrigins.includes(originBase)) {
          logger.warn('Origin validation failed', {
            origin: originBase,
            allowedOrigins,
            method: req.method,
            path: req.path,
          });
          
          return res.status(403).json({ error: 'Origin not allowed' });
        }
      } catch {
        logger.error('Invalid origin header', { origin });
        return res.status(403).json({ error: 'Invalid origin' });
      }

      next();
    };
  }

  /**
   * SameSite cookie enforcement
   */
  enforceSameSite() {
    return (req: Request, res: Response, next: NextFunction) => {
      // Override cookie method to enforce SameSite
      const originalCookie = res.cookie.bind(res);
      
      res.cookie = (name: string, value: string, options?: CookieOptions) => {
        options = options || {};
        options.sameSite = options.sameSite || 'strict';
        options.secure = options.secure ?? (process.env.NODE_ENV === 'production');
        options.httpOnly = options.httpOnly ?? true;
        
        return originalCookie(name, value, options);
      };

      next();
    };
  }
}

// Export singleton instance
export const csrfProtection = new CsrfProtection();

/**
 * Apply all CSRF protections
 */
export function applyCsrfProtection(allowedOrigins: string[]) {
  return [
    csrfProtection.enforceSameSite(),
    csrfProtection.generateToken(),
    csrfProtection.validateOrigin(allowedOrigins),
    csrfProtection.validateToken(),
  ];
}