import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { z } from 'zod';
import { config, isAuthEnabled } from '../config/index.js';
import { AuthenticationError, RateLimitError } from '../errors/index.js';
import { RateLimitEntry } from '../types/index.js';

// Token validation schema
const authHeaderSchema = z.string().regex(/^Bearer .+$/);

// Rate limiting storage (in production, use Redis)
const rateLimitStore = new Map<string, RateLimitEntry>();

/**
 * Generates a secure API key
 */
export function generateApiKey(): string {
  return crypto.randomBytes(32).toString('base64url');
}

/**
 * Validates the API key from Authorization header
 */
export function validateApiKey(key: string): boolean {
  if (!isAuthEnabled()) {
    console.error('WARNING: No AUTH_KEY environment variable set. Authentication is disabled!');
    return true; // Allow access if no auth key is configured (development only)
  }
  
  const apiKey = config.authKey!;
  
  // Constant-time comparison to prevent timing attacks
  if (key.length !== apiKey.length) {
    return false;
  }
  
  return crypto.timingSafeEqual(
    Buffer.from(key),
    Buffer.from(apiKey)
  );
}

/**
 * Express middleware for authentication
 */
export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Skip auth for health check and root
  if (req.path === '/' || req.path === '/health') {
    return next();
  }

  const authHeader = req.headers.authorization;
  
  try {
    // Check if auth header exists
    if (!authHeader) {
      throw new AuthenticationError('Missing authorization header');
    }
    
    // Validate auth header format
    authHeaderSchema.parse(authHeader);
    
    // Extract token
    const token = authHeader.split(' ')[1];
    
    // Validate token
    if (!validateApiKey(token)) {
      throw new AuthenticationError('Invalid authentication token');
    }
  } catch (error) {
    if (error instanceof AuthenticationError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    if (error instanceof z.ZodError) {
      res.status(401).json({ error: 'Invalid authorization header format. Use: Bearer <token>' });
      return;
    }
    res.status(500).json({ error: 'Internal server error' });
    return;
  }
  
  // Authentication successful
  next();
}

/**
 * Rate limiting middleware
 */
export function rateLimitMiddleware(req: Request, res: Response, next: NextFunction): void {
  const clientId = req.ip || 'unknown';
  const now = Date.now();
  
  // Get or create rate limit entry
  let rateLimit = rateLimitStore.get(clientId);
  
  if (!rateLimit || now > rateLimit.resetTime) {
    rateLimit = {
      count: 0,
      resetTime: now + config.rateLimitWindow
    };
  }
  
  rateLimit.count++;
  rateLimitStore.set(clientId, rateLimit);
  
  // Clean up old entries periodically
  if (Math.random() < 0.01) { // 1% chance
    for (const [key, value] of rateLimitStore.entries()) {
      if (now > value.resetTime) {
        rateLimitStore.delete(key);
      }
    }
  }
  
  // Check rate limit
  if (rateLimit.count > config.rateLimitMax) {
    const retryAfter = Math.ceil((rateLimit.resetTime - now) / 1000);
    const error = new RateLimitError('Too many requests', retryAfter);
    res.status(error.statusCode).json({ 
      error: error.message, 
      retryAfter
    });
    return;
  }
  
  // Add rate limit headers
  res.setHeader('X-RateLimit-Limit', config.rateLimitMax.toString());
  res.setHeader('X-RateLimit-Remaining', Math.max(0, config.rateLimitMax - rateLimit.count).toString());
  res.setHeader('X-RateLimit-Reset', rateLimit.resetTime.toString());
  
  next();
}

/**
 * Generate auth key on first run if not set
 */
export function initializeAuth(): void {
  if (!isAuthEnabled()) {
    const newKey = generateApiKey();
    // eslint-disable-next-line no-console
    console.log('\n===========================================');
    // eslint-disable-next-line no-console
    console.log('SECURITY WARNING: No AUTH_KEY configured!');
    // eslint-disable-next-line no-console
    console.log('Generated temporary key:', newKey);
    // eslint-disable-next-line no-console
    console.log('Set this in your environment:');
    // eslint-disable-next-line no-console
    console.log(`export SERVEAPI_AUTH_KEY="${newKey}"`);
    // eslint-disable-next-line no-console
    console.log('===========================================\n');
  }
}