import { describe, it, expect, jest } from '@jest/globals';
import { csrfProtection } from '../../middleware/csrf.js';
import { createMockRequest, createMockResponse, asResponse } from '../helpers/express-mocks.js';

const ALLOWED = ['https://app.example.com'];

describe('CsrfProtection.validateOrigin', () => {
  it('skips safe methods without inspecting the origin', () => {
    const req = createMockRequest({ method: 'GET', headers: {} });
    const res = createMockResponse();
    const next = jest.fn();

    csrfProtection.validateOrigin(ALLOWED)(req, asResponse(res), next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.statusCode).toBe(200);
  });

  // The security fix: a state-changing request with no Origin/Referer must be
  // rejected, not waved through.
  it('rejects an unsafe method with no Origin or Referer (fail-closed)', () => {
    const req = createMockRequest({ method: 'POST', headers: {} });
    const res = createMockResponse();
    const next = jest.fn();

    csrfProtection.validateOrigin(ALLOWED)(req, asResponse(res), next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
    expect(res.body).toEqual({ error: 'Missing origin' });
  });

  it('rejects a disallowed origin', () => {
    const req = createMockRequest({ method: 'POST', headers: { origin: 'https://evil.example.com' } });
    const res = createMockResponse();
    const next = jest.fn();

    csrfProtection.validateOrigin(ALLOWED)(req, asResponse(res), next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
    expect(res.body).toEqual({ error: 'Origin not allowed' });
  });

  it('allows a whitelisted origin', () => {
    const req = createMockRequest({ method: 'POST', headers: { origin: 'https://app.example.com' } });
    const res = createMockResponse();
    const next = jest.fn();

    csrfProtection.validateOrigin(ALLOWED)(req, asResponse(res), next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.statusCode).toBe(200);
  });

  it('derives the origin from Referer when Origin is absent', () => {
    const req = createMockRequest({ method: 'POST', headers: { referer: 'https://app.example.com/some/path' } });
    const res = createMockResponse();
    const next = jest.fn();

    csrfProtection.validateOrigin(ALLOWED)(req, asResponse(res), next);

    expect(next).toHaveBeenCalledTimes(1);
  });

  it('rejects a malformed origin header', () => {
    const req = createMockRequest({ method: 'POST', headers: { origin: 'not-a-valid-url' } });
    const res = createMockResponse();
    const next = jest.fn();

    csrfProtection.validateOrigin(ALLOWED)(req, asResponse(res), next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
    expect(res.body).toEqual({ error: 'Invalid origin' });
  });
});

describe('CsrfProtection.doubleSubmitValidation', () => {
  it('skips safe methods', () => {
    const req = createMockRequest({ method: 'GET' });
    const res = createMockResponse();
    const next = jest.fn();

    csrfProtection.doubleSubmitValidation()(req, asResponse(res), next);

    expect(next).toHaveBeenCalledTimes(1);
  });

  it('rejects when the header or cookie token is missing', () => {
    const req = createMockRequest({ method: 'POST', headers: {}, cookies: {} });
    const res = createMockResponse();
    const next = jest.fn();

    csrfProtection.doubleSubmitValidation()(req, asResponse(res), next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
    expect(res.body).toEqual({ error: 'Missing CSRF token' });
  });

  it('rejects mismatched header and cookie tokens', () => {
    // Equal length so the constant-time compare reaches the inequality branch.
    const req = createMockRequest({
      method: 'POST',
      headers: { 'x-csrf-token': 'a'.repeat(24) },
      cookies: { 'csrf-token': 'b'.repeat(24) },
    });
    const res = createMockResponse();
    const next = jest.fn();

    csrfProtection.doubleSubmitValidation()(req, asResponse(res), next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
    expect(res.body).toEqual({ error: 'CSRF validation failed' });
  });

  it('rejects tokens of differing lengths without throwing (fails closed)', () => {
    const req = createMockRequest({
      method: 'POST',
      headers: { 'x-csrf-token': 'short' },
      cookies: { 'csrf-token': 'a-much-longer-token-value' },
    });
    const res = createMockResponse();
    const next = jest.fn();

    expect(() =>
      csrfProtection.doubleSubmitValidation()(req, asResponse(res), next)
    ).not.toThrow();
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
    expect(res.body).toEqual({ error: 'CSRF validation failed' });
  });

  it('passes when header and cookie tokens match', () => {
    const token = 'c'.repeat(24);
    const req = createMockRequest({
      method: 'POST',
      headers: { 'x-csrf-token': token },
      cookies: { 'csrf-token': token },
    });
    const res = createMockResponse();
    const next = jest.fn();

    csrfProtection.doubleSubmitValidation()(req, asResponse(res), next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.statusCode).toBe(200);
  });
});

describe('CsrfProtection.enforceSameSite', () => {
  it('wraps res.cookie to apply secure SameSite defaults', () => {
    const req = createMockRequest({ method: 'POST' });
    const res = createMockResponse();
    const next = jest.fn();

    csrfProtection.enforceSameSite()(req, asResponse(res), next);
    expect(next).toHaveBeenCalledTimes(1);

    // A later cookie write should pick up the enforced defaults.
    asResponse(res).cookie('session', 'value');
    expect(res.cookies.session.options).toMatchObject({
      sameSite: 'strict',
      httpOnly: true,
    });
  });
});
