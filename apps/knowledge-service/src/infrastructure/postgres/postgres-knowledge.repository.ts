import { KafkaTopics, TopicMaterializationRequested } from '@wellllai/contracts';
import { addToOutbox, inTransaction } from '@wellllai/platform';
import { Pool, PoolClient } from 'pg';
import { IdempotencyConflictError, KnowledgeError } from '../../domain/errors';
import {
  KnowledgeSourceSnapshot,
  RetrievedKnowledgeChunk,
  SourceKind,
  SourceStatus,
} from '../../domain/knowledge-source';
import {
  FailKnowledgeSourceInput,
  KnowledgeRepositoryPort,
  PublishKnowledgeVersionInput,
  RegisterDocumentSourceInput,
} from '../../ports/knowledge-repository.port';

interface SourceRow {
  id: string;
  program_id: string;
  user_id: string;
  kind: SourceKind;
  status: SourceStatus;
  title: string;
  language: string;
  current_version_id: string | null;
}

interface IdempotencyRow {
  request_hash: string;
  source_id: string;
}

interface RetrievedChunkRow {
  chunk_id: string;
  source_id: string;
  text: string;
  page: number | null;
  heading: string | null;
  similarity: number;
}

const DOCUMENT_UPLOAD_SCOPE = 'POST /internal/documents';

export class PostgresKnowledgeRepository implements KnowledgeRepositoryPort {
  constructor(private readonly pool: Pool) {}

  async registerDocumentSource(
    input: RegisterDocumentSourceInput,
  ): Promise<KnowledgeSourceSnapshot> {
    return inTransaction(this.pool, async (client) => {
      const existingKey = await client.query<IdempotencyRow>(
        `SELECT request_hash, source_id
           FROM knowledge.idempotency_keys
          WHERE scope = $1 AND key = $2`,
        [DOCUMENT_UPLOAD_SCOPE, input.idempotencyKey],
      );
      const keyRow = existingKey.rows[0];
      if (keyRow) {
        if (keyRow.request_hash !== input.requestHash || keyRow.source_id !== input.sourceId) {
          throw new IdempotencyConflictError();
        }
        const existing = await this.findSourceWithClient(client, keyRow.source_id);
        if (!existing) throw new Error('Idempotency record points to a missing source');
        return existing;
      }

      const existingSource = await this.findSourceWithClient(client, input.sourceId);
      if (existingSource) {
        this.assertMatchingDocumentSource(existingSource, input);
        await this.insertIdempotencyKey(client, input);
        return existingSource;
      }

      await client.query(
        `INSERT INTO knowledge.knowledge_sources
          (id, program_id, user_id, kind, status, title, language)
         VALUES ($1, $2, $3, 'document', 'pending', $4, $5)`,
        [input.sourceId, input.programId, input.userId, input.title, input.language],
      );
      await this.insertIdempotencyKey(client, input);
      await addToOutbox(
        client,
        'knowledge',
        KafkaTopics.knowledgeCommands,
        input.sourceId,
        input.command,
      );

      const created = await this.findSourceWithClient(client, input.sourceId);
      if (!created) throw new Error('Failed to load the newly created source');
      return created;
    });
  }

  async ensureTopicSource(input: TopicMaterializationRequested): Promise<KnowledgeSourceSnapshot> {
    return inTransaction(this.pool, async (client) => {
      await client.query(
        `INSERT INTO knowledge.knowledge_sources
          (id, program_id, user_id, kind, status, title, language, source_spec)
         VALUES ($1, $2, $3, 'generated_topic', 'pending', $4, $5, $6::jsonb)
         ON CONFLICT (id) DO NOTHING`,
        [
          input.sourceId,
          input.programId,
          input.userId,
          input.topic,
          input.language,
          JSON.stringify({ topic: input.topic, level: input.level, goal: input.goal }),
        ],
      );

      const source = await this.findSourceWithClient(client, input.sourceId);
      if (!source) throw new Error('Failed to create the generated topic source');
      if (
        source.kind !== 'generated_topic' ||
        source.programId !== input.programId ||
        source.userId !== input.userId ||
        source.language !== input.language
      ) {
        throw new KnowledgeError(
          'KNOWLEDGE_SOURCE_CONFLICT',
          'The sourceId is already used by another knowledge source',
          409,
        );
      }
      return source;
    });
  }

