import { Request } from 'express';
import { describe, expect, it } from 'vitest';
import { buildRateLimitKey } from './rate-limit.guard';

describe('buildRateLimitKey', () => {
  it('uses a bounded hash of IP and route instead of a caller-controlled user header', () => {
    const request = {
      ip: '203.0.113.10',
      method: 'GET',
      baseUrl: '/api/v1',
      path: `/learning-programs/${'x'.repeat(10_000)}`,
      route: { path: '/learning-programs/:programId' },
      socket: { remoteAddress: '127.0.0.1' },
      headers: { 'x-user-id': 'attacker-controlled' },
    } as unknown as Request;

    const key = buildRateLimitKey(request, 120_000);

    expect(key).toMatch(/^gateway:rate:v1:[a-f0-9]{32}:2$/);
    expect(key).not.toContain('attacker-controlled');
    expect(key.length).toBeLessThan(80);
  });
});
