import { resolve } from 'node:path';
import { z } from 'zod';
import { retrievedChunkSchema } from './knowledge';

export const KNOWLEDGE_GRPC_PACKAGE = 'wellllai.knowledge.v1';
export const KNOWLEDGE_GRPC_SERVICE = 'KnowledgeRetrievalService';

// The workspace build emits this module to dist/, while proto/ stays next to dist/.
export const KNOWLEDGE_GRPC_PROTO_PATH = resolve(__dirname, '../proto/knowledge.proto');

export const retrieveKnowledgeRpcRequestSchema = z.object({
  sourceId: z.string().uuid(),
  query: z.string().trim().min(2).max(2_000),
  limit: z.number().int().min(1).max(20),
});

export const retrieveKnowledgeRpcResponseSchema = z.object({
  chunks: z.array(
    retrievedChunkSchema.extend({
      page: z.number().int().positive().nullish(),
      heading: z.string().nullish(),
    }),
  ),
});

export type RetrieveKnowledgeRpcRequest = z.infer<typeof retrieveKnowledgeRpcRequestSchema>;
export type RetrieveKnowledgeRpcResponse = z.infer<typeof retrieveKnowledgeRpcResponseSchema>;
