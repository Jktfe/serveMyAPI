import { Request, Response, NextFunction } from 'express';
import { 
  ServeMyAPIError, 
  isOperationalError,
  ValidationError,
  RateLimitError 
} from '../errors/index.js';
import { logger } from '../utils/logger.js';
import { isProduction } from '../config/index.js';
import crypto from 'crypto';

interface ErrorResponse {
  error: {
    message: string;
    code?: string;
    requestId?: string;
    timestamp?: string;
    details?: unknown;
  };
}

/**
 * Generate a unique request ID for error tracking
 */
function generateRequestId(): string {
  return crypto.randomBytes(16).toString('hex');
}

/**
 * Sanitize error message for production
 */
function sanitizeErrorMessage(error: Error): string {
  // Never expose internal error details in production
  if (isProduction()) {
    if (error instanceof ServeMyAPIError) {
      // Operational errors can show their message
      if (isOperationalError(error)) {
        return error.message;
      }
    }
    
    // Generic message for all other errors
    return 'An error occurred processing your request';
  }
  
  // In development, show the actual error
  return error.message;
}

/**
 * Create error response based on error type
 */
function createErrorResponse(
  error: Error, 
  requestId: string
): ErrorResponse {
  const response: ErrorResponse = {
    error: {
      message: sanitizeErrorMessage(error),
      requestId,
      timestamp: new Date().toISOString(),
    }
  };

  // Add error code for known errors
  if (error instanceof ServeMyAPIError) {
    response.error.code = error.code;
    
    // Add rate limit info
    if (error instanceof RateLimitError) {
      response.error.details = {
        retryAfter: error.retryAfter
      };
    }
    
    // Add validation details in development
    if (error instanceof ValidationError && !isProduction()) {
      response.error.details = error.details;
    }
  }

  return response;
}

/**
 * Get HTTP status code from error
 */
function getStatusCode(error: Error): number {
  if (error instanceof ServeMyAPIError) {
    return error.statusCode;
  }
  
  // Default status codes for common errors
  if (error.name === 'UnauthorizedError') return 401;
  if (error.name === 'ValidationError') return 400;
  if (error.name === 'CastError') return 400;
  
  return 500;
}

/**
 * Production-safe error handler middleware
 */
export function errorHandler(
  error: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  // Generate request ID for tracking
  const requestId = generateRequestId();
  
  // Get status code
  const statusCode = getStatusCode(error);
  
  // Log error with context
  const logContext = {
    requestId,
    method: req.method,
    path: req.path,
    statusCode,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
    ...(req.auth && { apiKeyId: req.auth.apiKeyId }),
  };

  // Log based on error type
  if (isOperationalError(error)) {
    logger.warn('Operational error', {
      ...logContext,
      error: error.message,
      code: (error as ServeMyAPIError).code,
    });
  } else {
    logger.error('System error', error, logContext);
    
    // Alert on critical errors in production
    if (isProduction() && statusCode >= 500) {
      // In a real system, send alert to monitoring service
      logger.error('CRITICAL: System error in production', {
        ...logContext,
        stack: error.stack,
      });
    }
  }

  // Create error response
  const response = createErrorResponse(error, requestId);
  
  // Set security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Request-ID', requestId);
  
  // Send response
  res.status(statusCode).json(response);
}

/**
 * Not found handler
 */
export function notFoundHandler(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const error = new ValidationError(`Endpoint not found: ${req.method} ${req.path}`);
  next(error);
}

/**
 * Async error wrapper
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Unhandled rejection handler
 */
export function setupErrorHandlers(): void {
  process.on('unhandledRejection', (reason: Error | unknown, promise: Promise<unknown>) => {
    logger.error('Unhandled Rejection', reason, {
      promise,
      stack: reason instanceof Error ? reason.stack : undefined,
    });
    
    // In production, we might want to gracefully shutdown
    if (isProduction()) {
      logger.error('CRITICAL: Unhandled rejection in production, consider shutdown');
    }
  });

  process.on('uncaughtException', (error: Error) => {
    logger.error('Uncaught Exception', error, {
      stack: error.stack,
    });
    
    // Uncaught exceptions are serious - log and exit
    if (isProduction()) {
      logger.error('CRITICAL: Uncaught exception in production, shutting down');
      process.exit(1);
    }
  });
}

/**
 * Request logging middleware
 */
export function requestLogger(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const start = Date.now();
  const requestId = generateRequestId();
  
  // Attach request ID
  (req as Request & { id?: string }).id = requestId;
  res.setHeader('X-Request-ID', requestId);
  
  // Log request
  logger.info('Request received', {
    requestId,
    method: req.method,
    path: req.path,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
  });
  
  // Log response
  res.on('finish', () => {
    const duration = Date.now() - start;
    
    logger.info('Request completed', {
      requestId,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration,
    });
  });
  
  next();
}