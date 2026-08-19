import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import { ApiEnvelope } from '@wellllai/contracts';
import { InterviewNotFoundError, InterviewStateError } from '../domain/interview-session';

interface HttpResponse {
  status(code: number): HttpResponse;
  json(body: unknown): void;
}

@Catch()
export class InterviewHttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const domainError =
      exception instanceof InterviewNotFoundError || exception instanceof InterviewStateError
        ? exception
        : null;
    const httpError = exception instanceof HttpException ? exception : null;
    const status = domainError
      ? domainError instanceof InterviewNotFoundError
        ? 404
        : 409
      : (httpError?.getStatus() ?? HttpStatus.INTERNAL_SERVER_ERROR);
    const httpResponse = httpError?.getResponse();
    const rawMessage =
      typeof httpResponse === 'string'
        ? httpResponse
        : typeof httpResponse === 'object' && httpResponse !== null && 'message' in httpResponse
          ? (httpResponse as { message?: unknown }).message
          : undefined;
    const message = domainError
      ? domainError.message
      : typeof rawMessage === 'string'
        ? rawMessage
        : status >= 500
          ? 'Internal server error'
          : 'Request validation failed';
    const body: ApiEnvelope<never> = {
      data: null,
      meta: {},
      error: {
        code: domainError?.name ?? (status === 400 ? 'VALIDATION_FAILED' : `HTTP_${status}`),
        message,
        ...(Array.isArray(rawMessage) ? { details: rawMessage } : {}),
      },
    };

    host.switchToHttp().getResponse<HttpResponse>().status(status).json(body);
  }
}
