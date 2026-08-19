import { CitedAnswer, RetrievedChunk } from '@wellllai/contracts';
import { LearningAiOutputError } from '../domain/errors';

function normalize(value: string): string {
  return value.replace(/\s+/g, ' ').trim().toLocaleLowerCase();
}

export function validateCitedAnswer(answer: CitedAnswer, chunks: RetrievedChunk[]): CitedAnswer {
  const chunksById = new Map(chunks.map((chunk) => [chunk.chunkId, chunk]));
  const citations = answer.citations.filter((citation) => {
    const chunk = chunksById.get(citation.chunkId);
    const normalizedQuote = normalize(citation.quote);
    return chunk && normalizedQuote.length > 0
      ? normalize(chunk.text).includes(normalizedQuote)
      : false;
  });

  if (!answer.insufficientContext && citations.length === 0) {
    throw new LearningAiOutputError('The AI answer did not contain a verifiable citation');
  }

  return { ...answer, citations };
}

export function keepKnownChunkIds(ids: string[], chunks: RetrievedChunk[]): string[] {
  const knownIds = new Set(chunks.map((chunk) => chunk.chunkId));
  return [...new Set(ids.filter((id) => knownIds.has(id)))];
}
