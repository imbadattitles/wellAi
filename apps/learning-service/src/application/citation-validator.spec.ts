import { describe, expect, it } from 'vitest';
import { validateCitedAnswer } from './citation-validator';

const chunk = {
  chunkId: 'e44ed13e-b07d-42c1-a4e0-e27a837a72ec',
  sourceId: '5cc30ed6-2488-4b88-8893-ea4ffc487899',
  text: 'PostgreSQL uses MVCC to provide transaction isolation.',
  page: 7,
  heading: 'Transactions',
  similarity: 0.92,
};

describe('validateCitedAnswer', () => {
  it('keeps an exact citation from supplied context', () => {
    const result = validateCitedAnswer(
      {
        answer: 'PostgreSQL uses MVCC.',
        citations: [{ chunkId: chunk.chunkId, quote: 'uses MVCC' }],
        insufficientContext: false,
      },
      [chunk],
    );
    expect(result.citations).toHaveLength(1);
  });

  it('rejects a fabricated citation', () => {
    expect(() =>
      validateCitedAnswer(
        {
          answer: 'Invented.',
          citations: [{ chunkId: chunk.chunkId, quote: 'not present' }],
          insufficientContext: false,
        },
        [chunk],
      ),
    ).toThrow(/verifiable citation/);
  });

  it('rejects a whitespace-only citation', () => {
    expect(() =>
      validateCitedAnswer(
        {
          answer: 'Ungrounded.',
          citations: [{ chunkId: chunk.chunkId, quote: '   \n  ' }],
          insufficientContext: false,
        },
        [chunk],
      ),
    ).toThrow(/verifiable citation/);
  });
});
