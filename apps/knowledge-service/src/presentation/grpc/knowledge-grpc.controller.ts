import { status } from '@grpc/grpc-js';
import { Controller } from '@nestjs/common';
import { GrpcMethod, RpcException } from '@nestjs/microservices';
import {
  KNOWLEDGE_GRPC_SERVICE,
  RetrieveKnowledgeRpcResponse,
  retrieveKnowledgeRpcRequestSchema,
} from '@wellllai/contracts';
import { RetrieveKnowledgeUseCase } from '../../application/retrieve-knowledge.use-case';
import { KnowledgeError } from '../../domain/errors';

@Controller()
export class KnowledgeGrpcController {
  constructor(private readonly retrieveKnowledge: RetrieveKnowledgeUseCase) {}

  @GrpcMethod(KNOWLEDGE_GRPC_SERVICE, 'Retrieve')
  async retrieve(value: unknown): Promise<RetrieveKnowledgeRpcResponse> {
    const request = retrieveKnowledgeRpcRequestSchema.safeParse(value);
    if (!request.success) {
      throw new RpcException({
        code: status.INVALID_ARGUMENT,
        message: 'Invalid knowledge retrieval request',
      });
    }

    try {
      const chunks = await this.retrieveKnowledge.execute(request.data);
      return {
        chunks: chunks.map(({ page, heading, ...chunk }) => ({
          ...chunk,
          ...(page === null ? {} : { page }),
          ...(heading === null ? {} : { heading }),
        })),
      };
    } catch (error) {
      if (error instanceof KnowledgeError) {
        throw new RpcException({
          code: this.grpcStatus(error),
          message: `${error.code}: ${error.message}`,
        });
      }
      throw new RpcException({
        code: status.INTERNAL,
        message: 'Knowledge retrieval failed',
      });
    }
  }

  private grpcStatus(error: KnowledgeError): status {
    if (error.statusCode === 404) return status.NOT_FOUND;
    if (error.statusCode === 409) return status.FAILED_PRECONDITION;
    if (error.statusCode === 422) return status.INVALID_ARGUMENT;
    if (error.retryable || error.statusCode >= 500) return status.UNAVAILABLE;
    return status.INTERNAL;
  }
}
