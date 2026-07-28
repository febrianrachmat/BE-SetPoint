import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { LockState, PublishState } from '@prisma/client';
import {
  DOMAIN_EVENT_PUBLISHER,
  DomainEvent,
  DomainEventPublisher,
} from '../common/events/domain-event.publisher';
import { MatchEvents } from '../match/match.events';
import {
  calculateGroupStandings,
  listQualifiedTeamIds,
  resolveStandingsConfig,
  StandingMatchInput,
} from './engine';
import { StandingRepository } from './standing.repository';
import { StandingEvents } from './standing.events';

type VerifiedPayload = {
  tournamentId?: string;
  categoryId?: string;
  matchId?: string;
  groupId?: string | null;
};

@Injectable()
export class StandingService implements OnModuleInit {
  private readonly logger = new Logger(StandingService.name);

  constructor(
    private readonly standings: StandingRepository,
    @Inject(DOMAIN_EVENT_PUBLISHER)
    private readonly events: DomainEventPublisher,
  ) {}

  onModuleInit() {
    this.events.subscribe?.(MatchEvents.Verified, (event) =>
      this.onMatchVerified(event),
    );
  }

  async list(
    tournamentId: string,
    categoryId: string,
    groupId?: string,
  ) {
    await this.requireCategory(tournamentId, categoryId);
    const items = await this.standings.findStandings({
      categoryId,
      groupId,
    });
    return { items };
  }

  async listQualified(
    tournamentId: string,
    categoryId: string,
    groupId?: string,
  ) {
    await this.requireCategory(tournamentId, categoryId);
    const items = await this.standings.findStandings({
      categoryId,
      groupId,
    });
    const qualified = items
      .filter((row) => row.qualificationStatus === 'qualified')
      .sort(
        (a, b) =>
          (a.rankPosition ?? 999) - (b.rankPosition ?? 999) ||
          a.teamId.localeCompare(b.teamId),
      );
    return { items: qualified };
  }

  async recalculate(
    tournamentId: string,
    categoryId: string,
    params: { groupId?: string; actorId?: string } = {},
  ) {
    const { category } = await this.requireCategory(tournamentId, categoryId);
    const config = resolveStandingsConfig(category.configuration);

    const drawing = await this.standings.findDrawing(categoryId);
    if (
      !drawing?.currentOfficialVersionId ||
      drawing.publishState !== PublishState.published ||
      drawing.lockState !== LockState.locked
    ) {
      throw new BadRequestException(
        'Standing recalc requires Official Locked Drawing',
      );
    }

    const groups = await this.standings.findGroupsForOfficialDrawing({
      categoryId,
      officialDrawingVersionId: drawing.currentOfficialVersionId,
      groupId: params.groupId,
    });

    if (params.groupId && groups.length === 0) {
      throw new NotFoundException('Group not found on Official Drawing');
    }

    const schedule = await this.standings.findScheduleOfficialVersionId(
      categoryId,
    );
    const scheduleVersionId = schedule?.currentOfficialVersionId ?? null;

    const allRows = [];
    const qualifiedTeamIds: string[] = [];
    for (const group of groups) {
      const locked = await this.standings.findLockedStandingInGroup(
        categoryId,
        group.id,
      );
      if (locked) {
        throw new BadRequestException(
          `Standing Lock blocks recalc for group ${group.id} (STD-08)`,
        );
      }

      const matches = await this.standings.findVerifiedGroupMatches({
        categoryId,
        groupId: group.id,
        scheduleVersionId,
      });

      const inputs: StandingMatchInput[] = [];
      for (const match of matches) {
        const teamA = match.participations.find((p) => p.sideLabel === 'A');
        const teamB = match.participations.find((p) => p.sideLabel === 'B');
        const result = this.standings.extractMatchResultFromScore(
          match.scoreRepresentation,
        );
        if (!teamA || !teamB || !result) {
          this.logger.warn(
            `Skipping verified match ${match.id}: incomplete sides/result`,
          );
          continue;
        }
        inputs.push({
          teamAId: teamA.teamId,
          teamBId: teamB.teamId,
          winnerSide: result.winnerSide,
          setsWon: result.setsWon,
          sets: result.sets,
        });
      }

      const ranked = calculateGroupStandings({
        teamIds: group.members.map((m) => m.teamId),
        matches: inputs,
        config,
      });

      const saved = await this.standings.replaceGroupStandings({
        categoryId,
        groupId: group.id,
        ranked,
        updatedBy: params.actorId,
      });
      allRows.push(...saved);
      qualifiedTeamIds.push(...listQualifiedTeamIds(ranked));
    }

    await this.events.publish({
      name: StandingEvents.Recalculated,
      occurredAt: new Date().toISOString(),
      payload: {
        tournamentId,
        categoryId,
        groupId: params.groupId ?? null,
        groupCount: groups.length,
        rowCount: allRows.length,
        qualifiedCount: qualifiedTeamIds.length,
        qualifiedTeamIds,
        actorId: params.actorId ?? null,
      },
    });

    return { items: allRows };
  }

  private async onMatchVerified(event: DomainEvent) {
    const payload = event.payload as VerifiedPayload;
    if (!payload.categoryId || !payload.tournamentId) {
      return;
    }

    const groupId = payload.groupId ?? null;
    if (!groupId) {
      this.logger.warn(
        `match.verified ${payload.matchId} has no groupId; skip Standing auto-recalc`,
      );
      return;
    }

    try {
      await this.recalculate(payload.tournamentId, payload.categoryId, {
        groupId,
      });
    } catch (err) {
      this.logger.error(
        `Auto standing recalc failed for group ${groupId}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  private async requireCategory(tournamentId: string, categoryId: string) {
    const tournament =
      await this.standings.findActiveTournament(tournamentId);
    if (!tournament) {
      throw new NotFoundException('Tournament not found');
    }

    const category = await this.standings.findActiveCategory(
      tournamentId,
      categoryId,
    );
    if (!category) {
      throw new NotFoundException('Category not found');
    }

    return { tournament, category };
  }
}
