import {
  HttpStatus,
  ConflictException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import {
  PrismaClientKnownRequestError,
  PrismaClientValidationError,
  PrismaClientInitializationError,
  PrismaClientRustPanicError,
  PrismaClientUnknownRequestError,
} from '@prisma/client/runtime/library';

export type NormalizedException = {
  statusCode: number;
  code: string;
  message: string;
  details?: string[] | Record<string, unknown>;
};

/**
 * Maps Prisma client errors to HTTP-friendly responses so callers (and a
 * future FE) can tell a unique conflict from a missing row without digging
 * through server logs.
 *
 * Returns null when the value is not a Prisma error — the caller should fall
 * through to its own handling.
 */
export function mapPrismaException(exception: unknown): NormalizedException | null {
  if (exception instanceof PrismaClientKnownRequestError) {
    return mapKnownRequestError(exception);
  }

  if (exception instanceof PrismaClientValidationError) {
    return {
      statusCode: HttpStatus.BAD_REQUEST,
      code: 'BAD_REQUEST',
      message: 'Invalid database query',
      details: {
        prismaCode: 'VALIDATION',
        reason: firstLine(exception.message),
      },
    };
  }

  if (
    exception instanceof PrismaClientInitializationError ||
    exception instanceof PrismaClientRustPanicError ||
    exception instanceof PrismaClientUnknownRequestError
  ) {
    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Database error',
      details: {
        prismaCode:
          'errorCode' in exception && typeof exception.errorCode === 'string'
            ? exception.errorCode
            : exception.name,
      },
    };
  }

  return null;
}

/**
 * Convenience for services that still catch P2002 locally and want a typed
 * ConflictException without re-implementing the duck-type check.
 */
export function isPrismaUniqueConflict(error: unknown): boolean {
  return (
    error instanceof PrismaClientKnownRequestError && error.code === 'P2002'
  );
}

function mapKnownRequestError(
  error: PrismaClientKnownRequestError,
): NormalizedException {
  const target = extractTarget(error.meta);
  const model = typeof error.meta?.modelName === 'string'
    ? error.meta.modelName
    : undefined;

  switch (error.code) {
    case 'P2002': {
      const fields = target?.join(', ') ?? 'field';
      return fromHttp(
        new ConflictException(
          `Unique constraint failed on ${fields}`,
        ),
        {
          prismaCode: error.code,
          ...(model ? { model } : {}),
          ...(target ? { target } : {}),
        },
      );
    }

    case 'P2025':
      return fromHttp(
        new NotFoundException(
          typeof error.meta?.cause === 'string'
            ? error.meta.cause
            : 'Record not found',
        ),
        {
          prismaCode: error.code,
          ...(model ? { model } : {}),
        },
      );

    case 'P2003':
      return fromHttp(
        new BadRequestException(
          `Foreign key constraint failed${
            target?.[0] ? ` on ${target[0]}` : ''
          }`,
        ),
        {
          prismaCode: error.code,
          ...(model ? { model } : {}),
          ...(target ? { field: target[0] } : {}),
        },
      );

    case 'P2014':
      return fromHttp(
        new BadRequestException(
          'The change would violate a required relation',
        ),
        {
          prismaCode: error.code,
          ...(model ? { model } : {}),
        },
      );

    case 'P2000':
    case 'P2001':
    case 'P2011':
    case 'P2012':
      return fromHttp(
        new BadRequestException(firstLine(error.message) || 'Invalid data'),
        {
          prismaCode: error.code,
          ...(model ? { model } : {}),
        },
      );

    default:
      return {
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Database error',
        details: {
          prismaCode: error.code,
          ...(model ? { model } : {}),
        },
      };
  }
}

function fromHttp(
  exception: ConflictException | BadRequestException | NotFoundException,
  details: Record<string, unknown>,
): NormalizedException {
  const statusCode = exception.getStatus();
  const response = exception.getResponse();
  const message =
    typeof response === 'string'
      ? response
      : typeof (response as { message?: unknown }).message === 'string'
        ? ((response as { message: string }).message)
        : exception.message;

  return {
    statusCode,
    code: statusToCode(statusCode),
    message,
    details,
  };
}

function extractTarget(meta: Record<string, unknown> | undefined): string[] | undefined {
  if (!meta) {
    return undefined;
  }
  const target = meta.target;
  if (Array.isArray(target) && target.every((item) => typeof item === 'string')) {
    return target;
  }
  if (typeof target === 'string') {
    return [target];
  }
  // P2003 exposes the field name as meta.field_name
  if (typeof meta.field_name === 'string') {
    return [meta.field_name];
  }
  return undefined;
}

function firstLine(message: string): string {
  return message.split('\n').find((line) => line.trim().length > 0)?.trim() ?? message;
}

function statusToCode(statusCode: number): string {
  const name = HttpStatus[statusCode];
  return typeof name === 'string' ? name : 'ERROR';
}
