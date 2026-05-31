import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { storeApiKeyTool, getApiKeyTool, deleteApiKeyTool, listApiKeysTool } from '../../mcp/tools.js';
import keychainService from '../../services/keychain.js';

// Mock the keychain service
jest.mock('../../services/keychain.js');

describe('MCP Tools', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('storeApiKeyTool', () => {
    it('should store an API key successfully', async () => {
      const mockStoreKey = keychainService.storeKey as jest.MockedFunction<typeof keychainService.storeKey>;
      mockStoreKey.mockResolvedValue(undefined);

      const result = await storeApiKeyTool.handler({ name: 'test-key', key: 'test-value' });

      expect(mockStoreKey).toHaveBeenCalledWith('test-key', 'test-value');
      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toBe('Successfully stored API key with name: test-key');
    });

    it('should handle storage errors', async () => {
      const mockStoreKey = keychainService.storeKey as jest.MockedFunction<typeof keychainService.storeKey>;
      mockStoreKey.mockRejectedValue(new Error('Storage failed'));

      const result = await storeApiKeyTool.handler({ name: 'test-key', key: 'test-value' });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Storage failed');
    });
  });

  describe('getApiKeyTool', () => {
    it('should retrieve an API key successfully', async () => {
      const mockGetKey = keychainService.getKey as jest.MockedFunction<typeof keychainService.getKey>;
      mockGetKey.mockResolvedValue('test-value');

      const result = await getApiKeyTool.handler({ name: 'test-key' });

      expect(mockGetKey).toHaveBeenCalledWith('test-key');
      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toBe('test-value');
    });

    it('should handle key not found', async () => {
      const mockGetKey = keychainService.getKey as jest.MockedFunction<typeof keychainService.getKey>;
      mockGetKey.mockResolvedValue(null);

      const result = await getApiKeyTool.handler({ name: 'test-key' });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toBe('No API key found with name: test-key');
    });
  });

  describe('deleteApiKeyTool', () => {
    it('should delete an API key successfully', async () => {
      const mockDeleteKey = keychainService.deleteKey as jest.MockedFunction<typeof keychainService.deleteKey>;
      mockDeleteKey.mockResolvedValue(true);

      const result = await deleteApiKeyTool.handler({ name: 'test-key' });

      expect(mockDeleteKey).toHaveBeenCalledWith('test-key');
      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toBe('Successfully deleted API key with name: test-key');
    });

    it('should handle key not found on delete', async () => {
      const mockDeleteKey = keychainService.deleteKey as jest.MockedFunction<typeof keychainService.deleteKey>;
      mockDeleteKey.mockResolvedValue(false);

      const result = await deleteApiKeyTool.handler({ name: 'test-key' });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toBe('No API key found with name: test-key');
    });
  });

  describe('listApiKeysTool', () => {
    it('should list API keys successfully', async () => {
      const mockListKeys = keychainService.listKeys as jest.MockedFunction<typeof keychainService.listKeys>;
      mockListKeys.mockResolvedValue(['key1', 'key2', 'key3']);

      const result = await listApiKeysTool.handler({});

      expect(mockListKeys).toHaveBeenCalled();
      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain('Available API keys');
      expect(result.content[0].text).toContain('key1');
      expect(result.content[0].text).toContain('key2');
      expect(result.content[0].text).toContain('key3');
    });

    it('should handle empty key list', async () => {
      const mockListKeys = keychainService.listKeys as jest.MockedFunction<typeof keychainService.listKeys>;
      mockListKeys.mockResolvedValue([]);

      const result = await listApiKeysTool.handler({});

      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toBe('No available api keys found');
    });
  });
});