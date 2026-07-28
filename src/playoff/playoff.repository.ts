import { Injectable } from '@nestjs/common';
import {
  DeclarationStatus,
  LockState,
  Prisma,
  PublishState,
  QualificationStatus,
  ReviewStatus,
  TeamStatus,
  VersionStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { BracketStructure } from './engine';

@Injectable()
export class PlayoffRepository {
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

  findDrawing(categoryId: string) {
    return this.prisma.drawing.findUnique({
      where: { categoryId },
      select: {
        currentOfficialVersionId: true,
        publishState: true,
        lockState: true,
      },
    });
  }

  findPlayoffByCategory(categoryId: string) {
    return this.prisma.playoff.findUnique({
      where: { categoryId },
      include: {
        currentOfficialBracket: {
          select: {
            id: true,
            versionNumber: true,
            versionStatus: true,
            publishState: true,
          },
        },
      },
    });
  }

  createPlayoff(categoryId: string, createdBy?: string) {
    return this.prisma.playoff.create({
      data: {
        categoryId,
        createdBy,
        updatedBy: createdBy,
      },
    });
  }

  listBrackets(playoffId: string) {
    return this.prisma.bracket.findMany({
      where: { playoffId },
      orderBy: { versionNumber: 'desc' },
      select: {
        id: true,
        versionNumber: true,
        versionStatus: true,
        officialFlag: true,
        reviewOutcome: true,
        publishState: true,
        lockState: true,
        generationSource: true,
        createdAt: true,
        createdBy: true,
      },
    });
  }

  findBracketForPlayoff(playoffId: string, bracketId: string) {
    return this.prisma.bracket.findFirst({
      where: { id: bracketId, playoffId },
    });
  }

  findBracketDetail(bracketId: string) {
    return this.prisma.bracket.findUnique({
      where: { id: bracketId },
      include: {
        playoff: { select: { id: true, categoryId: true } },
        matches: {
          orderBy: { bracketPosition: 'asc' },
          include: {
            participations: {
              orderBy: { sideLabel: 'asc' },
              include: { team: { select: { id: true, name: true } } },
            },
          },
        },
      },
    });
  }

  isLocked(lockState: LockState) {
    return lockState === LockState.locked;
  }

  nextBracketVersionNumber(playoffId: string) {
    return this.prisma.bracket
      .aggregate({
        where: { playoffId },
        _max: { versionNumber: true },
      })
      .then((r) => (r._max.versionNumber ?? 0) + 1);
  }

  findQualifiedStandings(categoryId: string) {
    return this.prisma.standing.findMany({
      where: {
        categoryId,
        qualificationStatus: QualificationStatus.qualified,
      },
      include: {
        team: { select: { id: true, name: true } },
        group: { select: { id: true, name: true, label: true } },
      },
      orderBy: [{ groupId: 'asc' }, { rankPosition: 'asc' }],
    });
  }

  findActiveTeamsForKnockout(categoryId: string) {
    return this.prisma.team.findMany({
      where: {
        categoryId,
        deletedAt: null,
        status: TeamStatus.active,
      },
      select: {
        id: true,
        name: true,
        seedRank: true,
        createdAt: true,
      },
      orderBy: [
        { seedRank: 'asc' },
        { createdAt: 'asc' },
      ],
    });
  }

  findBlockedQualificationNotes(categoryId: string) {
    return this.prisma.standing.findFirst({
      where: {
        categoryId,
        tieBreakNotes: { contains: 'qualification_blocked_tie' },
      },
      select: { id: true, teamId: true, tieBreakNotes: true },
    });
  }

  async createCandidateBracket(params: {
    playoffId: string;
    categoryId: string;
    versionNumber: number;
    structure: BracketStructure;
    qualificationBasis: string;
    matches: Array<{
      bracketPosition: string;
      teamAId: string;
      teamBId: string;
    }>;
    createdBy?: string;
  }) {
    return this.prisma.$transaction(async (tx) => {
      await tx.playoff.update({
        where: { id: params.playoffId },
        data: {
          qualificationBasis: params.qualificationBasis,
          reviewStatus: ReviewStatus.pending,
          updatedBy: params.createdBy,
          rowVersion: { increment: 1 },
        },
      });

      const bracket = await tx.bracket.create({
        data: {
          playoffId: params.playoffId,
          versionNumber: params.versionNumber,
          versionStatus: VersionStatus.candidate,
          publishState: PublishState.unpublished,
          lockState: LockState.unlocked,
          generationSource: 'engine',
          structureRepresentation:
            params.structure as unknown as Prisma.InputJsonValue,
          createdBy: params.createdBy,
          updatedBy: params.createdBy,
          matches: {
            create: params.matches.map((m) => ({
              categoryId: params.categoryId,
              playoffId: params.playoffId,
              bracketPosition: m.bracketPosition,
              createdBy: params.createdBy,
              updatedBy: params.createdBy,
              participations: {
                create: [
                  { teamId: m.teamAId, sideLabel: 'A' },
                  { teamId: m.teamBId, sideLabel: 'B' },
                ],
              },
            })),
          },
        },
        include: {
          matches: {
            orderBy: { bracketPosition: 'asc' },
            include: {
              participations: {
                orderBy: { sideLabel: 'asc' },
                include: { team: { select: { id: true, name: true } } },
              },
            },
          },
        },
      });

      // Prisma sets bracketId automatically when nested under bracket.matches.create
      return bracket;
    });
  }

  reviewBracket(params: {
    playoffId: string;
    bracketId: string;
    outcome: 'approved' | 'rejected';
    updatedBy?: string;
  }) {
    return this.prisma.$transaction(async (tx) => {
      await tx.bracket.update({
        where: { id: params.bracketId },
        data: {
          reviewOutcome: params.outcome,
          updatedBy: params.updatedBy,
        },
      });

      await tx.playoff.update({
        where: { id: params.playoffId },
        data: {
          reviewStatus: params.outcome,
          updatedBy: params.updatedBy,
          rowVersion: { increment: 1 },
        },
      });

      return tx.bracket.findUnique({
        where: { id: params.bracketId },
        include: {
          playoff: { select: { id: true, categoryId: true } },
          matches: {
            orderBy: { bracketPosition: 'asc' },
            include: {
              participations: {
                orderBy: { sideLabel: 'asc' },
                include: { team: { select: { id: true, name: true } } },
              },
            },
          },
        },
      });
    });
  }

  publishBracket(params: {
    playoffId: string;
    bracketId: string;
    previousOfficialBracketId: string | null;
    publishedBy?: string;
  }) {
    const now = new Date();

    return this.prisma.$transaction(async (tx) => {
      if (params.previousOfficialBracketId) {
        await tx.bracket.update({
          where: { id: params.previousOfficialBracketId },
          data: {
            officialFlag: false,
            versionStatus: VersionStatus.historical,
            updatedBy: params.publishedBy,
          },
        });
      }

      // Clear FK before reassignment (unique currentOfficialBracketId)
      await tx.playoff.update({
        where: { id: params.playoffId },
        data: {
          currentOfficialBracketId: null,
          updatedBy: params.publishedBy,
          rowVersion: { increment: 1 },
        },
      });

      await tx.bracket.update({
        where: { id: params.bracketId },
        data: {
          officialFlag: true,
          versionStatus: VersionStatus.official,
          reviewOutcome: ReviewStatus.approved,
          publishState: PublishState.published,
          publishedAt: now,
          publishedBy: params.publishedBy,
          updatedBy: params.publishedBy,
        },
      });

      await tx.playoff.update({
        where: { id: params.playoffId },
        data: {
          currentOfficialBracketId: params.bracketId,
          publishState: PublishState.published,
          publishedAt: now,
          publishedBy: params.publishedBy,
          reviewStatus: ReviewStatus.approved,
          updatedBy: params.publishedBy,
          rowVersion: { increment: 1 },
        },
      });

      return tx.bracket.findUnique({
        where: { id: params.bracketId },
        include: {
          playoff: { select: { id: true, categoryId: true } },
          matches: {
            orderBy: { bracketPosition: 'asc' },
            include: {
              participations: {
                orderBy: { sideLabel: 'asc' },
                include: { team: { select: { id: true, name: true } } },
              },
            },
          },
        },
      });
    });
  }

  lockPlayoff(params: { playoffId: string; lockedBy?: string }) {
    const now = new Date();
    return this.prisma.playoff.update({
      where: { id: params.playoffId },
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
        currentOfficialBracket: {
          select: {
            id: true,
            versionNumber: true,
            versionStatus: true,
            officialFlag: true,
            reviewOutcome: true,
          },
        },
      },
    });
  }

  unlockPlayoff(params: {
    playoffId: string;
    reason: string;
    unlockedBy?: string;
  }) {
    const now = new Date();
    return this.prisma.playoff.update({
      where: { id: params.playoffId },
      data: {
        lockState: LockState.unlocked,
        unlockReason: params.reason,
        unlockedAt: now,
        unlockedBy: params.unlockedBy,
        updatedBy: params.unlockedBy,
        rowVersion: { increment: 1 },
      },
      include: {
        currentOfficialBracket: {
          select: {
            id: true,
            versionNumber: true,
            versionStatus: true,
            officialFlag: true,
            reviewOutcome: true,
          },
        },
      },
    });
  }

  findOfficialBracketWithMatches(bracketId: string) {
    return this.prisma.bracket.findUnique({
      where: { id: bracketId },
      include: {
        playoff: { select: { id: true, categoryId: true } },
        matches: {
          include: {
            participations: {
              select: { sideLabel: true, teamId: true },
            },
          },
        },
      },
    });
  }

  async materializeBracketMatches(params: {
    playoffId: string;
    categoryId: string;
    bracketId: string;
    matches: Array<{
      bracketPosition: string;
      teamAId: string;
      teamBId: string;
    }>;
    createdBy?: string;
  }) {
    if (params.matches.length === 0) {
      return [];
    }

    return this.prisma.$transaction(async (tx) => {
      const created = [];
      for (const m of params.matches) {
        created.push(
          await tx.match.create({
            data: {
              categoryId: params.categoryId,
              playoffId: params.playoffId,
              bracketId: params.bracketId,
              bracketPosition: m.bracketPosition,
              createdBy: params.createdBy,
              updatedBy: params.createdBy,
              participations: {
                create: [
                  { teamId: m.teamAId, sideLabel: 'A' },
                  { teamId: m.teamBId, sideLabel: 'B' },
                ],
              },
            },
            include: {
              participations: {
                include: { team: { select: { id: true, name: true } } },
              },
            },
          }),
        );
      }
      return created;
    });
  }

  findChampion(playoffId: string) {
    return this.prisma.champion.findUnique({
      where: { playoffId },
      include: {
        winningTeam: { select: { id: true, name: true } },
      },
    });
  }

  upsertChampion(params: {
    playoffId: string;
    categoryId: string;
    winningTeamId: string;
    declaredBy?: string;
  }) {
    const now = new Date();
    return this.prisma.champion.upsert({
      where: { playoffId: params.playoffId },
      create: {
        playoffId: params.playoffId,
        categoryId: params.categoryId,
        winningTeamId: params.winningTeamId,
        declaredBy: params.declaredBy,
        declaredAt: now,
        declarationStatus: DeclarationStatus.declared,
      },
      update: {
        winningTeamId: params.winningTeamId,
        declaredBy: params.declaredBy,
        declaredAt: now,
        declarationStatus: DeclarationStatus.declared,
      },
      include: {
        winningTeam: { select: { id: true, name: true } },
      },
    });
  }
}
