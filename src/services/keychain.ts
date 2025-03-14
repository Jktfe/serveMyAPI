import keytar from 'keytar';

const SERVICE_NAME = 'serveMyAPI';

/**
 * Service for securely storing and retrieving API keys from macOS Keychain
 */
export class KeychainService {
  /**
   * Store an API key in the keychain
   * @param name The name/identifier for the API key
   * @param key The API key to store
   * @returns Promise that resolves when the key is stored
   */
  async storeKey(name: string, key: string): Promise<void> {
    return keytar.setPassword(SERVICE_NAME, name, key);
  }

  /**
   * Retrieve an API key from the keychain
   * @param name The name/identifier of the API key to retrieve
   * @returns Promise that resolves with the API key or null if not found
   */
  async getKey(name: string): Promise<string | null> {
    return keytar.getPassword(SERVICE_NAME, name);
  }

  /**
   * Delete an API key from the keychain
   * @param name The name/identifier of the API key to delete
   * @returns Promise that resolves with true if deleted, false otherwise
   */
  async deleteKey(name: string): Promise<boolean> {
    return keytar.deletePassword(SERVICE_NAME, name);
  }

  /**
   * List all stored API keys
   * @returns Promise that resolves with an array of key names
   */
  async listKeys(): Promise<string[]> {
    const credentials = await keytar.findCredentials(SERVICE_NAME);
    return credentials.map(cred => cred.account);
  }
}

export default new KeychainService();