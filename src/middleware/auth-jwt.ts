import { Request, Response, NextFunction } from 'express';
import { authService, Permission } from '../services/auth.js';
import { AuthenticationError } from '../errors/index.js';
import { logger } from '../utils/logger.js';

/**
 * JWT authentication middleware
 */
export function jwtAuthMiddleware(
  requiredPermission: Permission = 'read'
): (req: Request, res: Response, next: NextFunction) => void {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      // Skip auth for health check and root
      if (req.path === '/' || req.path === '/health') {
        return next();
      }

      // Extract token from Authorization header
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        throw new AuthenticationError('Missing authorization header');
      }

      const [type, token] = authHeader.split(' ');
      if (type !== 'Bearer' || !token) {
        throw new AuthenticationError('Invalid authorization header format');
      }

      // Verify token
      const payload = authService.verifyAccessToken(token);
      
      // Check permissions
      if (!authService.hasPermission(payload, requiredPermission)) {
        throw new AuthenticationError(
          `Insufficient permissions. Required: ${requiredPermission}`
        );
      }

      // Attach auth info to request
      req.auth = {
        apiKeyId: payload.sub,
        permissions: payload.permissions,
        jti: payload.jti,
      };

      logger.debug('Request authenticated', {
        apiKeyId: payload.sub,
        permissions: payload.permissions,
        path: req.path,
      });

      next();
    } catch (error) {
      if (error instanceof AuthenticationError) {
        res.status(401).json({ error: error.message });
      } else {
        logger.error('Authentication error', error);
        res.status(500).json({ error: 'Authentication failed' });
      }
    }
  };
}

/**
 * API key authentication middleware (for backward compatibility)
 */
export function apiKeyAuthMiddleware(req: Request, res: Response, next: NextFunction): void {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      throw new AuthenticationError('Missing authorization header');
    }

    const [type, key] = authHeader.split(' ');
    if (type !== 'ApiKey' || !key) {
      // Try JWT auth as fallback
      return jwtAuthMiddleware('read')(req, res, next);
    }

    // Validate API key format
    if (!authService.isValidApiKeyFormat(key)) {
      throw new AuthenticationError('Invalid API key format');
    }

    // In a real implementation, look up the API key in the database
    // For now, we'll create a temporary auth context
    req.auth = {
      apiKeyId: 'legacy_api_key',
      permissions: ['read', 'write', 'delete'],
      jti: 'legacy',
    };

    next();
  } catch (error) {
    if (error instanceof AuthenticationError) {
      res.status(401).json({ error: error.message });
    } else {
      logger.error('API key authentication error', error);
      res.status(500).json({ error: 'Authentication failed' });
    }
  }
}

/**
 * Token refresh endpoint middleware
 */
export async function refreshTokenMiddleware(
  req: Request, 
  res: Response
): Promise<void> {
  try {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      throw new AuthenticationError('Missing refresh token');
    }

    const tokens = authService.refreshAccessToken(refreshToken);
    
    res.json({
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      tokenType: 'Bearer',
      expiresIn: 900, // 15 minutes
    });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      res.status(401).json({ error: error.message });
    } else {
      logger.error('Token refresh error', error);
      res.status(500).json({ error: 'Token refresh failed' });
    }
  }
}