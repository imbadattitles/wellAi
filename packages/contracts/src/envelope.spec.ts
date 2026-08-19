import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { createEnvelope, parseEnvelope } from './envelope';

describe('message envelope', () => {
  it('creates and validates a versioned message', () => {
    const envelope = createEnvelope({
      messageType: 'example.created',
      producer: 'test-service',
      aggregateId: '7541dff5-0ff7-4820-a52e-c1f705de1e7f',
      payload: { name: 'example' },
    });

    const parsed = parseEnvelope(envelope, z.object({ name: z.string() }));

    expect(parsed.schemaVersion).toBe(1);
    expect(parsed.payload.name).toBe('example');
  });
});
