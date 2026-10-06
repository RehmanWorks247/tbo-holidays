import { randomUUID } from 'node:crypto';

import { type ArgumentsHost, Catch, type ExceptionFilter, HttpException } from '@nestjs/common';
import type { Response } from 'express';
import { PinoLogger } from 'nestjs-pino';

import { DomainError } from '../errors/domain-error';
import type { AuthenticatedRequest } from '../types/authenticated-request';

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  constructor(private readonly logger: PinoLogger) {}
  catch(error: unknown, host: ArgumentsHost): void {
    const request = host.switchToHttp().getRequest<Partial<AuthenticatedRequest>>();
    const response = host.switchToHttp().getResponse<Response>();
    // Body-parser can reject malformed JSON before the request logger runs.
    const requestId = request.id ?? randomUUID();
    request.id = requestId;
    response.setHeader('X-Request-Id', requestId);
    if (error instanceof DomainError) {
      response.status(error.status).json({
        code: error.code,
        message: error.message,
        ...(error.details ? { details: error.details } : {}),
        requestId,
      });
      return;
    }
    if (error instanceof HttpException && error.getStatus() < 500) {
      const status = error.getStatus();
      const codes: Record<number, string> = {
        400: 'VALIDATION_ERROR',
        401: 'UNAUTHENTICATED',
        403: 'FORBIDDEN',
        404: 'NOT_FOUND',
        429: 'RATE_LIMITED',
      };
      response.status(status).json({
        code: codes[status] ?? 'REQUEST_REJECTED',
        message: status === 400 ? 'The request is invalid.' : error.message,
        requestId,
      });
      return;
    }
    // Exception messages may contain supplier payloads, URLs or SQL parameter values.
    this.logger.error(
      {
        requestId,
        userId: request.user?.id,
        errorType: error instanceof Error ? error.name : 'UnknownError',
      },
      'Unhandled request failure',
    );
    response
      .status(500)
      .json({ code: 'INTERNAL_ERROR', message: 'An unexpected error occurred.', requestId });
  }
}
