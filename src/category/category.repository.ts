import { Injectable } from '@nestjs/common';
import {
  LockState,
  MatchStatus,
  Prisma,
  PublishState,
  Visibility,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export type CreateCategoryData = {
  tournamentId: string;
  name: string;
  format: string;
  visibility?: Visibility;
  configuration?: Prisma.InputJsonValue;
  createdBy?: string;
};

export type UpdateCategoryData = {
  name?: string;
  format?: string;
  visibility?: Visibility;
  configuration?: Prisma.InputJsonValue | typeof Prisma.DbNull;
  updatedBy?: string;
};

@Injectable()
export class CategoryRepository {
  constructor(private readonly prisma: PrismaService) {}

  findActiveTournamentById(tournamentId: string) {
    return this.prisma.tournament.findFirst({
      where: { id: tournamentId, deletedAt: null },
    });
  }

  findActiveById(id: string) {
    return this.prisma.category.findFirst({
      where: { id, deletedAt: null },
    });
  }

  findActiveInTournament(tournamentId: string, categoryId: string) {
    return this.prisma.category.findFirst({
      where: {
        id: categoryId,
        tournamentId,
        deletedAt: null,
      },
      include: {
        drawing: true,
        schedule: true,
        playoff: true,
      },
    });
  }

  findManyActive(params: {
    tournamentId: string;
    skip: number;
    take: number;
    search?: string;
  }) {
    const where: Prisma.CategoryWhereInput = {
      tournamentId: params.tournamentId,
      deletedAt: null,
      ...(params.search
        ? {
            name: {
              contains: params.search,
              mode: 'insensitive' as const,
            },
          }
        : {}),
    };

    return this.prisma.$transaction([
      this.prisma.category.findMany({
        where,
        skip: params.skip,
        take: params.take,
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.category.count({ where }),
    ]);
  }

  create(data: CreateCategoryData) {
    return this.prisma.category.create({
      data: {
        tournamentId: data.tournamentId,
        name: data.name,
        format: data.format,
        visibility: data.visibility ?? Visibility.private,
        configuration: data.configuration,
        createdBy: data.createdBy,
        updatedBy: data.createdBy,
      },
    });
  }

  update(id: string, data: UpdateCategoryData) {
    return this.prisma.category.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.format !== undefined ? { format: data.format } : {}),
        ...(data.visibility !== undefined
          ? { visibility: data.visibility }
          : {}),
        ...(data.configuration !== undefined
          ? { configuration: data.configuration }
          : {}),
        updatedBy: data.updatedBy,
        rowVersion: { increment: 1 },
      },
    });
  }

  softDelete(id: string, deletedBy?: string) {
    return this.prisma.category.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        deletedBy,
        updatedBy: deletedBy,
        rowVersion: { increment: 1 },
      },
    });
  }

  countVerifiedMatches(categoryId: string) {
    return this.prisma.match.count({
      where: {
        categoryId,
        status: MatchStatus.verified,
      },
    });
  }

  hasBlockingCompetitionArtifact(categoryId: string) {
    return this.prisma.category.findFirst({
      where: {
        id: categoryId,
        deletedAt: null,
        OR: [
          {
            drawing: {
              OR: [
                { publishState: PublishState.published },
                { lockState: LockState.locked },
              ],
            },
          },
          {
            schedule: {
              OR: [
                { publishState: PublishState.published },
                { lockState: LockState.locked },
              ],
            },
          },
          {
            playoff: {
              OR: [
                { publishState: PublishState.published },
                { lockState: LockState.locked },
              ],
            },
          },
        ],
      },
      select: { id: true },
    });
  }
}
