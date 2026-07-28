import { Injectable } from '@nestjs/common';
import {
  ConflictStatus,
  CourtStatus,
  LockState,
  MatchStatus,
  Prisma,
  VersionStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AssignedMatch } from './engine/schedule-assigner';

@Injectable()
export class ScheduleRepository {
  constructor(private readonly prisma: PrismaService) {}

  findActiveTournament(tournamentId: string) {
    return this.prisma.tournament.findFirst({
      where: { id: tournamentId, deletedAt: null },
    });
  }

  findActiveCategory(tournamentId: string, categoryId: string) {
    return this.prisma.category.findFirst({
      where: { id: categoryId, tournamentId, deletedAt: null },
    });
  }

  findScheduleByCategory(categoryId: string) {
    return this.prisma.schedule.findUnique({
      where: { categoryId },
      include: {
        currentOfficialVersion: {
          select: {
            id: true,
            versionNumber: true,
            versionStatus: true,
            officialFlag: true,
            conflictStatus: true,
            createdAt: true,
          },
        },
      },
    });
  }

  createSchedule(categoryId: string, createdBy?: string) {
    return this.prisma.schedule.create({
      data: {
        categoryId,
        createdBy,
        updatedBy: createdBy,
      },
    });
  }

  findAvailableCourts(tournamentId: string) {
    return this.prisma.court.findMany({
      where: {
        tournamentId,
        deletedAt: null,
        status: CourtStatus.available,
      },
      orderBy: [{ label: 'asc' }, { createdAt: 'asc' }],
      select: { id: true, name: true, label: true },
    });
  }

  findOfficialDrawingGroups(drawingVersionId: string) {
    return this.prisma.group.findMany({
      where: { drawingVersionId },
      orderBy: { name: 'asc' },
      include: {
        members: {
          orderBy: { placementOrder: 'asc' },
          include: {
            team: {
              select: {
                id: true,
                name: true,
                status: true,
                withdrawalFlag: true,
              },
            },
          },
        },
      },
    });
  }

  nextVersionNumber(scheduleId: string) {
    return this.prisma.scheduleVersion
      .aggregate({
        where: { scheduleId },
        _max: { versionNumber: true },
      })
      .then((result) => (result._max.versionNumber ?? 0) + 1);
  }

  persistGeneratedVersion(params: {
    scheduleId: string;
    categoryId: string;
    versionNumber: number;
    matches: AssignedMatch[];
    conflictStatus: ConflictStatus;
    createdBy?: string;
  }) {
    return this.prisma.$transaction(async (tx) => {
      const version = await tx.scheduleVersion.create({
        data: {
          scheduleId: params.scheduleId,
          versionNumber: params.versionNumber,
          officialFlag: false,
          generationSource: 'engine',
          versionStatus: VersionStatus.candidate,
          conflictStatus: params.conflictStatus,
          createdBy: params.createdBy,
        },
      });

      for (const planned of params.matches) {
        const match = await tx.match.create({
          data: {
            categoryId: params.categoryId,
            groupId: planned.groupId,
            scheduleVersionId: version.id,
            courtId: planned.courtId,
            scheduledStartAt: planned.scheduledStartAt,
            status: MatchStatus.waiting,
            createdBy: params.createdBy,
            updatedBy: params.createdBy,
            participations: {
              create: [
                {
                  teamId: planned.teamAId,
                  sideLabel: 'A',
                },
                {
                  teamId: planned.teamBId,
                  sideLabel: 'B',
                },
              ],
            },
          },
        });

        await tx.scheduleEntry.create({
          data: {
            scheduleVersionId: version.id,
            matchId: match.id,
            courtId: planned.courtId,
            scheduledStartAt: planned.scheduledStartAt,
            scheduledEndAt: planned.scheduledEndAt,
            sequenceOrder: planned.sequenceOrder,
          },
        });
      }

      return this.loadVersionDetail(tx, version.id);
    });
  }

  listVersions(scheduleId: string) {
    return this.prisma.scheduleVersion.findMany({
      where: { scheduleId },
      orderBy: { versionNumber: 'desc' },
      select: {
        id: true,
        versionNumber: true,
        officialFlag: true,
        versionStatus: true,
        conflictStatus: true,
        reviewOutcome: true,
        createdAt: true,
        createdBy: true,
        _count: {
          select: { matches: true, entries: true },
        },
      },
    });
  }

  findVersionDetail(versionId: string) {
    return this.loadVersionDetail(this.prisma, versionId);
  }

  findVersionForSchedule(scheduleId: string, versionId: string) {
    return this.prisma.scheduleVersion.findFirst({
      where: { id: versionId, scheduleId },
    });
  }

  reviewVersion(params: {
    scheduleId: string;
    versionId: string;
    outcome: 'approved' | 'rejected';
    updatedBy?: string;
  }) {
    return this.prisma.$transaction(async (tx) => {
      await tx.scheduleVersion.update({
        where: { id: params.versionId },
        data: {
          reviewOutcome: params.outcome,
        },
      });

      await tx.schedule.update({
        where: { id: params.scheduleId },
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
    scheduleId: string;
    versionId: string;
    previousOfficialVersionId: string | null;
    publishedBy?: string;
  }) {
    const now = new Date();

    return this.prisma.$transaction(async (tx) => {
      if (params.previousOfficialVersionId) {
        await tx.scheduleVersion.update({
          where: { id: params.previousOfficialVersionId },
          data: {
            officialFlag: false,
            versionStatus: VersionStatus.historical,
          },
        });
      }

      await tx.schedule.update({
        where: { id: params.scheduleId },
        data: {
          currentOfficialVersionId: null,
          updatedBy: params.publishedBy,
          rowVersion: { increment: 1 },
        },
      });

      await tx.scheduleVersion.update({
        where: { id: params.versionId },
        data: {
          officialFlag: true,
          versionStatus: VersionStatus.official,
          reviewOutcome: 'approved',
        },
      });

      await tx.schedule.update({
        where: { id: params.scheduleId },
        data: {
          currentOfficialVersionId: params.versionId,
          publishState: 'published',
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

  lockSchedule(params: {
    scheduleId: string;
    lockedBy?: string;
  }) {
    const now = new Date();
    return this.prisma.schedule.update({
      where: { id: params.scheduleId },
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
            versionStatus: true,
            officialFlag: true,
            conflictStatus: true,
            createdAt: true,
          },
        },
      },
    });
  }

  unlockSchedule(params: {
    scheduleId: string;
    reason: string;
    unlockedBy?: string;
  }) {
    const now = new Date();
    return this.prisma.schedule.update({
      where: { id: params.scheduleId },
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
            versionStatus: true,
            officialFlag: true,
            conflictStatus: true,
            createdAt: true,
          },
        },
      },
    });
  }

  private loadVersionDetail(
    client: Prisma.TransactionClient | PrismaService,
    versionId: string,
  ) {
    return client.scheduleVersion.findUnique({
      where: { id: versionId },
      include: {
        schedule: {
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
        entries: {
          orderBy: { sequenceOrder: 'asc' },
          include: {
            court: {
              select: { id: true, name: true, label: true },
            },
            match: {
              include: {
                group: {
                  select: { id: true, name: true, label: true },
                },
                participations: {
                  orderBy: { sideLabel: 'asc' },
                  include: {
                    team: {
                      select: { id: true, name: true },
                    },
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
}
