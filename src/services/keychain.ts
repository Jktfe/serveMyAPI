import keytar from 'keytar';

const SERVICE_NAME = 'serveMyAPI';
const PERMISSION_MARKER = '_permission_granted';

/**
 * Service for securely storing and retrieving API keys from macOS Keychain
 * with improved permission handling to reduce permission prompts
 */
export class KeychainService {
  private hasStoredPermissionMarker = false;

  constructor() {
    // Check for permission marker on initialization
    this.checkPermissionMarker();
  }

  /**
   * Check if the permission marker exists, which indicates
   * that the user has previously granted permission
   */
  private async checkPermissionMarker(): Promise<void> {
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
   * Store an API key in the keychain
   * @param name The name/identifier for the API key
   * @param key The API key to store
   * @returns Promise that resolves when the key is stored
   */
  async storeKey(name: string, key: string): Promise<void> {
    // Ensure permission marker exists before storing key
    if (!this.hasStoredPermissionMarker) {
      await this.checkPermissionMarker();
    }
    return keytar.setPassword(SERVICE_NAME, name, key);
  }

  /**
   * Retrieve an API key from the keychain
   * @param name The name/identifier of the API key to retrieve
   * @returns Promise that resolves with the API key or null if not found
   */
  async getKey(name: string): Promise<string | null> {
    // Ensure permission marker exists before retrieving key
    if (!this.hasStoredPermissionMarker) {
      await this.checkPermissionMarker();
    }
    return keytar.getPassword(SERVICE_NAME, name);
  }

  /**
   * Delete an API key from the keychain
   * @param name The name/identifier of the API key to delete
   * @returns Promise that resolves with true if deleted, false otherwise
   */
  async deleteKey(name: string): Promise<boolean> {
    // Ensure permission marker exists before deleting key
    if (!this.hasStoredPermissionMarker) {
      await this.checkPermissionMarker();
    }
    return keytar.deletePassword(SERVICE_NAME, name);
  }

  /**
   * List all stored API keys
   * @returns Promise that resolves with an array of key names
   */
  async listKeys(): Promise<string[]> {
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
}

export default new KeychainService();