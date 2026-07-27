import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, map } from 'rxjs';
import { ApiSuccessResponse } from '../interfaces/api-response.interface';
import { RequestWithId } from '../middleware/request-id.middleware';

@Injectable()
export class ResponseEnvelopeInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest<RequestWithId>();

    return next.handle().pipe(
      map((data) => {
        if (this.isAlreadyEnveloped(data)) {
          return data;
        }

        const response: ApiSuccessResponse<unknown> = {
          success: true,
          data: data ?? null,
          meta: {
            timestamp: new Date().toISOString(),
            path: request.originalUrl ?? request.url,
            requestId: request.requestId,
          },
        };

        return response;
      }),
    );
  }

  private isAlreadyEnveloped(data: unknown): boolean {
    return (
      typeof data === 'object' &&
      data !== null &&
      'success' in data &&
      'meta' in data
    );
  }
}
