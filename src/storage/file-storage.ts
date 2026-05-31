import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import { StorageProvider } from './storage-interface.js';
import { logger } from '../utils/logger.js';
import { getEncryptionKey } from '../config/index.js';

/**
 * File-based storage provider with encryption
 * Stores API keys in an encrypted JSON file
 */
export class FileStorage implements StorageProvider {
  private readonly filePath: string;
  private readonly encryptionKey: string;
  
  constructor(filePath?: string) {
    // Default to user's home directory
    this.filePath = filePath || path.join(os.homedir(), '.servemyapi', 'keys.json.enc');
    this.encryptionKey = getEncryptionKey();
  }
  
  /**
   * Ensure the storage directory exists
   */
  private async ensureDirectory(): Promise<void> {
    const dir = path.dirname(this.filePath);
    await fs.mkdir(dir, { recursive: true });
  }
  
  /**
   * Encrypt data.
   *
   * A fresh random salt is generated per write and stored alongside the
   * ciphertext, so the scrypt-derived key differs every time even for the
   * same passphrase — a static salt would make the KDF output predictable
   * across all files and installs.
   */
  private encrypt(data: string): string {
    const salt = crypto.randomBytes(16);
    const iv = crypto.randomBytes(16);
    const key = crypto.scryptSync(this.encryptionKey, salt, 32);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    return JSON.stringify({
      salt: salt.toString('hex'),
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex'),
      data: encrypted
    });
  }

  /**
   * Decrypt data.
   *
   * Reads the per-file salt from the blob. Files written before per-file
   * salting (no `salt` field) fall back to the original literal 'salt' so
   * existing data stays readable.
   */
  private decrypt(encryptedData: string): string {
    const { salt, iv, authTag, data } = JSON.parse(encryptedData);
    const keySalt: crypto.BinaryLike = salt ? Buffer.from(salt, 'hex') : 'salt';
    const key = crypto.scryptSync(this.encryptionKey, keySalt, 32);

    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      key,
      Buffer.from(iv, 'hex')
    );

    decipher.setAuthTag(Buffer.from(authTag, 'hex'));

    let decrypted = decipher.update(data, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }
  
  /**
   * Read the storage file
   */
  private async readStorage(): Promise<Record<string, string>> {
    try {
      const encryptedData = await fs.readFile(this.filePath, 'utf8');
      const decryptedData = this.decrypt(encryptedData);
      return JSON.parse(decryptedData);
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
        return {};
      }
      throw error;
    }
  }
  
  /**
   * Write to the storage file
   */
  private async writeStorage(data: Record<string, string>): Promise<void> {
    await this.ensureDirectory();
    const jsonData = JSON.stringify(data, null, 2);
    const encryptedData = this.encrypt(jsonData);
    await fs.writeFile(this.filePath, encryptedData, 'utf8');
  }
  
  async store(key: string, value: string): Promise<void> {
    try {
      const storage = await this.readStorage();
      storage[key] = value;
      await this.writeStorage(storage);
      logger.debug('Stored key in file', { key, path: this.filePath });
    } catch (error) {
      logger.error('Failed to store key in file', { key, error });
      throw new Error(`Failed to store key: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  async get(key: string): Promise<string | null> {
    try {
      const storage = await this.readStorage();
      const value = storage[key] || null;
      logger.debug('Retrieved key from file', { key, found: !!value });
      return value;
    } catch (error) {
      logger.error('Failed to get key from file', { key, error });
      throw new Error(`Failed to get key: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  async delete(key: string): Promise<boolean> {
    try {
      const storage = await this.readStorage();
      if (key in storage) {
        delete storage[key];
        await this.writeStorage(storage);
        logger.debug('Deleted key from file', { key });
        return true;
      }
      return false;
    } catch (error) {
      logger.error('Failed to delete key from file', { key, error });
      throw new Error(`Failed to delete key: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  async list(): Promise<string[]> {
    try {
      const storage = await this.readStorage();
      const keys = Object.keys(storage);
      logger.debug('Listed keys from file', { count: keys.length });
      return keys;
    } catch (error) {
      logger.error('Failed to list keys from file', { error });
      throw new Error(`Failed to list keys: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  async isAvailable(): Promise<boolean> {
    try {
      await this.ensureDirectory();
      // Try to write and read a test file
      const testPath = path.join(path.dirname(this.filePath), '.test');
      await fs.writeFile(testPath, 'test', 'utf8');
      await fs.unlink(testPath);
      return true;
    } catch (error) {
      logger.warn('File storage not available', { error });
      return false;
    }
  }
  
  getType(): string {
    return 'file';
  }
}