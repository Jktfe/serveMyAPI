import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { z } from 'zod';
import { config } from '../config/index.js';
import { AuthenticationError, ValidationError } from '../errors/index.js';
import { logger } from '../utils/logger.js';
import { apiKeyManager } from './api-key-manager.js';
import { CreateApiKeyRequest, ApiKeyResponse, ApiKeyMetadata } from '../types/auth.js';

// Token payload schemas
const accessTokenPayloadSchema = z.object({
  sub: z.string(), // Subject (API key ID)
  type: z.literal('access'),
  permissions: z.array(z.enum(['read', 'write', 'delete', 'admin'])),
  iat: z.number(),
  exp: z.number(),
  jti: z.string(), // JWT ID for revocation
});

const refreshTokenPayloadSchema = z.object({
  sub: z.string(),
  type: z.literal('refresh'),
  iat: z.number(),
  exp: z.number(),
  jti: z.string(),
});

export type AccessTokenPayload = z.infer<typeof accessTokenPayloadSchema>;
export type RefreshTokenPayload = z.infer<typeof refreshTokenPayloadSchema>;
export type Permission = AccessTokenPayload['permissions'][number];

// Token configuration
const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY = '7d';
const ISSUER = 'serveMyAPI';

/**
 * JWT Authentication Service
 */
export class AuthService {
  private readonly secret: string;
  private readonly revokedTokens = new Set<string>(); // In production, use Redis
  private readonly refreshTokens = new Map<string, number>(); // Token -> expiry timestamp

  constructor() {
    this.secret = this.getJwtSecret();
    
    // Clean up expired tokens periodically
    setInterval(() => this.cleanupExpiredTokens(), 60000); // Every minute
  }

  /**
   * Get or generate JWT secret
   */
  private getJwtSecret(): string {
    const envSecret = process.env.JWT_SECRET || process.env.SERVEAPI_JWT_SECRET;
    
    if (!envSecret) {
      if (config.nodeEnv === 'production') {
        throw new Error('JWT_SECRET must be set in production');
      }
      
      const generated = crypto.randomBytes(64).toString('base64');
      logger.warn('Generated temporary JWT secret - NOT FOR PRODUCTION');
      return generated;
    }
    
    return envSecret;
  }

  /**
   * Generate access token
   */
  generateAccessToken(
    apiKeyId: string, 
    permissions: Permission[] = ['read']
  ): string {
    const jti = crypto.randomUUID();
    
    const payload: Omit<AccessTokenPayload, 'iat' | 'exp'> = {
      sub: apiKeyId,
      type: 'access',
      permissions,
      jti,
    };

    return jwt.sign(payload, this.secret, {
      expiresIn: ACCESS_TOKEN_EXPIRY,
      issuer: ISSUER,
    });
  }

  /**
   * Generate refresh token
   */
  generateRefreshToken(apiKeyId: string): string {
    const jti = crypto.randomUUID();
    
    const payload: Omit<RefreshTokenPayload, 'iat' | 'exp'> = {
      sub: apiKeyId,
      type: 'refresh',
      jti,
    };

    const token = jwt.sign(payload, this.secret, {
      expiresIn: REFRESH_TOKEN_EXPIRY,
      issuer: ISSUER,
    });
    
    // Store refresh token with expiry
    const decoded = jwt.decode(token) as jwt.JwtPayload;
    if (decoded && typeof decoded.exp === 'number') {
      this.refreshTokens.set(jti, decoded.exp * 1000);
    }
    
    return token;
  }

