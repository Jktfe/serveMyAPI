import keytar from 'keytar';
import fs from 'fs';
import path from 'path';

const SERVICE_NAME = 'serveMyAPI';
const PERMISSION_MARKER = '_permission_granted';
const STORAGE_DIR = process.env.STORAGE_DIR || '/app/data';
const IS_DOCKER = process.env.DOCKER_ENV === 'true';

/**
 * Service for securely storing and retrieving API keys
 * - Uses macOS Keychain on macOS systems
 * - Falls back to file-based storage in Docker environments
 */
export class KeychainService {
  private hasStoredPermissionMarker = false;

  constructor() {
    // Check for permission marker on initialization
    if (!IS_DOCKER) {
      this.checkPermissionMarker();
    } else {
      this.ensureStorageDirectory();
    }
  }

  /**
   * Ensure the storage directory exists for Docker environments
   */
  private ensureStorageDirectory(): void {
    if (IS_DOCKER) {
      try {
        if (!fs.existsSync(STORAGE_DIR)) {
          fs.mkdirSync(STORAGE_DIR, { recursive: true });
        }
      } catch (error) {
        console.error('Error creating storage directory:', error);
      }
    }
  }

  /**
   * Check if the permission marker exists, which indicates
   * that the user has previously granted permission
   */
  private async checkPermissionMarker(): Promise<void> {
    if (IS_DOCKER) return;
    
    try {
      const marker = await keytar.getPassword(SERVICE_NAME, PERMISSION_MARKER);
      this.hasStoredPermissionMarker = !!marker;
      
      if (!this.hasStoredPermissionMarker) {
        // If no marker exists, create one to consolidate permission requests
        await keytar.setPassword(SERVICE_NAME, PERMISSION_MARKER, 'true');
        this.hasStoredPermissionMarker = true;
      }
    } catch (error) {
      console.error('Error checking permission marker:', error);
    }
  }

  /**
   * Store an API key
   * @param name The name/identifier for the API key
   * @param key The API key to store
   * @returns Promise that resolves when the key is stored
   */
  async storeKey(name: string, key: string): Promise<void> {
    if (IS_DOCKER) {
      return this.storeKeyFile(name, key);
    }
    
    // Ensure permission marker exists before storing key
    if (!this.hasStoredPermissionMarker) {
      await this.checkPermissionMarker();
    }
    return keytar.setPassword(SERVICE_NAME, name, key);
  }

  /**
   * Store an API key in a file (Docker fallback)
   */
  private async storeKeyFile(name: string, key: string): Promise<void> {
    try {
      const filePath = path.join(STORAGE_DIR, `${name}.key`);
      fs.writeFileSync(filePath, key, { encoding: 'utf8' });
    } catch (error) {
      console.error(`Error storing key ${name} in file:`, error);
      throw error;
    }
  }

  /**
   * Retrieve an API key
   * @param name The name/identifier of the API key to retrieve
   * @returns Promise that resolves with the API key or null if not found
   */
  async getKey(name: string): Promise<string | null> {
    if (IS_DOCKER) {
      return this.getKeyFile(name);
    }
    
    // Ensure permission marker exists before retrieving key
    if (!this.hasStoredPermissionMarker) {
      await this.checkPermissionMarker();
    }
    return keytar.getPassword(SERVICE_NAME, name);
  }

  /**
   * Retrieve an API key from a file (Docker fallback)
   */
  private getKeyFile(name: string): string | null {
    try {
      const filePath = path.join(STORAGE_DIR, `${name}.key`);
      if (fs.existsSync(filePath)) {
        return fs.readFileSync(filePath, { encoding: 'utf8' });
      }
      return null;
    } catch (error) {
      console.error(`Error retrieving key ${name} from file:`, error);
      return null;
    }
  }

  /**
   * Delete an API key
   * @param name The name/identifier of the API key to delete
   * @returns Promise that resolves with true if deleted, false otherwise
   */
  async deleteKey(name: string): Promise<boolean> {
    if (IS_DOCKER) {
      return this.deleteKeyFile(name);
    }
    
    // Ensure permission marker exists before deleting key
    if (!this.hasStoredPermissionMarker) {
      await this.checkPermissionMarker();
    }
    return keytar.deletePassword(SERVICE_NAME, name);
  }

  /**
   * Delete an API key file (Docker fallback)
   */
  private deleteKeyFile(name: string): boolean {
    try {
      const filePath = path.join(STORAGE_DIR, `${name}.key`);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        return true;
      }
      return false;
    } catch (error) {
      console.error(`Error deleting key ${name} file:`, error);
      return false;
    }
  }

  /**
   * List all stored API keys
   * @returns Promise that resolves with an array of key names
   */
  async listKeys(): Promise<string[]> {
    if (IS_DOCKER) {
      return this.listKeyFiles();
    }
    
    // Ensure permission marker exists before listing keys
    if (!this.hasStoredPermissionMarker) {
      await this.checkPermissionMarker();
    }
    
    const credentials = await keytar.findCredentials(SERVICE_NAME);
    // Filter out the permission marker from the list of keys
    return credentials
      .map(cred => cred.account)
      .filter(account => account !== PERMISSION_MARKER);
  }

  /**
   * List all stored API key files (Docker fallback)
   */
  private listKeyFiles(): string[] {
    try {
      const files = fs.readdirSync(STORAGE_DIR);
      return files
        .filter(file => file.endsWith('.key'))
        .map(file => file.replace(/\.key$/, ''));
    } catch (error) {
      console.error('Error listing key files:', error);
      return [];
    }
  }
}

export default new KeychainService();