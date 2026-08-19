import { Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import {
  documentIngestionRequestedSchema,
  KafkaTopics,
  MessageEnvelope,
  messageEnvelopeSchema,
  MessageTypes,
  parseEnvelope,
  topicMaterializationRequestedSchema,
} from '@wellllai/contracts';
import { Consumer, EachMessagePayload, Kafka } from 'kafkajs';
import { z } from 'zod';
import { IngestDocumentUseCase } from '../../application/ingest-document.use-case';
import { MaterializeTopicUseCase } from '../../application/materialize-topic.use-case';
import { RecordSourceFailureUseCase } from '../../application/record-source-failure.use-case';
import { CommandInboxPort } from '../../ports/command-inbox.port';

export class KnowledgeCommandConsumer implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(KnowledgeCommandConsumer.name);
  private readonly consumer: Consumer;

  constructor(
    brokers: string[],
    clientId: string,
    groupId: string,
    private readonly inbox: CommandInboxPort,
    private readonly ingestDocument: IngestDocumentUseCase,
    private readonly materializeTopic: MaterializeTopicUseCase,
    private readonly recordFailure: RecordSourceFailureUseCase,
  ) {
    this.consumer = new Kafka({ brokers, clientId: `${clientId}-consumer` }).consumer({
      groupId,
      sessionTimeout: 120_000,
      heartbeatInterval: 3_000,
    });
  }

  async onModuleInit(): Promise<void> {
    await this.consumer.connect();
    await this.consumer.subscribe({ topic: KafkaTopics.knowledgeCommands, fromBeginning: false });
    await this.consumer.run({
      eachMessage: async (message) => {
        const heartbeatTimer = setInterval(() => {
          void message.heartbeat().catch((error: unknown) => {
            const detail = error instanceof Error ? error.message : 'unknown heartbeat error';
            this.logger.warn(`Kafka heartbeat failed: ${detail}`);
          });
        }, 3_000);
        heartbeatTimer.unref();
        try {
          await this.handleMessage(message);
        } finally {
          clearInterval(heartbeatTimer);
        }
      },
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.consumer.stop();
    await this.consumer.disconnect();
  }

  private async handleMessage({ message }: EachMessagePayload): Promise<void> {
    if (!message.value) return;

    let raw: unknown;
    try {
      raw = JSON.parse(message.value.toString('utf8'));
    } catch {
      this.logger.error('Ignored a Kafka command with invalid JSON');
      return;
    }

    const base = messageEnvelopeSchema.safeParse(raw);
    if (!base.success) {
      this.logger.error('Ignored a Kafka command with an invalid envelope');
      return;
    }

    if (base.data.messageType === MessageTypes.knowledgeDocumentIngestionRequested) {
      const envelope = this.parsePayload(raw, documentIngestionRequestedSchema);
      if (!envelope) return;
      await this.processClaimed(envelope, () =>
        this.ingestDocument.execute(envelope.payload, envelope),
      );
      return;
    }

    if (base.data.messageType === MessageTypes.knowledgeTopicMaterializationRequested) {
      const envelope = this.parsePayload(raw, topicMaterializationRequestedSchema);
      if (!envelope) return;
      await this.processClaimed(envelope, () =>
        this.materializeTopic.execute(envelope.payload, envelope),
      );
      return;
    }

    this.logger.warn(`Ignored unsupported knowledge command ${base.data.messageType}`);
  }

  private parsePayload<T>(raw: unknown, schema: z.ZodType<T>): MessageEnvelope<T> | null {
    try {
      const envelope = parseEnvelope(raw, schema);
      const payload = envelope.payload as T & { sourceId?: unknown };
      if (typeof payload.sourceId !== 'string' || envelope.aggregateId !== payload.sourceId) {
        this.logger.error('Ignored a Kafka command whose aggregateId does not match sourceId');
        return null;
      }
      return envelope;
    } catch {
      this.logger.error('Ignored a Kafka command with an invalid payload');
      return null;
    }
  }

  private async processClaimed<T extends { sourceId: string; programId: string }>(
    envelope: MessageEnvelope<T>,
    operation: () => Promise<void>,
  ): Promise<void> {
    const claim = await this.inbox.claim(envelope.messageId, envelope.messageType);
    if (claim === 'completed') return;
    if (claim === 'busy') {
      throw new Error(`Kafka command ${envelope.messageId} is already being processed`);
    }

    try {
      await operation();
      await this.inbox.complete(envelope.messageId);
    } catch (error) {
      try {
        await this.recordFailure.execute({
          sourceId: envelope.payload.sourceId,
          programId: envelope.payload.programId,
          command: envelope,
          error,
        });
        await this.inbox.complete(envelope.messageId);
      } catch (reportingError) {
        await this.inbox.fail(envelope.messageId, 'FAILURE_REPORTING_FAILED');
        throw reportingError;
      }

      const message = error instanceof Error ? error.message : 'Unknown processing error';
      this.logger.error(`Knowledge command ${envelope.messageId} failed: ${message}`);
    }
  }
}
