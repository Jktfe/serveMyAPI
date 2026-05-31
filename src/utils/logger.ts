/**
 * Secure logging utilities that prevent sensitive information exposure
 */
import { Request, Response, NextFunction } from 'express';

type LogLevel = 'info' | 'warn' | 'error' | 'debug';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: Record<string, unknown>;
}

/**
 * Sanitizes sensitive information from log data
 */
function sanitizeLogData(data: unknown): unknown {
  if (typeof data === 'string') {
    // Redact API keys and tokens
    return data
      .replace(/Bearer\s+[A-Za-z0-9+/=_-]+/gi, 'Bearer [REDACTED]')
      .replace(/[A-Za-z0-9]{32,}/g, '[REDACTED_KEY]')
      .replace(/password["\s:=]+["']?[^"'\s,}]+/gi, 'password: [REDACTED]')
      .replace(/key["\s:=]+["']?[^"'\s,}]+/gi, 'key: [REDACTED]');
  }
  
  if (typeof data === 'object' && data !== null) {
    const sanitized: Record<string, unknown> | unknown[] = Array.isArray(data) ? [] : {};
    
    for (const key in data) {
      const lowerKey = key.toLowerCase();
      
      // Redact sensitive fields
      if (lowerKey.includes('password') || 
          lowerKey.includes('secret') || 
          lowerKey.includes('token') || 
          lowerKey.includes('key') ||
          lowerKey.includes('auth')) {
        (sanitized as Record<string, unknown>)[key] = '[REDACTED]';
      } else {
        (sanitized as Record<string, unknown>)[key] = sanitizeLogData((data as Record<string, unknown>)[key]);
      }
    }
    
    return sanitized;
  }
  
  return data;
}

/**
 * Creates a log entry with sanitized data
 */
function createLogEntry(level: LogLevel, message: string, context?: unknown): LogEntry {
  return {
    timestamp: new Date().toISOString(),
    level,
    message: sanitizeLogData(message) as string,
    context: context ? sanitizeLogData(context) as Record<string, unknown> : undefined
  };
}

/**
 * Logs messages with appropriate sanitization
 */
export const logger = {
  info(message: string, context?: unknown) {
    const entry = createLogEntry('info', message, context);
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(entry));
  },
  
  warn(message: string, context?: unknown) {
    const entry = createLogEntry('warn', message, context);
    console.warn(JSON.stringify(entry));
  },
  
  error(message: string, error?: Error | unknown, context?: unknown) {
    const errorDetails = error instanceof Error ? {
      message: error.message,
      stack: process.env.NODE_ENV !== 'production' ? error.stack : undefined,
      name: error.name
    } : error ? String(error) : undefined;
    
    const entry = createLogEntry('error', message, {
      ...(context as Record<string, unknown>),
      error: errorDetails
    });
    console.error(JSON.stringify(entry));
  },
  
  debug(message: string, context?: unknown) {
    if (process.env.NODE_ENV !== 'production') {
      const entry = createLogEntry('debug', message, context);
      // eslint-disable-next-line no-console
      console.debug(JSON.stringify(entry));
    }
  }
};

/**
 * Express error logging middleware
 */
export function errorLoggingMiddleware(err: Error, req: Request, res: Response, _next: NextFunction) {
  logger.error('Request error', err, {
    method: req.method,
    path: req.path,
    ip: req.ip,
    userAgent: req.headers['user-agent']
  });
  
  // Don't expose internal errors to clients
  const statusCode = res.statusCode !== 200 ? res.statusCode : 500;
  res.status(statusCode).json({
    error: process.env.NODE_ENV === 'production' 
      ? 'Internal server error' 
      : err.message
  });
}