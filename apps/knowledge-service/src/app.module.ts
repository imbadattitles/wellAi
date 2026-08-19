import { Module } from '@nestjs/common';
import { KafkaEventPublisher, PgOutboxRelay, createPostgresPool } from '@wellllai/platform';
import { Pool } from 'pg';
import { IngestDocumentUseCase } from './application/ingest-document.use-case';
import { MaterializeTopicUseCase } from './application/materialize-topic.use-case';
import { RecordSourceFailureUseCase } from './application/record-source-failure.use-case';
import { RetrieveKnowledgeUseCase } from './application/retrieve-knowledge.use-case';
import { UploadDocumentUseCase } from './application/upload-document.use-case';
import { KnowledgeConfig, readKnowledgeConfig } from './config/knowledge.config';
import { TextChunker } from './domain/text-chunker';
import { KnowledgeCommandConsumer } from './infrastructure/kafka/knowledge-command.consumer';
import { OutboxRelayWorker } from './infrastructure/kafka/outbox-relay.worker';
import { OpenAiEmbeddingAdapter } from './infrastructure/openai/openai-embedding.adapter';
import { OpenAiHttpClient } from './infrastructure/openai/openai-http.client';
import { OpenAiTopicMaterializerAdapter } from './infrastructure/openai/openai-topic-materializer.adapter';
import { PdfParseTextExtractorAdapter } from './infrastructure/pdf/pdf-parse-text-extractor.adapter';
import { PostgresBlobStorageAdapter } from './infrastructure/postgres/postgres-blob-storage.adapter';
import { PostgresCommandInboxAdapter } from './infrastructure/postgres/postgres-command-inbox.adapter';
import { PostgresKnowledgeRepository } from './infrastructure/postgres/postgres-knowledge.repository';
import { PostgresLifecycle } from './infrastructure/postgres/postgres-lifecycle';
import {
  KAFKA_EVENT_PUBLISHER,
  KNOWLEDGE_CONFIG,
  OPENAI_HTTP_CLIENT,
  POSTGRES_POOL,
} from './infrastructure/tokens';
import { BLOB_STORAGE, BlobStoragePort } from './ports/blob-storage.port';
import { COMMAND_INBOX, CommandInboxPort } from './ports/command-inbox.port';
import { EMBEDDING_PORT, EmbeddingPort } from './ports/embedding.port';
import { KNOWLEDGE_REPOSITORY, KnowledgeRepositoryPort } from './ports/knowledge-repository.port';
import { TEXT_EXTRACTION, TextExtractionPort } from './ports/text-extraction.port';
import { TOPIC_MATERIALIZER, TopicMaterializerPort } from './ports/topic-materializer.port';
import { KnowledgeController } from './presentation/http/knowledge.controller';

