import keytar from 'keytar';
import fs from 'fs';
import path from 'path';
import { validateKeyName, validateKeyValue } from '../utils/validation.js';
import { encrypt, decrypt, hash } from '../utils/encryption.js';
import { logger } from '../utils/logger.js';
import { config } from '../config/index.js';
import { StorageError, EncryptionError } from '../errors/index.js';
import { EncryptedKeyData, ApiKeyMetadata } from '../types/index.js';
import {
  VAULT_ACCOUNT,
  LEGACY_PERMISSION_MARKER,
  Vault,
  parseVault,
  serializeVault
} from '../utils/vault.js';

/** Result of a one-shot migration from per-key items to the blob vault. */
export interface MigrationReport {
  migrated: string[];
  deleted: string[];
  skipped: string[];
}

/**
 * Service for securely storing and retrieving API keys
 * - macOS: all keys live in a single Keychain item (one ACL, one prompt)
 * - Docker: falls back to per-key encrypted files
 */
export class KeychainService {
  /**
   * In-process cache of the decoded vault. Populated on first read and
   * kept warm for the life of the process so we touch the keychain (and
   * risk a prompt) at most once. Writes are always write-through, so the
   * cache never diverges from the keychain *within* this process. A
   * separate process that mutates the vault won't be reflected until this
   * one calls invalidateCache() or restarts.
   */
  private vaultCache: Vault | null = null;

  constructor() {
    // Docker uses per-file storage and needs its directory up front.
    // The keychain path is lazy — we only read the vault when first asked.
    if (config.isDocker) {
      this.ensureStorageDirectory();
    }
  }

  /**
   * Ensure the storage directory exists for Docker environments
   */
  private ensureStorageDirectory(): void {
    if (config.isDocker) {
      try {
        if (!fs.existsSync(config.storageDir)) {
          fs.mkdirSync(config.storageDir, { recursive: true });
        }
      } catch (error) {
        logger.error('Error creating storage directory', error);
        throw new StorageError('Failed to create storage directory');
      }
    }
  }

  /**
   * Read and decode the vault from the keychain, caching the result.
   * Returns an empty vault if none has been stored yet.
   */
  private async loadVault(): Promise<Vault> {
    if (this.vaultCache) {
      return this.vaultCache;
    }

    try {
      const raw = await keytar.getPassword(config.serviceName, VAULT_ACCOUNT);
      this.vaultCache = parseVault(raw);
      return this.vaultCache;
    } catch (error) {
      logger.error('Error reading key vault', error);
      throw new StorageError('Failed to access keychain');
    }
  }

  /**
   * Encode and write the vault back to the keychain (write-through),
   * keeping the in-process cache in sync.
   */
  private async saveVault(vault: Vault): Promise<void> {
    try {
      await keytar.setPassword(config.serviceName, VAULT_ACCOUNT, serializeVault(vault));
      this.vaultCache = vault;
    } catch (error) {
      logger.error('Error writing key vault', error);
      throw new StorageError('Failed to write to keychain');
    }
  }

  /**
   * Drop the cached vault so the next read re-fetches from the keychain.
   * Useful when another process may have mutated the vault.
   */
  invalidateCache(): void {
    this.vaultCache = null;
  }

  /**
   * Store an API key
   * @param name The name/identifier for the API key
   * @param key The API key to store
   * @returns Promise that resolves when the key is stored
   */
  async storeKey(name: string, key: string): Promise<void> {
    // Validate inputs to prevent security issues
    const validatedName = validateKeyName(name);
    const validatedKey = validateKeyValue(key);

    if (config.isDocker) {
      return this.storeKeyFile(validatedName, validatedKey);
    }

    const vault = await this.loadVault();
    vault[validatedName] = validatedKey;
    await this.saveVault(vault);
  }

