import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { LockState, MatchStatus, PublishState, VersionStatus } from '@prisma/client';
import { AuthUserView } from '../auth/types/auth-user.type';
import {
  DOMAIN_EVENT_PUBLISHER,
  DomainEvent,
  DomainEventPublisher,
} from '../common/events/domain-event.publisher';
import { resolveCompetitionMode } from '../category/competition-mode';
import { MatchEvents } from '../match/match.events';
import {
  getMatchResult,
  isMatchComplete,
  PADEL_SCORING_ENGINE_VERSION,
  ScoreState,
} from '../match/scoring';
import { resolveStandingsConfig } from '../standing/engine';
import { ReviewBracketDto } from './dto/review-bracket.dto';
import { UnlockPlayoffDto } from './dto/unlock-playoff.dto';
import {
  BracketStructure,
  generateKnockoutBracket,
  generatePlayoffBracket,
  planPlayoffAdvancement,
  PLAYOFF_BRACKET_ENGINE_VERSION,
  QualifiedSeed,
} from './engine';
import { PlayoffEvents } from './playoff.events';
import {
  isPlayoffLocked,
  isPlayoffReady,
  PLAYOFF_GENERATION_TOURNAMENT_STATUSES,
  PLAYOFF_PUBLISH_TOURNAMENT_STATUSES,
} from './playoff.lifecycle';
import { PlayoffRepository } from './playoff.repository';

type MatchVerifiedPayload = {
  tournamentId?: string;
  categoryId?: string;
  matchId?: string;
  playoffId?: string | null;
  bracketId?: string | null;
  bracketPosition?: string | null;
  result?: { winnerSide: 'A' | 'B' } | null;
  sides?: { A: string | null; B: string | null };
};

@Injectable()
export class PlayoffService implements OnModuleInit {
  private readonly logger = new Logger(PlayoffService.name);

  constructor(
    private readonly playoffs: PlayoffRepository,
    @Inject(DOMAIN_EVENT_PUBLISHER)
    private readonly events: DomainEventPublisher,
  ) {}

