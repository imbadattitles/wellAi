import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import { Request, Response } from 'express';
import { ServiceHttpError } from '../application/service-http.client';

@Catch()
export class HttpErrorFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const request = host.switchToHttp().getRequest<Request>();
    const status =
      exception instanceof ServiceHttpError
        ? exception.status
        : exception instanceof HttpException
          ? exception.getStatus()
          : HttpStatus.INTERNAL_SERVER_ERROR;
    const httpDetails = exception instanceof HttpException ? exception.getResponse() : undefined;
    const message =
      exception instanceof ServiceHttpError
        ? exception.message
        : exception instanceof HttpException && status < 500
          ? exception.message
          : 'Internal service error';
    const code =
      exception instanceof ServiceHttpError ? exception.downstreamCode : `HTTP_${status}`;

    response.status(status).json({
      data: null,
      meta: { path: request.url },
      error: {
        code,
        message,
        ...(status < 500 && !(exception instanceof ServiceHttpError)
          ? { details: httpDetails }
          : {}),
      },
    });
  }
}
