import { randomUUID } from 'node:crypto';
import {
  createEnvelope,
  KnowledgeSourceReady,
  MessageEnvelope,
  MessageTypes,
  TopicMaterializationRequested,
} from '@wellllai/contracts';
import { KnowledgeChunkDraft, KnowledgeTopicDraft } from '../domain/knowledge-source';
import { TextChunker } from '../domain/text-chunker';
import { EmbeddingPort } from '../ports/embedding.port';
import { KnowledgeRepositoryPort } from '../ports/knowledge-repository.port';
import { TopicMaterializerPort } from '../ports/topic-materializer.port';

export class MaterializeTopicUseCase {
  constructor(
    private readonly repository: KnowledgeRepositoryPort,
    private readonly materializer: TopicMaterializerPort,
    private readonly embeddings: EmbeddingPort,
    private readonly chunker: TextChunker,
  ) {}

  async execute(
    payload: TopicMaterializationRequested,
    command: MessageEnvelope<TopicMaterializationRequested>,
  ): Promise<void> {
    const source = await this.repository.ensureTopicSource(payload);
    const claimed = await this.repository.claimForProcessing(source.id);
    if (!claimed) return;

    const material = await this.materializer.materialize({
      topic: payload.topic,
      level: payload.level,
      goal: payload.goal,
      language: payload.language,
    });

    const topics: KnowledgeTopicDraft[] = material.sections.map((section, position) => ({
      id: randomUUID(),
      title: section.title,
      summary: section.summary,
      position,
    }));
    const chunkInputs = material.sections.flatMap((section, sectionIndex) =>
      this.chunker
        .chunk([
          {
            text: section.content,
            page: null,
            heading: section.title,
          },
        ])
        .map((chunk) => ({ chunk, topicId: topics[sectionIndex]?.id ?? null })),
    );

    if (chunkInputs.length === 0) {
      throw new Error('The topic materializer returned no lesson content');
    }

    const vectors = await this.embeddings.embed(chunkInputs.map(({ chunk }) => chunk.text));
    if (vectors.length !== chunkInputs.length) {
      throw new Error('The embedding provider returned an unexpected number of vectors');
    }

    const chunks: KnowledgeChunkDraft[] = chunkInputs.map(({ chunk, topicId }, index) => ({
      id: randomUUID(),
      ordinal: index,
      text: chunk.text,
      page: null,
      heading: chunk.heading,
      tokenCount: chunk.tokenCount,
      embedding: vectors[index] ?? [],
      topicId,
    }));
    const versionId = randomUUID();
    const readyPayload: KnowledgeSourceReady = {
      sourceId: source.id,
      programId: source.programId,
      knowledgeVersionId: versionId,
      title: material.title,
      topicIds: topics.map((topic) => topic.id),
    };
    const readyEvent = createEnvelope({
      messageType: MessageTypes.knowledgeSourceReady,
      producer: 'knowledge-service',
      aggregateId: source.id,
      correlationId: command.correlationId,
      causationId: command.messageId,
      traceparent: command.traceparent,
      payload: readyPayload,
    });

    await this.repository.publishVersion({
      sourceId: source.id,
      versionId,
      title: material.title,
      embeddingModel: this.embeddings.model,
      embeddingDimensions: this.embeddings.dimensions,
      generationModel: this.materializer.model,
      chunks,
      topics,
      readyEvent: { ...readyEvent, payload: readyPayload },
    });
  }
}
