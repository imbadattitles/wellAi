import { CreateInterview } from '@wellllai/contracts';
import { describe, expect, it } from 'vitest';
import {
  AnswerEvaluation,
  InterviewReport,
  InterviewScenario,
  InterviewSession,
  InterviewTurn,
} from '../domain/interview-session';
import { InterviewApplicationService } from './interview.service';
import { CreateInterviewSessionInput, InterviewAiPort, InterviewRepository } from './ports';

const userId = '50cd15be-f1af-46a1-9884-7341d28f06d4';
const sessionId = '9dc2e87d-8c81-4895-ada7-772ba18d264a';
const firstAnswerId = '6bb4a0ff-6da3-4d8d-a3cd-40cf99b696e7';
const secondAnswerId = '67e10224-1366-4a3b-89fd-66f08375b15f';

const createInput: CreateInterview = {
  userId,
  profession: 'Backend developer',
  level: 'middle',
  format: 'technical',
  technologies: ['TypeScript', 'PostgreSQL'],
  vacancyText: null,
  language: 'ru',
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
    {
      competency: 'PostgreSQL',
      prompt: 'Как работает индекс B-tree?',
      evaluationCriteria: ['Описан поиск по диапазону'],
    },
  ],
};

const evaluation: AnswerEvaluation = {
  feedback: 'Ответ по существу.',
  score: 0.8,
  strengths: ['Приведён пример'],
  gaps: ['Не упомянут крайний случай'],
};

const report: InterviewReport = {
  summary: 'Уверенный результат.',
  overallScore: 0.8,
  competencyScores: [{ competency: 'Backend', score: 0.8, evidence: 'Ответы' }],
  strengths: ['Практический опыт'],
  gaps: ['Детали индексов'],
  recommendations: ['Повторить планы запросов'],
};

class FakeInterviewRepository implements InterviewRepository {
  session: InterviewSession | null = null;
  lastCreated: CreateInterviewSessionInput | null = null;
  lastRecorded: Parameters<InterviewRepository['recordAnswer']>[0] | null = null;
  processed = new Set<string>();

  async createSession(input: CreateInterviewSessionInput): Promise<InterviewSession> {
    this.lastCreated = input;
    const session = makeSession(input);
    this.session = session;
    return session;
  }

  async findOwnedSession(id: string, ownerId: string): Promise<InterviewSession | null> {
    return this.session?.id === id && this.session.userId === ownerId ? this.session : null;
  }

  async findSession(id: string): Promise<InterviewSession | null> {
    return this.session?.id === id ? this.session : null;
  }

  async isMessageProcessed(messageId: string): Promise<boolean> {
    return this.processed.has(messageId);
  }

  async acknowledgeMessage(messageId: string): Promise<void> {
    this.processed.add(messageId);
  }

  async completeScenarioGeneration(
    input: Parameters<InterviewRepository['completeScenarioGeneration']>[0],
  ): Promise<void> {
    if (this.session) {
      this.session.scenario = input.scenario;
      this.session.status = 'active';
    }
    this.processed.add(input.context.messageId);
  }

  async failScenarioGeneration(
    input: Parameters<InterviewRepository['failScenarioGeneration']>[0],
  ): Promise<void> {
    if (this.session) {
      this.session.status = 'failed';
      this.session.failureCode = input.failureCode;
    }
    this.processed.add(input.context.messageId);
  }

  async recordAnswer(
    input: Parameters<InterviewRepository['recordAnswer']>[0],
  ): Promise<InterviewTurn> {
    this.lastRecorded = input;
    const turn: InterviewTurn = {
      id: 'e9195bad-1393-48be-8af9-37637648aecf',
      answerId: input.answerId,
      questionIndex: input.expectedQuestionIndex,
      question: input.question,
      answer: input.answer,
      ...input.evaluation,
      createdAt: new Date('2026-08-19T00:00:00.000Z'),
    };
    if (this.session) {
      this.session.turns.push(turn);
      if (input.completed) {
        this.session.status = 'completed';
        this.session.reportStatus = 'pending';
      }
    }
    return turn;
  }

  async completeReportGeneration(
    input: Parameters<InterviewRepository['completeReportGeneration']>[0],
  ): Promise<void> {
    if (this.session) {
      this.session.report = input.report;
      this.session.reportStatus = 'ready';
    }
    this.processed.add(input.context.messageId);
  }

  async failReportGeneration(
    input: Parameters<InterviewRepository['failReportGeneration']>[0],
  ): Promise<void> {
    if (this.session) {
      this.session.reportStatus = 'failed';
      this.session.failureCode = input.failureCode;
    }
    this.processed.add(input.context.messageId);
  }
}

class FakeInterviewAi implements InterviewAiPort {
  lastQuestionIndex: number | null = null;

  async generateScenario(): Promise<InterviewScenario> {
    return scenario;
  }

