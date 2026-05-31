import { KeychainRepository } from '../types/index.js';
import { config } from '../config/index.js';
import keychainServiceV1 from './keychain.js';
import { keychainServiceV2 } from './keychain-v2.js';

/**
 * Factory to create the appropriate keychain service
 * based on configuration or feature flags
 */
export function createKeychainService(): KeychainRepository {
  // Check if we should use the new storage abstraction
  const useStorageAbstraction = process.env.USE_STORAGE_ABSTRACTION === 'true' || 
                               config.storageType !== undefined;
  
  if (useStorageAbstraction) {
    return keychainServiceV2;
  }
  
  // Default to the existing implementation for backward compatibility
  return keychainServiceV1;
}

// Export the default service
export const keychainService = createKeychainService();