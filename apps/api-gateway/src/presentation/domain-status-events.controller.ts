import { Controller } from '@nestjs/common';
import { Ctx, EventPattern, KafkaContext, Payload } from '@nestjs/microservices';
import {
  interviewJobFailedSchema,
  interviewReportReadySchema,
  interviewScenarioReadySchema,
  interviewSessionCompletedSchema,
  KafkaTopics,
  learningProgramStatusChangedSchema,
  messageEnvelopeSchema,
  MessageTypes,
  parseEnvelope,
} from '@wellllai/contracts';
import { StatusRedisBridge } from '../infrastructure/status-redis.bridge';

@Controller()
export class DomainStatusEventsController {
  constructor(private readonly bridge: StatusRedisBridge) {}

  @EventPattern(KafkaTopics.learningEvents)
  async learning(@Payload() value: unknown, @Ctx() context: KafkaContext): Promise<void> {
    const raw = value ?? context.getMessage().value;
    const base = messageEnvelopeSchema.parse(raw);
    if (base.messageType !== MessageTypes.learningProgramStatusChanged) return;

    const envelope = parseEnvelope(raw, learningProgramStatusChangedSchema);
    this.assertAggregate(envelope.aggregateId, envelope.payload.programId);
    await this.bridge.publish({
      resource: 'learning-program',
      resourceId: envelope.payload.programId,
      eventId: envelope.messageId,
    });
    await context.getHeartbeat()();
  }

  @EventPattern(KafkaTopics.interviewEvents)
  async interview(@Payload() value: unknown, @Ctx() context: KafkaContext): Promise<void> {
    const raw = value ?? context.getMessage().value;
    const base = messageEnvelopeSchema.parse(raw);
    const parser = this.interviewPayloadParser(base.messageType);
    if (!parser) return;

    const payload = parser.parse(base.payload);
    this.assertAggregate(base.aggregateId, payload.sessionId);
    await this.bridge.publish({
      resource: 'interview-session',
      resourceId: payload.sessionId,
      eventId: base.messageId,
    });
    await context.getHeartbeat()();
  }

  private interviewPayloadParser(
    messageType: string,
  ): { parse(value: unknown): { sessionId: string } } | null {
    if (messageType === MessageTypes.interviewScenarioReady) return interviewScenarioReadySchema;
    if (messageType === MessageTypes.interviewScenarioGenerationFailed) {
      return interviewJobFailedSchema;
    }
    if (messageType === MessageTypes.interviewSessionCompleted) {
      return interviewSessionCompletedSchema;
    }
    if (messageType === MessageTypes.interviewReportReady) return interviewReportReadySchema;
    if (messageType === MessageTypes.interviewReportGenerationFailed) {
      return interviewJobFailedSchema;
    }
    return null;
  }

  private assertAggregate(aggregateId: string, resourceId: string): void {
    if (aggregateId !== resourceId) {
      throw new Error('Status event aggregateId does not match its resource id');
    }
  }
}
