import { Injectable } from '@nestjs/common';
import {
  EligibilityStatus,
  LockState,
  Prisma,
  PublishState,
  TeamStatus,
  VersionStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { GenerateDrawingResult } from './engine/drawing-generator';

@Injectable()
export class DrawingRepository {
  constructor(private readonly prisma: PrismaService) {}

  findActiveTournament(tournamentId: string) {
    return this.prisma.tournament.findFirst({
      where: { id: tournamentId, deletedAt: null },
    });
  }

  findActiveCategory(tournamentId: string, categoryId: string) {
    return this.prisma.category.findFirst({
      where: {
        id: categoryId,
        tournamentId,
        deletedAt: null,
      },
    });
  }

  findDrawingByCategory(categoryId: string) {
    return this.prisma.drawing.findUnique({
      where: { categoryId },
      include: {
        currentOfficialVersion: {
          select: {
            id: true,
            versionNumber: true,
            drawingSeed: true,
            placementMode: true,
            officialFlag: true,
            versionStatus: true,
            reviewOutcome: true,
            createdAt: true,
          },
        },
      },
    });
  }

  createDrawing(categoryId: string, createdBy?: string) {
    return this.prisma.drawing.create({
      data: {
        categoryId,
        createdBy,
        updatedBy: createdBy,
      },
    });
  }

  findEligibleTeams(categoryId: string) {
    return this.prisma.team.findMany({
      where: {
        categoryId,
        deletedAt: null,
        status: TeamStatus.active,
        withdrawalFlag: false,
        eligibilityStatus: EligibilityStatus.eligible,
      },
      orderBy: [
        { seedRank: 'asc' },
        { createdAt: 'asc' },
        { id: 'asc' },
      ],
      select: {
        id: true,
        name: true,
        seedRank: true,
        createdAt: true,
      },
    });
  }

  nextVersionNumber(drawingId: string) {
    return this.prisma.drawingVersion
      .aggregate({
        where: { drawingId },
        _max: { versionNumber: true },
      })
      .then((result) => (result._max.versionNumber ?? 0) + 1);
  }

  persistGeneratedVersion(params: {
    drawingId: string;
    categoryId: string;
    versionNumber: number;
    result: GenerateDrawingResult;
    generationDurationMs: number;
    createdBy?: string;
  }) {
    const { drawingId, categoryId, versionNumber, result, createdBy } = params;

    return this.prisma.$transaction(async (tx) => {
      const version = await tx.drawingVersion.create({
        data: {
          drawingId,
          versionNumber,
          drawingSeed: result.drawingSeed,
          placementMode: result.placementMode,
          prngAlgorithm: result.prngAlgorithm,
          engineVersion: result.engineVersion,
          generationDurationMs: params.generationDurationMs,
          officialFlag: false,
          generationSource: 'engine',
          versionStatus: VersionStatus.candidate,
          createdBy,
        },
      });

      for (const group of result.groups) {
        const createdGroup = await tx.group.create({
          data: {
            categoryId,
            drawingVersionId: version.id,
            name: group.name,
            label: group.label,
            createdBy,
            updatedBy: createdBy,
          },
        });

        if (group.members.length > 0) {
          await tx.groupMember.createMany({
            data: group.members.map((member) => ({
              groupId: createdGroup.id,
              teamId: member.teamId,
              drawingVersionId: version.id,
              placementOrder: member.placementOrder,
            })),
          });
        }
      }

      return this.loadVersionDetail(tx, version.id);
    });
  }

  listVersions(drawingId: string) {
    return this.prisma.drawingVersion.findMany({
      where: { drawingId },
      orderBy: { versionNumber: 'desc' },
      select: {
        id: true,
        versionNumber: true,
        drawingSeed: true,
        placementMode: true,
        prngAlgorithm: true,
        engineVersion: true,
        generationDurationMs: true,
        officialFlag: true,
        versionStatus: true,
        reviewOutcome: true,
        createdAt: true,
        createdBy: true,
      },
    });
  }

  findVersionDetail(versionId: string) {
    return this.loadVersionDetail(this.prisma, versionId);
  }

  findVersionForDrawing(drawingId: string, versionId: string) {
    return this.prisma.drawingVersion.findFirst({
      where: { id: versionId, drawingId },
    });
  }

  reviewVersion(params: {
    drawingId: string;
    versionId: string;
    outcome: 'approved' | 'rejected';
    updatedBy?: string;
  }) {
    return this.prisma.$transaction(async (tx) => {
      await tx.drawingVersion.update({
        where: { id: params.versionId },
        data: {
          reviewOutcome: params.outcome,
        },
      });

      await tx.drawing.update({
        where: { id: params.drawingId },
        data: {
          reviewStatus: params.outcome,
          updatedBy: params.updatedBy,
          rowVersion: { increment: 1 },
        },
      });

      return this.loadVersionDetail(tx, params.versionId);
    });
  }

  publishVersion(params: {
    drawingId: string;
    versionId: string;
    previousOfficialVersionId: string | null;
    publishedBy?: string;
  }) {
    const now = new Date();

    return this.prisma.$transaction(async (tx) => {
      if (params.previousOfficialVersionId) {
        await tx.drawingVersion.update({
          where: { id: params.previousOfficialVersionId },
          data: {
            officialFlag: false,
            versionStatus: VersionStatus.historical,
          },
        });
      }

      // Clear pointer before flipping official flags (unique partial index).
      await tx.drawing.update({
        where: { id: params.drawingId },
        data: {
          currentOfficialVersionId: null,
          updatedBy: params.publishedBy,
          rowVersion: { increment: 1 },
        },
      });

      await tx.drawingVersion.update({
        where: { id: params.versionId },
        data: {
          officialFlag: true,
          versionStatus: VersionStatus.official,
          reviewOutcome: 'approved',
        },
      });

      await tx.group.updateMany({
        where: { drawingVersionId: params.versionId },
        data: {
          publishState: PublishState.published,
          publishedAt: now,
          publishedBy: params.publishedBy,
          updatedBy: params.publishedBy,
        },
      });

      await tx.drawing.update({
        where: { id: params.drawingId },
        data: {
          currentOfficialVersionId: params.versionId,
          publishState: PublishState.published,
          publishedAt: now,
          publishedBy: params.publishedBy,
          reviewStatus: 'approved',
          updatedBy: params.publishedBy,
          rowVersion: { increment: 1 },
        },
      });

      return this.loadVersionDetail(tx, params.versionId);
    });
  }

  private loadVersionDetail(
    client: Prisma.TransactionClient | PrismaService,
    versionId: string,
  ) {
    return client.drawingVersion.findUnique({
      where: { id: versionId },
      include: {
        drawing: {
          select: {
            id: true,
            categoryId: true,
            publishState: true,
            lockState: true,
            reviewStatus: true,
            currentOfficialVersionId: true,
            publishedAt: true,
            publishedBy: true,
          },
        },
        groups: {
          orderBy: { name: 'asc' },
          include: {
            members: {
              orderBy: { placementOrder: 'asc' },
              include: {
                team: {
                  select: {
                    id: true,
                    name: true,
                    seedRank: true,
                    eligibilityStatus: true,
                    status: true,
                  },
                },
              },
            },
          },
        },
      },
    });
  }

  isLocked(lockState: LockState) {
    return lockState === LockState.locked;
  }

  lockDrawing(params: {
    drawingId: string;
    officialVersionId: string;
    lockedBy?: string;
  }) {
    const now = new Date();
    return this.prisma.$transaction(async (tx) => {
      const drawing = await tx.drawing.update({
        where: { id: params.drawingId },
        data: {
          lockState: LockState.locked,
          lockedAt: now,
          lockedBy: params.lockedBy,
          unlockReason: null,
          unlockedAt: null,
          unlockedBy: null,
          updatedBy: params.lockedBy,
          rowVersion: { increment: 1 },
        },
        include: {
          currentOfficialVersion: {
            select: {
              id: true,
              versionNumber: true,
              drawingSeed: true,
              placementMode: true,
              officialFlag: true,
              versionStatus: true,
              reviewOutcome: true,
              createdAt: true,
            },
          },
        },
      });

      await tx.group.updateMany({
        where: { drawingVersionId: params.officialVersionId },
        data: {
          lockState: LockState.locked,
          lockedAt: now,
          lockedBy: params.lockedBy,
          unlockReason: null,
          unlockedAt: null,
          unlockedBy: null,
          updatedBy: params.lockedBy,
        },
      });

      await tx.category.update({
        where: { id: drawing.categoryId },
        data: {
          lockState: LockState.locked,
          lockedAt: now,
          lockedBy: params.lockedBy,
          unlockReason: null,
          unlockedAt: null,
          unlockedBy: null,
          updatedBy: params.lockedBy,
          rowVersion: { increment: 1 },
        },
      });

      return drawing;
    });
  }

  unlockDrawing(params: {
    drawingId: string;
    officialVersionId: string | null;
    reason: string;
    unlockedBy?: string;
  }) {
    const now = new Date();
    return this.prisma.$transaction(async (tx) => {
      const drawing = await tx.drawing.update({
        where: { id: params.drawingId },
        data: {
          lockState: LockState.unlocked,
          unlockReason: params.reason,
          unlockedAt: now,
          unlockedBy: params.unlockedBy,
          updatedBy: params.unlockedBy,
          rowVersion: { increment: 1 },
        },
        include: {
          currentOfficialVersion: {
            select: {
              id: true,
              versionNumber: true,
              drawingSeed: true,
              placementMode: true,
              officialFlag: true,
              versionStatus: true,
              reviewOutcome: true,
              createdAt: true,
            },
          },
        },
      });

      if (params.officialVersionId) {
        await tx.group.updateMany({
          where: { drawingVersionId: params.officialVersionId },
          data: {
            lockState: LockState.unlocked,
            unlockReason: params.reason,
            unlockedAt: now,
            unlockedBy: params.unlockedBy,
            updatedBy: params.unlockedBy,
          },
        });
      }

      await tx.category.update({
        where: { id: drawing.categoryId },
        data: {
          lockState: LockState.unlocked,
          unlockReason: params.reason,
          unlockedAt: now,
          unlockedBy: params.unlockedBy,
          updatedBy: params.unlockedBy,
          rowVersion: { increment: 1 },
        },
      });

      return drawing;
    });
  }
}
