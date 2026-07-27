import { Injectable } from '@nestjs/common';
import { PlayerStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export type CreatePlayerData = {
  teamId: string;
  displayName: string;
  replacementFlag?: boolean;
  createdBy?: string;
};

export type UpdatePlayerData = {
  displayName?: string;
  status?: PlayerStatus;
  updatedBy?: string;
};

@Injectable()
export class PlayerRepository {
  constructor(private readonly prisma: PrismaService) {}

  findActiveById(id: string) {
    return this.prisma.player.findFirst({
      where: { id, deletedAt: null },
      include: {
        team: {
          include: {
            category: {
              include: {
                drawing: true,
                tournament: true,
              },
            },
          },
        },
      },
    });
  }

  findActiveOnTeam(teamId: string, playerId: string) {
    return this.prisma.player.findFirst({
      where: {
        id: playerId,
        teamId,
        deletedAt: null,
      },
    });
  }

  findManyActive(params: { teamId: string; skip: number; take: number }) {
    const where: Prisma.PlayerWhereInput = {
      teamId: params.teamId,
      deletedAt: null,
    };

    return this.prisma.$transaction([
      this.prisma.player.findMany({
        where,
        skip: params.skip,
        take: params.take,
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.player.count({ where }),
    ]);
  }

  create(data: CreatePlayerData) {
    return this.prisma.player.create({
      data: {
        teamId: data.teamId,
        displayName: data.displayName,
        replacementFlag: data.replacementFlag ?? false,
        createdBy: data.createdBy,
        updatedBy: data.createdBy,
      },
    });
  }

  update(id: string, data: UpdatePlayerData) {
    return this.prisma.player.update({
      where: { id },
      data: {
        ...(data.displayName !== undefined
          ? { displayName: data.displayName }
          : {}),
        ...(data.status !== undefined ? { status: data.status } : {}),
        updatedBy: data.updatedBy,
        rowVersion: { increment: 1 },
      },
    });
  }

  softDelete(id: string, deletedBy?: string) {
    return this.prisma.player.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        deletedBy,
        updatedBy: deletedBy,
        status: PlayerStatus.inactive,
        rowVersion: { increment: 1 },
      },
    });
  }
}
