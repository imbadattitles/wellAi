import { CallOptions, Metadata, status } from '@grpc/grpc-js';
import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { ClientGrpc } from '@nestjs/microservices';
import {
  KNOWLEDGE_GRPC_SERVICE,
  RetrieveKnowledgeRpcRequest,
  retrieveKnowledgeRpcResponseSchema,
} from '@wellllai/contracts';
import { firstValueFrom, Observable } from 'rxjs';
import { KnowledgeRetrievalPort } from '../application/ports';
import { LearningDependencyError, LearningStateError } from '../domain/errors';

export const KNOWLEDGE_GRPC_CLIENT = 'KNOWLEDGE_GRPC_CLIENT';
const KNOWLEDGE_GRPC_DEADLINE_MS = 15_000;

interface KnowledgeRetrievalGrpcService {
  retrieve(
    request: RetrieveKnowledgeRpcRequest,
    metadata?: Metadata,
    options?: CallOptions,
  ): Observable<unknown>;
}

@Injectable()
export class KnowledgeGrpcClient implements KnowledgeRetrievalPort, OnModuleInit {
  private service: KnowledgeRetrievalGrpcService | null = null;

  constructor(@Inject(KNOWLEDGE_GRPC_CLIENT) private readonly client: ClientGrpc) {}

  onModuleInit(): void {
    this.service = this.client.getService<KnowledgeRetrievalGrpcService>(KNOWLEDGE_GRPC_SERVICE);
  }

  async retrieve(sourceId: string, query: string, limit: number) {
    if (!this.service) throw new Error('Knowledge gRPC client is not initialized');

    let response: unknown;
    try {
      response = await firstValueFrom(
        this.service.retrieve({ sourceId, query, limit }, new Metadata(), {
          deadline: new Date(Date.now() + KNOWLEDGE_GRPC_DEADLINE_MS),
        }),
      );
    } catch (error) {
      throw this.mapRpcError(error);
    }

    const parsed = retrieveKnowledgeRpcResponseSchema.safeParse(response);
    if (!parsed.success) {
      throw new LearningDependencyError(
        'KNOWLEDGE_RPC_RESPONSE_INVALID',
        'Knowledge service returned an invalid response',
      );
    }
    return parsed.data.chunks.map((chunk) => ({
      ...chunk,
      page: chunk.page ?? null,
      heading: chunk.heading ?? null,
    }));
  }

  private mapRpcError(error: unknown): Error {
    const code =
      error && typeof error === 'object' && 'code' in error
        ? Number((error as { code: unknown }).code)
        : null;
    if (code === status.FAILED_PRECONDITION) {
      return new LearningStateError('Knowledge source is not ready');
    }
    if (code === status.DEADLINE_EXCEEDED) {
      return new LearningDependencyError(
        'KNOWLEDGE_RPC_TIMEOUT',
        'Knowledge service did not respond in time',
        504,
      );
    }
    if (code === status.UNAVAILABLE) {
      return new LearningDependencyError(
        'KNOWLEDGE_RPC_UNAVAILABLE',
        'Knowledge service is unavailable',
        503,
      );
    }
    return new LearningDependencyError('KNOWLEDGE_RPC_FAILED', 'Knowledge retrieval failed');
  }
}
