import crypto from 'crypto';
import { 
  ApiKeyMetadata, 
  CreateApiKeyRequest, 
  ApiKeyResponse,
  StoredApiKey,
  isKeyInScope 
} from '../types/auth.js';
import { authService } from './auth.js';
import keychainService from './keychain.js';
import { logger } from '../utils/logger.js';
import { AuthenticationError, ValidationError } from '../errors/index.js';

const API_KEY_PREFIX = '_servemyapi_key_';

/**
 * Service for managing API keys with scopes and permissions
 */
export class ApiKeyManager {
  /**
   * Create a new API key
   */
  async createApiKey(request: CreateApiKeyRequest): Promise<ApiKeyResponse> {
    // Generate unique ID
    const id = crypto.randomUUID();
    
    // Generate API key and tokens
    const { apiKey, accessToken, refreshToken } = authService.generateApiKeyTokens(
      id,
      request.permissions
    );
    
    // Calculate expiration
    const expiresAt = request.expiresIn
      ? new Date(Date.now() + request.expiresIn * 1000).toISOString()
      : undefined;
    
    // Create metadata
    const metadata: ApiKeyMetadata = {
      id,
      name: request.name,
      permissions: request.permissions,
      scopes: request.scopes,
      createdAt: new Date().toISOString(),
      expiresAt,
      description: request.description,
    };
    
    // Hash the API key for storage
    const salt = crypto.randomBytes(32).toString('base64');
    const hashedKey = this.hashApiKey(apiKey, salt);
    
    // Store the API key metadata
    const storedKey: StoredApiKey = {
      id,
      hashedKey,
      metadata,
      salt,
    };
    
    await keychainService.storeKey(
      `${API_KEY_PREFIX}${id}`,
      JSON.stringify(storedKey)
    );
    
    logger.info('API key created', {
      id,
      name: request.name,
      permissions: request.permissions,
      scopes: request.scopes,
    });
    
    return {
      id,
      apiKey,
      name: request.name,
      permissions: request.permissions,
      scopes: request.scopes,
      expiresAt,
      accessToken,
      refreshToken,
    };
  }
  
  /**
   * Validate an API key and return its metadata
   */
  async validateApiKey(apiKey: string): Promise<ApiKeyMetadata> {
    // List all API keys
    const keys = await keychainService.listKeys();
    const apiKeyIds = keys
      .filter(k => k.startsWith(API_KEY_PREFIX))
      .map(k => k.replace(API_KEY_PREFIX, ''));
    
    // Check each stored key
    for (const id of apiKeyIds) {
      const storedData = await keychainService.getKey(`${API_KEY_PREFIX}${id}`);
      if (!storedData) continue;
      
      try {
        const stored: StoredApiKey = JSON.parse(storedData);
        
        // Check if key matches
        const hashedInput = this.hashApiKey(apiKey, stored.salt);
        if (hashedInput === stored.hashedKey) {
          // Check expiration
          if (stored.metadata.expiresAt) {
            const expiryDate = new Date(stored.metadata.expiresAt);
            if (expiryDate < new Date()) {
              throw new AuthenticationError('API key has expired');
            }
          }
          
          // Update last used timestamp
          stored.metadata.lastUsedAt = new Date().toISOString();
          await keychainService.storeKey(
            `${API_KEY_PREFIX}${id}`,
            JSON.stringify(stored)
          );
          
          return stored.metadata;
        }
      } catch (error) {
        if (error instanceof AuthenticationError) throw error;
        logger.error('Error validating API key', error);
      }
    }
    
    throw new AuthenticationError('Invalid API key');
  }
  
  /**
   * Check if an API key has access to a specific key
   */
  async checkKeyAccess(
    apiKeyId: string, 
    keyName: string, 
    requiredPermission: 'read' | 'write' | 'delete'
  ): Promise<boolean> {
    const storedData = await keychainService.getKey(`${API_KEY_PREFIX}${apiKeyId}`);
    if (!storedData) {
      throw new AuthenticationError('API key not found');
    }
    
    const stored: StoredApiKey = JSON.parse(storedData);
    const metadata = stored.metadata;
    
    // Check permissions
    if (!metadata.permissions.includes(requiredPermission) && 
        !metadata.permissions.includes('admin')) {
      return false;
    }
    
    // Check scopes
    return isKeyInScope(keyName, metadata.scopes);
  }
  
  /**
   * List all API keys (metadata only)
   */
  async listApiKeys(): Promise<ApiKeyMetadata[]> {
    const keys = await keychainService.listKeys();
    const apiKeys: ApiKeyMetadata[] = [];
    
    for (const key of keys) {
      if (key.startsWith(API_KEY_PREFIX)) {
        const storedData = await keychainService.getKey(key);
        if (storedData) {
          try {
            const stored: StoredApiKey = JSON.parse(storedData);
            apiKeys.push(stored.metadata);
          } catch {
            logger.error('Error parsing API key data', { key });
          }
        }
      }
    }
    
    return apiKeys;
  }
  
  /**
   * Revoke an API key
   */
  async revokeApiKey(apiKeyId: string): Promise<void> {
    const key = `${API_KEY_PREFIX}${apiKeyId}`;
    const exists = await keychainService.deleteKey(key);
    
    if (!exists) {
      throw new ValidationError('API key not found');
    }
    
    logger.info('API key revoked', { apiKeyId });
  }
  
  /**
   * Hash an API key with salt
   */
  private hashApiKey(apiKey: string, salt: string): string {
    return crypto
      .pbkdf2Sync(apiKey, salt, 100000, 64, 'sha256')
      .toString('base64');
  }
  
  /**
   * Get API key by ID
   */
  async getApiKeyById(apiKeyId: string): Promise<ApiKeyMetadata | null> {
    const storedData = await keychainService.getKey(`${API_KEY_PREFIX}${apiKeyId}`);
    if (!storedData) return null;
    
    try {
      const stored: StoredApiKey = JSON.parse(storedData);
      return stored.metadata;
    } catch {
      logger.error('Error parsing API key data', { apiKeyId });
      return null;
    }
  }
}

// Export singleton instance
export const apiKeyManager = new ApiKeyManager();