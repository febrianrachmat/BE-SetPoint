import { Injectable } from '@nestjs/common';
import {
  LockState,
  MatchStatus,
  QualificationStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  getMatchResult,
  isMatchComplete,
  PADEL_SCORING_ENGINE_VERSION,
  ScoreState,
} from '../match/scoring';
import { RankedStanding } from './engine';

@Injectable()
export class StandingRepository {
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
        id: true,
        currentOfficialVersionId: true,
        publishState: true,
        lockState: true,
      },
    });
  }

  findGroupsForOfficialDrawing(params: {
    categoryId: string;
    officialDrawingVersionId: string;
    groupId?: string;
  }) {
    return this.prisma.group.findMany({
      where: {
        categoryId: params.categoryId,
        drawingVersionId: params.officialDrawingVersionId,
        ...(params.groupId ? { id: params.groupId } : {}),
      },
      include: {
        members: {
          select: { teamId: true },
          orderBy: { placementOrder: 'asc' },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  findVerifiedGroupMatches(params: {
    categoryId: string;
    groupId: string;
    scheduleVersionId?: string | null;
  }) {
    return this.prisma.match.findMany({
      where: {
        categoryId: params.categoryId,
        groupId: params.groupId,
        status: MatchStatus.verified,
        ...(params.scheduleVersionId
          ? { scheduleVersionId: params.scheduleVersionId }
          : {}),
      },
      include: {
        participations: {
          select: { sideLabel: true, teamId: true },
        },
      },
      orderBy: { actualEndAt: 'asc' },
    });
  }

  findScheduleOfficialVersionId(categoryId: string) {
    return this.prisma.schedule.findUnique({
      where: { categoryId },
      select: { currentOfficialVersionId: true, lockState: true, publishState: true },
    });
  }

  findStandings(params: {
    categoryId: string;
    groupId?: string;
  }) {
    return this.prisma.standing.findMany({
      where: {
        categoryId: params.categoryId,
        ...(params.groupId ? { groupId: params.groupId } : {}),
      },
      include: {
        team: { select: { id: true, name: true } },
        group: { select: { id: true, name: true, label: true } },
      },
      orderBy: [
        { groupId: 'asc' },
        { rankPosition: 'asc' },
        { points: 'desc' },
      ],
    });
  }

  findLockedStandingInGroup(categoryId: string, groupId: string) {
    return this.prisma.standing.findFirst({
      where: {
        categoryId,
        groupId,
        lockState: LockState.locked,
      },
      select: { id: true, teamId: true },
    });
  }

  async replaceGroupStandings(params: {
    categoryId: string;
    groupId: string;
    ranked: RankedStanding[];
    updatedBy?: string;
  }) {
    const now = new Date();

    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.standing.findMany({
        where: {
          categoryId: params.categoryId,
          groupId: params.groupId,
        },
      });
      const byTeam = new Map(existing.map((row) => [row.teamId, row]));
      const keepTeamIds = new Set(params.ranked.map((r) => r.teamId));

      // Remove rows for teams no longer in group
      const staleIds = existing
        .filter((row) => !keepTeamIds.has(row.teamId))
        .map((row) => row.id);
      if (staleIds.length > 0) {
        await tx.standing.deleteMany({ where: { id: { in: staleIds } } });
      }

      const results = [];
      for (const row of params.ranked) {
        const prev = byTeam.get(row.teamId);
        if (prev) {
          results.push(
            await tx.standing.update({
              where: { id: prev.id },
              data: {
                rankPosition: row.rankPosition,
                matchesPlayed: row.matchesPlayed,
                wins: row.wins,
                losses: row.losses,
                points: row.points,
                tieBreakNotes: row.tieBreakNotes,
                lastRecalculatedAt: now,
                updatedBy: params.updatedBy,
                rowVersion: { increment: 1 },
                // Keep publish/lock/qualification as-is in 9A
              },
              include: {
                team: { select: { id: true, name: true } },
                group: { select: { id: true, name: true, label: true } },
              },
            }),
          );
        } else {
          results.push(
            await tx.standing.create({
              data: {
                categoryId: params.categoryId,
                groupId: params.groupId,
                teamId: row.teamId,
                rankPosition: row.rankPosition,
                matchesPlayed: row.matchesPlayed,
                wins: row.wins,
                losses: row.losses,
                points: row.points,
                tieBreakNotes: row.tieBreakNotes,
                lastRecalculatedAt: now,
                qualificationStatus: QualificationStatus.not_qualified,
                createdBy: params.updatedBy,
                updatedBy: params.updatedBy,
              },
              include: {
                team: { select: { id: true, name: true } },
                group: { select: { id: true, name: true, label: true } },
              },
            }),
          );
        }
      }

      return results;
    });
  }

  extractMatchResultFromScore(scoreRepresentation: unknown): ReturnType<
    typeof getMatchResult
  > | null {
    const state = this.readScoreState(scoreRepresentation);
    if (!state || !isMatchComplete(state)) {
      return null;
    }
    try {
      return getMatchResult(state);
    } catch {
      return null;
    }
  }

  private readScoreState(value: unknown): ScoreState | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return null;
    }
    const raw = value as Partial<ScoreState>;
    if (raw.engineVersion !== PADEL_SCORING_ENGINE_VERSION) {
      return null;
    }
    if (!raw.configSnapshot || !Array.isArray(raw.sets)) {
      return null;
    }
    return raw as ScoreState;
  }
}
