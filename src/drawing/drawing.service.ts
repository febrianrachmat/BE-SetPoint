import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { VersionStatus } from '@prisma/client';
import { randomBytes } from 'node:crypto';
import { AuthUserView } from '../auth/types/auth-user.type';
import {
  DOMAIN_EVENT_PUBLISHER,
  DomainEventPublisher,
} from '../common/events/domain-event.publisher';
import { resolveCompetitionMode } from '../category/competition-mode';
import { DrawingEvents } from './drawing.events';
import {
  DRAWING_GENERATION_TOURNAMENT_STATUSES,
  DRAWING_PUBLISH_TOURNAMENT_STATUSES,
  isScheduleReady,
} from './drawing.lifecycle';
import { DrawingRepository } from './drawing.repository';
import { GenerateDrawingDto } from './dto/generate-drawing.dto';
import { ReviewDrawingVersionDto } from './dto/review-drawing-version.dto';
import { generateDrawingPlacements } from './engine/drawing-generator';
import { parseGroupPartitionConfig } from './engine/group-partition';

@Injectable()
export class DrawingService {
  constructor(
    private readonly drawings: DrawingRepository,
    @Inject(DOMAIN_EVENT_PUBLISHER)
    private readonly events: DomainEventPublisher,
  ) {}

  async getDrawing(tournamentId: string, categoryId: string) {
    await this.requireCategoryContext(tournamentId, categoryId);
    const drawing = await this.drawings.findDrawingByCategory(categoryId);
    if (!drawing) {
      throw new NotFoundException('Drawing not found');
    }
    return drawing;
  }

  async getOfficialVersion(tournamentId: string, categoryId: string) {
    const drawing = await this.getDrawing(tournamentId, categoryId);
    if (!drawing.currentOfficialVersionId) {
      throw new NotFoundException('No official Drawing version');
    }
    return this.getVersion(
      tournamentId,
      categoryId,
      drawing.currentOfficialVersionId,
    );
  }

  async listVersions(tournamentId: string, categoryId: string) {
    await this.requireCategoryContext(tournamentId, categoryId);
    const drawing = await this.drawings.findDrawingByCategory(categoryId);
    if (!drawing) {
      return { items: [], currentOfficialVersionId: null };
    }
    const items = await this.drawings.listVersions(drawing.id);
    return {
      items,
      currentOfficialVersionId: drawing.currentOfficialVersionId,
      publishState: drawing.publishState,
      reviewStatus: drawing.reviewStatus,
      lockState: drawing.lockState,
    };
  }

  async getVersion(
    tournamentId: string,
    categoryId: string,
    versionId: string,
  ) {
    await this.requireCategoryContext(tournamentId, categoryId);
    const version = await this.drawings.findVersionDetail(versionId);
    if (!version || version.drawing.categoryId !== categoryId) {
      throw new NotFoundException('Drawing version not found');
    }
    return version;
  }

  async generate(
    tournamentId: string,
    categoryId: string,
    dto: GenerateDrawingDto,
    user: AuthUserView,
  ) {
    const startedAt = Date.now();
    const { tournament, category } = await this.requireCategoryContext(
      tournamentId,
      categoryId,
    );

    if (!DRAWING_GENERATION_TOURNAMENT_STATUSES.includes(tournament.status)) {
      throw new BadRequestException(
        `Drawing generation is not allowed while tournament is '${tournament.status}'`,
      );
    }

    if (resolveCompetitionMode(category.configuration) === 'knockout_only') {
      throw new BadRequestException(
        'Drawing is not used for knockout_only categories; generate Playoff directly',
      );
    }

    let partition;
    try {
      partition = parseGroupPartitionConfig(category.configuration);
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error
          ? error.message
          : 'Invalid Category configuration for Drawing',
      );
    }

    let drawing = await this.drawings.findDrawingByCategory(categoryId);
    if (!drawing) {
      const created = await this.drawings.createDrawing(categoryId, user.id);
      await this.events.publish({
        name: DrawingEvents.Ensured,
        occurredAt: new Date().toISOString(),
        payload: {
          drawingId: created.id,
          categoryId,
          tournamentId,
          actorId: user.id,
        },
      });
      drawing = await this.drawings.findDrawingByCategory(categoryId);
      if (!drawing) {
        throw new NotFoundException('Drawing not found after create');
      }
    }

