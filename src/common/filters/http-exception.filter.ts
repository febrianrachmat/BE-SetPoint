import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { ApiErrorResponse } from '../interfaces/api-response.interface';
import { RequestWithId } from '../middleware/request-id.middleware';
import {
  mapPrismaException,
  NormalizedException,
} from './prisma-exception.mapper';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<RequestWithId>();

    const { statusCode, code, message, details } = this.normalize(exception);

    const body: ApiErrorResponse = {
      success: false,
      error: {
        statusCode,
        code,
        message,
        ...(details ? { details } : {}),
      },
      meta: {
        timestamp: new Date().toISOString(),
        path: request.originalUrl ?? request.url,
        requestId: request.requestId ?? 'unknown',
      },
    };

    if (statusCode >= 500) {
      this.logger.error(
        `${request.method} ${body.meta.path} [${body.meta.requestId}]`,
        exception instanceof Error ? exception.stack : undefined,
      );
    }

    response.status(statusCode).json(body);
  }

  private normalize(exception: unknown): NormalizedException {
    if (exception instanceof HttpException) {
      const statusCode = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      const code = this.statusToCode(statusCode);

      if (typeof exceptionResponse === 'string') {
        return { statusCode, code, message: exceptionResponse };
      }

      const payload = exceptionResponse as Record<string, unknown>;
      const extracted = this.extractMessage(payload.message, exception.message);

      if (Array.isArray(extracted)) {
        return {
          statusCode,
          code,
          message: 'Validation failed',
          details: extracted,
        };
      }

      return { statusCode, code, message: extracted };
    }

    const prismaMapped = mapPrismaException(exception);
    if (prismaMapped) {
      return prismaMapped;
    }

    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Internal server error',
    };
  }

  private extractMessage(
    value: unknown,
    fallback: string,
  ): string | string[] {
    if (typeof value === 'string') {
      return value;
    }

    if (Array.isArray(value) && value.every((item) => typeof item === 'string')) {
      return value;
    }

    return fallback;
  }

  private statusToCode(statusCode: number): string {
    const name = HttpStatus[statusCode];
    if (typeof name === 'string') {
      return name;
    }
    return 'ERROR';
  }
}
