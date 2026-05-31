import crypto from 'crypto';
import { getEncryptionKey } from '../config/index.js';
import { EncryptionError } from '../errors/index.js';

const ALGORITHM = 'aes-256-gcm';
const SALT_LENGTH = 32;
const IV_LENGTH = 16;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32;
const ITERATIONS = 100000;

/**
 * Derives an encryption key from a password using PBKDF2
 */
function deriveKey(password: string, salt: Buffer): Buffer {
  return crypto.pbkdf2Sync(password, salt, ITERATIONS, KEY_LENGTH, 'sha256');
}

/**
 * Encrypts a string using AES-256-GCM
 * @param text The text to encrypt
 * @returns Base64 encoded encrypted data with salt, iv, tag, and ciphertext
 */
export function encrypt(text: string): string {
  const password = getEncryptionKey();
  
  // Generate random salt and IV
  const salt = crypto.randomBytes(SALT_LENGTH);
  const iv = crypto.randomBytes(IV_LENGTH);
  
  // Derive key from password
  const key = deriveKey(password, salt);
  
  // Create cipher
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  // Encrypt the text
  const encrypted = Buffer.concat([
    cipher.update(text, 'utf8'),
    cipher.final()
  ]);
  
  // Get the authentication tag
  const tag = cipher.getAuthTag();
  
  // Combine salt, iv, tag, and encrypted data
  const combined = Buffer.concat([salt, iv, tag, encrypted]);
  
  // Return base64 encoded
  return combined.toString('base64');
}

/**
 * Decrypts a string encrypted with encrypt()
 * @param encryptedText Base64 encoded encrypted data
 * @returns The decrypted text
 * @throws Error if decryption fails
 */
export function decrypt(encryptedText: string): string {
  const password = getEncryptionKey();
  
  // Decode from base64
  const combined = Buffer.from(encryptedText, 'base64');
  
  // Extract components
  const salt = combined.slice(0, SALT_LENGTH);
  const iv = combined.slice(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
  const tag = combined.slice(SALT_LENGTH + IV_LENGTH, SALT_LENGTH + IV_LENGTH + TAG_LENGTH);
  const encrypted = combined.slice(SALT_LENGTH + IV_LENGTH + TAG_LENGTH);
  
  // Derive key from password
  const key = deriveKey(password, salt);
  
  // Create decipher
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  
  // Decrypt
  try {
    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final()
    ]);
    
    return decrypted.toString('utf8');
  } catch {
    throw new EncryptionError('Failed to decrypt data. Invalid key or corrupted data.');
  }
}

/**
 * Hashes a string using SHA-256 (for file names)
 * @param text The text to hash
 * @returns Hex encoded hash
 */
export function hash(text: string): string {
  return crypto.createHash('sha256').update(text).digest('hex');
}