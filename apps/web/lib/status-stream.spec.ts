import { describe, expect, it } from 'vitest';
import { parseSseFrames } from './status-stream';

describe('parseSseFrames', () => {
  it('handles fragmented CRLF frames and multiple events', () => {
    const first = parseSseFrames('event: state\r\ndata: {"status":"pro');
    expect(first.events).toEqual([]);

    const second = parseSseFrames(
      `${first.remainder}cessing"}\r\nretry: 2000\r\n\r\nevent: heartbeat\ndata: {}\n\npartial`,
    );
    expect(second.events).toEqual([
      { type: 'state', data: '{"status":"processing"}', retry: 2000 },
      { type: 'heartbeat', data: '{}' },
    ]);
    expect(second.remainder).toBe('partial');
  });

  it('joins multiline data and ignores SSE comments', () => {
    const parsed = parseSseFrames(': keep-alive\nevent: state\ndata: first\ndata: second\n\n');
    expect(parsed.events).toEqual([{ type: 'state', data: 'first\nsecond' }]);
  });
});
