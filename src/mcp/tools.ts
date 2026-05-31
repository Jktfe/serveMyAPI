import { z } from 'zod';
import { ToolDefinition } from '../types/index.js';
import { createValidatedToolHandler } from './tool-handler.js';
import keychainService from '../services/keychain.js';
import { ResponseBuilder } from '../utils/response-builder.js';
import { KeyNotFoundError } from '../errors/index.js';

/**
 * Store API key tool
 */
export const storeApiKeyTool: ToolDefinition = {
  name: 'store-api-key',
  description: 'Store an API key in the secure keychain',
  schema: {
    name: z.string().min(1).describe('The name/identifier for the API key'),
    key: z.string().min(1).describe('The API key to store'),
  },
  handler: createValidatedToolHandler(
    'store-api-key',
    (params) => z.object({ 
      name: z.string().min(1), 
      key: z.string().min(1) 
    }).parse(params),
    async ({ name, key }) => {
      await keychainService.storeKey(name, key);
      return ResponseBuilder.success(`Successfully stored API key with name: ${name}`);
    }
  )
};

/**
 * Get API key tool
 */
export const getApiKeyTool: ToolDefinition = {
  name: 'get-api-key',
  description: 'Retrieve an API key from the secure keychain',
  schema: {
    name: z.string().min(1).describe('The name/identifier of the API key to retrieve'),
  },
  handler: createValidatedToolHandler(
    'get-api-key',
    (params) => z.object({ 
      name: z.string().min(1) 
    }).parse(params),
    async ({ name }) => {
      const key = await keychainService.getKey(name);
      
      if (!key) {
        throw new KeyNotFoundError(name);
      }
      
      return ResponseBuilder.success(key);
    }
  )
};

/**
 * Delete API key tool
 */
export const deleteApiKeyTool: ToolDefinition = {
  name: 'delete-api-key',
  description: 'Delete an API key from the secure keychain',
  schema: {
    name: z.string().min(1).describe('The name/identifier of the API key to delete'),
  },
  handler: createValidatedToolHandler(
    'delete-api-key',
    (params) => z.object({ 
      name: z.string().min(1) 
    }).parse(params),
    async ({ name }) => {
      const success = await keychainService.deleteKey(name);
      
      if (!success) {
        throw new KeyNotFoundError(name);
      }
      
      return ResponseBuilder.success(`Successfully deleted API key with name: ${name}`);
    }
  )
};

/**
 * List API keys tool
 */
export const listApiKeysTool: ToolDefinition = {
  name: 'list-api-keys',
  description: 'List all stored API keys',
  schema: {},
  handler: createValidatedToolHandler(
    'list-api-keys',
    () => ({}), // No parameters to validate
    async () => {
      const keys = await keychainService.listKeys();
      return ResponseBuilder.list('Available API keys', keys);
    }
  )
};

/**
 * All available tools
 */
export const tools: ToolDefinition[] = [
  storeApiKeyTool,
  getApiKeyTool,
  deleteApiKeyTool,
  listApiKeysTool,
];