@Module({
  controllers: [KnowledgeController],
  providers: [
    {
      provide: KNOWLEDGE_CONFIG,
      useFactory: (): KnowledgeConfig => readKnowledgeConfig(),
    },
    {
      provide: POSTGRES_POOL,
      useFactory: (config: KnowledgeConfig): Pool =>
        createPostgresPool(config.databaseUrl, 'knowledge-service'),
      inject: [KNOWLEDGE_CONFIG],
    },
    {
      provide: KNOWLEDGE_REPOSITORY,
      useFactory: (pool: Pool): KnowledgeRepositoryPort => new PostgresKnowledgeRepository(pool),
      inject: [POSTGRES_POOL],
    },
    {
      provide: BLOB_STORAGE,
      useFactory: (pool: Pool): BlobStoragePort => new PostgresBlobStorageAdapter(pool),
      inject: [POSTGRES_POOL],
    },
    {
      provide: COMMAND_INBOX,
      useFactory: (pool: Pool): CommandInboxPort => new PostgresCommandInboxAdapter(pool),
      inject: [POSTGRES_POOL],
    },
    {
      provide: TEXT_EXTRACTION,
      useFactory: (): TextExtractionPort => new PdfParseTextExtractorAdapter(),
    },
    {
      provide: OPENAI_HTTP_CLIENT,
      useFactory: (config: KnowledgeConfig): OpenAiHttpClient =>
        new OpenAiHttpClient({
          apiKey: config.openAi.apiKey,
          baseUrl: config.openAi.baseUrl,
          timeoutMs: config.openAi.timeoutMs,
        }),
      inject: [KNOWLEDGE_CONFIG],
    },
    {
      provide: EMBEDDING_PORT,
      useFactory: (client: OpenAiHttpClient, config: KnowledgeConfig): EmbeddingPort =>
        new OpenAiEmbeddingAdapter(client, config.openAi.embeddingModel),
      inject: [OPENAI_HTTP_CLIENT, KNOWLEDGE_CONFIG],
    },
    {
      provide: TOPIC_MATERIALIZER,
      useFactory: (client: OpenAiHttpClient, config: KnowledgeConfig): TopicMaterializerPort =>
        new OpenAiTopicMaterializerAdapter(client, config.openAi.textModel),
      inject: [OPENAI_HTTP_CLIENT, KNOWLEDGE_CONFIG],
    },
    {
      provide: TextChunker,
      useFactory: (): TextChunker => new TextChunker(),
    },
    {
      provide: UploadDocumentUseCase,
      useFactory: (
        repository: KnowledgeRepositoryPort,
        blobs: BlobStoragePort,
        config: KnowledgeConfig,
      ): UploadDocumentUseCase =>
        new UploadDocumentUseCase(repository, blobs, config.maxDocumentBytes),
      inject: [KNOWLEDGE_REPOSITORY, BLOB_STORAGE, KNOWLEDGE_CONFIG],
    },
    {
      provide: IngestDocumentUseCase,
      useFactory: (
        repository: KnowledgeRepositoryPort,
        blobs: BlobStoragePort,
        extractor: TextExtractionPort,
        embeddings: EmbeddingPort,
        chunker: TextChunker,
      ): IngestDocumentUseCase =>
        new IngestDocumentUseCase(repository, blobs, extractor, embeddings, chunker),
      inject: [KNOWLEDGE_REPOSITORY, BLOB_STORAGE, TEXT_EXTRACTION, EMBEDDING_PORT, TextChunker],
    },
    {
      provide: MaterializeTopicUseCase,
      useFactory: (
        repository: KnowledgeRepositoryPort,
        materializer: TopicMaterializerPort,
        embeddings: EmbeddingPort,
        chunker: TextChunker,
      ): MaterializeTopicUseCase =>
        new MaterializeTopicUseCase(repository, materializer, embeddings, chunker),
      inject: [KNOWLEDGE_REPOSITORY, TOPIC_MATERIALIZER, EMBEDDING_PORT, TextChunker],
    },
    {
      provide: RetrieveKnowledgeUseCase,
      useFactory: (
        repository: KnowledgeRepositoryPort,
        embeddings: EmbeddingPort,
      ): RetrieveKnowledgeUseCase => new RetrieveKnowledgeUseCase(repository, embeddings),
      inject: [KNOWLEDGE_REPOSITORY, EMBEDDING_PORT],
    },
    {
      provide: RecordSourceFailureUseCase,
      useFactory: (repository: KnowledgeRepositoryPort): RecordSourceFailureUseCase =>
        new RecordSourceFailureUseCase(repository),
      inject: [KNOWLEDGE_REPOSITORY],
    },
    {
      provide: KAFKA_EVENT_PUBLISHER,
      useFactory: (config: KnowledgeConfig): KafkaEventPublisher =>
        new KafkaEventPublisher(`${config.kafkaClientId}-producer`, config.kafkaBrokers),
      inject: [KNOWLEDGE_CONFIG],
    },
    {
      provide: PgOutboxRelay,
      useFactory: (pool: Pool, publisher: KafkaEventPublisher): PgOutboxRelay =>
        new PgOutboxRelay(pool, 'knowledge', publisher),
      inject: [POSTGRES_POOL, KAFKA_EVENT_PUBLISHER],
    },
    {
      provide: OutboxRelayWorker,
      useFactory: (
        relay: PgOutboxRelay,
        publisher: KafkaEventPublisher,
        config: KnowledgeConfig,
      ): OutboxRelayWorker => new OutboxRelayWorker(relay, publisher, config.outboxPollMs),
      inject: [PgOutboxRelay, KAFKA_EVENT_PUBLISHER, KNOWLEDGE_CONFIG],
    },
    {
      provide: KnowledgeCommandConsumer,
      useFactory: (
        config: KnowledgeConfig,
        inbox: CommandInboxPort,
        ingestDocument: IngestDocumentUseCase,
        materializeTopic: MaterializeTopicUseCase,
        recordFailure: RecordSourceFailureUseCase,
      ): KnowledgeCommandConsumer =>
        new KnowledgeCommandConsumer(
          config.kafkaBrokers,
          config.kafkaClientId,
          config.kafkaGroupId,
          inbox,
          ingestDocument,
          materializeTopic,
          recordFailure,
        ),
      inject: [
        KNOWLEDGE_CONFIG,
        COMMAND_INBOX,
        IngestDocumentUseCase,
        MaterializeTopicUseCase,
        RecordSourceFailureUseCase,
      ],
    },
    {
      provide: PostgresLifecycle,
      useFactory: (pool: Pool): PostgresLifecycle => new PostgresLifecycle(pool),
      inject: [POSTGRES_POOL],
    },
  ],
})
export class AppModule {}
