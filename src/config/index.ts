import { z } from 'zod';

/**
 * Configuration schema for the application
 */
const configSchema = z.object({
  // Server configuration
  port: z.number().min(1).max(65535).default(3000),
  nodeEnv: z.enum(['development', 'production', 'test']).default('development'),
  
  // Authentication
  authKey: z.string().optional(),
  encryptionKey: z.string().optional(),
  jwtSecret: z.string().optional(),
  
  // Storage
  storageDir: z.string().default('/app/data'),
  storageType: z.enum(['keychain', 'file', 'memory']).optional(),
  isDocker: z.boolean().default(false),
  
  // Service
  serviceName: z.string().default('serveMyAPI'),
  
  // Rate limiting
  rateLimitWindow: z.number().default(60000), // 1 minute
  rateLimitMax: z.number().default(60), // 60 requests per minute
  
  // Session management
  sessionTimeout: z.number().default(30 * 60 * 1000), // 30 minutes
  sessionCleanupInterval: z.number().default(5 * 60 * 1000), // 5 minutes
  
  // CORS
  allowedOrigins: z.string().optional(),
});

export type Config = z.infer<typeof configSchema>;

/**
 * Load and validate configuration from environment variables
 */
function loadConfig(): Config {
  const rawConfig = {
    port: process.env.PORT ? parseInt(process.env.PORT, 10) : undefined,
    nodeEnv: process.env.NODE_ENV,
    authKey: process.env.SERVEAPI_AUTH_KEY || process.env.AUTH_KEY,
    encryptionKey: process.env.ENCRYPTION_KEY || process.env.SERVEAPI_ENCRYPTION_KEY,
    jwtSecret: process.env.JWT_SECRET || process.env.SERVEAPI_JWT_SECRET,
    storageDir: process.env.STORAGE_DIR,
    storageType: process.env.SERVEMYAPI_STORAGE_TYPE as 'keychain' | 'file' | 'memory' | undefined,
    isDocker: process.env.DOCKER_ENV === 'true',
    serviceName: process.env.SERVICE_NAME,
    rateLimitWindow: process.env.RATE_LIMIT_WINDOW ? parseInt(process.env.RATE_LIMIT_WINDOW, 10) : undefined,
    rateLimitMax: process.env.RATE_LIMIT_MAX ? parseInt(process.env.RATE_LIMIT_MAX, 10) : undefined,
    sessionTimeout: process.env.SESSION_TIMEOUT ? parseInt(process.env.SESSION_TIMEOUT, 10) : undefined,
    sessionCleanupInterval: process.env.SESSION_CLEANUP_INTERVAL ? parseInt(process.env.SESSION_CLEANUP_INTERVAL, 10) : undefined,
    allowedOrigins: process.env.ALLOWED_ORIGINS,
  };

  try {
    return configSchema.parse(rawConfig);
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('Configuration validation error:', error.errors);
      throw new Error('Invalid configuration');
    }
    throw error;
  }
}

// Load configuration once
export const config = loadConfig();

/**
 * Check if running in production mode
 */
export function isProduction(): boolean {
  return config.nodeEnv === 'production';
}

/**
 * Check if running in development mode
 */
export function isDevelopment(): boolean {
  return config.nodeEnv === 'development';
}

/**
 * Check if running in test mode
 */
export function isTest(): boolean {
  return config.nodeEnv === 'test';
}

/**
 * Get a default encryption key for development
 * @throws Error in production if no key is set
 */
export function getEncryptionKey(): string {
  if (!config.encryptionKey) {
    if (isProduction()) {
      throw new Error('ENCRYPTION_KEY environment variable must be set in production');
    }
    console.warn('WARNING: No ENCRYPTION_KEY environment variable set. Using default key - NOT SECURE FOR PRODUCTION!');
    return 'INSECURE_DEFAULT_KEY_CHANGE_THIS_IN_PRODUCTION';
  }
  return config.encryptionKey;
}

/**
 * Check if authentication is enabled
 */
export function isAuthEnabled(): boolean {
  return !!config.authKey;
}

/**
 * Get allowed origins for CORS
 */
export function getAllowedOrigins(): string[] {
  if (!config.allowedOrigins) {
    return isDevelopment() 
      ? ['http://localhost:3000', 'http://localhost:5173']
      : [];
  }
  
  return config.allowedOrigins.split(',').map(origin => origin.trim());
}