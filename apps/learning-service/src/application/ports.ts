import { CitedAnswer, CreateTopicProgram, RetrievedChunk } from '@wellllai/contracts';

export type ProgramStatus = 'pending' | 'processing' | 'ready' | 'failed';
export type ProgramSourceType = 'document' | 'generated_topic';

export interface LearningProgram {
  id: string;
  userId: string;
  sourceId: string;
  sourceType: ProgramSourceType;
  title: string;
  goal: string;
  level: CreateTopicProgram['level'] | 'unspecified';
  language: string;
  status: ProgramStatus;
  failureCode: string | null;
  knowledgeVersionId: string | null;
  createdAt: Date;
}

export interface CreateTopicProgramInput {
  userId: string;
  topic: string;
  goal: string;
  level: CreateTopicProgram['level'];
  language: string;
  correlationId: string;
}

export interface CreateDocumentProgramInput {
  userId: string;
  title: string;
  fileName: string;
  language: string;
}

export interface GeneratedQuizQuestion {
  type: 'single_choice' | 'free_text';
  topic: string;
  prompt: string;
  options: string[] | null;
  correctAnswer: string | null;
  rubric: string[];
  sourceChunkIds: string[];
}

export interface PersistedQuestion extends GeneratedQuizQuestion {
  id: string;
  quizId: string;
  programId: string;
  sourceId: string;
}

export interface AnswerEvaluation {
  score: number;
  feedback: string;
  missingPoints: string[];
}

export interface LearningRepository {
  createTopicProgram(input: CreateTopicProgramInput): Promise<LearningProgram>;
  createDocumentProgram(input: CreateDocumentProgramInput): Promise<LearningProgram>;
  markDocumentUploadFailed(input: {
    programId: string;
    sourceId: string;
    userId: string;
    errorCode: string;
  }): Promise<LearningProgram | null>;
  findOwnedProgram(programId: string, userId: string): Promise<LearningProgram | null>;
  saveCitedAnswer(input: {
    programId: string;
    userId: string;
    question: string;
    answer: CitedAnswer;
  }): Promise<{ id: string }>;
  saveQuiz(input: {
    program: LearningProgram;
    questions: GeneratedQuizQuestion[];
  }): Promise<{ id: string; questions: PersistedQuestion[] }>;
  findOwnedQuestion(questionId: string, userId: string): Promise<PersistedQuestion | null>;
  getProgress(
    programId: string,
    userId: string,
  ): Promise<Array<{ topic: string; score: number; attemptCount: number; lastReviewedAt: Date }>>;
  saveAttempt(input: {
    question: PersistedQuestion;
    userId: string;
    answer: string;
    evaluation: AnswerEvaluation;
  }): Promise<{ attemptId: string; mastery: number }>;
  markSourceReady(
    messageId: string,
    payload: {
      sourceId: string;
      programId: string;
      knowledgeVersionId: string;
    },
  ): Promise<void>;
  markSourceFailed(
    messageId: string,
    payload: {
      sourceId: string;
      programId: string;
      errorCode: string;
    },
  ): Promise<void>;
}

export interface KnowledgeRetrievalPort {
  retrieve(sourceId: string, query: string, limit: number): Promise<RetrievedChunk[]>;
}

export interface LearningAiPort {
  answerQuestion(input: {
    question: string;
    language: string;
    chunks: RetrievedChunk[];
  }): Promise<CitedAnswer>;
  generateQuiz(input: {
    title: string;
    language: string;
    count: number;
    difficulty: 'easy' | 'medium' | 'hard';
    chunks: RetrievedChunk[];
  }): Promise<GeneratedQuizQuestion[]>;
  evaluateFreeAnswer(input: {
    question: PersistedQuestion;
    answer: string;
    language: string;
    chunks: RetrievedChunk[];
  }): Promise<AnswerEvaluation>;
}

export const LEARNING_REPOSITORY = Symbol('LEARNING_REPOSITORY');
export const KNOWLEDGE_RETRIEVAL = Symbol('KNOWLEDGE_RETRIEVAL');
export const LEARNING_AI = Symbol('LEARNING_AI');
export const POSTGRES_POOL = Symbol('POSTGRES_POOL');