  /**
   * Store an API key in a file (Docker fallback)
   * Uses encryption for secure storage
   */
  private async storeKeyFile(name: string, key: string): Promise<void> {
    try {
      // Hash the key name to prevent information leakage
      const hashedName = hash(name);
      const filePath = path.join(config.storageDir, `${hashedName}.enc`);

      // Create metadata file with encrypted key name
      const metadata: ApiKeyMetadata = {
        name: encrypt(name),
        created: new Date().toISOString()
      };

      // Encrypt the API key value
      const encryptedKey = encrypt(key);

      // Store encrypted data
      const data: EncryptedKeyData = {
        metadata,
        value: encryptedKey
      };
      const fileContent = JSON.stringify(data);

      // Write with secure permissions (owner read/write only)
      fs.writeFileSync(filePath, fileContent, {
        encoding: 'utf8',
        mode: 0o600
      });
    } catch (error) {
      logger.error('Error storing key in file', error, { keyName: name });
      if (error instanceof EncryptionError) {
        throw error;
      }
      throw new StorageError(`Failed to store key: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Retrieve an API key
   * @param name The name/identifier of the API key to retrieve
   * @returns Promise that resolves with the API key or null if not found
   */
  async getKey(name: string): Promise<string | null> {
    // Validate name to prevent path traversal
    const validatedName = validateKeyName(name);

    if (config.isDocker) {
      return this.getKeyFile(validatedName);
    }

    const vault = await this.loadVault();
    return vault[validatedName] ?? null;
  }

  /**
   * Retrieve an API key from a file (Docker fallback)
   * Decrypts the stored value
   */
  private getKeyFile(name: string): string | null {
    try {
      const hashedName = hash(name);
      const filePath = path.join(config.storageDir, `${hashedName}.enc`);

      if (fs.existsSync(filePath)) {
        const fileContent = fs.readFileSync(filePath, { encoding: 'utf8' });
        const data = JSON.parse(fileContent) as EncryptedKeyData;

        // Verify the name matches (encrypted name check)
        const decryptedName = decrypt(data.metadata.name);
        if (decryptedName !== name) {
          return null;
        }

        // Decrypt and return the API key value
        return decrypt(data.value);
      }
      return null;
    } catch (error) {
      logger.error('Error retrieving key from file', error, { keyName: name });
      return null;
    }
  }

  /**
   * Delete an API key
   * @param name The name/identifier of the API key to delete
   * @returns Promise that resolves with true if deleted, false otherwise
   */
  async deleteKey(name: string): Promise<boolean> {
    // Validate name to prevent path traversal
    const validatedName = validateKeyName(name);

    if (config.isDocker) {
      return this.deleteKeyFile(validatedName);
    }

    const vault = await this.loadVault();
    if (!(validatedName in vault)) {
      return false;
    }
    delete vault[validatedName];
    await this.saveVault(vault);
    return true;
  }

  /**
   * Delete an API key file (Docker fallback)
   */
  private deleteKeyFile(name: string): boolean {
    try {
      const hashedName = hash(name);
      const filePath = path.join(config.storageDir, `${hashedName}.enc`);

      if (fs.existsSync(filePath)) {
        // Verify it's the correct file by checking the encrypted name
        const fileContent = fs.readFileSync(filePath, { encoding: 'utf8' });
        const data = JSON.parse(fileContent) as EncryptedKeyData;
        const decryptedName = decrypt(data.metadata.name);

        if (decryptedName === name) {
          fs.unlinkSync(filePath);
          return true;
        }
      }
      return false;
    } catch (error) {
      logger.error('Error deleting key file', error, { keyName: name });
      return false;
    }
  }

  /**
   * List all stored API keys
   * @returns Promise that resolves with an array of key names
   */
  async listKeys(): Promise<string[]> {
    if (config.isDocker) {
      return this.listKeyFiles();
    }

    const vault = await this.loadVault();
    return Object.keys(vault);
  }

  /**
   * List all stored API key files (Docker fallback)
   */
  private listKeyFiles(): string[] {
    try {
      const files = fs.readdirSync(config.storageDir);
      const keyNames: string[] = [];

      for (const file of files) {
        if (file.endsWith('.enc')) {
          try {
            const filePath = path.join(config.storageDir, file);
            const fileContent = fs.readFileSync(filePath, { encoding: 'utf8' });
            const data = JSON.parse(fileContent) as EncryptedKeyData;

            // Decrypt the key name from metadata
            const decryptedName = decrypt(data.metadata.name);
            keyNames.push(decryptedName);
          } catch {
            // Skip files that can't be decrypted or parsed
            logger.warn('Error processing encrypted file', { file });
          }
        }
      }

      return keyNames;
    } catch (error) {
      logger.error('Error listing key files', error);
      return [];
    }
  }

  /**
   * One-shot migration from the legacy per-key keychain items to the
   * single blob vault. Reads every legacy item, folds it into the vault,
   * verifies the vault round-trips, and only then deletes the originals.
   *
   * This is intentionally verify-before-delete: a key is only removed
   * from its legacy slot once it has been confirmed present in the
   * freshly re-read vault, so an interrupted run can never lose data.
   *
   * @returns A report of which keys were migrated, deleted, and skipped.
   */
  async migrateToVault(): Promise<MigrationReport> {
    if (config.isDocker) {
      throw new StorageError('Migration only applies to keychain storage, not Docker file storage');
    }

    const report: MigrationReport = { migrated: [], deleted: [], skipped: [] };

    // Discover every credential under the service. findCredentials returns
    // each account's value directly, so we don't need a getPassword per key.
    const credentials = await keytar.findCredentials(config.serviceName);
    const legacy = credentials.filter(
      ({ account }) => account !== VAULT_ACCOUNT && account !== LEGACY_PERMISSION_MARKER
    );

    // Fold legacy items into the current vault (preserving any keys already
    // written via the new scheme).
    const vault = await this.loadVault();
    for (const { account, password } of legacy) {
      vault[account] = password;
      report.migrated.push(account);
    }
    await this.saveVault(vault);

    // Re-read the vault from the keychain (bypassing cache) to prove the
    // write landed before we delete anything.
    this.invalidateCache();
    const persisted = await this.loadVault();

    // Delete the legacy permission marker too — it's obsolete now.
    const obsolete = credentials
      .filter(({ account }) => account === LEGACY_PERMISSION_MARKER)
      .map(({ account }) => account);

    for (const { account, password } of legacy) {
      if (persisted[account] === password) {
        await keytar.deletePassword(config.serviceName, account);
        report.deleted.push(account);
      } else {
        // Verification failed — leave the legacy item in place.
        report.skipped.push(account);
      }
    }

    for (const account of obsolete) {
      await keytar.deletePassword(config.serviceName, account);
    }

    logger.info('Vault migration complete', {
      migrated: report.migrated.length,
      deleted: report.deleted.length,
      skipped: report.skipped.length
    });

    return report;
  }
}

export default new KeychainService();
