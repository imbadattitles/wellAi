import { Controller, Inject } from '@nestjs/common';
import { Ctx, EventPattern, KafkaContext, Payload } from '@nestjs/microservices';
import {
  KafkaTopics,
  knowledgeSourceFailedSchema,
  knowledgeSourceReadySchema,
  MessageTypes,
  parseEnvelope,
} from '@wellllai/contracts';
import { LEARNING_REPOSITORY, LearningRepository } from '../application/ports';

@Controller()
export class KnowledgeEventsController {
  constructor(@Inject(LEARNING_REPOSITORY) private readonly repository: LearningRepository) {}

  @EventPattern(KafkaTopics.knowledgeEvents)
  async handle(@Payload() value: unknown, @Ctx() context: KafkaContext): Promise<void> {
    const record = context.getMessage();
    const raw = value ?? record.value;
    const messageType = (raw as { messageType?: string })?.messageType;

    if (messageType === MessageTypes.knowledgeSourceReady) {
      const envelope = parseEnvelope(raw, knowledgeSourceReadySchema);
      this.assertAggregate(envelope.aggregateId, envelope.payload.sourceId);
      await this.repository.markSourceReady(
        {
          messageId: envelope.messageId,
          correlationId: envelope.correlationId,
          traceparent: envelope.traceparent,
        },
        envelope.payload,
      );
    } else if (messageType === MessageTypes.knowledgeSourceFailed) {
      const envelope = parseEnvelope(raw, knowledgeSourceFailedSchema);
      this.assertAggregate(envelope.aggregateId, envelope.payload.sourceId);
      await this.repository.markSourceFailed(
        {
          messageId: envelope.messageId,
          correlationId: envelope.correlationId,
          traceparent: envelope.traceparent,
        },
        envelope.payload,
      );
    }

    await context.getHeartbeat()();
  }

  private assertAggregate(aggregateId: string, sourceId: string): void {
    if (aggregateId !== sourceId) {
      throw new Error('Knowledge event aggregateId does not match sourceId');
    }
  }
}