  /**
   * Verify and decode access token
   */
  verifyAccessToken(token: string): AccessTokenPayload {
    try {
      const decoded = jwt.verify(token, this.secret, {
        issuer: ISSUER,
      }) as jwt.JwtPayload;

      // Validate token structure
      const validated = accessTokenPayloadSchema.parse(decoded);
      
      // Check if token is revoked
      if (this.revokedTokens.has(validated.jti)) {
        throw new AuthenticationError('Token has been revoked');
      }
      
      return validated;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new AuthenticationError('Access token has expired');
      }
      if (error instanceof jwt.JsonWebTokenError) {
        throw new AuthenticationError('Invalid access token');
      }
      if (error instanceof z.ZodError) {
        throw new ValidationError('Invalid token structure');
      }
      throw error;
    }
  }

  /**
   * Verify and decode refresh token
   */
  verifyRefreshToken(token: string): RefreshTokenPayload {
    try {
      const decoded = jwt.verify(token, this.secret, {
        issuer: ISSUER,
      }) as jwt.JwtPayload;

      // Validate token structure
      const validated = refreshTokenPayloadSchema.parse(decoded);
      
      // Check if token is revoked
      if (this.revokedTokens.has(validated.jti)) {
        throw new AuthenticationError('Token has been revoked');
      }
      
      return validated;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new AuthenticationError('Refresh token has expired');
      }
      if (error instanceof jwt.JsonWebTokenError) {
        throw new AuthenticationError('Invalid refresh token');
      }
      if (error instanceof z.ZodError) {
        throw new ValidationError('Invalid token structure');
      }
      throw error;
    }
  }

  /**
   * Refresh access token using refresh token
   */
  refreshAccessToken(refreshToken: string, permissions?: Permission[]): {
    accessToken: string;
    refreshToken: string;
  } {
    const payload = this.verifyRefreshToken(refreshToken);
    
    // Revoke old refresh token
    this.revokeToken(payload.jti);
    
    // Generate new tokens
    const newAccessToken = this.generateAccessToken(payload.sub, permissions);
    const newRefreshToken = this.generateRefreshToken(payload.sub);
    
    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    };
  }

  /**
   * Revoke a token by JTI
   */
  revokeToken(jti: string): void {
    this.revokedTokens.add(jti);
    logger.info('Token revoked', { jti });
    
    // In production, store in Redis with TTL
  }

  /**
   * Check if user has required permission
   */
  hasPermission(
    tokenPayload: AccessTokenPayload, 
    requiredPermission: Permission
  ): boolean {
    if (tokenPayload.permissions.includes('admin')) {
      return true;
    }
    return tokenPayload.permissions.includes(requiredPermission);
  }

  /**
   * Generate API key with associated tokens
   */
  generateApiKeyTokens(
    apiKeyId: string, 
    permissions: Permission[] = ['read']
  ): {
    apiKey: string;
    accessToken: string;
    refreshToken: string;
  } {
    // Generate a secure API key
    const apiKey = `sk_${crypto.randomBytes(32).toString('base64url')}`;
    
    // Generate tokens
    const accessToken = this.generateAccessToken(apiKeyId, permissions);
    const refreshToken = this.generateRefreshToken(apiKeyId);
    
    return {
      apiKey,
      accessToken,
      refreshToken,
    };
  }

  /**
   * Validate API key format
   */
  isValidApiKeyFormat(apiKey: string): boolean {
    return /^sk_[A-Za-z0-9_-]{43,}$/.test(apiKey);
  }

  /**
   * Create a new API key
   */
  async createApiKey(request: CreateApiKeyRequest): Promise<ApiKeyResponse> {
    return apiKeyManager.createApiKey(request);
  }

  /**
   * Revoke an API key
   */
  async revokeApiKey(id: string): Promise<void> {
    return apiKeyManager.revokeApiKey(id);
  }

  /**
   * List all API keys
   */
  async listApiKeys(): Promise<ApiKeyMetadata[]> {
    return apiKeyManager.listApiKeys();
  }

  /**
   * Clean up expired refresh tokens
   */
  private cleanupExpiredTokens(): void {
    const now = Date.now();
    for (const [token, exp] of this.refreshTokens.entries()) {
      if (exp < now) {
        this.refreshTokens.delete(token);
      }
    }
  }
}

// Export singleton instance
export const authService = new AuthService();