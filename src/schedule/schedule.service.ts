import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ConflictStatus,
  MatchStatus,
  TeamStatus,
  VersionStatus,
} from '@prisma/client';
import { AuthUserView } from '../auth/types/auth-user.type';
import {
  DOMAIN_EVENT_PUBLISHER,
  DomainEventPublisher,
} from '../common/events/domain-event.publisher';
import { resolveCompetitionMode } from '../category/competition-mode';
import { DrawingService } from '../drawing/drawing.service';
import { GenerateScheduleDto } from './dto/generate-schedule.dto';
import { ReviewScheduleVersionDto } from './dto/review-schedule-version.dto';
import { UpdateScheduleEntryDto } from './dto/update-schedule-entry.dto';
import { assertNoScheduleConflicts } from './engine/schedule-assigner';
import { generateSchedulePlan } from './engine/schedule-generator';
import { ScheduleEvents } from './schedule.events';
import {
  isLiveReady,
  SCHEDULE_PUBLISH_TOURNAMENT_STATUSES,
} from './schedule.lifecycle';
import { ScheduleRepository } from './schedule.repository';

const DEFAULT_SLOT_MINUTES = 90;

@Injectable()
export class ScheduleService {
  constructor(
    private readonly schedules: ScheduleRepository,
    private readonly drawings: DrawingService,
    @Inject(DOMAIN_EVENT_PUBLISHER)
    private readonly events: DomainEventPublisher,
  ) {}

  async getSchedule(tournamentId: string, categoryId: string) {
    await this.requireCategoryContext(tournamentId, categoryId);
    const schedule = await this.schedules.findScheduleByCategory(categoryId);
    if (!schedule) {
      throw new NotFoundException('Schedule not found');
    }
    return schedule;
  }

  async getOfficialVersion(tournamentId: string, categoryId: string) {
    const schedule = await this.getSchedule(tournamentId, categoryId);
    if (!schedule.currentOfficialVersionId) {
      throw new NotFoundException('No official Schedule version');
    }
    return this.getVersion(
      tournamentId,
      categoryId,
      schedule.currentOfficialVersionId,
    );
  }

  async listVersions(tournamentId: string, categoryId: string) {
    await this.requireCategoryContext(tournamentId, categoryId);
    const schedule = await this.schedules.findScheduleByCategory(categoryId);
    if (!schedule) {
      return { items: [], currentOfficialVersionId: null };
    }
    const items = await this.schedules.listVersions(schedule.id);
    return {
      items,
      currentOfficialVersionId: schedule.currentOfficialVersionId,
      publishState: schedule.publishState,
      reviewStatus: schedule.reviewStatus,
      lockState: schedule.lockState,
    };
  }

  async getVersion(
    tournamentId: string,
    categoryId: string,
    versionId: string,
  ) {
    await this.requireCategoryContext(tournamentId, categoryId);
    const version = await this.schedules.findVersionDetail(versionId);
    if (!version || version.schedule.categoryId !== categoryId) {
      throw new NotFoundException('Schedule version not found');
    }
    return version;
  }