  async evaluateAnswer(
    input: Parameters<InterviewAiPort['evaluateAnswer']>[0],
  ): Promise<AnswerEvaluation> {
    this.lastQuestionIndex = input.questionIndex;
    return evaluation;
  }

  async generateReport(): Promise<InterviewReport> {
    return report;
  }
}

function makeSession(overrides: Partial<InterviewSession> = {}): InterviewSession {
  return {
    ...createInput,
    id: sessionId,
    correlationId: '6c075017-dfd2-42aa-a406-79eb50d30a89',
    status: 'scenario_pending',
    reportStatus: 'not_requested',
    scenario: null,
    report: null,
    turns: [],
    failureCode: null,
    createdAt: new Date('2026-08-19T00:00:00.000Z'),
    updatedAt: new Date('2026-08-19T00:00:00.000Z'),
    ...overrides,
  };
}

describe('InterviewApplicationService', () => {
  it('creates a pending session through the repository port', async () => {
    const repository = new FakeInterviewRepository();
    const service = new InterviewApplicationService(repository, new FakeInterviewAi());

    const result = await service.create(createInput);

    expect(result.status).toBe('scenario_pending');
    expect(result.currentQuestion).toBeNull();
    expect(repository.lastCreated?.userId).toBe(userId);
    expect(repository.lastCreated?.id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('evaluates an answer and returns the next scenario question', async () => {
    const repository = new FakeInterviewRepository();
    repository.session = makeSession({ status: 'active', scenario });
    const ai = new FakeInterviewAi();
    const service = new InterviewApplicationService(repository, ai);

    const result = await service.submitAnswer({
      sessionId,
      userId,
      answerId: firstAnswerId,
      expectedQuestionIndex: 0,
      answer: 'Типы совместимы, когда совпадает их форма.',
    });

    expect(result).toEqual({
      answerId: firstAnswerId,
      questionIndex: 0,
      ...evaluation,
      nextQuestion: scenario.questions[1]?.prompt,
      completed: false,
    });
    expect(ai.lastQuestionIndex).toBe(0);
    expect(repository.lastRecorded?.completed).toBe(false);
  });

  it('completes the session after the final answer', async () => {
    const repository = new FakeInterviewRepository();
    repository.session = makeSession({
      status: 'active',
      scenario,
      turns: [
        {
          id: '14d197f4-9f6b-49fc-8085-301d298056f2',
          answerId: firstAnswerId,
          questionIndex: 0,
          question: scenario.questions[0]?.prompt ?? '',
          answer: 'Совместимость определяется структурой.',
          ...evaluation,
          createdAt: new Date('2026-08-19T00:00:00.000Z'),
        },
      ],
    });
    const service = new InterviewApplicationService(repository, new FakeInterviewAi());

    const result = await service.submitAnswer({
      sessionId,
      userId,
      answerId: secondAnswerId,
      expectedQuestionIndex: 1,
      answer: 'B-tree хранит отсортированные ключи.',
    });

    expect(result.completed).toBe(true);
    expect(result.nextQuestion).toBeNull();
    expect(repository.lastRecorded?.completed).toBe(true);
    expect(repository.session?.status).toBe('completed');
    expect(repository.session?.reportStatus).toBe('pending');
  });

  it('replays a persisted answer without evaluating it again', async () => {
    const persistedTurn: InterviewTurn = {
      id: '14d197f4-9f6b-49fc-8085-301d298056f2',
      answerId: firstAnswerId,
      questionIndex: 0,
      question: scenario.questions[0]?.prompt ?? '',
      answer: 'persisted answer',
      ...evaluation,
      createdAt: new Date('2026-08-19T00:00:00.000Z'),
    };
    const repository = new FakeInterviewRepository();
    repository.session = makeSession({
      status: 'active',
      scenario,
      turns: [persistedTurn],
    });
    const ai = new FakeInterviewAi();
    const service = new InterviewApplicationService(repository, ai);

    const result = await service.submitAnswer({
      sessionId,
      userId,
      answerId: firstAnswerId,
      expectedQuestionIndex: 0,
      answer: 'persisted answer',
    });

    expect(result.answerId).toBe(firstAnswerId);
    expect(result.questionIndex).toBe(0);
    expect(result.nextQuestion).toBe(scenario.questions[1]?.prompt);
    expect(ai.lastQuestionIndex).toBeNull();
    expect(repository.lastRecorded).toBeNull();
  });

  it('rejects a stale expected question before calling the AI port', async () => {
    const repository = new FakeInterviewRepository();
    repository.session = makeSession({ status: 'active', scenario });
    const ai = new FakeInterviewAi();
    const service = new InterviewApplicationService(repository, ai);

    await expect(
      service.submitAnswer({
        sessionId,
        userId,
        answerId: firstAnswerId,
        expectedQuestionIndex: 1,
        answer: 'stale answer',
      }),
    ).rejects.toThrow('expected interview question is no longer current');
    expect(ai.lastQuestionIndex).toBeNull();
  });
});
