import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { createMockRequest, createMockResponse, asResponse } from '../helpers/express-mocks.js';

/**
 * ESM-correct mocking: `jest.unstable_mockModule` registers the mock, then the
 * module under test is pulled in via dynamic `import()` AFTER the mock is set.
 * (`jest.mock` is not hoisted under native ESM, so the CommonJS pattern that
 * auto-mocks a module does not work here.)
 */
const validateApiKey = jest.fn<(key: string) => Promise<unknown>>();
const generateAccessToken = jest.fn<(id: string, perms: string[]) => string>();

jest.unstable_mockModule('../../services/api-key-manager.js', () => ({
  apiKeyManager: { validateApiKey },
}));
jest.unstable_mockModule('../../services/auth.js', () => ({
  authService: { generateAccessToken },
}));

const { apiKeyAuth } = await import('../../middleware/api-key-auth.js');

interface Metadata {
  id: string;
  name: string;
  permissions: string[];
  createdAt: string;
  expiresAt?: string;
}

function metadata(overrides: Partial<Metadata> = {}): Metadata {
  return {
    id: '11111111-1111-1111-1111-111111111111',
    name: 'test-key',
    permissions: ['read'],
    createdAt: new Date(0).toISOString(),
    ...overrides,
  };
}

describe('apiKeyAuth', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    generateAccessToken.mockReturnValue('signed.jwt.token');
  });

  it('rejects a request with no Authorization header (401) and never validates', async () => {
    const req = createMockRequest({ headers: {} });
    const res = createMockResponse();
    const next = jest.fn();

    await apiKeyAuth({ permissions: ['read'] })(req, asResponse(res), next);

    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
    expect(validateApiKey).not.toHaveBeenCalled();
  });

  it('passes through when no header is present but auth is optional', async () => {
    const req = createMockRequest({ headers: {} });
    const res = createMockResponse();
    const next = jest.fn();

    await apiKeyAuth({ optional: true })(req, asResponse(res), next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(validateApiKey).not.toHaveBeenCalled();
  });

  it('rejects an unverifiable key (401)', async () => {
    validateApiKey.mockRejectedValue(new Error('Invalid API key'));
    const req = createMockRequest({ headers: { authorization: 'Bearer bogus-key' } });
    const res = createMockResponse();
    const next = jest.fn();

    await apiKeyAuth({ permissions: ['read'] })(req, asResponse(res), next);

    expect(validateApiKey).toHaveBeenCalledWith('bogus-key');
    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects an expired key (401)', async () => {
    validateApiKey.mockResolvedValue(
      metadata({ expiresAt: new Date(Date.now() - 60_000).toISOString() })
    );
    const req = createMockRequest({ headers: { authorization: 'Bearer expired-key' } });
    const res = createMockResponse();
    const next = jest.fn();

    await apiKeyAuth({ permissions: ['read'] })(req, asResponse(res), next);

    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects a valid key lacking the required permission (403)', async () => {
    validateApiKey.mockResolvedValue(metadata({ permissions: ['read'] }));
    const req = createMockRequest({ headers: { authorization: 'Bearer read-only-key' } });
    const res = createMockResponse();
    const next = jest.fn();

    await apiKeyAuth({ permissions: ['write'] })(req, asResponse(res), next);

    expect(res.statusCode).toBe(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('authenticates a valid, sufficiently-permitted key: sets req.auth, issues a JWT, calls next', async () => {
    validateApiKey.mockResolvedValue(metadata({ permissions: ['read', 'write'] }));
    const req = createMockRequest({ headers: { authorization: 'Bearer good-key' } });
    const res = createMockResponse();
    const next = jest.fn();

    await apiKeyAuth({ permissions: ['write'] })(req, asResponse(res), next);

    expect(validateApiKey).toHaveBeenCalledWith('good-key');
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.statusCode).toBe(200);
    expect((req as unknown as { auth: { apiKeyId: string; permissions: string[] } }).auth).toMatchObject({
      apiKeyId: '11111111-1111-1111-1111-111111111111',
      permissions: ['read', 'write'],
    });
    expect(res.headers['X-Auth-Token']).toBe('signed.jwt.token');
  });
});
