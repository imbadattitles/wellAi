import { status } from '@grpc/grpc-js';
import { RpcException } from '@nestjs/microservices';
import { describe, expect, it, vi } from 'vitest';
import { RetrieveKnowledgeUseCase } from '../../application/retrieve-knowledge.use-case';
import { SourceNotFoundError, SourceNotReadyError } from '../../domain/errors';
import { KnowledgeGrpcController } from './knowledge-grpc.controller';

const request = {
  sourceId: 'a65f7855-14b3-4ce4-bc86-5fe472527a4d',
  query: 'What is MVCC?',
  limit: 8,
};

function rpcErrorCode(error: unknown): number | undefined {
  if (!(error instanceof RpcException)) return undefined;
  const detail = error.getError();
  return typeof detail === 'object' && detail && 'code' in detail
    ? Number((detail as { code: unknown }).code)
    : undefined;
}

describe('KnowledgeGrpcController', () => {
  it('delegates a valid unary request to the retrieval use case', async () => {
    const chunks = [
      {
        chunkId: '8d75b521-f967-41d6-9b3a-5267b08d8512',
        sourceId: request.sourceId,
        text: 'MVCC keeps multiple row versions.',
        page: null,
        heading: null,
        similarity: 0.9,
      },
    ];
    const useCase = {
      execute: vi.fn().mockResolvedValue(chunks),
    } as unknown as RetrieveKnowledgeUseCase;
    const controller = new KnowledgeGrpcController(useCase);

    await expect(controller.retrieve(request)).resolves.toEqual({
      chunks: [
        {
          chunkId: chunks[0]?.chunkId,
          sourceId: chunks[0]?.sourceId,
          text: chunks[0]?.text,
          similarity: chunks[0]?.similarity,
        },
      ],
    });
    expect(useCase.execute).toHaveBeenCalledWith(request);
  });

  it('rejects malformed requests as INVALID_ARGUMENT', async () => {
    const controller = new KnowledgeGrpcController({} as RetrieveKnowledgeUseCase);
    const error = await controller.retrieve({ ...request, limit: 0 }).catch((value) => value);
    expect(rpcErrorCode(error)).toBe(status.INVALID_ARGUMENT);
  });

  it.each([
    [new SourceNotFoundError(request.sourceId), status.NOT_FOUND],
    [new SourceNotReadyError(request.sourceId), status.FAILED_PRECONDITION],
  ])('maps domain errors to a stable gRPC status', async (failure, expectedStatus) => {
    const useCase = {
      execute: vi.fn().mockRejectedValue(failure),
    } as unknown as RetrieveKnowledgeUseCase;
    const controller = new KnowledgeGrpcController(useCase);
    const error = await controller.retrieve(request).catch((value) => value);
    expect(rpcErrorCode(error)).toBe(expectedStatus);
  });

  it('does not leak unexpected internal failures', async () => {
    const useCase = {
      execute: vi.fn().mockRejectedValue(new Error('secret database detail')),
    } as unknown as RetrieveKnowledgeUseCase;
    const controller = new KnowledgeGrpcController(useCase);
    const error = await controller.retrieve(request).catch((value) => value);
    expect(rpcErrorCode(error)).toBe(status.INTERNAL);
    expect(String((error as RpcException).getError())).not.toContain('secret database detail');
  });
});
