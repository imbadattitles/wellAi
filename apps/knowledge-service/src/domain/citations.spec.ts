import { describe, expect, it } from 'vitest';
import { InvalidCitationError, validateCitationChunkIds } from './citations';
import { RetrievedKnowledgeChunk } from './knowledge-source';

const retrieved: RetrievedKnowledgeChunk[] = [
  {
    chunkId: 'chunk-a',
    sourceId: 'source-a',
    text: 'First source fragment',
    page: 1,
    heading: null,
    similarity: 0.9,
  },
  {
    chunkId: 'chunk-b',
    sourceId: 'source-a',
    text: 'Second source fragment',
    page: 2,
    heading: null,
    similarity: 0.8,
  },
];

describe('validateCitationChunkIds', () => {
  it('accepts only retrieved chunk IDs and removes duplicates', () => {
    expect(validateCitationChunkIds(['chunk-b', 'chunk-a', 'chunk-b'], retrieved)).toEqual([
      'chunk-b',
      'chunk-a',
    ]);
  });

  it('rejects a hallucinated citation', () => {
    expect(() => validateCitationChunkIds(['chunk-a', 'chunk-missing'], retrieved)).toThrowError(
      InvalidCitationError,
    );
  });
});
