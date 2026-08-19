import { z } from 'zod';
import { sourceLanguageSchema } from './knowledge';

export const interviewLevelSchema = z.enum(['junior', 'middle', 'senior', 'lead']);
export const interviewFormatSchema = z.enum(['technical', 'behavioral', 'mixed']);

export const createInterviewSchema = z.object({
  userId: z.string().uuid(),
  profession: z.string().trim().min(2).max(120),
  level: interviewLevelSchema,
  format: interviewFormatSchema,
  technologies: z.array(z.string().trim().min(1).max(50)).max(20),
  vacancyText: z.string().trim().max(20_000).nullable(),
  language: sourceLanguageSchema,
});

export type CreateInterview = z.infer<typeof createInterviewSchema>;

export const submitInterviewAnswerSchema = z.object({
  userId: z.string().uuid(),
  sessionId: z.string().uuid(),
  answerId: z.string().uuid(),
  expectedQuestionIndex: z.number().int().nonnegative(),
  answer: z.string().trim().min(1).max(10_000),
});

export type SubmitInterviewAnswer = z.infer<typeof submitInterviewAnswerSchema>;

export const interviewTurnResultSchema = z.object({
  answerId: z.string().uuid(),
  questionIndex: z.number().int().nonnegative(),
  feedback: z.string().trim().min(1).max(2_000),
  score: z.number().min(0).max(1),
  strengths: z.array(z.string().trim().min(1).max(500)).max(10),
  gaps: z.array(z.string().trim().min(1).max(500)).max(10),
  nextQuestion: z.string().trim().min(1).max(2_000).nullable(),
  completed: z.boolean(),
});

export type InterviewTurnResult = z.infer<typeof interviewTurnResultSchema>;

export const interviewJobRequestedSchema = z.object({
  sessionId: z.string().uuid(),
});

export const interviewScenarioGenerationRequestedSchema = interviewJobRequestedSchema;
export const interviewReportGenerationRequestedSchema = interviewJobRequestedSchema;

export const interviewScenarioReadySchema = z.object({
  sessionId: z.string().uuid(),
  questionCount: z.number().int().positive(),
});

export const interviewSessionCompletedSchema = z.object({
  sessionId: z.string().uuid(),
  userId: z.string().uuid(),
});

export const interviewReportReadySchema = z.object({
  sessionId: z.string().uuid(),
  overallScore: z.number().min(0).max(1),
});

export const interviewJobFailedSchema = z.object({
  sessionId: z.string().uuid(),
  failureCode: z.string().min(1).max(80),
});

export type InterviewJobRequested = z.infer<typeof interviewJobRequestedSchema>;
export type InterviewScenarioReady = z.infer<typeof interviewScenarioReadySchema>;
export type InterviewSessionCompleted = z.infer<typeof interviewSessionCompletedSchema>;
export type InterviewReportReady = z.infer<typeof interviewReportReadySchema>;
export type InterviewJobFailed = z.infer<typeof interviewJobFailedSchema>;
