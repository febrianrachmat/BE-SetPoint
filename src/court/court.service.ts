import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Court, CourtStatus, Tournament } from '@prisma/client';
import { AuthUserView } from '../auth/types/auth-user.type';
import {
  DOMAIN_EVENT_PUBLISHER,
  DomainEventPublisher,
} from '../common/events/domain-event.publisher';
import { CourtEvents } from './court.events';
import { CourtRepository } from './court.repository';
import { COURT_MUTABLE_TOURNAMENT_STATUSES } from './court.rules';
import { CreateCourtDto } from './dto/create-court.dto';
import { DisableCourtDto } from './dto/disable-court.dto';
import { ListCourtsQueryDto } from './dto/list-courts.query.dto';
import { ReorderCourtsDto } from './dto/reorder-courts.dto';
import { UpdateCourtDto } from './dto/update-court.dto';

@Injectable()
export class CourtService {
  constructor(
    private readonly courts: CourtRepository,
    @Inject(DOMAIN_EVENT_PUBLISHER)
    private readonly events: DomainEventPublisher,
  ) {}

  async list(tournamentId: string, query: ListCourtsQueryDto) {
    await this.requireActiveTournament(tournamentId);
    const items = await this.courts.findManyActive({
      tournamentId,
      status: query.status,
    });
    return {
      items,
      availableCount: items.filter(
        (court) => court.status === CourtStatus.available,
      ).length,
    };
  }

  async getById(tournamentId: string, courtId: string) {
    await this.requireActiveTournament(tournamentId);
    return this.requireCourt(tournamentId, courtId);
  }

  async create(
    tournamentId: string,
    dto: CreateCourtDto,
    user: AuthUserView,
  ) {
    const tournament = await this.requireActiveTournament(tournamentId);
    this.assertMutable(tournament);
    await this.assertLabelAvailable(tournamentId, dto.label);

    const court = await this.courts.create({
      tournamentId,
      name: dto.name.trim(),
      label: dto.label.trim(),
      displayOrder:
        dto.displayOrder ?? (await this.courts.nextDisplayOrder(tournamentId)),
      availabilityNotes: dto.availabilityNotes ?? null,
      createdBy: user.id,
    });

    await this.publish(CourtEvents.Created, court, user.id);
    return court;
  }

  async update(
    tournamentId: string,
    courtId: string,
    dto: UpdateCourtDto,
    user: AuthUserView,
  ) {
    const tournament = await this.requireActiveTournament(tournamentId);
    this.assertMutable(tournament);
    const court = await this.requireCourt(tournamentId, courtId);

    if (dto.label !== undefined && dto.label.trim() !== court.label) {
      await this.assertLabelAvailable(tournamentId, dto.label, courtId);
    }

    const updated = await this.courts.update(court.id, {
      name: dto.name?.trim(),
      label: dto.label?.trim(),
      displayOrder: dto.displayOrder,
      availabilityNotes:
        dto.availabilityNotes === undefined
          ? undefined
          : (dto.availabilityNotes ?? null),
      updatedBy: user.id,
    });

    await this.publish(CourtEvents.Updated, updated, user.id);
    return updated;
  }

  async enable(tournamentId: string, courtId: string, user: AuthUserView) {
    const tournament = await this.requireActiveTournament(tournamentId);
    this.assertMutable(tournament);
    const court = await this.requireCourt(tournamentId, courtId);

    if (court.status === CourtStatus.available) {
      throw new BadRequestException('Court is already available');
    }

    const updated = await this.courts.setStatus({
      courtId: court.id,
      status: CourtStatus.available,
      availabilityNotes: null,
      updatedBy: user.id,
    });

    await this.publish(CourtEvents.Enabled, updated, user.id);
    return updated;
  }

  async disable(
    tournamentId: string,
    courtId: string,
    dto: DisableCourtDto,
    user: AuthUserView,
  ) {
    const tournament = await this.requireActiveTournament(tournamentId);
    this.assertMutable(tournament);
    const court = await this.requireCourt(tournamentId, courtId);

    const target = dto.status ?? CourtStatus.unavailable;
    if (court.status === target) {
      throw new BadRequestException(`Court is already '${target}'`);
    }

    await this.assertNotOccupied(court.id);

    const updated = await this.courts.setStatus({
      courtId: court.id,
      status: target,
      availabilityNotes: dto.reason ?? null,
      updatedBy: user.id,
    });

    await this.publish(CourtEvents.Disabled, updated, user.id, {
      reason: dto.reason ?? null,
    });
    return updated;
  }

