import { RetrievedKnowledgeChunk } from './knowledge-source';

export class InvalidCitationError extends Error {
  constructor(readonly invalidChunkIds: string[]) {
    super(`Unknown citation chunks: ${invalidChunkIds.join(', ')}`);
    this.name = 'InvalidCitationError';
  }
}

export function validateCitationChunkIds(
  candidateChunkIds: string[],
  retrievedChunks: RetrievedKnowledgeChunk[],
): string[] {
  const allowed = new Set(retrievedChunks.map((chunk) => chunk.chunkId));
  const unique = [...new Set(candidateChunkIds)];
  const invalid = unique.filter((chunkId) => !allowed.has(chunkId));

  if (invalid.length > 0) {
    throw new InvalidCitationError(invalid);
  }

  return unique;
}
