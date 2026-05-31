/**
 * Base error class for ServeMyAPI
 */
export class ServeMyAPIError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly isOperational: boolean;

  constructor(message: string, code: string, statusCode: number, isOperational = true) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Error thrown when a requested API key is not found
 */
export class KeyNotFoundError extends ServeMyAPIError {
  constructor(keyName: string) {
    super(`No API key found with name: ${keyName}`, 'KEY_NOT_FOUND', 404);
  }
}

/**
 * Error thrown when authentication fails
 */
export class AuthenticationError extends ServeMyAPIError {
  constructor(message: string) {
    super(message, 'AUTHENTICATION_FAILED', 401);
  }
}

/**
 * Error thrown when access is forbidden
 */
export class ForbiddenError extends ServeMyAPIError {
  constructor(message: string = 'Access forbidden') {
    super(message, 'FORBIDDEN', 403);
  }
}

/**
 * Error thrown when validation fails
 */
export class ValidationError extends ServeMyAPIError {
  public readonly details?: unknown;

  constructor(message: string, details?: unknown) {
    super(message, 'VALIDATION_ERROR', 400);
    if (details) {
      this.details = details;
    }
  }
}

/**
 * Error thrown when rate limit is exceeded
 */
export class RateLimitError extends ServeMyAPIError {
  public readonly retryAfter: number;

  constructor(message: string, retryAfter: number) {
    super(message, 'RATE_LIMIT_EXCEEDED', 429);
    this.retryAfter = retryAfter;
  }
}

/**
 * Error thrown when storage operations fail
 */
export class StorageError extends ServeMyAPIError {
  public readonly originalError?: Error;

  constructor(message: string, originalError?: Error) {
    super(message, 'STORAGE_ERROR', 500, false);
    if (originalError) {
      this.originalError = originalError;
    }
  }
}

/**
 * Error thrown when encryption/decryption fails
 */
export class EncryptionError extends ServeMyAPIError {
  constructor(message: string) {
    super(message, 'ENCRYPTION_ERROR', 500, false);
  }
}

/**
 * Error thrown when configuration is invalid
 */
export class ConfigurationError extends ServeMyAPIError {
  constructor(message: string) {
    super(message, 'CONFIGURATION_ERROR', 500, false);
  }
}

/**
 * Type guard to check if an error is a ServeMyAPI error
 */
export function isServeMyAPIError(error: unknown): error is ServeMyAPIError {
  return error instanceof ServeMyAPIError;
}

/**
 * Type guard to check if an error is operational
 */
export function isOperationalError(error: unknown): boolean {
  if (isServeMyAPIError(error)) {
    return error.isOperational;
  }
  return false;
}

/**
 * Convert any error to a ServeMyAPIError
 */
export function toServeMyAPIError(error: unknown): ServeMyAPIError {
  if (isServeMyAPIError(error)) {
    return error;
  }
  
  if (error instanceof Error) {
    return new ServeMyAPIError(
      error.message,
      'INTERNAL_ERROR',
      500,
      false
    );
  }
  
  return new ServeMyAPIError(
    'An unknown error occurred',
    'UNKNOWN_ERROR',
    500,
    false
  );
}