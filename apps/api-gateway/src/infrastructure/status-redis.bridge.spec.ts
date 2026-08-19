import { describe, expect, it } from 'vitest';
import { parseStatusSignal } from './status-redis.bridge';

describe('parseStatusSignal', () => {
  it('accepts a bounded status hint and rejects malformed Redis data', () => {
    const signal = {
      resource: 'learning-program',
      resourceId: 'ea5655d4-248b-4f9d-a846-d6eab73f03ff',
      eventId: '46d40467-60ee-436a-a106-eed62eb48fd1',
    };
    expect(parseStatusSignal(JSON.stringify(signal))).toEqual(signal);
    expect(parseStatusSignal('{broken')).toBeNull();
    expect(parseStatusSignal(JSON.stringify({ ...signal, resourceId: 'not-a-uuid' }))).toBeNull();
  });
});
