import { SourceNotFoundError, SourceNotReadyError } from '../domain/errors';
import { RetrievedKnowledgeChunk } from '../domain/knowledge-source';
import { rankRetrievedChunks } from '../domain/retrieval-ranking';
import { EmbeddingPort } from '../ports/embedding.port';
import { KnowledgeRepositoryPort } from '../ports/knowledge-repository.port';

export interface RetrieveKnowledgeInput {
  sourceId: string;
  query: string;
  limit: number;
}

export class RetrieveKnowledgeUseCase {
  constructor(
    private readonly repository: KnowledgeRepositoryPort,
    private readonly embeddings: EmbeddingPort,
  ) {}

  async execute(input: RetrieveKnowledgeInput): Promise<RetrievedKnowledgeChunk[]> {
    const source = await this.repository.findSource(input.sourceId);
    if (!source) {
      throw new SourceNotFoundError(input.sourceId);
    }
    if (source.status !== 'ready') {
      throw new SourceNotReadyError(input.sourceId);
    }

    const [queryEmbedding] = await this.embeddings.embed([input.query.trim()]);
    if (!queryEmbedding) {
      throw new Error('The embedding provider returned no query vector');
    }

    const candidates = await this.repository.retrieve(
      input.sourceId,
      queryEmbedding,
      Math.min(input.limit * 2, 40),
    );
    return rankRetrievedChunks(candidates, input.limit);
  }
}
