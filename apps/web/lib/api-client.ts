const DEFAULT_API_URL = 'http://localhost:3001/api/v1';
const ANONYMOUS_USER_KEY = 'wellllai.anonymous-user-id';
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
let inMemoryUserId: string | null = null;

export interface ApiErrorBody {
  code: string;
  message: string;
  details?: unknown;
}

interface ApiEnvelope<T> {
  data: T | null;
  meta: Record<string, unknown>;
  error: ApiErrorBody | null;
}

export interface CreationResult {
  id?: string;
  operationId?: string;
  programId?: string;
  sessionId?: string;
  status?: string;
  title?: string;
}

export interface TopicProgramInput {
  topic: string;
  goal: string;
  level: 'beginner' | 'intermediate' | 'advanced';
  language: string;
}

export interface DocumentProgramInput {
  title: string;
  file: File;
  language: string;
}

export interface InterviewInput {
  profession: string;
  level: 'junior' | 'middle' | 'senior' | 'lead';
  format: 'technical' | 'behavioral' | 'mixed';
  technologies: string[];
  vacancyText: string | null;
  language: string;
}

export interface LearningProgram {
  id: string;
  sourceId: string;
  sourceType: 'document' | 'generated_topic';
  title: string;
  goal: string;
  level: string;
  language: string;
  status: 'pending' | 'processing' | 'ready' | 'failed';
  failureCode: string | null;
}

export interface CitedAnswer {
  id: string;
  answer: string;
  citations: Array<{ chunkId: string; quote: string }>;
  insufficientContext: boolean;
}

export interface QuizQuestion {
  id: string;
  quizId: string;
  programId: string;
  sourceId: string;
  type: 'single_choice' | 'free_text';
  topic: string;
  prompt: string;
  options: string[] | null;
  sourceChunkIds: string[];
}

export interface Quiz {
  id: string;
  questions: QuizQuestion[];
}

export interface AnswerEvaluation {
  attemptId: string;
  score: number;
  mastery: number;
  feedback: string;
  missingPoints: string[];
}

export interface ProgramProgress {
  programId: string;
  topics: Array<{
    topic: string;
    score: number;
    attemptCount: number;
    lastReviewedAt: string;
  }>;
  weakestTopics: string[];
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
}

export interface InterviewReport {
  summary: string;
  overallScore: number;
  competencyScores: Array<{
    competency: string;
    score: number;
    evidence: string;
  }>;
  strengths: string[];
  gaps: string[];
  recommendations: string[];
}

export interface InterviewSession {
  id: string;
  profession: string;
  level: InterviewInput['level'];
  format: InterviewInput['format'];
  technologies: string[];
  language: string;
  status: 'scenario_pending' | 'active' | 'completed' | 'failed';
  reportStatus: 'not_requested' | 'pending' | 'ready' | 'failed';
  openingMessage: string | null;
  currentQuestion: string | null;
  currentQuestionIndex: number | null;
  answeredQuestions: number;
  totalQuestions: number;
  turns: InterviewTurn[];
  report: InterviewReport | null;
  failureCode: string | null;
}

export interface InterviewAnswerResult {
  answerId: string;
  questionIndex: number;
  feedback: string;
  score: number;
  strengths: string[];
  gaps: string[];
  nextQuestion: string | null;
  completed: boolean;
}

export class ApiClientError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
}

export function createRequestId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }

  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (character) => {
    const random = Math.floor(Math.random() * 16);
    const value = character === 'x' ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}

export function getAnonymousUserId(): string {
  if (typeof window === 'undefined') {
    throw new ApiClientError(
      'Идентификатор пользователя доступен только в браузере.',
      'BROWSER_REQUIRED',
    );
  }

  if (inMemoryUserId) return inMemoryUserId;

  try {
    const savedUserId = window.localStorage.getItem(ANONYMOUS_USER_KEY);
    if (savedUserId && UUID_PATTERN.test(savedUserId)) {
      inMemoryUserId = savedUserId;
      return savedUserId;
    }

    const userId = createRequestId();
    inMemoryUserId = userId;

    window.localStorage.setItem(ANONYMOUS_USER_KEY, userId);
    return userId;
  } catch {
    // Keep a stable identifier for this page session when persistent storage is
    // unavailable in a restricted browser context.
    inMemoryUserId = createRequestId();
    return inMemoryUserId;
  }
}