  onModuleInit() {
    this.events.subscribe?.(MatchEvents.Verified, (event) =>
      this.onMatchVerified(event),
    );
  }

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
        `Playoff generation is not allowed while tournament is '${tournament.status}' (MVP: published|live)`,
      );
    }

    const competitionMode = resolveCompetitionMode(category.configuration);

    if (competitionMode === 'group_then_knockout') {
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

    let plan;
    let qualificationBasis: string;

    try {
      if (competitionMode === 'knockout_only') {
        const teams = await this.playoffs.findActiveTeamsForKnockout(
          categoryId,
        );
        const seeded = teams.map((team, index) => ({
          teamId: team.id,
          seed: team.seedRank ?? index + 1,
        }));
        // Re-number contiguous 1..N by sort order for generator
        const ordered = [...seeded].sort((a, b) => a.seed - b.seed);
        const contiguous = ordered.map((t, i) => ({
          teamId: t.teamId,
          seed: i + 1,
        }));
        plan = generateKnockoutBracket({ teams: contiguous });
        qualificationBasis = `competitionMode=knockout_only;entrants=${contiguous.length};bracketSize=${plan.structure.bracketSize};pairing=seeded_knockout`;
      } else {
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

        plan = generatePlayoffBracket({
          seeds,
          qualifyTop: standingsConfig.qualifyTop,
        });
        qualificationBasis = `competitionMode=group_then_knockout;qualifyTop=${standingsConfig.qualifyTop};pairing=cross_group_standard`;
      }
    } catch (err) {
      throw new BadRequestException(
        err instanceof Error ? err.message : 'Unable to generate bracket',
      );
    }

    const versionNumber = await this.playoffs.nextBracketVersionNumber(
      playoff.id,
    );

    const bracket = await this.playoffs.createCandidateBracket({
      playoffId: playoff.id,
      categoryId,
      versionNumber,
      structure: plan.structure,
      qualificationBasis,
      matches: plan.materializable,
      createdBy: user.id,
    });

    // Cup byes: auto-advance winners so next-round matches that are fully known
    // (e.g. bye vs bye → QF) materialize immediately without waiting for verify.
    let matchCount = plan.materializable.length;
    if (plan.byeWinners.length > 0) {
      const followUp = planPlayoffAdvancement({
        structure: plan.structure,
        verified: plan.byeWinners,
        materializedPositions: plan.materializable.map((m) => m.bracketPosition),
      });
      if (followUp.create.length > 0) {
        await this.playoffs.materializeBracketMatches({
          playoffId: playoff.id,
          categoryId,
          bracketId: bracket.id,
          matches: followUp.create,
          createdBy: user.id,
        });
        matchCount += followUp.create.length;
      }
    }

    await this.events.publish({
      name: PlayoffEvents.BracketGenerated,
      occurredAt: new Date().toISOString(),
      payload: {
        tournamentId,
        categoryId,
        playoffId: playoff.id,
        bracketId: bracket.id,
        versionNumber,
        matchCount,
        byeCount: plan.byeWinners.length,
        qualificationBasis,
        competitionMode,
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

  async getChampion(tournamentId: string, categoryId: string) {
    await this.requireCategory(tournamentId, categoryId);
    const playoff = await this.playoffs.findPlayoffByCategory(categoryId);
    if (!playoff) {
      throw new NotFoundException('Playoff not found');
    }
    const champion = await this.playoffs.findChampion(playoff.id);
    if (!champion) {
      throw new NotFoundException('Champion not declared yet');
    }
    return champion;
  }

  private async onMatchVerified(event: DomainEvent) {
    const payload = event.payload as MatchVerifiedPayload;
    if (
      !payload.playoffId ||
      !payload.bracketId ||
      !payload.categoryId ||
      !payload.tournamentId
    ) {
      return;
    }

    try {
      await this.advanceOfficialBracket({
        tournamentId: payload.tournamentId,
        categoryId: payload.categoryId,
        playoffId: payload.playoffId,
        bracketId: payload.bracketId,
        actorId: null,
      });
    } catch (err) {
      this.logger.error(
        `Playoff advancement failed for match ${payload.matchId}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  async advanceOfficialBracket(params: {
    tournamentId: string;
    categoryId: string;
    playoffId: string;
    bracketId: string;
    actorId?: string | null;
  }) {
    const playoff = await this.assertPlayoffReady(
      params.tournamentId,
      params.categoryId,
    );
    if (playoff.id !== params.playoffId) {
      throw new BadRequestException('Playoff mismatch');
    }
    if (playoff.currentOfficialBracketId !== params.bracketId) {
      // Ignore verified matches on non-official / historical brackets
      return { created: [], champion: null };
    }

    const bracket = await this.playoffs.findOfficialBracketWithMatches(
      params.bracketId,
    );
    if (!bracket) {
      throw new NotFoundException('Official Bracket not found');
    }

    const structure = this.readStructure(bracket.structureRepresentation);
    const verified = [];
    for (const match of bracket.matches) {
      if (match.status !== MatchStatus.verified || !match.bracketPosition) {
        continue;
      }
      const winnerTeamId = this.winnerTeamIdFromMatch(match);
      if (!winnerTeamId) {
        this.logger.warn(
          `Verified playoff match ${match.id} missing winner; skip`,
        );
        continue;
      }
      verified.push({
        bracketPosition: match.bracketPosition,
        winnerTeamId,
      });
    }

    const materializedPositions = bracket.matches
      .map((m) => m.bracketPosition)
      .filter((p): p is string => !!p);

    const plan = planPlayoffAdvancement({
      structure,
      verified,
      materializedPositions,
    });

    const created = await this.playoffs.materializeBracketMatches({
      playoffId: params.playoffId,
      categoryId: params.categoryId,
      bracketId: params.bracketId,
      matches: plan.create,
      createdBy: params.actorId ?? undefined,
    });

    if (created.length > 0) {
      await this.events.publish({
        name: PlayoffEvents.Advanced,
        occurredAt: new Date().toISOString(),
        payload: {
          tournamentId: params.tournamentId,
          categoryId: params.categoryId,
          playoffId: params.playoffId,
          bracketId: params.bracketId,
          createdPositions: plan.create.map((m) => m.bracketPosition),
          actorId: params.actorId ?? null,
        },
      });
    }

    let champion = null;
    if (plan.championTeamId) {
      const existing = await this.playoffs.findChampion(params.playoffId);
      if (!existing || existing.winningTeamId !== plan.championTeamId) {
        champion = await this.playoffs.upsertChampion({
          playoffId: params.playoffId,
          categoryId: params.categoryId,
          winningTeamId: plan.championTeamId,
          declaredBy: params.actorId ?? undefined,
        });
        await this.events.publish({
          name: PlayoffEvents.ChampionDeclared,
          occurredAt: new Date().toISOString(),
          payload: {
            tournamentId: params.tournamentId,
            categoryId: params.categoryId,
            playoffId: params.playoffId,
            winningTeamId: plan.championTeamId,
            actorId: params.actorId ?? null,
          },
        });
      } else {
        champion = existing;
      }
    }

    return { created, champion };
  }

  private winnerTeamIdFromMatch(match: {
    scoreRepresentation: unknown;
    participations: Array<{ sideLabel: string; teamId: string }>;
  }): string | null {
    const state = this.readScoreState(match.scoreRepresentation);
    if (!state || !isMatchComplete(state)) {
      return null;
    }
    let result;
    try {
      result = getMatchResult(state);
    } catch {
      return null;
    }
    return (
      match.participations.find((p) => p.sideLabel === result.winnerSide)
        ?.teamId ?? null
    );
  }

  private readStructure(value: unknown): BracketStructure {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new BadRequestException('Invalid bracket structureRepresentation');
    }
    const raw = value as BracketStructure;
    if (raw.engineVersion !== PLAYOFF_BRACKET_ENGINE_VERSION) {
      throw new BadRequestException(
        `Unsupported bracket engine version: ${String(raw.engineVersion)}`,
      );
    }
    if (!Array.isArray(raw.matches)) {
      throw new BadRequestException('Bracket structure missing matches');
    }
    return raw;
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
