import { Injectable } from '@nestjs/common';
import {
  LockState,
  Prisma,
  PublishState,
  QualificationStatus,
  ReviewStatus,
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
        publishState: true,
        lockState: true,
        generationSource: true,
        createdAt: true,
        createdBy: true,
      },
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

      // Link bracketId on matches (create nested doesn't set bracket relation field name correctly via matches.create under bracket — Prisma sets bracketId automatically when nested under bracket.matches.create)
      return bracket;
    });
  }
}
