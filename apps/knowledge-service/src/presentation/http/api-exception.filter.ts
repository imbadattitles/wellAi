import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import { ApiEnvelope } from '@wellllai/contracts';
import { Response } from 'express';
import { KnowledgeError } from '../../domain/errors';

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const knowledgeError = exception instanceof KnowledgeError ? exception : null;
    const httpError = exception instanceof HttpException ? exception : null;
    const status =
      knowledgeError?.statusCode ?? httpError?.getStatus() ?? HttpStatus.INTERNAL_SERVER_ERROR;
    const httpResponse = httpError?.getResponse();
    const httpMessage =
      typeof httpResponse === 'string'
        ? httpResponse
        : typeof httpResponse === 'object' && httpResponse !== null && 'message' in httpResponse
          ? (httpResponse as { message?: unknown }).message
          : undefined;
    const message = knowledgeError
      ? knowledgeError.message
      : typeof httpMessage === 'string'
        ? httpMessage
        : status >= 500
          ? 'Internal server error'
          : 'Request validation failed';
    const body: ApiEnvelope<never> = {
      data: null,
      meta: {},
      error: {
        code: knowledgeError?.code ?? (status === 400 ? 'VALIDATION_FAILED' : 'HTTP_ERROR'),
        message,
        ...(Array.isArray(httpMessage) ? { details: httpMessage } : {}),
      },
    };

    response.status(status).json(body);
  }
}
