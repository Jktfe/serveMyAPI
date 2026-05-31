import { Request, Response, NextFunction } from 'express';
import { authService, Permission } from '../services/auth.js';
import { AuthenticationError, ForbiddenError } from '../errors/index.js';
import { logger } from '../utils/logger.js';

export interface JwtAuthOptions {
  permissions?: string[];
  optional?: boolean;
}

/**
 * JWT authentication middleware
 */
export function jwtAuth(options: JwtAuthOptions = {}) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authHeader = req.headers.authorization;
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        if (options.optional) {
          return next();
        }
        throw new AuthenticationError('Missing or invalid authorization header');
      }
      
      const token = authHeader.substring(7);
      
      try {
        // Verify JWT token
        const payload = authService.verifyAccessToken(token);
        
        // Check permissions if required
        if (options.permissions && options.permissions.length > 0) {
          const hasPermission = options.permissions.some(perm => 
            payload.permissions.includes(perm as Permission)
          );
          
          if (!hasPermission) {
            throw new ForbiddenError('Insufficient permissions');
          }
        }
        
        // Attach auth info to request
        req.auth = {
          apiKeyId: payload.sub,
          permissions: payload.permissions,
          jti: payload.jti
        };
        
        logger.debug('JWT authentication successful', {
          apiKeyId: payload.sub,
          permissions: payload.permissions,
          path: req.path
        });
        
        next();
      } catch (error) {
        if (error instanceof Error && error.message.includes('expired')) {
          throw new AuthenticationError('Token expired');
        }
        throw error;
      }
    } catch (error) {
      if (error instanceof AuthenticationError || error instanceof ForbiddenError) {
        logger.warn('JWT authentication failed', {
          error: error.message,
          path: req.path,
          ip: req.ip
        });
        
        res.status(error.statusCode).json({
          error: error.message,
          code: error.code
        });
      } else {
        next(error as Error);
      }
    }
  };
}

/**
 * Extract JWT token from request
 */
export function extractJwtToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  
  return authHeader.substring(7);
}