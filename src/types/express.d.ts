import { Permission } from '../services/auth.js';

declare global {
  namespace Express {
    interface Request {
      auth?: {
        apiKeyId: string;
        permissions: Permission[];
        jti: string;
      };
    }
  }
}

export {};