import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { MatchStatus, Prisma, ResultStatus } from '@prisma/client';
import { AuthUserView } from '../auth/types/auth-user.type';
import {
  DOMAIN_EVENT_PUBLISHER,
  DomainEventPublisher,
} from '../common/events/domain-event.publisher';
import { ScheduleService } from '../schedule/schedule.service';
import { ListMatchesQueryDto } from './dto/list-matches.query.dto';
import { MatchEvents } from './match.events';
import { getNextMatchStatus } from './match.lifecycle';
import { MatchRepository } from './match.repository';
import {
  applyPoint,
  createInitialState,
  getMatchResult,
  isMatchComplete,
  PADEL_SCORING_ENGINE_VERSION,
  resolveScoringConfig,
  ScoreState,
  Side,
} from './scoring';

@Injectable()
export class MatchService {
  constructor(
    private readonly matches: MatchRepository,
    private readonly schedules: ScheduleService,
    @Inject(DOMAIN_EVENT_PUBLISHER)
    private readonly events: DomainEventPublisher,
  ) {}

  async list(
    tournamentId: string,
    categoryId: string,
    query: ListMatchesQueryDto,
  ) {
    await this.requireCategory(tournamentId, categoryId);
    const schedule = await this.schedules.assertLiveReady(
      tournamentId,
      categoryId,
    );

    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 50;
    const skip = (page - 1) * pageSize;

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
    const schedule = await this.schedules.assertLiveReady(
      tournamentId,
      categoryId,
    );
    const match = await this.requireOfficialMatch(
      categoryId,
      matchId,
      schedule.currentOfficialVersionId!,
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
    const { category } = await this.requireCategory(tournamentId, categoryId);
    const schedule = await this.schedules.assertLiveReady(
      tournamentId,
      categoryId,
    );
    const match = await this.requireOfficialMatch(
      categoryId,
      matchId,
      schedule.currentOfficialVersionId!,
    );

    if (match.status !== MatchStatus.live) {
      throw new BadRequestException(
        'Score points only allowed while Match is live (8B)',
      );
    }

    await this.assertOperatorAuthorized(match.id, user);

    let state = this.readScoreState(match.scoreRepresentation);
    if (!state) {
      const config = resolveScoringConfig(category.configuration);
      state = createInitialState(config);
    }

    let next: ScoreState;
    try {
      next = applyPoint(state, side);
    } catch (err) {
      throw new BadRequestException(
        err instanceof Error ? err.message : 'Unable to apply point',
      );
    }

    const updated = await this.matches.updateScoreRepresentation({
      matchId: match.id,
      scoreRepresentation: next as unknown as Prisma.InputJsonValue,
      updatedBy: user.id,
    });

    await this.events.publish({
      name: MatchEvents.ScoreUpdated,
      occurredAt: new Date().toISOString(),
      payload: {
        tournamentId,
        categoryId,
        matchId: match.id,
        side,
        phase: next.phase,
        winnerSide: next.winnerSide,
        setsWon: next.setsWon,
        actorId: user.id,
      },
    });

    return updated;
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
        result: extractedResult,
        sides: sideTeams,
        // Standing Engine (Step 9) consumes this event; MatchService does not update standings.
      }),
    });
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
    const schedule = await this.schedules.assertLiveReady(
      params.tournamentId,
      params.categoryId,
    );

    const match = await this.requireOfficialMatch(
      params.categoryId,
      params.matchId,
      schedule.currentOfficialVersionId!,
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
        actorId: params.user.id,
        ...(params.eventPayload?.() ?? {}),
      },
    });

    return updated;
  }

  private async assertCourtAvailable(match: {
    id: string;
    courtId: string | null;
  }) {
    if (!match.courtId) {
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
