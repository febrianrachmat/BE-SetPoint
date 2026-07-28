import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { LockState, PublishState, VersionStatus } from '@prisma/client';
import { AuthUserView } from '../auth/types/auth-user.type';
import {
  DOMAIN_EVENT_PUBLISHER,
  DomainEventPublisher,
} from '../common/events/domain-event.publisher';
import { resolveStandingsConfig } from '../standing/engine';
import { ReviewBracketDto } from './dto/review-bracket.dto';
import { UnlockPlayoffDto } from './dto/unlock-playoff.dto';
import { generatePlayoffBracket, QualifiedSeed } from './engine';
import { PlayoffEvents } from './playoff.events';
import {
  isPlayoffLocked,
  isPlayoffReady,
  PLAYOFF_GENERATION_TOURNAMENT_STATUSES,
  PLAYOFF_PUBLISH_TOURNAMENT_STATUSES,
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

  async getOfficialBracket(tournamentId: string, categoryId: string) {
    const playoff = await this.getPlayoff(tournamentId, categoryId);
    if (!playoff.currentOfficialBracketId) {
      throw new NotFoundException('No official Bracket');
    }
    return this.getBracket(
      tournamentId,
      categoryId,
      playoff.currentOfficialBracketId,
    );
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

  async reviewBracket(
    tournamentId: string,
    categoryId: string,
    bracketId: string,
    dto: ReviewBracketDto,
    user: AuthUserView,
  ) {
    await this.requireCategory(tournamentId, categoryId);
    const playoff = await this.requirePlayoff(categoryId);

    if (this.playoffs.isLocked(playoff.lockState)) {
      throw new BadRequestException('Playoff is locked; review is forbidden');
    }

    const bracket = await this.playoffs.findBracketForPlayoff(
      playoff.id,
      bracketId,
    );
    if (!bracket) {
      throw new NotFoundException('Bracket not found');
    }

    if (bracket.versionStatus === VersionStatus.historical) {
      throw new BadRequestException('Historical Brackets cannot be reviewed');
    }

    if (
      bracket.officialFlag ||
      bracket.versionStatus === VersionStatus.official
    ) {
      throw new BadRequestException(
        'Official Bracket is already published; generate a new candidate to change the plan',
      );
    }

    const reviewed = await this.playoffs.reviewBracket({
      playoffId: playoff.id,
      bracketId,
      outcome: dto.outcome,
      updatedBy: user.id,
    });

    await this.events.publish({
      name: PlayoffEvents.BracketReviewed,
      occurredAt: new Date().toISOString(),
      payload: {
        tournamentId,
        categoryId,
        playoffId: playoff.id,
        bracketId,
        versionNumber: bracket.versionNumber,
        outcome: dto.outcome,
        note: dto.note ?? null,
        actorId: user.id,
      },
    });

    return reviewed;
  }

  async publishBracket(
    tournamentId: string,
    categoryId: string,
    bracketId: string,
    user: AuthUserView,
  ) {
    const { tournament } = await this.requireCategory(tournamentId, categoryId);
    const playoff = await this.requirePlayoff(categoryId);

    if (!PLAYOFF_PUBLISH_TOURNAMENT_STATUSES.includes(tournament.status)) {
      throw new BadRequestException(
        `Playoff publish is not allowed while tournament is '${tournament.status}'`,
      );
    }

    if (this.playoffs.isLocked(playoff.lockState)) {
      throw new BadRequestException('Playoff is locked; publish is forbidden');
    }

    const bracket = await this.playoffs.findBracketForPlayoff(
      playoff.id,
      bracketId,
    );
    if (!bracket) {
      throw new NotFoundException('Bracket not found');
    }

    if (bracket.versionStatus === VersionStatus.historical) {
      throw new BadRequestException('Historical Brackets cannot be published');
    }

    if (
      bracket.officialFlag &&
      bracket.versionStatus === VersionStatus.official
    ) {
      throw new BadRequestException('Bracket is already official');
    }

    if (bracket.reviewOutcome !== 'approved') {
      throw new BadRequestException(
        'Bracket must be Review-approved before Publish',
      );
    }

    const previousOfficialBracketId = playoff.currentOfficialBracketId;
    const published = await this.playoffs.publishBracket({
      playoffId: playoff.id,
      bracketId,
      previousOfficialBracketId,
      publishedBy: user.id,
    });

    await this.events.publish({
      name: PlayoffEvents.Published,
      occurredAt: new Date().toISOString(),
      payload: {
        tournamentId,
        categoryId,
        playoffId: playoff.id,
        bracketId,
        versionNumber: bracket.versionNumber,
        previousOfficialBracketId,
        actorId: user.id,
      },
    });

    return published;
  }

  async lock(tournamentId: string, categoryId: string, user: AuthUserView) {
    await this.requireCategory(tournamentId, categoryId);
    const playoff = await this.requirePlayoff(categoryId);

    if (playoff.publishState !== PublishState.published) {
      throw new BadRequestException(
        'Playoff must be Published before Lock',
      );
    }
    if (!playoff.currentOfficialBracketId) {
      throw new BadRequestException(
        'Playoff Lock requires a current Official Bracket',
      );
    }
    if (this.playoffs.isLocked(playoff.lockState)) {
      throw new BadRequestException('Playoff is already Locked');
    }

    const locked = await this.playoffs.lockPlayoff({
      playoffId: playoff.id,
      lockedBy: user.id,
    });

    await this.events.publish({
      name: PlayoffEvents.Locked,
      occurredAt: new Date().toISOString(),
      payload: {
        tournamentId,
        categoryId,
        playoffId: playoff.id,
        officialBracketId: playoff.currentOfficialBracketId,
        actorId: user.id,
      },
    });

    return locked;
  }

  async unlock(
    tournamentId: string,
    categoryId: string,
    dto: UnlockPlayoffDto,
    user: AuthUserView,
  ) {
    await this.requireCategory(tournamentId, categoryId);
    const playoff = await this.requirePlayoff(categoryId);

    if (!this.playoffs.isLocked(playoff.lockState)) {
      throw new BadRequestException('Playoff is not Locked');
    }

    const unlocked = await this.playoffs.unlockPlayoff({
      playoffId: playoff.id,
      reason: dto.reason,
      unlockedBy: user.id,
    });

    await this.events.publish({
      name: PlayoffEvents.Unlocked,
      occurredAt: new Date().toISOString(),
      payload: {
        tournamentId,
        categoryId,
        playoffId: playoff.id,
        reason: dto.reason,
        actorId: user.id,
      },
    });

    return unlocked;
  }

  /**
   * Gate for Step 10C playoff match ops: Published ∧ Locked ∧ Official bracket.
   */
  async assertPlayoffReady(tournamentId: string, categoryId: string) {
    await this.requireCategory(tournamentId, categoryId);
    const playoff = await this.playoffs.findPlayoffByCategory(categoryId);
    if (!playoff) {
      throw new BadRequestException('Playoff not found');
    }
    if (!isPlayoffReady(playoff)) {
      throw new BadRequestException(
        'Playoff Ready requires Published ∧ Locked Official Bracket',
      );
    }
    return playoff;
  }

  private async requirePlayoff(categoryId: string) {
    const playoff = await this.playoffs.findPlayoffByCategory(categoryId);
    if (!playoff) {
      throw new NotFoundException('Playoff not found');
    }
    return playoff;
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
