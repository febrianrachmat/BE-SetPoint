import { Injectable } from '@nestjs/common';
import {
  AssignmentStatus,
  MatchStatus,
  Prisma,
  ResultStatus,
  TournamentStatus,
  UserRole,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { COURT_OCCUPYING_STATUSES } from './match.lifecycle';

@Injectable()
export class MatchRepository {
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

  findMatchInCategory(categoryId: string, matchId: string) {
    return this.prisma.match.findFirst({
      where: { id: matchId, categoryId },
      include: this.matchInclude(),
    });
  }

  findManyOfficial(params: {
    categoryId: string;
    scheduleVersionId: string;
    skip: number;
    take: number;
    status?: MatchStatus;
  }) {
    const where: Prisma.MatchWhereInput = {
      categoryId: params.categoryId,
      scheduleVersionId: params.scheduleVersionId,
      ...(params.status ? { status: params.status } : {}),
    };

    return this.prisma.$transaction([
      this.prisma.match.findMany({
        where,
        skip: params.skip,
        take: params.take,
        orderBy: [{ scheduledStartAt: 'asc' }, { createdAt: 'asc' }],
        include: this.matchInclude(),
      }),
      this.prisma.match.count({ where }),
    ]);
  }

  findOccupyingMatchOnCourt(params: {
    courtId: string;
    excludeMatchId: string;
  }) {
    return this.prisma.match.findFirst({
      where: {
        courtId: params.courtId,
        id: { not: params.excludeMatchId },
        status: { in: COURT_OCCUPYING_STATUSES },
      },
      select: { id: true, status: true },
    });
  }

  findActiveRefereeAssignment(matchId: string, refereeId: string) {
    return this.prisma.refereeAssignment.findFirst({
      where: {
        matchId,
        refereeId,
        assignmentStatus: AssignmentStatus.active,
        unassignedAt: null,
      },
    });
  }

  transitionStatus(params: {
    matchId: string;
    status: MatchStatus;
    updatedBy?: string;
    actualStartAt?: Date | null;
    actualEndAt?: Date | null;
    resultStatus?: ResultStatus;
    scoreRepresentation?: Prisma.InputJsonValue | typeof Prisma.JsonNull;
  }) {
    return this.prisma.match.update({
      where: { id: params.matchId },
      data: {
        status: params.status,
        updatedBy: params.updatedBy,
        ...(params.actualStartAt !== undefined
          ? { actualStartAt: params.actualStartAt }
          : {}),
        ...(params.actualEndAt !== undefined
          ? { actualEndAt: params.actualEndAt }
          : {}),
        ...(params.resultStatus !== undefined
          ? { resultStatus: params.resultStatus }
          : {}),
        ...(params.scoreRepresentation !== undefined
          ? { scoreRepresentation: params.scoreRepresentation }
          : {}),
        rowVersion: { increment: 1 },
      },
      include: this.matchInclude(),
    });
  }

  updateScoreRepresentation(params: {
    matchId: string;
    scoreRepresentation: Prisma.InputJsonValue;
    updatedBy?: string;
  }) {
    return this.prisma.match.update({
      where: { id: params.matchId },
      data: {
        scoreRepresentation: params.scoreRepresentation,
        updatedBy: params.updatedBy,
        rowVersion: { increment: 1 },
      },
      include: this.matchInclude(),
    });
  }

  isTournamentLive(status: TournamentStatus) {
    return status === TournamentStatus.live;
  }

  isAdminOperator(roles: Array<{ role: UserRole }>) {
    return roles.some(
      (assignment) =>
        assignment.role === UserRole.super_admin ||
        assignment.role === UserRole.tournament_admin,
    );
  }

  isRefereeOnly(roles: Array<{ role: UserRole }>) {
    const hasReferee = roles.some(
      (assignment) => assignment.role === UserRole.referee,
    );
    const hasAdmin = this.isAdminOperator(roles);
    return hasReferee && !hasAdmin;
  }

  private matchInclude() {
    return {
      group: { select: { id: true, name: true, label: true } },
      court: { select: { id: true, name: true, label: true } },
      participations: {
        orderBy: { sideLabel: 'asc' as const },
        include: {
          team: { select: { id: true, name: true } },
        },
      },
      refereeAssignments: {
        where: {
          assignmentStatus: AssignmentStatus.active,
          unassignedAt: null,
        },
        select: {
          id: true,
          refereeId: true,
          assignedAt: true,
          assignmentStatus: true,
        },
      },
    };
  }
}
