import { createEnvelope, MessageTypes } from '@wellllai/contracts';
import { KafkaContext } from '@nestjs/microservices';
import { describe, expect, it, vi } from 'vitest';
import { StatusRedisBridge } from '../infrastructure/status-redis.bridge';
import { DomainStatusEventsController } from './domain-status-events.controller';

function kafkaContext() {
  const heartbeat = vi.fn().mockResolvedValue(undefined);
  return {
    context: {
      getMessage: () => ({ value: null }),
      getHeartbeat: () => heartbeat,
    } as unknown as KafkaContext,
    heartbeat,
  };
}

describe('DomainStatusEventsController', () => {
  it('relays a validated learning status event to Redis', async () => {
    const bridge = {
      publish: vi.fn().mockResolvedValue(undefined),
    } as unknown as StatusRedisBridge;
    const controller = new DomainStatusEventsController(bridge);
    const envelope = createEnvelope({
      messageType: MessageTypes.learningProgramStatusChanged,
      producer: 'learning-service',
      aggregateId: 'ea5655d4-248b-4f9d-a846-d6eab73f03ff',
      payload: {
        programId: 'ea5655d4-248b-4f9d-a846-d6eab73f03ff',
        sourceId: 'a65f7855-14b3-4ce4-bc86-5fe472527a4d',
        status: 'ready' as const,
        failureCode: null,
      },
    });
    const { context, heartbeat } = kafkaContext();

    await controller.learning(envelope, context);

    expect(bridge.publish).toHaveBeenCalledWith({
      resource: 'learning-program',
      resourceId: envelope.payload.programId,
      eventId: envelope.messageId,
    });
    expect(heartbeat).toHaveBeenCalledOnce();
  });

  it('rejects an event whose aggregate does not match the program', async () => {
    const bridge = { publish: vi.fn() } as unknown as StatusRedisBridge;
    const controller = new DomainStatusEventsController(bridge);
    const envelope = createEnvelope({
      messageType: MessageTypes.learningProgramStatusChanged,
      producer: 'learning-service',
      aggregateId: 'd90c3f4a-e04a-4fc1-b76b-bf13810bcf47',
      payload: {
        programId: 'ea5655d4-248b-4f9d-a846-d6eab73f03ff',
        sourceId: 'a65f7855-14b3-4ce4-bc86-5fe472527a4d',
        status: 'failed' as const,
        failureCode: 'OPENAI_REQUEST_FAILED',
      },
    });

    await expect(controller.learning(envelope, kafkaContext().context)).rejects.toThrow(
      'aggregateId',
    );
    expect(bridge.publish).not.toHaveBeenCalled();
  });
});
