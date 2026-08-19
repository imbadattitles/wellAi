import { createEnvelope, MessageTypes } from '@wellllai/contracts';
import { KafkaContext } from '@nestjs/microservices';
import { describe, expect, it, vi } from 'vitest';
import { InterviewJobsService } from '../application/interview-jobs.service';
import { InterviewCommandsController } from './interview-commands.controller';

const sessionId = '9dc2e87d-8c81-4895-ada7-772ba18d264a';
const correlationId = '6c075017-dfd2-42aa-a406-79eb50d30a89';

function kafkaContext(value: unknown, heartbeat: () => Promise<void>): KafkaContext {
  return {
    getMessage: () => ({ value }),
    getHeartbeat: () => heartbeat,
  } as unknown as KafkaContext;
}

describe('InterviewCommandsController', () => {
  it('dispatches a valid command and heartbeats around processing', async () => {
    const jobs = {
      generateScenario: vi.fn().mockResolvedValue(undefined),
    } as unknown as InterviewJobsService;
    const controller = new InterviewCommandsController(jobs);
    const heartbeat = vi.fn().mockResolvedValue(undefined);
    const command = createEnvelope({
      messageType: MessageTypes.interviewScenarioGenerationRequested,
      producer: 'test',
      aggregateId: sessionId,
      correlationId,
      payload: { sessionId },
    });

    await controller.handle(command, kafkaContext(command, heartbeat));

    expect(jobs.generateScenario).toHaveBeenCalledWith(
      { messageId: command.messageId, correlationId },
      sessionId,
    );
    expect(heartbeat).toHaveBeenCalledTimes(2);
  });

  it('rejects a command whose aggregate does not match its payload', async () => {
    const jobs = {
      generateScenario: vi.fn(),
    } as unknown as InterviewJobsService;
    const controller = new InterviewCommandsController(jobs);
    const heartbeat = vi.fn().mockResolvedValue(undefined);
    const command = createEnvelope({
      messageType: MessageTypes.interviewScenarioGenerationRequested,
      producer: 'test',
      aggregateId: '50cd15be-f1af-46a1-9884-7341d28f06d4',
      correlationId,
      payload: { sessionId },
    });

    await expect(controller.handle(command, kafkaContext(command, heartbeat))).rejects.toThrow(
      'aggregateId does not match',
    );
    expect(jobs.generateScenario).not.toHaveBeenCalled();
  });
});
