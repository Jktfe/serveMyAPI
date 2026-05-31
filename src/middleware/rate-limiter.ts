import { Request, Response, NextFunction } from 'express';
import { RateLimitError } from '../errors/index.js';
import { logger } from '../utils/logger.js';
import { config } from '../config/index.js';

/**
 * Rate limiting configuration
 */
export interface RateLimitConfig {
  windowMs?: number;
  max?: number;
  keyGenerator?: (req: Request) => string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  message?: string;
  standardHeaders?: boolean;
  legacyHeaders?: boolean;
  handler?: (req: Request, res: Response, next: NextFunction) => void;
}

/**
 * Rate limit store entry
 */
interface RateLimitEntry {
  count: number;
  resetAt: number;
}

/**
 * Rate limit store interface
 */
export interface RateLimitStore {
  get(key: string): RateLimitEntry | undefined;
  set(key: string, entry: RateLimitEntry): void;
  delete(key: string): boolean;
  clear(): void;
  cleanup(now: number): void;
}

/**
 * In-memory rate limit store
 */
export class MemoryRateLimitStore implements RateLimitStore {
  private store = new Map<string, RateLimitEntry>();
  
  get(key: string): RateLimitEntry | undefined {
    return this.store.get(key);
  }
  
  set(key: string, entry: RateLimitEntry): void {
    this.store.set(key, entry);
  }
  
  delete(key: string): boolean {
    return this.store.delete(key);
  }
  
  clear(): void {
    this.store.clear();
  }
  
  cleanup(now: number): void {
    for (const [key, entry] of this.store.entries()) {
      if (entry.resetAt < now) {
        this.store.delete(key);
      }
    }
  }
}

/**
 * Default key generator - uses API key ID or IP address
 */
function defaultKeyGenerator(req: Request): string {
  // Prefer API key ID if authenticated
  if (req.auth?.apiKeyId) {
    return `api:${req.auth.apiKeyId}`;
  }
  
  // Fall back to IP address
  const forwarded = req.headers['x-forwarded-for'];
  const ip = forwarded 
    ? (Array.isArray(forwarded) ? forwarded[0] : forwarded).split(',')[0].trim()
    : req.ip || 'unknown';
  
  return `ip:${ip}`;
}

/**
 * Create rate limiting middleware
 */
export function createRateLimiter(options: RateLimitConfig = {}): (req: Request, res: Response, next: NextFunction) => void {
  const windowMs = options.windowMs ?? config.rateLimitWindow;
  const max = options.max ?? config.rateLimitMax;
  const keyGenerator = options.keyGenerator ?? defaultKeyGenerator;
  const skipSuccessfulRequests = options.skipSuccessfulRequests ?? false;
  const skipFailedRequests = options.skipFailedRequests ?? false;
  const message = options.message ?? 'Too many requests, please try again later.';
  const standardHeaders = options.standardHeaders ?? true;
  const legacyHeaders = options.legacyHeaders ?? true;
  
  const store = new MemoryRateLimitStore();
  
  // Clean up expired entries periodically
  const cleanupInterval = setInterval(() => {
    store.cleanup(Date.now());
  }, Math.max(windowMs, 60000)); // At least every minute
  
  // Clear interval on process exit
  process.once('exit', () => clearInterval(cleanupInterval));
  
  return (req: Request, res: Response, next: NextFunction) => {
    const key = keyGenerator(req);
    const now = Date.now();
    
    // Get or create rate limit entry
    let entry = store.get(key);
    
    if (!entry || entry.resetAt < now) {
      // New window
      entry = {
        count: 0,
        resetAt: now + windowMs
      };
      store.set(key, entry);
    }
    
    // Calculate remaining requests
    const remaining = Math.max(0, max - entry.count);
    const resetDate = new Date(entry.resetAt);
    
    // Set rate limit headers
    if (standardHeaders) {
      res.setHeader('RateLimit-Limit', max.toString());
      res.setHeader('RateLimit-Remaining', remaining.toString());
      res.setHeader('RateLimit-Reset', resetDate.toISOString());
    }
    
    if (legacyHeaders) {
      res.setHeader('X-RateLimit-Limit', max.toString());
      res.setHeader('X-RateLimit-Remaining', remaining.toString());
      res.setHeader('X-RateLimit-Reset', Math.ceil(entry.resetAt / 1000).toString());
    }
    
    // Check if limit exceeded
    if (entry.count >= max) {
      const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
      
      logger.warn('Rate limit exceeded', {
        key,
        count: entry.count,
        max,
        retryAfter,
        path: req.path,
        method: req.method
      });
      
      // Set retry header
      res.setHeader('Retry-After', retryAfter.toString());
      
      // Use custom handler or default error
      if (options.handler) {
        return options.handler(req, res, next);
      }
      
      throw new RateLimitError(message, retryAfter);
    }
    
    // Increment counter (may be reverted based on response)
    entry.count++;
    
    // Handle response to potentially revert increment
    const originalEnd = res.end;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    res.end = function(this: Response, ...args: any[]) {
      const statusCode = res.statusCode;
      
      // Revert increment based on configuration
      if ((skipSuccessfulRequests && statusCode < 400) ||
          (skipFailedRequests && statusCode >= 400)) {
        entry!.count--;
      }
      
      // Update remaining header after potential revert
      const finalRemaining = Math.max(0, max - entry!.count);
      if (standardHeaders) {
        res.setHeader('RateLimit-Remaining', finalRemaining.toString());
      }
      if (legacyHeaders) {
        res.setHeader('X-RateLimit-Remaining', finalRemaining.toString());
      }
      
      // Call original end
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return originalEnd.apply(this, args as any);
    } as typeof res.end;
    
    next();
  };
}

/**
 * Rate limiter specifically for API endpoints
 */
export function apiRateLimiter(options?: Partial<RateLimitConfig>) {
  return createRateLimiter({
    windowMs: 60000, // 1 minute
    max: 60, // 60 requests per minute
    message: 'API rate limit exceeded. Please try again later.',
    ...options
  });
}

/**
 * Rate limiter for authentication endpoints
 */
export function authRateLimiter(options?: Partial<RateLimitConfig>) {
  return createRateLimiter({
    windowMs: 900000, // 15 minutes
    max: 5, // 5 attempts per 15 minutes
    message: 'Too many authentication attempts. Please try again later.',
    skipSuccessfulRequests: true, // Don't count successful logins
    ...options
  });
}

/**
 * Rate limiter for public endpoints
 */
export function publicRateLimiter(options?: Partial<RateLimitConfig>) {
  return createRateLimiter({
    windowMs: 60000, // 1 minute
    max: 30, // 30 requests per minute for public endpoints
    message: 'Too many requests from this IP. Please try again later.',
    keyGenerator: (req) => {
      // Always use IP for public endpoints
      const forwarded = req.headers['x-forwarded-for'];
      const ip = forwarded 
        ? (Array.isArray(forwarded) ? forwarded[0] : forwarded).split(',')[0].trim()
        : req.ip || 'unknown';
      return `public:${ip}`;
    },
    ...options
  });
}

