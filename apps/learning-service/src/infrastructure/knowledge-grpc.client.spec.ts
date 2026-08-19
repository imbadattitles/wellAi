import { ClientGrpc } from '@nestjs/microservices';
import { status } from '@grpc/grpc-js';
import { of, throwError } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { KNOWLEDGE_GRPC_SERVICE } from '@wellllai/contracts';
import { LearningDependencyError } from '../domain/errors';
import { KnowledgeGrpcClient } from './knowledge-grpc.client';

describe('KnowledgeGrpcClient', () => {
  it('uses a deadline and restores nullable fields omitted by protobuf', async () => {
    const retrieve = vi.fn().mockReturnValue(
      of({
        chunks: [
          {
            chunkId: '8d75b521-f967-41d6-9b3a-5267b08d8512',
            sourceId: 'a65f7855-14b3-4ce4-bc86-5fe472527a4d',
            text: 'MVCC keeps multiple row versions.',
            similarity: 0.9,
          },
        ],
      }),
    );
    const grpc = {
      getService: vi.fn().mockReturnValue({ retrieve }),
    } as unknown as ClientGrpc;
    const client = new KnowledgeGrpcClient(grpc);
    client.onModuleInit();

    const before = Date.now();
    const result = await client.retrieve(
      'a65f7855-14b3-4ce4-bc86-5fe472527a4d',
      'What is MVCC?',
      8,
    );

    expect(grpc.getService).toHaveBeenCalledWith(KNOWLEDGE_GRPC_SERVICE);
    expect(retrieve).toHaveBeenCalledWith(
      {
        sourceId: 'a65f7855-14b3-4ce4-bc86-5fe472527a4d',
        query: 'What is MVCC?',
        limit: 8,
      },
      expect.anything(),
      expect.objectContaining({ deadline: expect.any(Date) }),
    );
    const options = retrieve.mock.calls[0]?.[2] as { deadline: Date };
    expect(options.deadline.getTime()).toBeGreaterThanOrEqual(before + 14_000);
    expect(result[0]).toMatchObject({ page: null, heading: null, similarity: 0.9 });
  });

  it('rejects a malformed response instead of passing it to the AI layer', async () => {
    const grpc = {
      getService: vi.fn().mockReturnValue({ retrieve: () => of({ chunks: [{ text: '' }] }) }),
    } as unknown as ClientGrpc;
    const client = new KnowledgeGrpcClient(grpc);
    client.onModuleInit();

    await expect(
      client.retrieve('a65f7855-14b3-4ce4-bc86-5fe472527a4d', 'query', 8),
    ).rejects.toThrow();
  });

  it('maps an unavailable dependency to a retryable HTTP-facing error', async () => {
    const grpc = {
      getService: vi.fn().mockReturnValue({
        retrieve: () => throwError(() => ({ code: status.UNAVAILABLE })),
      }),
    } as unknown as ClientGrpc;
    const client = new KnowledgeGrpcClient(grpc);
    client.onModuleInit();

    const error = await client
      .retrieve('a65f7855-14b3-4ce4-bc86-5fe472527a4d', 'query', 8)
      .catch((value) => value);
    expect(error).toBeInstanceOf(LearningDependencyError);
    expect(error).toMatchObject({ code: 'KNOWLEDGE_RPC_UNAVAILABLE', statusCode: 503 });
  });
});