  async findSource(sourceId: string): Promise<KnowledgeSourceSnapshot | null> {
    return this.findSourceWithClient(this.pool, sourceId);
  }

  async claimForProcessing(sourceId: string): Promise<boolean> {
    const result = await this.pool.query(
      `UPDATE knowledge.knowledge_sources
          SET status = 'processing', processing_started_at = NOW(), failure_code = NULL,
              updated_at = NOW()
        WHERE id = $1
          AND (
            status IN ('pending', 'failed')
            OR (status = 'processing' AND processing_started_at < NOW() - INTERVAL '10 minutes')
          )
      RETURNING id`,
      [sourceId],
    );
    return result.rowCount === 1;
  }

  async publishVersion(input: PublishKnowledgeVersionInput): Promise<void> {
    if (input.embeddingDimensions !== 1_536) {
      throw new Error('The knowledge schema requires 1536-dimensional embeddings');
    }
    for (const chunk of input.chunks) {
      this.assertVector(chunk.embedding, input.embeddingDimensions);
    }

    await inTransaction(this.pool, async (client) => {
      const sourceResult = await client.query<{ status: SourceStatus }>(
        `SELECT status
           FROM knowledge.knowledge_sources
          WHERE id = $1
          FOR UPDATE`,
        [input.sourceId],
      );
      const source = sourceResult.rows[0];
      if (!source) throw new Error(`Knowledge source ${input.sourceId} no longer exists`);
      if (source.status === 'ready') return;

      const versionResult = await client.query<{ next_version: number }>(
        `SELECT COALESCE(MAX(version), 0) + 1 AS next_version
           FROM knowledge.knowledge_versions
          WHERE source_id = $1`,
        [input.sourceId],
      );
      const version = Number(versionResult.rows[0]?.next_version ?? 1);

      await client.query(
        `INSERT INTO knowledge.knowledge_versions
          (id, source_id, version, title, embedding_model, embedding_dimensions,
           generation_model)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          input.versionId,
          input.sourceId,
          version,
          input.title,
          input.embeddingModel,
          input.embeddingDimensions,
          input.generationModel,
        ],
      );

      for (const topic of input.topics) {
        await client.query(
          `INSERT INTO knowledge.topics
            (id, knowledge_version_id, title, summary, position)
           VALUES ($1, $2, $3, $4, $5)`,
          [topic.id, input.versionId, topic.title, topic.summary, topic.position],
        );
      }

      for (const chunk of input.chunks) {
        await client.query(
          `INSERT INTO knowledge.chunks
            (id, knowledge_version_id, source_id, ordinal, text, page, heading,
             token_count, embedding)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::vector)`,
          [
            chunk.id,
            input.versionId,
            input.sourceId,
            chunk.ordinal,
            chunk.text,
            chunk.page,
            chunk.heading,
            chunk.tokenCount,
            this.toVectorLiteral(chunk.embedding),
          ],
        );
        if (chunk.topicId) {
          await client.query(
            `INSERT INTO knowledge.topic_chunks (topic_id, chunk_id) VALUES ($1, $2)`,
            [chunk.topicId, chunk.id],
          );
        }
      }

      await client.query(
        `UPDATE knowledge.knowledge_sources
            SET status = 'ready', title = $2, current_version_id = $3,
                processing_started_at = NULL, failure_code = NULL, updated_at = NOW()
          WHERE id = $1`,
        [input.sourceId, input.title, input.versionId],
      );
      await addToOutbox(
        client,
        'knowledge',
        KafkaTopics.knowledgeEvents,
        input.sourceId,
        input.readyEvent,
      );
    });
  }

  async failSource(input: FailKnowledgeSourceInput): Promise<void> {
    await inTransaction(this.pool, async (client) => {
      await client.query(
        `UPDATE knowledge.knowledge_sources
            SET status = 'failed', failure_code = $2, processing_started_at = NULL,
                updated_at = NOW()
          WHERE id = $1 AND status <> 'ready'`,
        [input.sourceId, input.failedEvent.payload.errorCode],
      );
      await addToOutbox(
        client,
        'knowledge',
        KafkaTopics.knowledgeEvents,
        input.sourceId,
        input.failedEvent,
      );
    });
  }

  async retrieve(
    sourceId: string,
    queryEmbedding: number[],
    limit: number,
  ): Promise<RetrievedKnowledgeChunk[]> {
    this.assertVector(queryEmbedding, 1_536);
    const result = await this.pool.query<RetrievedChunkRow>(
      `SELECT c.id AS chunk_id,
              c.source_id,
              c.text,
              c.page,
              c.heading,
              (1 - (c.embedding <=> $2::vector))::float8 AS similarity
         FROM knowledge.chunks c
         JOIN knowledge.knowledge_sources s
           ON s.id = c.source_id AND s.current_version_id = c.knowledge_version_id
        WHERE c.source_id = $1 AND s.status = 'ready'
        ORDER BY c.embedding <=> $2::vector
        LIMIT $3`,
      [sourceId, this.toVectorLiteral(queryEmbedding), limit],
    );

    return result.rows.map((row) => ({
      chunkId: row.chunk_id,
      sourceId: row.source_id,
      text: row.text,
      page: row.page,
      heading: row.heading,
      similarity: Math.max(-1, Math.min(1, Number(row.similarity))),
    }));
  }

  private async findSourceWithClient(
    client: Pick<Pool, 'query'> | PoolClient,
    sourceId: string,
  ): Promise<KnowledgeSourceSnapshot | null> {
    const result = await client.query<SourceRow>(
      `SELECT id, program_id, user_id, kind, status, title, language, current_version_id
         FROM knowledge.knowledge_sources
        WHERE id = $1`,
      [sourceId],
    );
    const row = result.rows[0];
    return row ? this.toSource(row) : null;
  }

  private async insertIdempotencyKey(
    client: PoolClient,
    input: RegisterDocumentSourceInput,
  ): Promise<void> {
    const insertion = await client.query(
      `INSERT INTO knowledge.idempotency_keys (scope, key, request_hash, source_id)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (scope, key) DO NOTHING
       RETURNING key`,
      [DOCUMENT_UPLOAD_SCOPE, input.idempotencyKey, input.requestHash, input.sourceId],
    );
    if (insertion.rowCount === 1) return;

    const existing = await client.query<IdempotencyRow>(
      `SELECT request_hash, source_id
         FROM knowledge.idempotency_keys
        WHERE scope = $1 AND key = $2`,
      [DOCUMENT_UPLOAD_SCOPE, input.idempotencyKey],
    );
    const row = existing.rows[0];
    if (!row || row.request_hash !== input.requestHash || row.source_id !== input.sourceId) {
      throw new IdempotencyConflictError();
    }
  }

  private assertMatchingDocumentSource(
    source: KnowledgeSourceSnapshot,
    input: RegisterDocumentSourceInput,
  ): void {
    if (
      source.kind !== 'document' ||
      source.programId !== input.programId ||
      source.userId !== input.userId ||
      source.language !== input.language
    ) {
      throw new KnowledgeError(
        'KNOWLEDGE_SOURCE_CONFLICT',
        'The sourceId is already used by another knowledge source',
        409,
      );
    }
  }

  private assertVector(vector: number[], dimensions: number): void {
    if (vector.length !== dimensions || vector.some((value) => !Number.isFinite(value))) {
      throw new Error(`Expected a finite ${dimensions}-dimensional embedding`);
    }
  }

  private toVectorLiteral(vector: number[]): string {
    return `[${vector.join(',')}]`;
  }

  private toSource(row: SourceRow): KnowledgeSourceSnapshot {
    return {
      id: row.id,
      programId: row.program_id,
      userId: row.user_id,
      kind: row.kind,
      status: row.status,
      title: row.title,
      language: row.language,
      currentVersionId: row.current_version_id,
    };
  }
}
