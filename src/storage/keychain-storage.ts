import keytar from 'keytar';
import { StorageProvider } from './storage-interface.js';
import { logger } from '../utils/logger.js';
import { VAULT_ACCOUNT, Vault, parseVault, serializeVault } from '../utils/vault.js';

/**
 * macOS Keychain storage provider.
 *
 * All keys are consolidated into a single keychain item (stored under
 * {@link VAULT_ACCOUNT}) so the OS only ever shows ONE access-control prompt
 * for the whole vault rather than one per key. The decoded vault is cached
 * in-process; writes are write-through so the cache never diverges from the
 * keychain within this process.
 */
export class KeychainStorage implements StorageProvider {
  private readonly service: string;
  private vaultCache: Vault | null = null;

  constructor(service: string = 'serveMyAPI') {
    this.service = service;
  }

  /** Read and decode the vault, caching the result. Empty if unset. */
  private async loadVault(): Promise<Vault> {
    if (this.vaultCache) {
      return this.vaultCache;
    }
    const raw = await keytar.getPassword(this.service, VAULT_ACCOUNT);
    this.vaultCache = parseVault(raw);
    return this.vaultCache;
  }

  /** Write the vault back to the keychain (write-through). */
  private async saveVault(vault: Vault): Promise<void> {
    await keytar.setPassword(this.service, VAULT_ACCOUNT, serializeVault(vault));
    this.vaultCache = vault;
  }

  /** Drop the cached vault so the next read re-fetches from the keychain. */
  invalidateCache(): void {
    this.vaultCache = null;
  }

  async store(key: string, value: string): Promise<void> {
    try {
      const vault = await this.loadVault();
      vault[key] = value;
      await this.saveVault(vault);
      logger.debug('Stored key in keychain vault', { key, service: this.service });
    } catch (error) {
      logger.error('Failed to store key in keychain', { key, error });
      throw new Error(`Failed to store key: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async get(key: string): Promise<string | null> {
    try {
      const vault = await this.loadVault();
      const value = vault[key] ?? null;
      logger.debug('Retrieved key from keychain vault', { key, found: value !== null });
      return value;
    } catch (error) {
      logger.error('Failed to get key from keychain', { key, error });
      throw new Error(`Failed to get key: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async delete(key: string): Promise<boolean> {
    try {
      const vault = await this.loadVault();
      if (!(key in vault)) {
        return false;
      }
      delete vault[key];
      await this.saveVault(vault);
      logger.debug('Deleted key from keychain vault', { key, success: true });
      return true;
    } catch (error) {
      logger.error('Failed to delete key from keychain', { key, error });
      throw new Error(`Failed to delete key: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async list(): Promise<string[]> {
    try {
      const vault = await this.loadVault();
      const keys = Object.keys(vault);
      logger.debug('Listed keys from keychain vault', { count: keys.length });
      return keys;
    } catch (error) {
      logger.error('Failed to list keys from keychain', { error });
      throw new Error(`Failed to list keys: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async isAvailable(): Promise<boolean> {
    try {
      // Probe only the single vault item — never findCredentials, which would
      // touch every legacy item and could trigger a burst of prompts. A missing
      // vault returns null (still available); a broken keytar binding throws.
      await keytar.getPassword(this.service, VAULT_ACCOUNT);
      return true;
    } catch (error) {
      logger.warn('Keychain not available', { error });
      return false;
    }
  }

  getType(): string {
    return 'keychain';
  }
}
