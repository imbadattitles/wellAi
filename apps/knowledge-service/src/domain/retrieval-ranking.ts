import { RetrievedKnowledgeChunk } from './knowledge-source';

export function rankRetrievedChunks(
  candidates: RetrievedKnowledgeChunk[],
  limit: number,
  minimumSimilarity = -1,
): RetrievedKnowledgeChunk[] {
  if (!Number.isInteger(limit) || limit < 1) {
    throw new Error('Retrieval limit must be a positive integer');
  }

  const bestByChunkId = new Map<string, RetrievedKnowledgeChunk>();

  for (const candidate of candidates) {
    if (!Number.isFinite(candidate.similarity) || candidate.similarity < minimumSimilarity) {
      continue;
    }

    const existing = bestByChunkId.get(candidate.chunkId);
    if (!existing || candidate.similarity > existing.similarity) {
      bestByChunkId.set(candidate.chunkId, candidate);
    }
  }

  return [...bestByChunkId.values()]
    .sort(
      (left, right) =>
        right.similarity - left.similarity || left.chunkId.localeCompare(right.chunkId),
    )
    .slice(0, limit);
}
