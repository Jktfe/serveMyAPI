import type { Request, Response } from 'express';

/**
 * Minimal Express test doubles for unit-testing middleware in isolation —
 * no server boot, no supertest. Each mock records what the middleware did
 * (status code, body, headers, cookies) so assertions can read it back.
 */

export interface MockResponse {
  statusCode: number;
  body: unknown;
  headers: Record<string, string>;
  cookies: Record<string, { value: string; options?: unknown }>;
  status(code: number): MockResponse;
  json(payload: unknown): MockResponse;
  send(payload: unknown): MockResponse;
  setHeader(name: string, value: string): MockResponse;
  cookie(name: string, value: string, options?: unknown): MockResponse;
}

/** Build a request with sensible state-changing defaults; override per test. */
export function createMockRequest(overrides: Partial<Request> = {}): Request {
  return {
    method: 'POST',
    path: '/api/keys',
    headers: {},
    cookies: {},
    body: {},
    query: {},
    ip: '203.0.113.7',
    ...overrides,
  } as unknown as Request;
}

/** Build a response that records everything the middleware sets on it. */
export function createMockResponse(): MockResponse {
  return {
    statusCode: 200,
    body: undefined,
    headers: {},
    cookies: {},
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
    send(payload: unknown) {
      this.body = payload;
      return this;
    },
    setHeader(name: string, value: string) {
      this.headers[name] = value;
      return this;
    },
    cookie(name: string, value: string, options?: unknown) {
      this.cookies[name] = { value, options };
      return this;
    },
  };
}

/** Cast the recording mock to the Express Response type middleware expects. */
export function asResponse(res: MockResponse): Response {
  return res as unknown as Response;
}
