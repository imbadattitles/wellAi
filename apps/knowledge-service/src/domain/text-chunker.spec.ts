import { describe, expect, it } from 'vitest';
import { TextChunker } from './text-chunker';

describe('TextChunker', () => {
  it('creates deterministic overlapping chunks and preserves page metadata', () => {
    const chunker = new TextChunker(4, 1);

    const chunks = chunker.chunk([
      {
        text: 'one   two\nthree four five six seven',
        page: 3,
        heading: 'Numbers',
      },
    ]);

    expect(chunks).toEqual([
      {
        text: 'one two three four',
        page: 3,
        heading: 'Numbers',
        tokenCount: 4,
      },
      {
        text: 'four five six seven',
        page: 3,
        heading: 'Numbers',
        tokenCount: 4,
      },
    ]);
  });

  it('ignores empty pages', () => {
    const chunks = new TextChunker().chunk([
      { text: ' \n ', page: 1, heading: null },
      { text: 'useful text', page: 2, heading: null },
    ]);

    expect(chunks).toHaveLength(1);
    expect(chunks[0]?.page).toBe(2);
  });
});
