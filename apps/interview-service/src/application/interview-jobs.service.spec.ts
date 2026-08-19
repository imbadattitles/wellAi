import { describe, expect, it, vi } from 'vitest';
import { InterviewScenario, InterviewSession } from '../domain/interview-session';
import { InterviewJobsService } from './interview-jobs.service';
import { InterviewAiPort, InterviewRepository, PermanentInterviewAiError } from './ports';

const context = {
  messageId: '61b5a598-351d-4ed0-be59-9c54e6144f28',
  correlationId: '6c075017-dfd2-42aa-a406-79eb50d30a89',
};

const scenario: InterviewScenario = {
  title: 'Backend interview',
  openingMessage: 'Начнём интервью.',
  questions: [
    {
      competency: 'TypeScript',
      prompt: 'Объясните структурную типизацию.',
      evaluationCriteria: ['Описана совместимость по форме'],
    },
  ],
};

const session = {
  id: '9dc2e87d-8c81-4895-ada7-772ba18d264a',
  userId: '50cd15be-f1af-46a1-9884-7341d28f06d4',
  profession: 'Backend developer',
  level: 'middle',
  format: 'technical',
  technologies: ['TypeScript'],
  vacancyText: null,
  language: 'ru',
  correlationId: context.correlationId,
  status: 'scenario_pending',
  reportStatus: 'not_requested',
  scenario: null,
  report: null,
  turns: [],
  failureCode: null,
  createdAt: new Date('2026-08-19T00:00:00.000Z'),
  updatedAt: new Date('2026-08-19T00:00:00.000Z'),
} satisfies InterviewSession;

describe('InterviewJobsService', () => {
  it('persists a generated scenario through the repository port', async () => {
    const repository = {
      isMessageProcessed: vi.fn().mockResolvedValue(false),
      findSession: vi.fn().mockResolvedValue(session),
      completeScenarioGeneration: vi.fn().mockResolvedValue(undefined),
    } as unknown as InterviewRepository;
    const ai = {
      generateScenario: vi.fn().mockResolvedValue(scenario),
    } as unknown as InterviewAiPort;
    const service = new InterviewJobsService(repository, ai);

    await service.generateScenario(context, session.id);

    expect(ai.generateScenario).toHaveBeenCalledWith(session);
    expect(repository.completeScenarioGeneration).toHaveBeenCalledWith({
      context,
      sessionId: session.id,
      scenario,
    });
  });

  it('does not call OpenAI again for an inbox-processed command', async () => {
    const repository = {
      isMessageProcessed: vi.fn().mockResolvedValue(true),
    } as unknown as InterviewRepository;
    const ai = { generateScenario: vi.fn() } as unknown as InterviewAiPort;
    const service = new InterviewJobsService(repository, ai);

    await service.generateScenario(context, session.id);

    expect(ai.generateScenario).not.toHaveBeenCalled();
  });

  it('marks scenario generation failed and acknowledges a permanent AI failure', async () => {
    const failure = new PermanentInterviewAiError('openai_http_400', 'OpenAI rejected the request');
    const repository = {
      isMessageProcessed: vi.fn().mockResolvedValue(false),
      findSession: vi.fn().mockResolvedValue(session),
      failScenarioGeneration: vi.fn().mockResolvedValue(undefined),
    } as unknown as InterviewRepository;
    const ai = {
      generateScenario: vi.fn().mockRejectedValue(failure),
    } as unknown as InterviewAiPort;
    const service = new InterviewJobsService(repository, ai);

    await service.generateScenario(context, session.id);

    expect(repository.failScenarioGeneration).toHaveBeenCalledWith({
      context,
      sessionId: session.id,
      failureCode: 'openai_http_400',
    });
  });

  it('marks report generation failed and acknowledges a permanent AI failure', async () => {
    const completedSession: InterviewSession = {
      ...session,
      status: 'completed',
      reportStatus: 'pending',
      scenario,
    };
    const failure = new PermanentInterviewAiError(
      'openai_no_structured_output',
      'OpenAI returned no parsed output',
    );
    const repository = {
      isMessageProcessed: vi.fn().mockResolvedValue(false),
      findSession: vi.fn().mockResolvedValue(completedSession),
      failReportGeneration: vi.fn().mockResolvedValue(undefined),
    } as unknown as InterviewRepository;
    const ai = {
      generateReport: vi.fn().mockRejectedValue(failure),
    } as unknown as InterviewAiPort;
    const service = new InterviewJobsService(repository, ai);

    await service.generateReport(context, session.id);

    expect(repository.failReportGeneration).toHaveBeenCalledWith({
      context,
      sessionId: session.id,
      failureCode: 'openai_no_structured_output',
    });
  });

  it('rethrows a transient AI failure so Kafka can retry it', async () => {
    const repository = {
      isMessageProcessed: vi.fn().mockResolvedValue(false),
      findSession: vi.fn().mockResolvedValue(session),
      failScenarioGeneration: vi.fn(),
    } as unknown as InterviewRepository;
    const ai = {
      generateScenario: vi.fn().mockRejectedValue(new Error('temporary timeout')),
    } as unknown as InterviewAiPort;
    const service = new InterviewJobsService(repository, ai);

    await expect(service.generateScenario(context, session.id)).rejects.toThrow(
      'temporary timeout',
    );
    expect(repository.failScenarioGeneration).not.toHaveBeenCalled();
  });
});
