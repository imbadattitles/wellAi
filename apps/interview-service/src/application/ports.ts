import { CreateInterview } from '@wellllai/contracts';
import {
  AnswerEvaluation,
  InterviewReport,
  InterviewScenario,
  InterviewSession,
  InterviewTurn,
} from '../domain/interview-session';

export interface CreateInterviewSessionInput extends CreateInterview {
  id: string;
  correlationId: string;
}

export interface MessageContext {
  messageId: string;
  correlationId: string;
}

export class PermanentInterviewAiError extends Error {
  constructor(
    readonly code: string,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = 'PermanentInterviewAiError';
  }
}

export interface InterviewRepository {
  createSession(input: CreateInterviewSessionInput): Promise<InterviewSession>;
  findOwnedSession(sessionId: string, userId: string): Promise<InterviewSession | null>;
  findSession(sessionId: string): Promise<InterviewSession | null>;
  isMessageProcessed(messageId: string): Promise<boolean>;
  acknowledgeMessage(messageId: string): Promise<void>;
  completeScenarioGeneration(input: {
    context: MessageContext;
    sessionId: string;
    scenario: InterviewScenario;
  }): Promise<void>;
  failScenarioGeneration(input: {
    context: MessageContext;
    sessionId: string;
    failureCode: string;
  }): Promise<void>;
  recordAnswer(input: {
    sessionId: string;
    userId: string;
    answerId: string;
    expectedQuestionIndex: number;
    question: string;
    answer: string;
    evaluation: AnswerEvaluation;
    completed: boolean;
  }): Promise<InterviewTurn>;
  completeReportGeneration(input: {
    context: MessageContext;
    sessionId: string;
    report: InterviewReport;
  }): Promise<void>;
  failReportGeneration(input: {
    context: MessageContext;
    sessionId: string;
    failureCode: string;
  }): Promise<void>;
}

export interface InterviewAiPort {
  generateScenario(session: InterviewSession): Promise<InterviewScenario>;
  evaluateAnswer(input: {
    session: InterviewSession;
    questionIndex: number;
    answer: string;
  }): Promise<AnswerEvaluation>;
  generateReport(session: InterviewSession): Promise<InterviewReport>;
}

export const INTERVIEW_REPOSITORY = Symbol('INTERVIEW_REPOSITORY');
export const INTERVIEW_AI = Symbol('INTERVIEW_AI');
export const POSTGRES_POOL = Symbol('POSTGRES_POOL');
