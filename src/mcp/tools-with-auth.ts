import { z } from 'zod';
import { ToolDefinition, ToolResponse } from '../types/index.js';
import { createValidatedToolHandler } from './tool-handler.js';
import keychainService from '../services/keychain.js';
import { ResponseBuilder } from '../utils/response-builder.js';
import { KeyNotFoundError, AuthenticationError } from '../errors/index.js';
import { apiKeyManager } from '../services/api-key-manager.js';

// Context schema for authenticated requests
const authContextSchema = z.object({
  apiKeyId: z.string(),
  permissions: z.array(z.string()),
});

type AuthContext = z.infer<typeof authContextSchema>;

/**
 * Create an authenticated tool handler
 */
function createAuthenticatedHandler<T>(
  name: string,
  paramsSchema: z.ZodType<T>,
  requiredPermission: 'read' | 'write' | 'delete',
  handler: (params: T, auth: AuthContext) => Promise<ToolResponse>
) {
  return createValidatedToolHandler(
    name,
    (params) => {
      const validatedParams = paramsSchema.parse(params);
      const authContext = authContextSchema.parse((params as { _auth?: unknown })._auth);
      return { params: validatedParams, auth: authContext };
    },
    async ({ params, auth }) => {
      // For admin permission, allow all operations
      if (auth.permissions.includes('admin')) {
        return handler(params, auth);
      }
      
      // Check if user has required permission
      if (!auth.permissions.includes(requiredPermission)) {
        throw new AuthenticationError(
          `Insufficient permissions. Required: ${requiredPermission}`
        );
      }
      
      return handler(params, auth);
    }
  );
}

/**
 * Store API key tool with authentication
 */
export const storeApiKeyToolWithAuth: ToolDefinition = {
  name: 'store-api-key',
  description: 'Store an API key in the secure keychain',
  schema: {
    name: z.string().min(1).describe('The name/identifier for the API key'),
    key: z.string().min(1).describe('The API key to store'),
    _auth: z.unknown().describe('Authentication context (internal)'),
  },
  handler: createAuthenticatedHandler(
    'store-api-key',
    z.object({
      name: z.string().min(1),
      key: z.string().min(1),
    }),
    'write',
    async ({ name, key }, auth) => {
      // Check scope access
      const hasAccess = await apiKeyManager.checkKeyAccess(
        auth.apiKeyId,
        name,
        'write'
      );
      
      if (!hasAccess) {
        throw new AuthenticationError(
          `Access denied. Key '${name}' is outside your allowed scopes.`
        );
      }
      
      await keychainService.storeKey(name, key);
      return ResponseBuilder.success(`Successfully stored API key with name: ${name}`);
    }
  )
};

/**
 * Get API key tool with authentication
 */
export const getApiKeyToolWithAuth: ToolDefinition = {
  name: 'get-api-key',
  description: 'Retrieve an API key from the secure keychain',
  schema: {
    name: z.string().min(1).describe('The name/identifier of the API key to retrieve'),
    _auth: z.unknown().describe('Authentication context (internal)'),
  },
  handler: createAuthenticatedHandler(
    'get-api-key',
    z.object({
      name: z.string().min(1),
    }),
    'read',
    async ({ name }, auth) => {
      // Check scope access
      const hasAccess = await apiKeyManager.checkKeyAccess(
        auth.apiKeyId,
        name,
        'read'
      );
      
      if (!hasAccess) {
        throw new AuthenticationError(
          `Access denied. Key '${name}' is outside your allowed scopes.`
        );
      }
      
      const key = await keychainService.getKey(name);
      
      if (!key) {
        throw new KeyNotFoundError(name);
      }
      
      return ResponseBuilder.success(key);
    }
  )
};

/**
 * Delete API key tool with authentication
 */
export const deleteApiKeyToolWithAuth: ToolDefinition = {
  name: 'delete-api-key',
  description: 'Delete an API key from the secure keychain',
  schema: {
    name: z.string().min(1).describe('The name/identifier of the API key to delete'),
    _auth: z.unknown().describe('Authentication context (internal)'),
  },
  handler: createAuthenticatedHandler(
    'delete-api-key',
    z.object({
      name: z.string().min(1),
    }),
    'delete',
    async ({ name }, auth) => {
      // Check scope access
      const hasAccess = await apiKeyManager.checkKeyAccess(
        auth.apiKeyId,
        name,
        'delete'
      );
      
      if (!hasAccess) {
        throw new AuthenticationError(
          `Access denied. Key '${name}' is outside your allowed scopes.`
        );
      }
      
      const success = await keychainService.deleteKey(name);
      
      if (!success) {
        throw new KeyNotFoundError(name);
      }
      
      return ResponseBuilder.success(`Successfully deleted API key with name: ${name}`);
    }
  )
};

/**
 * List API keys tool with authentication
 */
export const listApiKeysToolWithAuth: ToolDefinition = {
  name: 'list-api-keys',
  description: 'List all stored API keys',
  schema: {
    _auth: z.unknown().describe('Authentication context (internal)'),
  },
  handler: createAuthenticatedHandler(
    'list-api-keys',
    z.object({}),
    'read',
    async (_, auth) => {
      const allKeys = await keychainService.listKeys();
      
      // Filter keys based on scope access
      const accessibleKeys: string[] = [];
      
      for (const key of allKeys) {
        // Skip internal API keys
        if (key.startsWith('_servemyapi_')) continue;
        
        const hasAccess = await apiKeyManager.checkKeyAccess(
          auth.apiKeyId,
          key,
          'read'
        );
        
        if (hasAccess) {
          accessibleKeys.push(key);
        }
      }
      
      return ResponseBuilder.list('Available API keys', accessibleKeys);
    }
  )
};

/**
 * All authenticated tools
 */
export const authenticatedTools: ToolDefinition[] = [
  storeApiKeyToolWithAuth,
  getApiKeyToolWithAuth,
  deleteApiKeyToolWithAuth,
  listApiKeysToolWithAuth,
];