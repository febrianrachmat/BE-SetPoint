import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { LockState, PublishState } from '@prisma/client';
import { AuthUserView } from '../auth/types/auth-user.type';
import {
  DOMAIN_EVENT_PUBLISHER,
  DomainEventPublisher,
} from '../common/events/domain-event.publisher';
import { resolveStandingsConfig } from '../standing/engine';
import { generatePlayoffBracket, QualifiedSeed } from './engine';
import { PlayoffEvents } from './playoff.events';
import {
  isPlayoffLocked,
  PLAYOFF_GENERATION_TOURNAMENT_STATUSES,
} from './playoff.lifecycle';
import { PlayoffRepository } from './playoff.repository';

@Injectable()
export class PlayoffService {
  constructor(
    private readonly playoffs: PlayoffRepository,
    @Inject(DOMAIN_EVENT_PUBLISHER)
    private readonly events: DomainEventPublisher,
  ) {}

  async getPlayoff(tournamentId: string, categoryId: string) {
    await this.requireCategory(tournamentId, categoryId);
    const playoff = await this.playoffs.findPlayoffByCategory(categoryId);
    if (!playoff) {
      throw new NotFoundException('Playoff not found');
    }
    return playoff;
  }

  async listBrackets(tournamentId: string, categoryId: string) {
    await this.requireCategory(tournamentId, categoryId);
    const playoff = await this.playoffs.findPlayoffByCategory(categoryId);
    if (!playoff) {
      return { items: [], currentOfficialBracketId: null };
    }
    const items = await this.playoffs.listBrackets(playoff.id);
    return {
      items,
      currentOfficialBracketId: playoff.currentOfficialBracketId,
      publishState: playoff.publishState,
      reviewStatus: playoff.reviewStatus,
      lockState: playoff.lockState,
      qualificationBasis: playoff.qualificationBasis,
    };
  }

  async getBracket(
    tournamentId: string,
    categoryId: string,
    bracketId: string,
  ) {
    await this.requireCategory(tournamentId, categoryId);
    const bracket = await this.playoffs.findBracketDetail(bracketId);
    if (!bracket || bracket.playoff.categoryId !== categoryId) {
      throw new NotFoundException('Bracket not found');
    }
    return bracket;
  }

  async generate(
    tournamentId: string,
    categoryId: string,
    user: AuthUserView,
  ) {
    const { tournament, category } = await this.requireCategory(
      tournamentId,
      categoryId,
    );

    if (
      !PLAYOFF_GENERATION_TOURNAMENT_STATUSES.includes(tournament.status)
    ) {
      throw new BadRequestException(
        `Playoff generation is not allowed while tournament is '${tournament.status}' (MVP: live)`,
      );
    }

    const drawing = await this.playoffs.findDrawing(categoryId);
    if (
      !drawing?.currentOfficialVersionId ||
      drawing.publishState !== PublishState.published ||
      drawing.lockState !== LockState.locked
    ) {
      throw new BadRequestException(
        'Playoff generation requires Official Locked Drawing',
      );
    }

    const blocked = await this.playoffs.findBlockedQualificationNotes(
      categoryId,
    );
    if (blocked) {
      throw new BadRequestException(
        'Playoff generation blocked: unresolved qualification ties (STD-05)',
      );
    }

    let playoff = await this.playoffs.findPlayoffByCategory(categoryId);
    if (!playoff) {
      const created = await this.playoffs.createPlayoff(categoryId, user.id);
      await this.events.publish({
        name: PlayoffEvents.Ensured,
        occurredAt: new Date().toISOString(),
        payload: {
          tournamentId,
          categoryId,
          playoffId: created.id,
          actorId: user.id,
        },
      });
      playoff = await this.playoffs.findPlayoffByCategory(categoryId);
      if (!playoff) {
        throw new BadRequestException('Failed to create Playoff');
      }
    }

    if (isPlayoffLocked(playoff.lockState)) {
      throw new BadRequestException(
        'Playoff is Locked; unlock before regenerating (PO-12)',
      );
    }

    const standingsConfig = resolveStandingsConfig(category.configuration);
    const qualifiedRows = await this.playoffs.findQualifiedStandings(
      categoryId,
    );

    const seeds: QualifiedSeed[] = [];
    for (const row of qualifiedRows) {
      if (!row.groupId || !row.group || !row.rankPosition) {
        throw new BadRequestException(
          `Qualified standing for team ${row.teamId} missing group/rank`,
        );
      }
      const groupKey = (row.group.label ?? row.group.name).trim();
      if (!groupKey) {
        throw new BadRequestException(
          `Group ${row.groupId} has empty label/name`,
        );
      }
      seeds.push({
        teamId: row.teamId,
        groupId: row.groupId,
        groupKey,
        rankPosition: row.rankPosition,
      });
    }

    let plan;
    try {
      plan = generatePlayoffBracket({
        seeds,
        qualifyTop: standingsConfig.qualifyTop,
      });
    } catch (err) {
      throw new BadRequestException(
        err instanceof Error ? err.message : 'Unable to generate bracket',
      );
    }

    const versionNumber = await this.playoffs.nextBracketVersionNumber(
      playoff.id,
    );
    const qualificationBasis = `qualifyTop=${standingsConfig.qualifyTop};pairing=cross_group_standard`;

    const bracket = await this.playoffs.createCandidateBracket({
      playoffId: playoff.id,
      categoryId,
      versionNumber,
      structure: plan.structure,
      qualificationBasis,
      matches: plan.materializable,
      createdBy: user.id,
    });

    await this.events.publish({
      name: PlayoffEvents.BracketGenerated,
      occurredAt: new Date().toISOString(),
      payload: {
        tournamentId,
        categoryId,
        playoffId: playoff.id,
        bracketId: bracket.id,
        versionNumber,
        matchCount: plan.materializable.length,
        qualificationBasis,
        actorId: user.id,
      },
    });

    return bracket;
  }

  private async requireCategory(tournamentId: string, categoryId: string) {
    const tournament =
      await this.playoffs.findActiveTournament(tournamentId);
    if (!tournament) {
      throw new NotFoundException('Tournament not found');
    }
    const category = await this.playoffs.findActiveCategory(
      tournamentId,
      categoryId,
    );
    if (!category) {
      throw new NotFoundException('Category not found');
    }
    return { tournament, category };
  }
}
