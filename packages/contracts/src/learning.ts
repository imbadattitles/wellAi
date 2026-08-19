import { z } from 'zod';
import { sourceLanguageSchema, topicLevelSchema } from './knowledge';

export const programStatusSchema = z.enum(['pending', 'processing', 'ready', 'failed']);

export const programSourceTypeSchema = z.enum(['document', 'generated_topic']);

export const createTopicProgramSchema = z.object({
  userId: z.string().uuid(),
  topic: z.string().trim().min(3).max(200),
  goal: z.string().trim().min(3).max(500),
  level: topicLevelSchema,
  language: sourceLanguageSchema,
});

export type CreateTopicProgram = z.infer<typeof createTopicProgramSchema>;

export const createDocumentProgramSchema = z.object({
  userId: z.string().uuid(),
  title: z.string().trim().min(1).max(200),
  fileName: z.string().trim().min(1).max(255),
  language: sourceLanguageSchema,
});

export type CreateDocumentProgram = z.infer<typeof createDocumentProgramSchema>;

export const learningProgramStatusChangedSchema = z.object({
  programId: z.string().uuid(),
  sourceId: z.string().uuid(),
  status: z.enum(['ready', 'failed']),
  failureCode: z.string().trim().min(1).max(100).nullable(),
});

export type LearningProgramStatusChanged = z.infer<typeof learningProgramStatusChangedSchema>;

export const answerQuestionSchema = z.object({
  userId: z.string().uuid(),
  programId: z.string().uuid(),
  question: z.string().trim().min(2).max(2000),
  language: sourceLanguageSchema,
});

export type AnswerQuestion = z.infer<typeof answerQuestionSchema>;

export const citedAnswerSchema = z.object({
  answer: z.string().trim().min(1).max(20_000),
  citations: z.array(
    z.object({
      chunkId: z.string().uuid(),
      quote: z.string().trim().min(1).max(2_000),
    }),
  ),
  insufficientContext: z.boolean(),
});

export type CitedAnswer = z.infer<typeof citedAnswerSchema>;

export const quizQuestionSchema = z.object({
  id: z.string().uuid(),
  type: z.enum(['single_choice', 'free_text']),
  prompt: z.string().trim().min(1).max(2_000),
  options: z.array(z.string().trim().min(1).max(500)).nullable(),
  sourceChunkIds: z.array(z.string().uuid()),
});

export type QuizQuestion = z.infer<typeof quizQuestionSchema>;