    if (this.drawings.isLocked(drawing.lockState)) {
      throw new BadRequestException(
        'Drawing is locked; generation is forbidden (DRAW-10/11)',
      );
    }

    const eligibleTeams = await this.drawings.findEligibleTeams(categoryId);
    const drawingSeed =
      dto.drawingSeed?.trim() || randomBytes(16).toString('hex');

    let result;
    try {
      result = generateDrawingPlacements({
        configuration: category.configuration,
        eligibleTeams: eligibleTeams.map((team) => ({
          id: team.id,
          seedRank: team.seedRank,
        })),
        placementMode: dto.placementMode,
        drawingSeed,
      });
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error ? error.message : 'Drawing generation failed',
      );
    }

    const versionNumber = await this.drawings.nextVersionNumber(drawing.id);
    const generationDurationMs = Date.now() - startedAt;

    const version = await this.drawings.persistGeneratedVersion({
      drawingId: drawing.id,
      categoryId,
      versionNumber,
      result,
      generationDurationMs,
      createdBy: user.id,
    });

    await this.events.publish({
      name: DrawingEvents.VersionGenerated,
      occurredAt: new Date().toISOString(),
      payload: {
        tournamentId,
        categoryId,
        drawingId: drawing.id,
        drawingVersionId: version!.id,
        versionNumber,
        placementMode: result.placementMode,
        drawingSeed: result.drawingSeed,
        prngAlgorithm: result.prngAlgorithm,
        engineVersion: result.engineVersion,
        generationDurationMs,
        eligibleCount: eligibleTeams.length,
        groupCount: partition.groupCount,
        actorId: user.id,
      },
    });

    return version;
  }

  async reviewVersion(
    tournamentId: string,
    categoryId: string,
    versionId: string,
    dto: ReviewDrawingVersionDto,
    user: AuthUserView,
  ) {
    await this.requireCategoryContext(tournamentId, categoryId);
    const drawing = await this.requireDrawing(categoryId);

    if (this.drawings.isLocked(drawing.lockState)) {
      throw new BadRequestException(
        'Drawing is locked; review is forbidden',
      );
    }

    const version = await this.drawings.findVersionForDrawing(
      drawing.id,
      versionId,
    );
    if (!version) {
      throw new NotFoundException('Drawing version not found');
    }

    if (version.versionStatus === VersionStatus.historical) {
      throw new BadRequestException(
        'Historical Drawing versions cannot be reviewed',
      );
    }

    if (version.officialFlag || version.versionStatus === VersionStatus.official) {
      throw new BadRequestException(
        'Official Drawing version is already published; generate a new candidate to change placements',
      );
    }

    const reviewed = await this.drawings.reviewVersion({
      drawingId: drawing.id,
      versionId,
      outcome: dto.outcome,
      updatedBy: user.id,
    });

    await this.events.publish({
      name: DrawingEvents.VersionReviewed,
      occurredAt: new Date().toISOString(),
      payload: {
        tournamentId,
        categoryId,
        drawingId: drawing.id,
        drawingVersionId: versionId,
        versionNumber: version.versionNumber,
        outcome: dto.outcome,
        note: dto.note ?? null,
        actorId: user.id,
      },
    });

    return reviewed;
  }

  async publishVersion(
    tournamentId: string,
    categoryId: string,
    versionId: string,
    user: AuthUserView,
  ) {
    const { tournament } = await this.requireCategoryContext(
      tournamentId,
      categoryId,
    );
    const drawing = await this.requireDrawing(categoryId);

    if (!DRAWING_PUBLISH_TOURNAMENT_STATUSES.includes(tournament.status)) {
      throw new BadRequestException(
        `Drawing publish is not allowed while tournament is '${tournament.status}'`,
      );
    }

    if (this.drawings.isLocked(drawing.lockState)) {
      throw new BadRequestException(
        'Drawing is locked; publish is forbidden',
      );
    }

    const version = await this.drawings.findVersionForDrawing(
      drawing.id,
      versionId,
    );
    if (!version) {
      throw new NotFoundException('Drawing version not found');
    }

    if (version.versionStatus === VersionStatus.historical) {
      throw new BadRequestException(
        'Historical Drawing versions cannot be published',
      );
    }

    if (version.officialFlag && version.versionStatus === VersionStatus.official) {
      throw new BadRequestException('Drawing version is already official');
    }

    // REV-02 / REV-03: Review approval required before Publish
    if (version.reviewOutcome !== 'approved') {
      throw new BadRequestException(
        'Drawing version must be Review-approved before Publish (REV-02)',
      );
    }

    const previousOfficialVersionId = drawing.currentOfficialVersionId;

    const published = await this.drawings.publishVersion({
      drawingId: drawing.id,
      versionId,
      previousOfficialVersionId,
      publishedBy: user.id,
    });

    await this.events.publish({
      name: DrawingEvents.Published,
      occurredAt: new Date().toISOString(),
      payload: {
        tournamentId,
        categoryId,
        drawingId: drawing.id,
        drawingVersionId: versionId,
        versionNumber: version.versionNumber,
        previousOfficialVersionId,
        drawingSeed: version.drawingSeed,
        actorId: user.id,
      },
    });

    return published;
  }

  async lock(tournamentId: string, categoryId: string, user: AuthUserView) {
    await this.requireCategoryContext(tournamentId, categoryId);
    const drawing = await this.requireDrawing(categoryId);

    if (this.drawings.isLocked(drawing.lockState)) {
      throw new BadRequestException('Drawing is already locked');
    }

    if (
      drawing.publishState !== 'published' ||
      !drawing.currentOfficialVersionId
    ) {
      throw new BadRequestException(
        'Drawing must be Published with an Official version before Lock (PUB-08)',
      );
    }

    const locked = await this.drawings.lockDrawing({
      drawingId: drawing.id,
      officialVersionId: drawing.currentOfficialVersionId,
      lockedBy: user.id,
    });

    await this.events.publish({
      name: DrawingEvents.Locked,
      occurredAt: new Date().toISOString(),
      payload: {
        tournamentId,
        categoryId,
        drawingId: drawing.id,
        officialVersionId: drawing.currentOfficialVersionId,
        actorId: user.id,
      },
    });

    return locked;
  }

  async unlock(
    tournamentId: string,
    categoryId: string,
    reason: string,
    user: AuthUserView,
  ) {
    await this.requireCategoryContext(tournamentId, categoryId);
    const drawing = await this.requireDrawing(categoryId);

    if (!this.drawings.isLocked(drawing.lockState)) {
      throw new BadRequestException('Drawing is not locked');
    }

    const unlocked = await this.drawings.unlockDrawing({
      drawingId: drawing.id,
      officialVersionId: drawing.currentOfficialVersionId,
      reason,
      unlockedBy: user.id,
    });

    await this.events.publish({
      name: DrawingEvents.Unlocked,
      occurredAt: new Date().toISOString(),
      payload: {
        tournamentId,
        categoryId,
        drawingId: drawing.id,
        reason,
        actorId: user.id,
      },
    });

    return unlocked;
  }

  /**
   * Step 7 gate: Drawing must be Published + Locked with an Official version.
   * Conceptual "Schedule Ready" — not a persisted status field.
   */
  async assertScheduleReady(tournamentId: string, categoryId: string) {
    await this.requireCategoryContext(tournamentId, categoryId);
    const drawing = await this.requireDrawing(categoryId);

    if (!isScheduleReady(drawing)) {
      throw new BadRequestException(
        'Schedule generation requires Drawing Published AND Locked (Schedule Ready)',
      );
    }

    return drawing;
  }

  private async requireDrawing(categoryId: string) {
    const drawing = await this.drawings.findDrawingByCategory(categoryId);
    if (!drawing) {
      throw new NotFoundException('Drawing not found');
    }
    return drawing;
  }

  private async requireCategoryContext(
    tournamentId: string,
    categoryId: string,
  ) {
    const tournament = await this.drawings.findActiveTournament(tournamentId);
    if (!tournament) {
      throw new NotFoundException('Tournament not found');
    }

    const category = await this.drawings.findActiveCategory(
      tournamentId,
      categoryId,
    );
    if (!category) {
      throw new NotFoundException('Category not found');
    }

    return { tournament, category };
  }
}
