import { StorageProvider, StorageConfig } from './storage-interface.js';
import { KeychainStorage } from './keychain-storage.js';
import { FileStorage } from './file-storage.js';
import { MemoryStorage } from './memory-storage.js';
import { logger } from '../utils/logger.js';
import { config } from '../config/index.js';
import os from 'os';
import path from 'path';

/**
 * Storage manager that handles different storage providers
 */
export class StorageManager {
  private provider: StorageProvider | null = null;
  private readonly config: StorageConfig;
  
  constructor(config?: StorageConfig) {
    this.config = config || this.detectBestStorage();
  }
  
  /**
   * Detect the best storage provider for the current platform
   */
  private detectBestStorage(): StorageConfig {
    // Use config if set
    if (config.storageType) {
      return { 
        type: config.storageType,
        options: {
          path: config.storageDir,
          service: config.serviceName
        }
      };
    }
    
    // Check if running in Docker
    if (config.isDocker) {
      return { 
        type: 'file',
        options: {
          path: path.join(config.storageDir, 'keys.json.enc')
        }
      };
    }
    
    const platform = os.platform();
    
    // Platform-specific defaults
    switch (platform) {
      case 'darwin': // macOS
        return { 
          type: 'keychain',
          options: {
            service: config.serviceName
          }
        };
      case 'win32': // Windows
        // TODO: Could use Windows Credential Manager in future
        return { type: 'file' };
      case 'linux':
        // TODO: Could use Secret Service API in future
        return { type: 'file' };
      default:
        return { type: 'file' };
    }
  }
  
  /**
   * Initialize the storage provider
   */
  async initialize(): Promise<void> {
    if (this.provider) {
      return;
    }
    
    logger.info('Initializing storage provider', { type: this.config.type });
    
    switch (this.config.type) {
      case 'keychain':
        this.provider = await this.initializeKeychain();
        break;
      case 'file':
        this.provider = new FileStorage(this.config.options?.path as string | undefined);
        break;
      case 'memory':
        this.provider = new MemoryStorage();
        break;
      case 'custom':
        if (!this.config.options?.provider) {
          throw new Error('Custom storage provider not specified');
        }
        this.provider = this.config.options.provider as StorageProvider;
        break;
      default:
        throw new Error(`Unknown storage type: ${this.config.type}`);
    }
    
    // Verify storage is available
    if (this.provider) {
      const available = await this.provider.isAvailable();
      if (!available) {
        logger.warn(`Storage provider ${this.config.type} not available, falling back to file storage`);
        this.provider = new FileStorage();
      }
      
      logger.info('Storage provider initialized', { 
        type: this.provider.getType(),
        available 
      });
    }
  }
  
  /**
   * Initialize keychain storage with fallback
   */
  private async initializeKeychain(): Promise<StorageProvider> {
    const keychain = new KeychainStorage(this.config.options?.service as string | undefined);
    
    // Check if keychain is available
    const available = await keychain.isAvailable();
    if (!available) {
      logger.warn('Keychain not available, falling back to file storage');
      return new FileStorage();
    }
    
    return keychain;
  }
  
  /**
   * Get the storage provider
   */
  async getProvider(): Promise<StorageProvider> {
    if (!this.provider) {
      await this.initialize();
    }
    return this.provider!;
  }
  
  /**
   * Store a key-value pair
   */
  async store(key: string, value: string): Promise<void> {
    const provider = await this.getProvider();
    return provider.store(key, value);
  }
  
  /**
   * Get a value by key
   */
  async get(key: string): Promise<string | null> {
    const provider = await this.getProvider();
    return provider.get(key);
  }
  
  /**
   * Delete a key
   */
  async delete(key: string): Promise<boolean> {
    const provider = await this.getProvider();
    return provider.delete(key);
  }
  
  /**
   * List all keys
   */
  async list(): Promise<string[]> {
    const provider = await this.getProvider();
    return provider.list();
  }
  
  /**
   * Get storage type
   */
  async getType(): Promise<string> {
    const provider = await this.getProvider();
    return provider.getType();
  }
  
  /**
   * Migrate data from one storage provider to another
   */
  async migrate(to: StorageProvider): Promise<void> {
    const from = await this.getProvider();
    
    logger.info('Migrating storage', { 
      from: from.getType(), 
      to: to.getType() 
    });
    
    // Get all keys from current provider
    const keys = await from.list();
    
    // Copy each key to new provider
    for (const key of keys) {
      const value = await from.get(key);
      if (value) {
        await to.store(key, value);
      }
    }
    
    logger.info('Storage migration complete', { 
      keysCount: keys.length 
    });
    
    // Switch to new provider
    this.provider = to;
  }
}

// Export singleton instance
export const storageManager = new StorageManager();