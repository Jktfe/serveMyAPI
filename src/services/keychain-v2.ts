import { KeychainRepository } from '../types/index.js';
import { StorageError } from '../errors/index.js';
import { storageManager } from '../storage/storage-manager.js';
import { validateKeyName, validateKeyValue } from '../utils/validation.js';
import { logger } from '../utils/logger.js';

/**
 * Service for securely storing and retrieving API keys
 * Uses the storage abstraction layer for cross-platform compatibility
 */
export class KeychainServiceV2 implements KeychainRepository {
  private initialized = false;

  /**
   * Initialize the storage backend
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await storageManager.initialize();
      this.initialized = true;
      const type = await storageManager.getType();
      logger.info(`KeychainService initialized with ${type} storage`);
    }
  }

  /**
   * Store an API key
   * @param name The name/identifier for the API key
   * @param key The API key to store
   * @returns Promise that resolves when the key is stored
   */
  async storeKey(name: string, key: string): Promise<void> {
    await this.ensureInitialized();
    
    // Validate inputs to prevent security issues
    const validatedName = validateKeyName(name);
    const validatedKey = validateKeyValue(key);
    
    try {
      await storageManager.store(validatedName, validatedKey);
      logger.info('API key stored successfully', { name: validatedName });
    } catch (error) {
      logger.error('Failed to store API key', { name: validatedName, error });
      throw new StorageError(`Failed to store key: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Retrieve an API key
   * @param name The name/identifier of the API key to retrieve
   * @returns Promise that resolves with the API key or null if not found
   */
  async getKey(name: string): Promise<string | null> {
    await this.ensureInitialized();
    
    // Validate name to prevent security issues
    const validatedName = validateKeyName(name);
    
    try {
      const key = await storageManager.get(validatedName);
      if (key) {
        logger.debug('API key retrieved successfully', { name: validatedName });
      } else {
        logger.debug('API key not found', { name: validatedName });
      }
      return key;
    } catch (error) {
      logger.error('Failed to retrieve API key', { name: validatedName, error });
      throw new StorageError(`Failed to get key: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Delete an API key
   * @param name The name/identifier of the API key to delete
   * @returns Promise that resolves with true if deleted, false otherwise
   */
  async deleteKey(name: string): Promise<boolean> {
    await this.ensureInitialized();
    
    // Validate name to prevent security issues
    const validatedName = validateKeyName(name);
    
    try {
      const result = await storageManager.delete(validatedName);
      if (result) {
        logger.info('API key deleted successfully', { name: validatedName });
      } else {
        logger.debug('API key not found for deletion', { name: validatedName });
      }
      return result;
    } catch (error) {
      logger.error('Failed to delete API key', { name: validatedName, error });
      throw new StorageError(`Failed to delete key: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * List all stored API keys
   * @returns Promise that resolves with an array of key names
   */
  async listKeys(): Promise<string[]> {
    await this.ensureInitialized();
    
    try {
      const keys = await storageManager.list();
      logger.debug('Listed API keys', { count: keys.length });
      return keys;
    } catch (error) {
      logger.error('Failed to list API keys', { error });
      throw new StorageError(`Failed to list keys: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get the current storage type
   * @returns Promise that resolves with the storage type name
   */
  async getStorageType(): Promise<string> {
    await this.ensureInitialized();
    return await storageManager.getType();
  }
}

// Export instance
export const keychainServiceV2 = new KeychainServiceV2();