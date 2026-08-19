import { Controller } from '@nestjs/common';
import { Ctx, EventPattern, KafkaContext, Payload } from '@nestjs/microservices';
import {
  InterviewJobRequested,
  interviewReportGenerationRequestedSchema,
  interviewScenarioGenerationRequestedSchema,
  KafkaTopics,
  MessageEnvelope,
  MessageTypes,
  parseEnvelope,
} from '@wellllai/contracts';
import { InterviewJobsService } from '../application/interview-jobs.service';

function assertMatchingAggregate(envelope: MessageEnvelope<InterviewJobRequested>): void {
  if (envelope.aggregateId !== envelope.payload.sessionId) {
    throw new Error('Interview command aggregateId does not match payload.sessionId');
  }
}

async function withPeriodicHeartbeat<T>(
  heartbeat: () => Promise<void>,
  operation: () => Promise<T>,
): Promise<T> {
  await heartbeat();
  const interval = setInterval(() => {
    void heartbeat().catch(() => undefined);
  }, 5_000);

  try {
    return await operation();
  } finally {
    clearInterval(interval);
    await heartbeat();
  }
}

@Controller()
export class InterviewCommandsController {
  constructor(private readonly jobs: InterviewJobsService) {}

  @EventPattern(KafkaTopics.interviewCommands)
  async handle(@Payload() value: unknown, @Ctx() context: KafkaContext): Promise<void> {
    await withPeriodicHeartbeat(context.getHeartbeat(), async () => {
      const record = context.getMessage();
      const raw = value ?? record.value;
      const messageType = (raw as { messageType?: string })?.messageType;

      if (messageType === MessageTypes.interviewScenarioGenerationRequested) {
        const envelope = parseEnvelope(raw, interviewScenarioGenerationRequestedSchema);
        assertMatchingAggregate(envelope);
        await this.jobs.generateScenario(
          {
            messageId: envelope.messageId,
            correlationId: envelope.correlationId,
          },
          envelope.payload.sessionId,
        );
      } else if (messageType === MessageTypes.interviewReportGenerationRequested) {
        const envelope = parseEnvelope(raw, interviewReportGenerationRequestedSchema);
        assertMatchingAggregate(envelope);
        await this.jobs.generateReport(
          {
            messageId: envelope.messageId,
            correlationId: envelope.correlationId,
          },
          envelope.payload.sessionId,
        );
      }
    });
  }
}
