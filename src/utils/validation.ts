import { z } from 'zod';
import { ValidationError } from '../errors/index.js';

/**
 * Validates API key names to prevent path traversal and other security issues
 * Allows only alphanumeric characters, underscores, and hyphens
 * Maximum length of 255 characters
 */
export const apiKeyNameSchema = z.string()
  .min(1, 'Key name cannot be empty')
  .max(255, 'Key name too long (max 255 characters)')
  .regex(/^[a-zA-Z0-9_-]+$/, 'Key name can only contain letters, numbers, underscores, and hyphens')
  .refine(
    (name) => !name.includes('..') && !name.includes('/') && !name.includes('\\'),
    'Key name contains invalid characters'
  );

/**
 * Validates API key values
 * Ensures reasonable length limits and basic format
 */
export const apiKeyValueSchema = z.string()
  .min(1, 'API key value cannot be empty')
  .max(4096, 'API key value too long (max 4096 characters)')
  .refine(
    (value) => value.trim().length > 0,
    'API key value cannot be only whitespace'
  );

/**
 * Sanitizes a key name for safe storage
 * Removes any potentially dangerous characters
 */
export function sanitizeKeyName(name: string): string {
  // Remove any non-alphanumeric characters except underscore and hyphen
  return name.replace(/[^a-zA-Z0-9_-]/g, '');
}

/**
 * Validates if a key name is safe to use
 * @throws ValidationError if validation fails
 */
export function validateKeyName(name: string): string {
  try {
    return apiKeyNameSchema.parse(name);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new ValidationError(`Invalid key name: ${error.errors[0].message}`, error.errors);
    }
    throw error;
  }
}

/**
 * Validates if a key value is safe to store
 * @throws ValidationError if validation fails
 */
export function validateKeyValue(value: string): string {
  try {
    return apiKeyValueSchema.parse(value);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new ValidationError(`Invalid key value: ${error.errors[0].message}`, error.errors);
    }
    throw error;
  }
}