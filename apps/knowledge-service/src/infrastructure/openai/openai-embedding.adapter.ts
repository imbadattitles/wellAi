import { z } from 'zod';
import { OpenAiRequestError } from '../../domain/errors';
import { EmbeddingPort } from '../../ports/embedding.port';
import { OpenAiHttpClient } from './openai-http.client';

const embeddingResponseSchema = z.object({
  data: z.array(
    z.object({
      index: z.number().int().nonnegative(),
      embedding: z.array(z.number().finite()),
    }),
  ),
});

export class OpenAiEmbeddingAdapter implements EmbeddingPort {
  readonly dimensions = 1_536;

  constructor(
    private readonly client: OpenAiHttpClient,
    readonly model: string,
    private readonly batchSize = 64,
  ) {}

  async embed(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];
    const vectors: number[][] = [];

    for (let start = 0; start < texts.length; start += this.batchSize) {
      const batch = texts.slice(start, start + this.batchSize);
      const response = await this.client.post(
        '/embeddings',
        {
          model: this.model,
          input: batch,
          encoding_format: 'float',
          dimensions: this.dimensions,
        },
        embeddingResponseSchema,
      );
      const ordered = [...response.data].sort((left, right) => left.index - right.index);
      if (ordered.length !== batch.length) {
        throw new OpenAiRequestError('OpenAI omitted one or more embedding vectors', true);
      }
      for (const item of ordered) {
        if (item.embedding.length !== this.dimensions) {
          throw new OpenAiRequestError(
            `OpenAI returned an embedding with ${item.embedding.length} dimensions`,
            false,
          );
        }
        vectors.push(item.embedding);
      }
    }

    return vectors;
  }
}
