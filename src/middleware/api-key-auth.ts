import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { apiKeyManager } from '../services/api-key-manager.js';
import { authService, Permission } from '../services/auth.js';
import { AuthenticationError, ForbiddenError } from '../errors/index.js';
import { logger } from '../utils/logger.js';

export interface ApiKeyAuthOptions {
  permissions?: string[];
  optional?: boolean;
}

/**
 * API Key authentication middleware with rate limiting
 */
export function apiKeyAuth(options: ApiKeyAuthOptions = {}) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authHeader = req.headers.authorization;
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        if (options.optional) {
          return next();
        }
        throw new AuthenticationError('Missing or invalid authorization header');
      }
      
      const apiKey = authHeader.substring(7);
      
      try {
        // Validate API key
        const keyMetadata = await apiKeyManager.validateApiKey(apiKey);
        
        // Check if key is expired
        if (keyMetadata.expiresAt && new Date(keyMetadata.expiresAt) < new Date()) {
          throw new AuthenticationError('API key expired');
        }
        
        // Check permissions if required
        if (options.permissions && options.permissions.length > 0) {
          const hasPermission = options.permissions.some(perm => 
            keyMetadata.permissions.includes(perm as Permission)
          );
          
          if (!hasPermission) {
            throw new ForbiddenError('Insufficient permissions');
          }
        }
        
        // Generate JWT for subsequent requests
        const jwt = authService.generateAccessToken(
          keyMetadata.id,
          keyMetadata.permissions
        );
        
        // Attach auth info to request
        req.auth = {
          apiKeyId: keyMetadata.id,
          permissions: keyMetadata.permissions,
          jti: crypto.randomUUID() // Generate a unique request ID
        };
        
        // Set JWT in response header for client convenience
        res.setHeader('X-Auth-Token', jwt);
        
        // Track API key usage
        keyMetadata.lastUsedAt = new Date().toISOString();
        
        logger.debug('API key authentication successful', {
          apiKeyId: keyMetadata.id,
          permissions: keyMetadata.permissions,
          path: req.path
        });
        
        next();
      } catch (error) {
        if (error instanceof Error && error.message.includes('Invalid API key')) {
          throw new AuthenticationError('Invalid API key');
        }
        throw error;
      }
    } catch (error) {
      if (error instanceof AuthenticationError || 
          error instanceof ForbiddenError) {
        logger.warn('API key authentication failed', {
          error: error.message,
          path: req.path,
          ip: req.ip
        });
        
        const response: { error: string; code: string } = {
          error: error.message,
          code: error.code
        };
        
        res.status(error.statusCode).json(response);
      } else {
        next(error as Error);
      }
    }
  };
}