import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { MatchStatus, Prisma, ResultStatus, UserRole } from '@prisma/client';
import { AuthUserView } from '../auth/types/auth-user.type';
import {
  DOMAIN_EVENT_PUBLISHER,
  DomainEventPublisher,
} from '../common/events/domain-event.publisher';
import { ScheduleService } from '../schedule/schedule.service';
import { PlayoffService } from '../playoff/playoff.service';
import { ListMatchesQueryDto } from './dto/list-matches.query.dto';
import { MatchEvents } from './match.events';
import { getNextMatchStatus } from './match.lifecycle';
import { MatchRepository } from './match.repository';
import {
  adjustGame,
  adjustSet,
  applyPoint,
  createInitialState,
  getMatchResult,
  isMatchComplete,
  PADEL_SCORING_ENGINE_VERSION,
  removePoint,
  resolveScoringConfig,
  ScoreState,
  setServerSide,
  Side,
  stripUndoStack,
} from './scoring';

const MAX_UNDO_STACK = 40;

@Injectable()
export class MatchService {
  constructor(
    private readonly matches: MatchRepository,
    private readonly schedules: ScheduleService,
    private readonly playoffs: PlayoffService,
    @Inject(DOMAIN_EVENT_PUBLISHER)
    private readonly events: DomainEventPublisher,
  ) {}

