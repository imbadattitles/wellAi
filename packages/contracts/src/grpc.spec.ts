import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  KNOWLEDGE_GRPC_PROTO_PATH,
  retrieveKnowledgeRpcRequestSchema,
  retrieveKnowledgeRpcResponseSchema,
} from './grpc';

describe('knowledge gRPC contract', () => {
  it('keeps the proto asset available next to the built contracts package', () => {
    expect(existsSync(KNOWLEDGE_GRPC_PROTO_PATH)).toBe(true);
  });

  it('validates retrieval boundaries and nullable protobuf fields', () => {
    expect(() =>
      retrieveKnowledgeRpcRequestSchema.parse({
        sourceId: 'a65f7855-14b3-4ce4-bc86-5fe472527a4d',
        query: '  MVCC  ',
        limit: 8,
      }),
    ).not.toThrow();
    expect(() =>
      retrieveKnowledgeRpcRequestSchema.parse({
        sourceId: 'not-a-uuid',
        query: 'x',
        limit: 0,
      }),
    ).toThrow();

    const response = retrieveKnowledgeRpcResponseSchema.parse({
      chunks: [
        {
          chunkId: '8d75b521-f967-41d6-9b3a-5267b08d8512',
          sourceId: 'a65f7855-14b3-4ce4-bc86-5fe472527a4d',
          text: 'MVCC keeps multiple versions.',
          similarity: -0.1,
        },
      ],
    });
    expect(response.chunks[0]?.page).toBeUndefined();
    expect(response.chunks[0]?.heading).toBeUndefined();
  });
});
