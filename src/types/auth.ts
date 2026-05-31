import { z } from 'zod';
import { Permission } from '../services/auth.js';

/**
 * API Key metadata stored in keychain
 */
export const apiKeyMetadataSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  permissions: z.array(z.enum(['read', 'write', 'delete', 'admin'])),
  scopes: z.array(z.string()).optional(), // Specific key patterns allowed
  createdAt: z.string().datetime(),
  lastUsedAt: z.string().datetime().optional(),
  expiresAt: z.string().datetime().optional(),
  description: z.string().optional(),
});

export type ApiKeyMetadata = z.infer<typeof apiKeyMetadataSchema>;

/**
 * API Key creation request
 */
export const createApiKeyRequestSchema = z.object({
  name: z.string().min(1).max(255),
  permissions: z.array(z.enum(['read', 'write', 'delete', 'admin'])).default(['read']),
  scopes: z.array(z.string()).optional(),
  expiresIn: z.number().positive().optional(), // Seconds until expiration
  description: z.string().max(1000).optional(),
});

export type CreateApiKeyRequest = z.infer<typeof createApiKeyRequestSchema>;

/**
 * API Key response
 */
export interface ApiKeyResponse {
  id: string;
  apiKey: string;
  name: string;
  permissions: Permission[];
  scopes?: string[];
  expiresAt?: string;
  accessToken: string;
  refreshToken: string;
}

/**
 * Check if a key name matches the allowed scopes
 */
export function isKeyInScope(keyName: string, scopes?: string[]): boolean {
  if (!scopes || scopes.length === 0) {
    return true; // No scopes means access to all keys
  }
  
  return scopes.some(scope => {
    // Convert scope pattern to regex
    const pattern = scope
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.');
    
    const regex = new RegExp(`^${pattern}$`);
    return regex.test(keyName);
  });
}

/**
 * Storage schema for API keys (stored encrypted)
 */
export const storedApiKeySchema = z.object({
  id: z.string().uuid(),
  hashedKey: z.string(), // SHA-256 hash of the API key
  metadata: apiKeyMetadataSchema,
  salt: z.string(),
});

export type StoredApiKey = z.infer<typeof storedApiKeySchema>;