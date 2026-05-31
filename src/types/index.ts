/**
 * Shared type definitions for serveMyAPI
 */

import { z } from 'zod';

export interface ToolResponseContent {
  type: 'text';
  text: string;
  [key: string]: unknown;
}

export interface ToolResponse {
  content: ToolResponseContent[];
  isError?: boolean;
}

export type ToolHandler<T = unknown> = (params: T) => Promise<ToolResponse>;

export interface ToolDefinition {
  name: string;
  description: string;
  schema: Record<string, z.ZodType<unknown>>;
  handler: ToolHandler;
}

export interface KeychainRepository {
  storeKey(name: string, key: string): Promise<void>;
  getKey(name: string): Promise<string | null>;
  deleteKey(name: string): Promise<boolean>;
  listKeys(): Promise<string[]>;
}

export interface SessionInfo {
  transport: unknown;
  clientId: string;
  createdAt: Date;
}

export interface RateLimitEntry {
  count: number;
  resetTime: number;
}

export interface ApiKeyMetadata {
  name: string;
  created: string;
}

export interface EncryptedKeyData {
  metadata: ApiKeyMetadata;
  value: string;
}