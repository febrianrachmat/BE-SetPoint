import assert from 'node:assert/strict';
import { HttpStatus } from '@nestjs/common';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { mapPrismaException } from './prisma-exception.mapper';

function known(
  code: string,
  meta?: Record<string, unknown>,
): PrismaClientKnownRequestError {
  return new PrismaClientKnownRequestError(`Prisma ${code}`, {
    code,
    clientVersion: 'test',
    meta,
  });
}

{
  const mapped = mapPrismaException(
    known('P2002', { target: ['name'], modelName: 'Tournament' }),
  );
  assert.ok(mapped);
  assert.equal(mapped.statusCode, HttpStatus.CONFLICT);
  assert.equal(mapped.code, 'CONFLICT');
  assert.match(mapped.message, /name/);
  assert.deepEqual(mapped.details, {
    prismaCode: 'P2002',
    model: 'Tournament',
    target: ['name'],
  });
}

{
  const mapped = mapPrismaException(
    known('P2025', { cause: 'No Court found', modelName: 'Court' }),
  );
  assert.ok(mapped);
  assert.equal(mapped.statusCode, HttpStatus.NOT_FOUND);
  assert.equal(mapped.message, 'No Court found');
  assert.deepEqual(mapped.details, {
    prismaCode: 'P2025',
    model: 'Court',
  });
}

{
  const mapped = mapPrismaException(
    known('P2003', { field_name: 'tournament_id', modelName: 'Court' }),
  );
  assert.ok(mapped);
  assert.equal(mapped.statusCode, HttpStatus.BAD_REQUEST);
  assert.match(mapped.message, /tournament_id/);
  assert.deepEqual(mapped.details, {
    prismaCode: 'P2003',
    model: 'Court',
    field: 'tournament_id',
  });
}

{
  const mapped = mapPrismaException(known('P2014', { modelName: 'Match' }));
  assert.ok(mapped);
  assert.equal(mapped.statusCode, HttpStatus.BAD_REQUEST);
  assert.equal((mapped.details as { prismaCode: string }).prismaCode, 'P2014');
}

{
  // Unmapped known codes stay 500 but expose the prisma code so FE/logs
  // can distinguish "DB said no" from "unknown crash".
  const mapped = mapPrismaException(known('P2034', { modelName: 'Match' }));
  assert.ok(mapped);
  assert.equal(mapped.statusCode, HttpStatus.INTERNAL_SERVER_ERROR);
  assert.deepEqual(mapped.details, {
    prismaCode: 'P2034',
    model: 'Match',
  });
}

{
  assert.equal(mapPrismaException(new Error('not prisma')), null);
  assert.equal(mapPrismaException({ code: 'P2002' }), null);
}

console.log('prisma-exception.mapper.spec: all assertions passed');
