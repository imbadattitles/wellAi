import { describe, expect, it } from 'vitest';
import { RetrievedKnowledgeChunk } from './knowledge-source';
import { rankRetrievedChunks } from './retrieval-ranking';

function chunk(chunkId: string, similarity: number): RetrievedKnowledgeChunk {
  return {
    chunkId,
    sourceId: 'source-a',
    text: chunkId,
    page: null,
    heading: null,
    similarity,
  };
}

describe('rankRetrievedChunks', () => {
  it('deduplicates, sorts by similarity, filters invalid scores and applies the limit', () => {
    const result = rankRetrievedChunks(
      [
        chunk('low', 0.2),
        chunk('best', 0.95),
        chunk('same', 0.5),
        chunk('same', 0.8),
        chunk('invalid', Number.NaN),
      ],
      2,
      0.3,
    );

    expect(result.map(({ chunkId, similarity }) => ({ chunkId, similarity }))).toEqual([
      { chunkId: 'best', similarity: 0.95 },
      { chunkId: 'same', similarity: 0.8 },
    ]);
  });

  it('rejects a non-positive limit', () => {
    expect(() => rankRetrievedChunks([], 0)).toThrow('positive integer');
  });
});
