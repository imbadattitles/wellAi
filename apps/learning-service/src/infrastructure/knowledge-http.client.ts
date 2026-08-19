import { Injectable } from '@nestjs/common';
import { retrievedChunkSchema } from '@wellllai/contracts';
import { z } from 'zod';
import { KnowledgeRetrievalPort } from '../application/ports';

const retrievalResponseSchema = z.object({
  chunks: z.array(retrievedChunkSchema),
});

@Injectable()
export class KnowledgeHttpClient implements KnowledgeRetrievalPort {
  private readonly baseUrl = process.env.KNOWLEDGE_SERVICE_URL ?? 'http://localhost:3011';

  async retrieve(sourceId: string, query: string, limit: number) {
    const response = await fetch(`${this.baseUrl}/internal/retrievals`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ sourceId, query, limit }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) {
      throw new Error(`Knowledge service returned ${response.status}`);
    }
    return retrievalResponseSchema.parse(await response.json()).chunks;
  }
}
