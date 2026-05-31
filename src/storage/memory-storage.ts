import { StorageProvider } from './storage-interface.js';
import { logger } from '../utils/logger.js';

/**
 * In-memory storage provider
 * Useful for testing and temporary storage
 */
export class MemoryStorage implements StorageProvider {
  private storage: Map<string, string>;
  
  constructor() {
    this.storage = new Map();
  }
  
  async store(key: string, value: string): Promise<void> {
    this.storage.set(key, value);
    logger.debug('Stored key in memory', { key });
  }
  
  async get(key: string): Promise<string | null> {
    const value = this.storage.get(key) || null;
    logger.debug('Retrieved key from memory', { key, found: !!value });
    return value;
  }
  
  async delete(key: string): Promise<boolean> {
    const result = this.storage.delete(key);
    logger.debug('Deleted key from memory', { key, success: result });
    return result;
  }
  
  async list(): Promise<string[]> {
    const keys = Array.from(this.storage.keys());
    logger.debug('Listed keys from memory', { count: keys.length });
    return keys;
  }
  
  async isAvailable(): Promise<boolean> {
    return true;
  }
  
  getType(): string {
    return 'memory';
  }
  
  /**
   * Clear all stored data
   */
  clear(): void {
    this.storage.clear();
    logger.debug('Cleared all keys from memory');
  }
  
  /**
   * Get the number of stored keys
   */
  size(): number {
    return this.storage.size;
  }
}