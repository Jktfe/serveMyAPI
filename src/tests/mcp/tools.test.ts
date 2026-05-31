import { describe, it, expect, beforeEach, jest } from '@jest/globals';

/**
 * The keychain service is the default export of its module. Under native ESM,
 * `jest.mock(...)` auto-mocking does not produce mock functions, so we register
 * an explicit mock module and import the tools afterwards via dynamic import.
 */
const storeKey = jest.fn<(name: string, key: string) => Promise<void>>();
const getKey = jest.fn<(name: string) => Promise<string | null>>();
const deleteKey = jest.fn<(name: string) => Promise<boolean>>();
const listKeys = jest.fn<() => Promise<string[]>>();

jest.unstable_mockModule('../../services/keychain.js', () => ({
  default: { storeKey, getKey, deleteKey, listKeys },
}));

const { storeApiKeyTool, getApiKeyTool, deleteApiKeyTool, listApiKeysTool } = await import(
  '../../mcp/tools.js'
);

describe('MCP Tools', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('storeApiKeyTool', () => {
    it('should store an API key successfully', async () => {
      storeKey.mockResolvedValue(undefined);

      const result = await storeApiKeyTool.handler({ name: 'test-key', key: 'test-value' });

      expect(storeKey).toHaveBeenCalledWith('test-key', 'test-value');
      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toBe('Successfully stored API key with name: test-key');
    });

    it('should handle storage errors', async () => {
      storeKey.mockRejectedValue(new Error('Storage failed'));

      const result = await storeApiKeyTool.handler({ name: 'test-key', key: 'test-value' });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Storage failed');
    });
  });

  describe('getApiKeyTool', () => {
    it('should retrieve an API key successfully', async () => {
      getKey.mockResolvedValue('test-value');

      const result = await getApiKeyTool.handler({ name: 'test-key' });

      expect(getKey).toHaveBeenCalledWith('test-key');
      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toBe('test-value');
    });

    it('should handle key not found', async () => {
      getKey.mockResolvedValue(null);

      const result = await getApiKeyTool.handler({ name: 'test-key' });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toBe('No API key found with name: test-key');
    });
  });

  describe('deleteApiKeyTool', () => {
    it('should delete an API key successfully', async () => {
      deleteKey.mockResolvedValue(true);

      const result = await deleteApiKeyTool.handler({ name: 'test-key' });

      expect(deleteKey).toHaveBeenCalledWith('test-key');
      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toBe('Successfully deleted API key with name: test-key');
    });

    it('should handle key not found on delete', async () => {
      deleteKey.mockResolvedValue(false);

      const result = await deleteApiKeyTool.handler({ name: 'test-key' });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toBe('No API key found with name: test-key');
    });
  });

  describe('listApiKeysTool', () => {
    it('should list API keys successfully', async () => {
      listKeys.mockResolvedValue(['key1', 'key2', 'key3']);

      const result = await listApiKeysTool.handler({});

      expect(listKeys).toHaveBeenCalled();
      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain('Available API keys');
      expect(result.content[0].text).toContain('key1');
      expect(result.content[0].text).toContain('key2');
      expect(result.content[0].text).toContain('key3');
    });

    it('should handle empty key list', async () => {
      listKeys.mockResolvedValue([]);

      const result = await listApiKeysTool.handler({});

      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toBe('No available api keys found');
    });
  });
});
