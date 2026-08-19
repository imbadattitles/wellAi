import {
  createEnvelope,
  KnowledgeSourceFailed,
  MessageEnvelope,
  MessageTypes,
} from '@wellllai/contracts';
import { KnowledgeError } from '../domain/errors';
import { KnowledgeRepositoryPort } from '../ports/knowledge-repository.port';

export interface RecordSourceFailureInput {
  sourceId: string;
  programId: string;
  command: MessageEnvelope;
  error: unknown;
}

export class RecordSourceFailureUseCase {
  constructor(private readonly repository: KnowledgeRepositoryPort) {}

  async execute(input: RecordSourceFailureInput): Promise<void> {
    const knownError = input.error instanceof KnowledgeError ? input.error : null;
    const payload: KnowledgeSourceFailed = {
      sourceId: input.sourceId,
      programId: input.programId,
      errorCode: knownError?.code ?? 'KNOWLEDGE_PROCESSING_FAILED',
      retryable: knownError?.retryable ?? true,
    };
    const failedEvent = createEnvelope({
      messageType: MessageTypes.knowledgeSourceFailed,
      producer: 'knowledge-service',
      aggregateId: input.sourceId,
      correlationId: input.command.correlationId,
      causationId: input.command.messageId,
      traceparent: input.command.traceparent,
      payload,
    });

    await this.repository.failSource({
      sourceId: input.sourceId,
      failedEvent: { ...failedEvent, payload },
    });
  }
}