function buildUrl(path: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || DEFAULT_API_URL;
  return `${baseUrl.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;
}

function isApiEnvelope<T>(body: unknown): body is ApiEnvelope<T> {
  return Boolean(
    body && typeof body === 'object' && 'data' in body && 'meta' in body && 'error' in body,
  );
}

async function request<T>(path: string, init: RequestInit, userId: string): Promise<T> {
  let response: Response;
  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');
  headers.set('x-user-id', userId);

  try {
    response = await fetch(buildUrl(path), {
      ...init,
      cache: 'no-store',
      headers,
    });
  } catch {
    throw new ApiClientError(
      'Не удалось связаться с сервером. Проверьте, запущен ли API.',
      'NETWORK_ERROR',
    );
  }

  const contentType = response.headers.get('content-type') || '';
  const body: unknown = contentType.includes('application/json')
    ? await response.json().catch(() => null)
    : null;

  if (isApiEnvelope<T>(body)) {
    if (!response.ok || body.error) {
      throw new ApiClientError(
        body.error?.message || 'Сервер не смог выполнить запрос.',
        body.error?.code || 'API_ERROR',
        response.status,
      );
    }

    if (body.data === null) {
      throw new ApiClientError('Сервер вернул пустой ответ.', 'EMPTY_RESPONSE');
    }

    return body.data;
  }

  if (!response.ok) {
    throw new ApiClientError(
      'Сервер не смог выполнить запрос. Попробуйте ещё раз.',
      'HTTP_ERROR',
      response.status,
    );
  }

  return body as T;
}

export function createTopicProgram(input: TopicProgramInput): Promise<CreationResult> {
  const userId = getAnonymousUserId();

  return request<CreationResult>(
    '/learning-programs/from-topic',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    },
    userId,
  );
}

export function createDocumentProgram(input: DocumentProgramInput): Promise<CreationResult> {
  const userId = getAnonymousUserId();
  const formData = new FormData();
  formData.append('title', input.title);
  formData.append('language', input.language);
  formData.append('file', input.file);

  return request<CreationResult>(
    '/learning-programs/from-document',
    { method: 'POST', body: formData },
    userId,
  );
}

export function createInterview(input: InterviewInput): Promise<CreationResult> {
  const userId = getAnonymousUserId();

  return request<CreationResult>(
    '/interview-programs',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    },
    userId,
  );
}

export function getLearningProgram(programId: string): Promise<LearningProgram> {
  return request<LearningProgram>(
    `/learning-programs/${encodeURIComponent(programId)}`,
    { method: 'GET' },
    getAnonymousUserId(),
  );
}

export function askLearningQuestion(
  programId: string,
  question: string,
  language = 'ru',
): Promise<CitedAnswer> {
  return request<CitedAnswer>(
    `/learning-programs/${encodeURIComponent(programId)}/questions`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question, language }),
    },
    getAnonymousUserId(),
  );
}

export function generateLearningQuiz(programId: string, language = 'ru'): Promise<Quiz> {
  return request<Quiz>(
    `/learning-programs/${encodeURIComponent(programId)}/quizzes`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ count: 5, difficulty: 'medium', language }),
    },
    getAnonymousUserId(),
  );
}

export function submitLearningAnswer(
  questionId: string,
  answer: string,
  language = 'ru',
): Promise<AnswerEvaluation> {
  return request<AnswerEvaluation>(
    `/questions/${encodeURIComponent(questionId)}/attempts`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answer, language }),
    },
    getAnonymousUserId(),
  );
}

export function getProgramProgress(programId: string): Promise<ProgramProgress> {
  return request<ProgramProgress>(
    `/learning-programs/${encodeURIComponent(programId)}/progress`,
    { method: 'GET' },
    getAnonymousUserId(),
  );
}

export function getInterview(sessionId: string): Promise<InterviewSession> {
  return request<InterviewSession>(
    `/interview-programs/${encodeURIComponent(sessionId)}`,
    { method: 'GET' },
    getAnonymousUserId(),
  );
}

export function submitInterviewAnswer(
  sessionId: string,
  input: {
    answerId: string;
    expectedQuestionIndex: number;
    answer: string;
  },
): Promise<InterviewAnswerResult> {
  return request<InterviewAnswerResult>(
    `/interview-programs/${encodeURIComponent(sessionId)}/answers`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    },
    getAnonymousUserId(),
  );
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof ApiClientError) return error.message;
  return 'Что-то пошло не так. Попробуйте ещё раз.';
}
