import { Injectable } from '@nestjs/common';
import {
  EligibilityStatus,
  LockState,
  PlayerStatus,
  Prisma,
  PublishState,
  TeamStatus,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export type CreateTeamData = {
  categoryId: string;
  name: string;
  createdBy?: string;
  players?: Array<{ displayName: string }>;
};

export type UpdateTeamData = {
  name?: string;
  updatedBy?: string;
};

@Injectable()
export class TeamRepository {
  constructor(private readonly prisma: PrismaService) {}

  findActiveById(id: string) {
    return this.prisma.team.findFirst({
      where: { id, deletedAt: null },
      include: {
        players: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'asc' },
        },
        category: {
          include: {
            drawing: true,
            tournament: true,
          },
        },
      },
    });
  }

  findActiveInCategory(categoryId: string, teamId: string) {
    return this.prisma.team.findFirst({
      where: {
        id: teamId,
        categoryId,
        deletedAt: null,
      },
      include: {
        players: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
  }

  findManyActive(params: {
    categoryId: string;
    skip: number;
    take: number;
    search?: string;
  }) {
    const where: Prisma.TeamWhereInput = {
      categoryId: params.categoryId,
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
      this.prisma.team.findMany({
        where,
        skip: params.skip,
        take: params.take,
        orderBy: { createdAt: 'asc' },
        include: {
          players: {
            where: { deletedAt: null },
            orderBy: { createdAt: 'asc' },
          },
        },
      }),
      this.prisma.team.count({ where }),
    ]);
  }

  create(data: CreateTeamData) {
    return this.prisma.team.create({
      data: {
        categoryId: data.categoryId,
        name: data.name,
        createdBy: data.createdBy,
        updatedBy: data.createdBy,
        ...(data.players && data.players.length > 0
          ? {
              players: {
                create: data.players.map((player) => ({
                  displayName: player.displayName,
                  createdBy: data.createdBy,
                  updatedBy: data.createdBy,
                })),
              },
            }
          : {}),
      },
      include: {
        players: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
  }

  update(id: string, data: UpdateTeamData) {
    return this.prisma.team.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        updatedBy: data.updatedBy,
        rowVersion: { increment: 1 },
      },
      include: {
        players: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
  }

  softDelete(id: string, deletedBy?: string) {
    return this.prisma.team.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        deletedBy,
        updatedBy: deletedBy,
        rowVersion: { increment: 1 },
      },
    });
  }

  withdraw(id: string, reason: string, updatedBy?: string) {
    return this.prisma.team.update({
      where: { id },
      data: {
        withdrawalFlag: true,
        withdrawalReason: reason,
        status: TeamStatus.withdrawn,
        eligibilityStatus: EligibilityStatus.ineligible,
        updatedBy,
        rowVersion: { increment: 1 },
      },
      include: {
        players: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
  }

  updateEligibility(
    id: string,
    eligibilityStatus: EligibilityStatus,
    updatedBy?: string,
  ) {
    return this.prisma.team.update({
      where: { id },
      data: {
        eligibilityStatus,
        updatedBy,
        rowVersion: { increment: 1 },
      },
      include: {
        players: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
  }

  countActivePlayers(teamId: string) {
    return this.prisma.player.count({
      where: {
        teamId,
        deletedAt: null,
        status: PlayerStatus.active,
      },
    });
  }

  findCategoryPlayerNames(categoryId: string, excludePlayerId?: string) {
    return this.prisma.player.findMany({
      where: {
        deletedAt: null,
        status: { not: PlayerStatus.inactive },
        ...(excludePlayerId ? { id: { not: excludePlayerId } } : {}),
        team: {
          categoryId,
          deletedAt: null,
        },
      },
      select: {
        id: true,
        displayName: true,
        teamId: true,
      },
    });
  }

  isDrawingPublishedOrLocked(categoryId: string) {
    return this.prisma.drawing.findFirst({
      where: {
        categoryId,
        OR: [
          { publishState: PublishState.published },
          { lockState: LockState.locked },
        ],
      },
      select: { id: true },
    });
  }
}
