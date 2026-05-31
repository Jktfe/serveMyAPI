/**
 * Storage interface for API key management
 * Allows for different storage backends (Keychain, File, Database, etc.)
 */
export interface StorageProvider {
  /**
   * Store a key-value pair
   */
  store(key: string, value: string): Promise<void>;
  
  /**
   * Retrieve a value by key
   */
  get(key: string): Promise<string | null>;
  
  /**
   * Delete a key
   */
  delete(key: string): Promise<boolean>;
  
  /**
   * List all keys
   */
  list(): Promise<string[]>;
  
  /**
   * Check if storage is available
   */
  isAvailable(): Promise<boolean>;
  
  /**
   * Get storage type name
   */
  getType(): string;
}

/**
 * Storage provider factory
 */
export interface StorageProviderFactory {
  create(): Promise<StorageProvider>;
}

/**
 * Storage configuration
 */
export interface StorageConfig {
  type: 'keychain' | 'file' | 'memory' | 'custom';
  options?: Record<string, unknown>;
}