import { Injectable } from '@nestjs/common';
import { Prisma, TournamentStatus, Visibility } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export type CreateTournamentData = {
  name: string;
  description?: string;
  visibility?: Visibility;
  registrationOpenAt?: Date;
  registrationCloseAt?: Date;
  startAt?: Date;
  endAt?: Date;
  createdBy?: string;
};

export type UpdateTournamentData = {
  name?: string;
  description?: string | null;
  visibility?: Visibility;
  registrationOpenAt?: Date | null;
  registrationCloseAt?: Date | null;
  startAt?: Date | null;
  endAt?: Date | null;
  updatedBy?: string;
};

@Injectable()
export class TournamentRepository {
  constructor(private readonly prisma: PrismaService) {}

  findActiveById(id: string) {
    return this.prisma.tournament.findFirst({
      where: {
        id,
        deletedAt: null,
      },
    });
  }

  findManyActive(params: {
    skip: number;
    take: number;
    search?: string;
    status?: TournamentStatus;
  }) {
    const where: Prisma.TournamentWhereInput = {
      deletedAt: null,
      ...(params.status ? { status: params.status } : {}),
      ...(params.search
        ? {
            name: {
              contains: params.search,
              mode: 'insensitive',
            },
          }
        : {}),
    };

    return this.prisma.$transaction([
      this.prisma.tournament.findMany({
        where,
        skip: params.skip,
        take: params.take,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.tournament.count({ where }),
    ]);
  }

  create(data: CreateTournamentData) {
    return this.prisma.tournament.create({
      data: {
        name: data.name,
        description: data.description,
        visibility: data.visibility ?? Visibility.private,
        registrationOpenAt: data.registrationOpenAt,
        registrationCloseAt: data.registrationCloseAt,
        startAt: data.startAt,
        endAt: data.endAt,
        status: TournamentStatus.draft,
        createdBy: data.createdBy,
        updatedBy: data.createdBy,
      },
    });
  }

  update(id: string, data: UpdateTournamentData) {
    return this.prisma.tournament.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.description !== undefined
          ? { description: data.description }
          : {}),
        ...(data.visibility !== undefined ? { visibility: data.visibility } : {}),
        ...(data.registrationOpenAt !== undefined
          ? { registrationOpenAt: data.registrationOpenAt }
          : {}),
        ...(data.registrationCloseAt !== undefined
          ? { registrationCloseAt: data.registrationCloseAt }
          : {}),
        ...(data.startAt !== undefined ? { startAt: data.startAt } : {}),
        ...(data.endAt !== undefined ? { endAt: data.endAt } : {}),
        updatedBy: data.updatedBy,
        rowVersion: { increment: 1 },
      },
    });
  }

  softDelete(id: string, deletedBy?: string) {
    return this.prisma.tournament.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        deletedBy,
        updatedBy: deletedBy,
        rowVersion: { increment: 1 },
      },
    });
  }

  transitionStatus(
    id: string,
    status: TournamentStatus,
    extras: {
      updatedBy?: string;
      publishState?: 'unpublished' | 'published';
      publishedAt?: Date | null;
      publishedBy?: string | null;
    } = {},
  ) {
    return this.prisma.tournament.update({
      where: { id },
      data: {
        status,
        updatedBy: extras.updatedBy,
        ...(extras.publishState !== undefined
          ? { publishState: extras.publishState }
          : {}),
        ...(extras.publishedAt !== undefined
          ? { publishedAt: extras.publishedAt }
          : {}),
        ...(extras.publishedBy !== undefined
          ? { publishedBy: extras.publishedBy }
          : {}),
        rowVersion: { increment: 1 },
      },
    });
  }

  countActiveCategories(tournamentId: string) {
    return this.prisma.category.count({
      where: {
        tournamentId,
        deletedAt: null,
      },
    });
  }
}
