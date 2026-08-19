import { z } from 'zod';

export const sourceLanguageSchema = z.string().trim().min(2).max(16);

export const topicLevelSchema = z.enum(['beginner', 'intermediate', 'advanced']);

export const documentIngestionRequestedSchema = z.object({
  sourceId: z.string().uuid(),
  programId: z.string().uuid(),
  userId: z.string().uuid(),
  fileName: z.string().trim().min(1).max(255),
  mimeType: z.literal('application/pdf'),
  language: sourceLanguageSchema,
});

export type DocumentIngestionRequested = z.infer<typeof documentIngestionRequestedSchema>;

export const topicMaterializationRequestedSchema = z.object({
  sourceId: z.string().uuid(),
  programId: z.string().uuid(),
  userId: z.string().uuid(),
  topic: z.string().trim().min(3).max(200),
  level: topicLevelSchema,
  goal: z.string().trim().min(3).max(500),
  language: sourceLanguageSchema,
});

export type TopicMaterializationRequested = z.infer<typeof topicMaterializationRequestedSchema>;

export const knowledgeSourceReadySchema = z.object({
  sourceId: z.string().uuid(),
  programId: z.string().uuid(),
  knowledgeVersionId: z.string().uuid(),
  title: z.string().trim().min(1).max(255),
  topicIds: z.array(z.string().uuid()),
});

export type KnowledgeSourceReady = z.infer<typeof knowledgeSourceReadySchema>;

export const knowledgeSourceFailedSchema = z.object({
  sourceId: z.string().uuid(),
  programId: z.string().uuid(),
  errorCode: z.string().trim().min(1).max(100),
  retryable: z.boolean(),
});

export type KnowledgeSourceFailed = z.infer<typeof knowledgeSourceFailedSchema>;

export const retrievedChunkSchema = z.object({
  chunkId: z.string().uuid(),
  sourceId: z.string().uuid(),
  text: z.string().min(1),
  page: z.number().int().positive().nullable(),
  heading: z.string().nullable(),
  similarity: z.number().min(-1).max(1),
});

export type RetrievedChunk = z.infer<typeof retrievedChunkSchema>;
