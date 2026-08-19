import { CreateInterview, InterviewTurnResult } from '@wellllai/contracts';
import { randomUUID } from 'node:crypto';
import {
  createTurnResult,
  currentQuestion,
  InterviewNotFoundError,
  InterviewStateError,
  toSessionView,
} from '../domain/interview-session';
import { InterviewAiPort, InterviewRepository } from './ports';

export class InterviewApplicationService {
  constructor(
    private readonly repository: InterviewRepository,
    private readonly ai: InterviewAiPort,
  ) {}

  async create(input: CreateInterview) {
    const session = await this.repository.createSession({
      ...input,
      id: randomUUID(),
      correlationId: randomUUID(),
    });
    return toSessionView(session);
  }

  async get(sessionId: string, userId: string) {
    const session = await this.requireOwnedSession(sessionId, userId);
    return toSessionView(session);
  }

  async submitAnswer(input: {
    sessionId: string;
    userId: string;
    answerId: string;
    expectedQuestionIndex: number;
    answer: string;
  }): Promise<InterviewTurnResult> {
    const session = await this.requireOwnedSession(input.sessionId, input.userId);

    const previousSubmission = session.turns.find((turn) => turn.answerId === input.answerId);
    if (previousSubmission) {
      if (
        previousSubmission.questionIndex !== input.expectedQuestionIndex ||
        previousSubmission.answer !== input.answer
      ) {
        throw new InterviewStateError('answerId was already used for another submission');
      }
      if (!session.scenario) {
        throw new InterviewStateError('Interview scenario is unavailable');
      }
      return createTurnResult(
        previousSubmission,
        session.scenario.questions[previousSubmission.questionIndex + 1] ?? null,
      );
    }

    if (session.status !== 'active') {
      throw new InterviewStateError(`Interview session is ${session.status}`);
    }

    const question = currentQuestion(session);
    if (!question || !session.scenario) {
      throw new InterviewStateError('Interview session has no question to answer');
    }

    const questionIndex = session.turns.length;
    if (input.expectedQuestionIndex !== questionIndex) {
      throw new InterviewStateError('The expected interview question is no longer current');
    }

    const evaluation = await this.ai.evaluateAnswer({
      session,
      questionIndex,
      answer: input.answer,
    });
    const nextQuestion = session.scenario.questions[questionIndex + 1] ?? null;

    const turn = await this.repository.recordAnswer({
      sessionId: session.id,
      userId: input.userId,
      answerId: input.answerId,
      expectedQuestionIndex: input.expectedQuestionIndex,
      question: question.prompt,
      answer: input.answer,
      evaluation,
      completed: nextQuestion === null,
    });

    return createTurnResult(turn, session.scenario.questions[turn.questionIndex + 1] ?? null);
  }

  private async requireOwnedSession(sessionId: string, userId: string) {
    const session = await this.repository.findOwnedSession(sessionId, userId);
    if (!session) throw new InterviewNotFoundError();
    return session;
  }
}
