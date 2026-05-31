import { Request, Response, NextFunction } from 'express';
import { z, ZodError, ZodSchema } from 'zod';
import { logger } from '../utils/logger.js';

/**
 * Input validation schemas for all endpoints
 */
export const schemas = {
  // SSE connection
  sseConnect: z.object({
    headers: z.object({
      'user-agent': z.string().optional(),
      'accept-language': z.string().optional(),
      'accept-encoding': z.string().optional(),
    }),
  }),

  // Message endpoint
  postMessage: z.object({
    body: z.object({
      jsonrpc: z.literal('2.0'),
      method: z.string(),
      params: z.unknown(),
      id: z.union([z.string(), z.number()]),
    }),
    headers: z.object({
      'content-type': z.string().regex(/application\/json/i),
      'x-session-id': z.string().optional(),
      'x-csrf-token': z.string().optional(),
    }),
  }),

  // Token refresh
  refreshToken: z.object({
    body: z.object({
      refreshToken: z.string().min(1),
    }),
  }),

  // API key management
  createApiKey: z.object({
    body: z.object({
      name: z.string().min(1).max(255),
      permissions: z.array(z.enum(['read', 'write', 'delete', 'admin'])).default(['read']),
      scopes: z.array(z.string()).optional(),
      expiresIn: z.number().positive().max(31536000).optional(), // Max 1 year
      description: z.string().max(1000).optional(),
    }),
  }),

  revokeApiKey: z.object({
    params: z.object({
      id: z.string().uuid(),
    }),
  }),

  // Generic ID parameter
  idParam: z.object({
    params: z.object({
      id: z.string().uuid(),
    }),
  }),
};

/**
 * Request sanitization
 */
export function sanitizeInput(data: unknown): unknown {
  if (typeof data === 'string') {
    // Remove null bytes
    let sanitized = data.replace(/\0/g, '');
    
    // Trim whitespace
    sanitized = sanitized.trim();
    
    // Limit string length
    if (sanitized.length > 10000) {
      sanitized = sanitized.substring(0, 10000);
    }
    return sanitized;
  } else if (Array.isArray(data)) {
    return data.map(sanitizeInput);
  } else if (data && typeof data === 'object') {
    const sanitized: Record<string, unknown> = {};
    for (const key in data) {
      // Skip prototype pollution attempts
      if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
        continue;
      }
      sanitized[key] = sanitizeInput((data as Record<string, unknown>)[key]);
    }
    return sanitized;
  }
  
  return data;
}

/**
 * Create validation middleware for a schema
 */
export function validate<T extends ZodSchema>(
  schema: T,
  location: 'body' | 'query' | 'params' | 'headers' = 'body'
): (req: Request, res: Response, next: NextFunction) => void {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      // Get data from request location
      let data: unknown;
      switch (location) {
        case 'body':
          data = req.body;
          break;
        case 'query':
          data = req.query;
          break;
        case 'params':
          data = req.params;
          break;
        case 'headers':
          data = req.headers;
          break;
      }
      
      // Sanitize input
      data = sanitizeInput(data);
      
      // Validate against schema
      const validated = schema.parse({ [location]: data });
      
      // Replace request data with validated data
      if (location === 'body') req.body = validated.body;
      else if (location === 'query') req.query = validated.query;
      else if (location === 'params') req.params = validated.params;
      
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const errors = error.errors.map(e => ({
          path: e.path.join('.'),
          message: e.message,
        }));
        
        logger.warn('Validation failed', {
          location,
          errors,
          path: req.path,
        });
        
        res.status(400).json({
          error: 'Validation failed',
          details: errors,
        });
      } else {
        next(error);
      }
    }
  };
}

/**
 * Validate request body
 */
export function validateBody<T extends ZodSchema>(schema: T) {
  return validate(schema, 'body');
}

/**
 * Validate query parameters
 */
export function validateQuery<T extends ZodSchema>(schema: T) {
  return validate(schema, 'query');
}

/**
 * Validate URL parameters
 */
export function validateParams<T extends ZodSchema>(schema: T) {
  return validate(schema, 'params');
}

/**
 * Validate headers
 */
export function validateHeaders<T extends ZodSchema>(schema: T) {
  return validate(schema, 'headers');
}

/**
 * Payload size limiting middleware
 */
export function limitPayloadSize(maxSize: number = 1048576) { // 1MB default
  return (req: Request, res: Response, next: NextFunction) => {
    let size = 0;
    
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > maxSize) {
        res.status(413).json({ error: 'Payload too large' });
        req.destroy();
      }
    });
    
    next();
  };
}

/**
 * Request timeout middleware
 */
export function requestTimeout(ms: number = 30000) { // 30s default
  return (req: Request, res: Response, next: NextFunction) => {
    const timeout = setTimeout(() => {
      if (!res.headersSent) {
        res.status(408).json({ error: 'Request timeout' });
      }
    }, ms);
    
    // Clear timeout when response is sent
    res.on('finish', () => clearTimeout(timeout));
    res.on('close', () => clearTimeout(timeout));
    
    next();
  };
}

/**
 * Combined validation middleware for common security checks
 */
export function commonSecurityValidation() {
  return [
    limitPayloadSize(),
    requestTimeout(),
  ];
}