  async generate(
    tournamentId: string,
    categoryId: string,
    dto: GenerateScheduleDto,
    user: AuthUserView,
  ) {
    const { tournament, category } = await this.requireCategoryContext(
      tournamentId,
      categoryId,
    );

    if (resolveCompetitionMode(category.configuration) === 'knockout_only') {
      throw new BadRequestException(
        'Schedule is not used for knockout_only categories; generate Playoff directly',
      );
    }

    const drawing = await this.drawings.assertScheduleReady(
      tournamentId,
      categoryId,
    );

    let schedule = await this.schedules.findScheduleByCategory(categoryId);
    if (!schedule) {
      const created = await this.schedules.createSchedule(categoryId, user.id);
      await this.events.publish({
        name: ScheduleEvents.Ensured,
        occurredAt: new Date().toISOString(),
        payload: {
          scheduleId: created.id,
          categoryId,
          tournamentId,
          actorId: user.id,
        },
      });
      schedule = await this.schedules.findScheduleByCategory(categoryId);
      if (!schedule) {
        throw new NotFoundException('Schedule not found after create');
      }
    }

    if (this.schedules.isLocked(schedule.lockState)) {
      throw new BadRequestException(
        'Schedule is locked; regeneration is forbidden (SCH-11)',
      );
    }

    const availableCourts =
      await this.schedules.findAvailableCourts(tournamentId);
    if (availableCourts.length < 1) {
      throw new BadRequestException(
        'At least one available Court is required (SCH-02)',
      );
    }

    let courts = availableCourts;
    if (dto.courtIds && dto.courtIds.length > 0) {
      const allowed = new Set(dto.courtIds);
      courts = availableCourts.filter((court) => allowed.has(court.id));
      if (courts.length < 1) {
        throw new BadRequestException(
          'None of the selected courts are available for this tournament',
        );
      }
      const missing = dto.courtIds.filter(
        (id) => !availableCourts.some((court) => court.id === id),
      );
      if (missing.length > 0) {
        throw new BadRequestException(
          `Unknown or unavailable court id(s): ${missing.join(', ')}`,
        );
      }
      // Preserve admin selection order for stable group→court mapping
      const byId = new Map(courts.map((court) => [court.id, court]));
      courts = dto.courtIds
        .map((id) => byId.get(id))
        .filter((court): court is (typeof availableCourts)[number] =>
          Boolean(court),
        );
    }

    const groups = await this.schedules.findOfficialDrawingGroups(
      drawing.currentOfficialVersionId!,
    );
    if (groups.length < 1) {
      throw new BadRequestException(
        'Official Drawing has no Groups to schedule',
      );
    }

    const groupInputs = groups.map((group) => {
      const activeTeams = group.members
        .filter(
          (member) =>
            member.team.status === TeamStatus.active &&
            !member.team.withdrawalFlag,
        )
        .map((member) => member.team.id);

      return {
        groupId: group.id,
        teamIds: activeTeams,
      };
    });

    const startAt =
      dto.startAt ??
      tournament.startAt ??
      category.publishedAt ??
      new Date();

    let plan;
    try {
      plan = generateSchedulePlan({
        groups: groupInputs,
        courts: courts.map((court) => ({ id: court.id })),
        startAt,
        matchDurationMinutes: dto.matchDurationMinutes,
        restBufferMinutes: dto.restBufferMinutes,
        strategy: dto.strategy,
      });
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error ? error.message : 'Schedule generation failed',
      );
    }

    const versionNumber = await this.schedules.nextVersionNumber(schedule.id);
    const version = await this.schedules.persistGeneratedVersion({
      scheduleId: schedule.id,
      categoryId,
      versionNumber,
      matches: plan.matches,
      conflictStatus: ConflictStatus.clear,
      createdBy: user.id,
    });

    await this.events.publish({
      name: ScheduleEvents.VersionGenerated,
      occurredAt: new Date().toISOString(),
      payload: {
        tournamentId,
        categoryId,
        scheduleId: schedule.id,
        scheduleVersionId: version!.id,
        versionNumber,
        drawingVersionId: drawing.currentOfficialVersionId,
        matchCount: plan.matches.length,
        courtCount: courts.length,
        courtIds: courts.map((court) => court.id),
        matchDurationMinutes: plan.matchDurationMinutes,
        restBufferMinutes: plan.restBufferMinutes,
        strategy: plan.strategy,
        conflictStatus: plan.conflictStatus,
        actorId: user.id,
      },
    });

