import { CreateInterview, InterviewTurnResult } from '@wellllai/contracts';

export type InterviewStatus = 'scenario_pending' | 'active' | 'completed' | 'failed';
export type InterviewReportStatus = 'not_requested' | 'pending' | 'ready' | 'failed';

export interface InterviewQuestion {
  competency: string;
  prompt: string;
  evaluationCriteria: string[];
}

export interface InterviewScenario {
  title: string;
  openingMessage: string;
  questions: InterviewQuestion[];
}

export interface InterviewTurn {
  id: string;
  answerId: string;
  questionIndex: number;
  question: string;
  answer: string;
  feedback: string;
  score: number;
  strengths: string[];
  gaps: string[];
  createdAt: Date;
}

export interface CompetencyScore {
  competency: string;
  score: number;
  evidence: string;
}

export interface InterviewReport {
  summary: string;
  overallScore: number;
  competencyScores: CompetencyScore[];
  strengths: string[];
  gaps: string[];
  recommendations: string[];
}

export interface InterviewSession extends CreateInterview {
  id: string;
  correlationId: string;
  status: InterviewStatus;
  reportStatus: InterviewReportStatus;
  scenario: InterviewScenario | null;
  report: InterviewReport | null;
  turns: InterviewTurn[];
  failureCode: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface AnswerEvaluation {
  feedback: string;
  score: number;
  strengths: string[];
  gaps: string[];
}

export interface InterviewSessionView {
  id: string;
  profession: string;
  level: CreateInterview['level'];
  format: CreateInterview['format'];
  technologies: string[];
  language: string;
  status: InterviewStatus;
  reportStatus: InterviewReportStatus;
  openingMessage: string | null;
  currentQuestion: string | null;
  currentQuestionIndex: number | null;
  answeredQuestions: number;
  totalQuestions: number;
  turns: InterviewTurn[];
  report: InterviewReport | null;
  failureCode: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export class InterviewNotFoundError extends Error {
  constructor() {
    super('Interview session not found');
    this.name = 'InterviewNotFoundError';
  }
}

export class InterviewStateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InterviewStateError';
  }
}

export function currentQuestion(session: InterviewSession): InterviewQuestion | null {
  if (session.status !== 'active' || !session.scenario) return null;
  return session.scenario.questions[session.turns.length] ?? null;
}

export function toSessionView(session: InterviewSession): InterviewSessionView {
  const question = currentQuestion(session);
  return {
    id: session.id,
    profession: session.profession,
    level: session.level,
    format: session.format,
    technologies: session.technologies,
    language: session.language,
    status: session.status,
    reportStatus: session.reportStatus,
    openingMessage: session.scenario?.openingMessage ?? null,
    currentQuestion: question?.prompt ?? null,
    currentQuestionIndex: question ? session.turns.length : null,
    answeredQuestions: session.turns.length,
    totalQuestions: session.scenario?.questions.length ?? 0,
    turns: session.turns,
    report: session.report,
    failureCode: session.failureCode,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
  };
}

export function createTurnResult(
  turn: InterviewTurn,
  nextQuestion: InterviewQuestion | null,
): InterviewTurnResult {
  return {
    answerId: turn.answerId,
    questionIndex: turn.questionIndex,
    feedback: turn.feedback,
    score: turn.score,
    strengths: turn.strengths,
    gaps: turn.gaps,
    nextQuestion: nextQuestion?.prompt ?? null,
    completed: nextQuestion === null,
  };
}