  /**
   * Takes the complete ordered list so positions stay contiguous instead of
   * accumulating gaps from partial updates.
   */
  async reorder(
    tournamentId: string,
    dto: ReorderCourtsDto,
    user: AuthUserView,
  ) {
    const tournament = await this.requireActiveTournament(tournamentId);
    this.assertMutable(tournament);

    const existing = await this.courts.findManyActive({ tournamentId });
    const existingIds = new Set(existing.map((court) => court.id));
    const requestedIds = dto.items.map((item) => item.courtId);

    if (new Set(requestedIds).size !== requestedIds.length) {
      throw new BadRequestException('Reorder contains duplicate courtId');
    }
    for (const courtId of requestedIds) {
      if (!existingIds.has(courtId)) {
        throw new BadRequestException(
          `Court ${courtId} does not belong to this tournament`,
        );
      }
    }
    if (requestedIds.length !== existing.length) {
      throw new BadRequestException(
        `Reorder must list all ${existing.length} active courts (got ${requestedIds.length})`,
      );
    }

    await this.courts.reorder({
      items: requestedIds.map((courtId, index) => ({
        courtId,
        displayOrder: index,
      })),
      updatedBy: user.id,
    });

    await this.events.publish({
      name: CourtEvents.Reordered,
      occurredAt: new Date().toISOString(),
      payload: {
        tournamentId,
        order: requestedIds,
        actorId: user.id,
      },
    });

    return this.list(tournamentId, {});
  }

  async softDelete(tournamentId: string, courtId: string, user: AuthUserView) {
    const tournament = await this.requireActiveTournament(tournamentId);
    this.assertMutable(tournament);
    const court = await this.requireCourt(tournamentId, courtId);

    await this.assertNotOccupied(court.id);
    await this.assertNotReferenced(court.id);

    const deleted = await this.courts.softDelete(court.id, user.id);
    await this.publish(CourtEvents.SoftDeleted, deleted, user.id);
    return deleted;
  }

  private async requireActiveTournament(
    tournamentId: string,
  ): Promise<Tournament> {
    const tournament = await this.courts.findActiveTournamentById(tournamentId);
    if (!tournament) {
      throw new NotFoundException('Tournament not found');
    }
    return tournament;
  }

  private async requireCourt(tournamentId: string, courtId: string) {
    const court = await this.courts.findActiveInTournament(
      tournamentId,
      courtId,
    );
    if (!court) {
      throw new NotFoundException('Court not found');
    }
    return court;
  }

  private assertMutable(tournament: Tournament) {
    if (!COURT_MUTABLE_TOURNAMENT_STATUSES.includes(tournament.status)) {
      throw new BadRequestException(
        `Courts cannot be changed while tournament is '${tournament.status}'`,
      );
    }
  }

  private async assertLabelAvailable(
    tournamentId: string,
    label: string,
    excludeCourtId?: string,
  ) {
    const duplicate = await this.courts.findByNormalizedLabel({
      tournamentId,
      label: label.trim(),
      excludeCourtId,
    });
    if (duplicate) {
      throw new ConflictException(
        `Court label '${label.trim()}' already exists in this tournament`,
      );
    }
  }

  private async assertNotOccupied(courtId: string) {
    const occupying = await this.courts.findOccupyingMatch(courtId);
    if (occupying) {
      throw new BadRequestException(
        `Court is occupied by match ${occupying.id} (${occupying.status})`,
      );
    }
  }

  private async assertNotReferenced(courtId: string) {
    const [matches, entries] = await Promise.all([
      this.courts.countMatchReferences(courtId),
      this.courts.countScheduleEntryReferences(courtId),
    ]);
    if (matches > 0 || entries > 0) {
      throw new BadRequestException(
        'Court is referenced by an existing Schedule; disable it instead of deleting',
      );
    }
  }

  private async publish(
    name: string,
    court: Court,
    actorId: string,
    extra: Record<string, unknown> = {},
  ) {
    await this.events.publish({
      name,
      occurredAt: new Date().toISOString(),
      payload: {
        courtId: court.id,
        tournamentId: court.tournamentId,
        label: court.label,
        name: court.name,
        status: court.status,
        displayOrder: court.displayOrder,
        actorId,
        ...extra,
      },
    });
  }
}