  async list(
    tournamentId: string,
    categoryId: string,
    query: ListMatchesQueryDto,
  ) {
    await this.requireCategory(tournamentId, categoryId);
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 50;
    const skip = (page - 1) * pageSize;

    // Prefer group-stage Official Schedule; playoff matches listed via playoff/official.
    const schedule = await this.schedules.assertLiveReady(
      tournamentId,
      categoryId,
    );

    const [items, total] = await this.matches.findManyOfficial({
      categoryId,
      scheduleVersionId: schedule.currentOfficialVersionId!,
      skip,
      take: pageSize,
      status: query.status,
    });

    return {
      items,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize) || 1,
      },
    };
  }

  async getById(tournamentId: string, categoryId: string, matchId: string) {
    await this.requireCategory(tournamentId, categoryId);
    const match = await this.requireOperableMatch(
      tournamentId,
      categoryId,
      matchId,
    );
    return match;
  }

  async warmUp(
    tournamentId: string,
    categoryId: string,
    matchId: string,
    user: AuthUserView,
  ) {
    return this.transition({
      tournamentId,
      categoryId,
      matchId,
      user,
      target: MatchStatus.warm_up,
      eventName: MatchEvents.WarmedUp,
      before: async (ctx) => {
        if (!this.matches.isTournamentLive(ctx.tournament.status)) {
          throw new BadRequestException(
            'Warm Up requires Tournament status Live (MATCH-05)',
          );
        }
        await this.assertCourtAvailable(ctx.match);
        await this.assertOperatorAuthorized(ctx.match.id, user);
      },
    });
  }

  async start(
    tournamentId: string,
    categoryId: string,
    matchId: string,
    user: AuthUserView,
  ) {
    return this.transition({
      tournamentId,
      categoryId,
      matchId,
      user,
      target: MatchStatus.live,
      eventName: MatchEvents.Started,
      before: async (ctx) => {
        await this.assertCourtAvailable(ctx.match);
        await this.assertOperatorAuthorized(ctx.match.id, user);
      },
      extras: (ctx) => {
        const config = resolveScoringConfig(ctx.category.configuration);
        const initial = createInitialState(config);
        return {
          actualStartAt: new Date(),
          scoreRepresentation: initial as unknown as Prisma.InputJsonValue,
        };
      },
    });
  }

  async scorePoint(
    tournamentId: string,
    categoryId: string,
    matchId: string,
    side: Side,
    user: AuthUserView,
  ) {
    return this.mutateLiveScore({
      tournamentId,
      categoryId,
      matchId,
      user,
      action: 'point',
      side,
      mutate: (state) => applyPoint(state, side),
      pushUndo: true,
    });
  }

  async removeScorePoint(
    tournamentId: string,
    categoryId: string,
    matchId: string,
    side: Side,
    user: AuthUserView,
  ) {
    return this.mutateLiveScore({
      tournamentId,
      categoryId,
      matchId,
      user,
      action: 'point_remove',
      side,
      mutate: (state) => removePoint(state, side),
      pushUndo: true,
    });
  }

  async adjustScoreGame(
    tournamentId: string,
    categoryId: string,
    matchId: string,
    side: Side,
    delta: 1 | -1,
    user: AuthUserView,
  ) {
    return this.mutateLiveScore({
      tournamentId,
      categoryId,
      matchId,
      user,
      action: 'game',
      side,
      delta,
      mutate: (state) => adjustGame(state, side, delta),
      pushUndo: true,
    });
  }

  async adjustScoreSet(
    tournamentId: string,
    categoryId: string,
    matchId: string,
    side: Side,
    delta: 1 | -1,
    user: AuthUserView,
  ) {
    return this.mutateLiveScore({
      tournamentId,
      categoryId,
      matchId,
      user,
      action: 'set',
      side,
      delta,
      mutate: (state) => adjustSet(state, side, delta),
      pushUndo: true,
    });
  }

  async setScoreServer(
    tournamentId: string,
    categoryId: string,
    matchId: string,
    side: Side,
    user: AuthUserView,
  ) {
    return this.mutateLiveScore({
      tournamentId,
      categoryId,
      matchId,
      user,
      action: 'server',
      side,
      mutate: (state) => setServerSide(state, side),
      pushUndo: true,
    });
  }

  async undoScore(
    tournamentId: string,
    categoryId: string,
    matchId: string,
    user: AuthUserView,
  ) {
    return this.mutateLiveScore({
      tournamentId,
      categoryId,
      matchId,
      user,
      action: 'undo',
      mutate: (state) => {
        const stack = state.undoStack ?? [];
        if (stack.length === 0) {
          throw new Error('Nothing to undo');
        }
        const previous = stack[stack.length - 1];
        const restored = stripUndoStack(previous);
        restored.undoStack = stack.slice(0, -1);
        return restored;
      },
      pushUndo: false,
    });
  }

  async finish(
    tournamentId: string,
    categoryId: string,
    matchId: string,
    user: AuthUserView,
  ) {
    return this.transition({
      tournamentId,
      categoryId,
      matchId,
      user,
      target: MatchStatus.finished,
      eventName: MatchEvents.Finished,
      before: async (ctx) => {
        await this.assertOperatorAuthorized(ctx.match.id, user);
        const state = this.readScoreState(ctx.match.scoreRepresentation);
        if (!state || !isMatchComplete(state)) {
          throw new BadRequestException(
            'Finish requires completed scoring state (phase=completed) — Step 8B',
          );
        }
      },
      extras: () => ({
        actualEndAt: new Date(),
        resultStatus: ResultStatus.normal,
      }),
    });
  }

  async verify(
    tournamentId: string,
    categoryId: string,
    matchId: string,
    user: AuthUserView,
  ) {
    // 8C: officialize result + emit Standing-ready event. No Standing recalc here.
    let extractedResult: ReturnType<typeof getMatchResult> | null = null;
    let sideTeams: { A: string | null; B: string | null } = {
      A: null,
      B: null,
    };
    let groupId: string | null = null;
    let playoffId: string | null = null;
    let bracketId: string | null = null;
    let bracketPosition: string | null = null;

    return this.transition({
      tournamentId,
      categoryId,
      matchId,
      user,
      target: MatchStatus.verified,
      eventName: MatchEvents.Verified,
      before: async (ctx) => {
        if (!this.matches.isAdminOperator(user.roles)) {
          throw new ForbiddenException(
            'Only Tournament Admin may Verify matches in MVP (MATCH-10)',
          );
        }

        if (!this.matches.isTournamentLive(ctx.tournament.status)) {
          throw new BadRequestException(
            'Verify requires Tournament status Live (8C)',
          );
        }

        const state = this.readScoreState(ctx.match.scoreRepresentation);
        if (!state || !isMatchComplete(state)) {
          throw new BadRequestException(
            'Verify requires completed scoring state (8C)',
          );
        }

        try {
          extractedResult = getMatchResult(state);
        } catch (err) {
          throw new BadRequestException(
            err instanceof Error ? err.message : 'Unable to extract match result',
          );
        }

        groupId = ctx.match.groupId;
        playoffId = ctx.match.playoffId;
        bracketId = ctx.match.bracketId;
        bracketPosition = ctx.match.bracketPosition;
        sideTeams = {
          A:
            ctx.match.participations.find((p) => p.sideLabel === 'A')?.teamId ??
            null,
          B:
            ctx.match.participations.find((p) => p.sideLabel === 'B')?.teamId ??
            null,
        };
      },
      eventPayload: () => ({
        groupId,
        playoffId,
        bracketId,
        bracketPosition,
        result: extractedResult,
        sides: sideTeams,
        // Standing (group) / Playoff (knockout) consume this; MatchService does not write those domains.
      }),
    });
  }

  private async mutateLiveScore(params: {
    tournamentId: string;
    categoryId: string;
    matchId: string;
    user: AuthUserView;
    action: string;
    side?: Side;
    delta?: 1 | -1;
    mutate: (state: ScoreState) => ScoreState;
    pushUndo: boolean;
  }) {
    const { category } = await this.requireCategory(
      params.tournamentId,
      params.categoryId,
    );
    const match = await this.requireOperableMatch(
      params.tournamentId,
      params.categoryId,
      params.matchId,
    );

    if (match.status !== MatchStatus.live) {
      throw new BadRequestException(
        'Score changes only allowed while Match is live (8B)',
      );
    }

    await this.assertOperatorAuthorized(match.id, params.user);

    let state = this.readScoreState(match.scoreRepresentation);
    if (!state) {
      const config = resolveScoringConfig(category.configuration);
      state = createInitialState(config);
    }

    let next: ScoreState;
    try {
      if (params.pushUndo) {
        const snapshot = stripUndoStack(state);
        const stack = [...(state.undoStack ?? []), snapshot].slice(
          -MAX_UNDO_STACK,
        );
        next = params.mutate(state);
        next.undoStack = stack;
      } else {
        next = params.mutate(state);
      }
    } catch (err) {
      throw new BadRequestException(
        err instanceof Error ? err.message : 'Unable to update score',
      );
    }

    const updated = await this.matches.updateScoreRepresentation({
      matchId: match.id,
      scoreRepresentation: next as unknown as Prisma.InputJsonValue,
      updatedBy: params.user.id,
    });

    await this.events.publish({
      name: MatchEvents.ScoreUpdated,
      occurredAt: new Date().toISOString(),
      payload: {
        tournamentId: params.tournamentId,
        categoryId: params.categoryId,
        matchId: match.id,
        action: params.action,
        side: params.side ?? null,
        delta: params.delta ?? null,
        phase: next.phase,
        winnerSide: next.winnerSide,
        setsWon: next.setsWon,
        serverSide: next.serverSide,
        actorId: params.user.id,
      },
    });

    return updated;
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

  private async transition(params: {
    tournamentId: string;
    categoryId: string;
    matchId: string;
    user: AuthUserView;
    target: MatchStatus;
    eventName: string;
    before?: (ctx: {
      tournament: NonNullable<
        Awaited<ReturnType<MatchRepository['findActiveTournament']>>
      >;
      category: NonNullable<
        Awaited<ReturnType<MatchRepository['findActiveCategory']>>
      >;
      match: NonNullable<
        Awaited<ReturnType<MatchRepository['findMatchInCategory']>>
      >;
    }) => void | Promise<void>;
    extras?: (ctx: {
      tournament: NonNullable<
        Awaited<ReturnType<MatchRepository['findActiveTournament']>>
      >;
      category: NonNullable<
        Awaited<ReturnType<MatchRepository['findActiveCategory']>>
      >;
      match: NonNullable<
        Awaited<ReturnType<MatchRepository['findMatchInCategory']>>
      >;
    }) => {
      actualStartAt?: Date | null;
      actualEndAt?: Date | null;
      resultStatus?: ResultStatus;
      scoreRepresentation?: Prisma.InputJsonValue | typeof Prisma.JsonNull;
    };
    eventPayload?: () => Record<string, unknown>;
  }) {
    const { tournament, category } = await this.requireCategory(
      params.tournamentId,
      params.categoryId,
    );

    const match = await this.requireOperableMatch(
      params.tournamentId,
      params.categoryId,
      params.matchId,
    );

    const expected = getNextMatchStatus(match.status);
    if (expected !== params.target) {
      throw new BadRequestException(
        `Invalid Match transition from '${match.status}' to '${params.target}' (MATCH-03)`,
      );
    }

    const ctx = { tournament, category, match };
    if (params.before) {
      await params.before(ctx);
    }

    const extras = params.extras?.(ctx) ?? {};
    const updated = await this.matches.transitionStatus({
      matchId: match.id,
      status: params.target,
      updatedBy: params.user.id,
      ...extras,
    });

    await this.events.publish({
      name: params.eventName,
      occurredAt: new Date().toISOString(),
      payload: {
        tournamentId: params.tournamentId,
        categoryId: params.categoryId,
        matchId: match.id,
        fromStatus: match.status,
        toStatus: params.target,
        courtId: match.courtId,
        scheduleVersionId: match.scheduleVersionId,
        playoffId: match.playoffId,
        bracketId: match.bracketId,
        bracketPosition: match.bracketPosition,
        actorId: params.user.id,
        ...(params.eventPayload?.() ?? {}),
      },
    });

    return updated;
  }

  async assignReferee(
    tournamentId: string,
    categoryId: string,
    matchId: string,
    email: string,
    user: AuthUserView,
  ) {
    await this.requireCategory(tournamentId, categoryId);
    const match = await this.matches.findMatchInCategory(categoryId, matchId);
    if (!match) {
      throw new NotFoundException('Match not found');
    }

    const referee = await this.matches.findUserByEmail(email.trim());
    if (!referee) {
      throw new NotFoundException('Referee user not found');
    }

    const isReferee = referee.roleAssignments.some(
      (assignment) => assignment.role === UserRole.referee,
    );
    if (!isReferee) {
      throw new BadRequestException('User does not have referee role');
    }

    const existing = await this.matches.findActiveRefereeAssignment(
      matchId,
      referee.id,
    );
    if (existing) {
      return existing;
    }

    return this.matches.assignReferee({
      matchId,
      refereeId: referee.id,
      assignedBy: user.id,
    });
  }

  async listMyAssignments(user: AuthUserView) {
    const items = await this.matches.listActiveAssignmentsForReferee(user.id);
    return {
      items: items.map((row) => ({
        id: row.id,
        assignedAt: row.assignedAt,
        assignmentStatus: row.assignmentStatus,
        match: {
          id: row.match.id,
          status: row.match.status,
          bracketPosition: row.match.bracketPosition,
          scheduledStartAt: row.match.scheduledStartAt,
          tournamentId: row.match.category.tournamentId,
          tournamentName: row.match.category.tournament.name,
          tournamentStatus: row.match.category.tournament.status,
          categoryId: row.match.categoryId,
          categoryName: row.match.category.name,
          court: row.match.court,
          participations: row.match.participations,
        },
      })),
    };
  }

  private async assertCourtAvailable(match: {
    id: string;
    courtId: string | null;
    playoffId?: string | null;
  }) {
    // Playoff MVP may run without a court assignment.
    if (!match.courtId) {
      if (match.playoffId) {
        return;
      }
      throw new BadRequestException(
        'Match has no Court assigned; cannot occupy court',
      );
    }

    const occupying = await this.matches.findOccupyingMatchOnCourt({
      courtId: match.courtId,
      excludeMatchId: match.id,
    });
    if (occupying) {
      throw new BadRequestException(
        `Court already occupied by match ${occupying.id} (${occupying.status})`,
      );
    }
  }

  private async assertOperatorAuthorized(matchId: string, user: AuthUserView) {
    if (this.matches.isAdminOperator(user.roles)) {
      return;
    }

    if (!this.matches.isRefereeOnly(user.roles)) {
      throw new ForbiddenException('Insufficient permissions for Match ops');
    }

    const assignment = await this.matches.findActiveRefereeAssignment(
      matchId,
      user.id,
    );
    if (!assignment) {
      throw new ForbiddenException(
        'Referee may only operate assigned Matches (REF-02)',
      );
    }
  }

  private async requireOperableMatch(
    tournamentId: string,
    categoryId: string,
    matchId: string,
  ) {
    const match = await this.matches.findMatchInCategory(categoryId, matchId);
    if (!match) {
      throw new NotFoundException('Match not found');
    }

    if (match.playoffId && match.bracketId) {
      const playoff = await this.playoffs.assertPlayoffReady(
        tournamentId,
        categoryId,
      );
      if (match.bracketId !== playoff.currentOfficialBracketId) {
        throw new BadRequestException(
          'Match is not on the Official Locked Playoff Bracket',
        );
      }
      return match;
    }

    const schedule = await this.schedules.assertLiveReady(
      tournamentId,
      categoryId,
    );
    if (match.scheduleVersionId !== schedule.currentOfficialVersionId) {
      throw new BadRequestException(
        'Match is not on the Official Locked Schedule version',
      );
    }
    return match;
  }

  private async requireOfficialMatch(
    categoryId: string,
    matchId: string,
    officialScheduleVersionId: string,
  ) {
    const match = await this.matches.findMatchInCategory(categoryId, matchId);
    if (!match) {
      throw new NotFoundException('Match not found');
    }
    if (match.scheduleVersionId !== officialScheduleVersionId) {
      throw new BadRequestException(
        'Match is not on the Official Locked Schedule version',
      );
    }
    return match;
  }

  private async requireCategory(tournamentId: string, categoryId: string) {
    const tournament =
      await this.matches.findActiveTournament(tournamentId);
    if (!tournament) {
      throw new NotFoundException('Tournament not found');
    }

    const category = await this.matches.findActiveCategory(
      tournamentId,
      categoryId,
    );
    if (!category) {
      throw new NotFoundException('Category not found');
    }

    return { tournament, category };
  }
}