    return version;
  }

  async reviewVersion(
    tournamentId: string,
    categoryId: string,
    versionId: string,
    dto: ReviewScheduleVersionDto,
    user: AuthUserView,
  ) {
    await this.requireCategoryContext(tournamentId, categoryId);
    const schedule = await this.requireSchedule(categoryId);

    if (this.schedules.isLocked(schedule.lockState)) {
      throw new BadRequestException(
        'Schedule is locked; review is forbidden',
      );
    }

    const version = await this.schedules.findVersionForSchedule(
      schedule.id,
      versionId,
    );
    if (!version) {
      throw new NotFoundException('Schedule version not found');
    }

    if (version.versionStatus === VersionStatus.historical) {
      throw new BadRequestException(
        'Historical Schedule versions cannot be reviewed',
      );
    }

    if (
      version.officialFlag ||
      version.versionStatus === VersionStatus.official
    ) {
      throw new BadRequestException(
        'Official Schedule version is already published; generate a new candidate to change the plan',
      );
    }

    if (
      dto.outcome === 'approved' &&
      version.conflictStatus === ConflictStatus.conflict
    ) {
      throw new BadRequestException(
        'Schedule version with conflicts cannot be approved until resolved',
      );
    }

    const reviewed = await this.schedules.reviewVersion({
      scheduleId: schedule.id,
      versionId,
      outcome: dto.outcome,
      updatedBy: user.id,
    });

    await this.events.publish({
      name: ScheduleEvents.VersionReviewed,
      occurredAt: new Date().toISOString(),
      payload: {
        tournamentId,
        categoryId,
        scheduleId: schedule.id,
        scheduleVersionId: versionId,
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
    const schedule = await this.requireSchedule(categoryId);

    if (!SCHEDULE_PUBLISH_TOURNAMENT_STATUSES.includes(tournament.status)) {
      throw new BadRequestException(
        `Schedule publish is not allowed while tournament is '${tournament.status}'`,
      );
    }

    if (this.schedules.isLocked(schedule.lockState)) {
      throw new BadRequestException(
        'Schedule is locked; publish is forbidden',
      );
    }

    const version = await this.schedules.findVersionForSchedule(
      schedule.id,
      versionId,
    );
    if (!version) {
      throw new NotFoundException('Schedule version not found');
    }

    if (version.versionStatus === VersionStatus.historical) {
      throw new BadRequestException(
        'Historical Schedule versions cannot be published',
      );
    }

    if (
      version.officialFlag &&
      version.versionStatus === VersionStatus.official
    ) {
      throw new BadRequestException('Schedule version is already official');
    }

    if (version.conflictStatus === ConflictStatus.conflict) {
      throw new BadRequestException(
        'Conflicting Schedule cannot be Published',
      );
    }

    if (version.reviewOutcome !== 'approved') {
      throw new BadRequestException(
        'Schedule version must be Review-approved before Publish (SCH-07 / REV-02)',
      );
    }

    const previousOfficialVersionId = schedule.currentOfficialVersionId;

    const published = await this.schedules.publishVersion({
      scheduleId: schedule.id,
      versionId,
      previousOfficialVersionId,
      publishedBy: user.id,
    });

    await this.events.publish({
      name: ScheduleEvents.Published,
      occurredAt: new Date().toISOString(),
      payload: {
        tournamentId,
        categoryId,
        scheduleId: schedule.id,
        scheduleVersionId: versionId,
        versionNumber: version.versionNumber,
        previousOfficialVersionId,
        actorId: user.id,
      },
    });

    return published;
  }

  async lock(tournamentId: string, categoryId: string, user: AuthUserView) {
    await this.requireCategoryContext(tournamentId, categoryId);
    const schedule = await this.requireSchedule(categoryId);

    if (this.schedules.isLocked(schedule.lockState)) {
      throw new BadRequestException('Schedule is already locked');
    }

    if (
      schedule.publishState !== 'published' ||
      !schedule.currentOfficialVersionId
    ) {
      throw new BadRequestException(
        'Schedule must be Published with an Official version before Lock (PUB-08)',
      );
    }

    const locked = await this.schedules.lockSchedule({
      scheduleId: schedule.id,
      lockedBy: user.id,
    });

    await this.events.publish({
      name: ScheduleEvents.Locked,
      occurredAt: new Date().toISOString(),
      payload: {
        tournamentId,
        categoryId,
        scheduleId: schedule.id,
        officialVersionId: schedule.currentOfficialVersionId,
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
    const schedule = await this.requireSchedule(categoryId);

    if (!this.schedules.isLocked(schedule.lockState)) {
      throw new BadRequestException('Schedule is not locked');
    }

    const unlocked = await this.schedules.unlockSchedule({
      scheduleId: schedule.id,
      reason,
      unlockedBy: user.id,
    });

    await this.events.publish({
      name: ScheduleEvents.Unlocked,
      occurredAt: new Date().toISOString(),
      payload: {
        tournamentId,
        categoryId,
        scheduleId: schedule.id,
        reason,
        actorId: user.id,
      },
    });

    return unlocked;
  }

  /**
   * Manual reschedule of one entry while Schedule is unlocked (SCH-08).
   * Updates ScheduleEntry + Match.scheduledStartAt and re-checks SCH-05/06.
   */
  async updateEntry(
    tournamentId: string,
    categoryId: string,
    versionId: string,
    entryId: string,
    dto: UpdateScheduleEntryDto,
    user: AuthUserView,
  ) {
    await this.requireCategoryContext(tournamentId, categoryId);
    const schedule = await this.requireSchedule(categoryId);

    if (this.schedules.isLocked(schedule.lockState)) {
      throw new BadRequestException(
        'Schedule is locked; unlock before rescheduling entries (SCH-08 / SCH-11)',
      );
    }

    const version = await this.schedules.findVersionForSchedule(
      schedule.id,
      versionId,
    );
    if (!version) {
      throw new NotFoundException('Schedule version not found');
    }

    if (version.versionStatus === VersionStatus.historical) {
      throw new BadRequestException(
        'Historical Schedule versions cannot be edited',
      );
    }

    const entry = await this.schedules.findEntryInVersion(versionId, entryId);
    if (!entry) {
      throw new NotFoundException('Schedule entry not found');
    }

    if (
      entry.match.status !== MatchStatus.waiting &&
      entry.match.status !== MatchStatus.warm_up
    ) {
      throw new BadRequestException(
        `Cannot reschedule match in status '${entry.match.status}'`,
      );
    }

    const startAt = dto.scheduledStartAt;
    let endAt = dto.scheduledEndAt;
    if (!endAt) {
      const previousDurationMs =
        entry.scheduledEndAt != null
          ? entry.scheduledEndAt.getTime() - entry.scheduledStartAt.getTime()
          : DEFAULT_SLOT_MINUTES * 60_000;
      const durationMs =
        previousDurationMs > 0
          ? previousDurationMs
          : DEFAULT_SLOT_MINUTES * 60_000;
      endAt = new Date(startAt.getTime() + durationMs);
    }

    if (!(endAt > startAt)) {
      throw new BadRequestException(
        'scheduledEndAt must be after scheduledStartAt',
      );
    }

    const siblings = await this.schedules.listEntriesForConflictCheck(versionId);
    const slots = siblings.map((row) => {
      const isTarget = row.id === entryId;
      const teamA =
        row.match.participations.find((p) => p.sideLabel === 'A')?.teamId ??
        row.match.participations[0]?.teamId;
      const teamB =
        row.match.participations.find((p) => p.sideLabel === 'B')?.teamId ??
        row.match.participations[1]?.teamId;
      if (!teamA || !teamB) {
        throw new BadRequestException(
          'Schedule entry is missing team participations',
        );
      }
      return {
        courtId: row.courtId,
        teamAId: teamA,
        teamBId: teamB,
        scheduledStartAt: isTarget ? startAt : row.scheduledStartAt,
        scheduledEndAt: isTarget
          ? endAt
          : (row.scheduledEndAt ??
            new Date(
              row.scheduledStartAt.getTime() + DEFAULT_SLOT_MINUTES * 60_000,
            )),
      };
    });

    try {
      assertNoScheduleConflicts(slots);
    } catch (err) {
      throw new BadRequestException(
        err instanceof Error ? err.message : 'Schedule conflict detected',
      );
    }

    const updated = await this.schedules.updateEntrySchedule({
      entryId,
      matchId: entry.matchId,
      scheduledStartAt: startAt,
      scheduledEndAt: endAt,
      updatedBy: user.id,
    });

    await this.events.publish({
      name: ScheduleEvents.EntryRescheduled,
      occurredAt: new Date().toISOString(),
      payload: {
        tournamentId,
        categoryId,
        scheduleId: schedule.id,
        scheduleVersionId: versionId,
        entryId,
        matchId: entry.matchId,
        scheduledStartAt: startAt.toISOString(),
        scheduledEndAt: endAt.toISOString(),
        actorId: user.id,
      },
    });

    return updated;
  }

  /**
   * Step 8 gate: Schedule must be Published + Locked with an Official version.
   * Conceptual "Live Ready" — not a persisted status field.
   */
  async assertLiveReady(tournamentId: string, categoryId: string) {
    await this.requireCategoryContext(tournamentId, categoryId);
    const schedule = await this.requireSchedule(categoryId);

    if (!isLiveReady(schedule)) {
      throw new BadRequestException(
        'Live Match operations require Schedule Published AND Locked (Live Ready)',
      );
    }

    return schedule;
  }

  private async requireSchedule(categoryId: string) {
    const schedule = await this.schedules.findScheduleByCategory(categoryId);
    if (!schedule) {
      throw new NotFoundException('Schedule not found');
    }
    return schedule;
  }

  private async requireCategoryContext(
    tournamentId: string,
    categoryId: string,
  ) {
    const tournament =
      await this.schedules.findActiveTournament(tournamentId);
    if (!tournament) {
      throw new NotFoundException('Tournament not found');
    }

    const category = await this.schedules.findActiveCategory(
      tournamentId,
      categoryId,
    );
    if (!category) {
      throw new NotFoundException('Category not found');
    }

    return { tournament, category };
  }
}
