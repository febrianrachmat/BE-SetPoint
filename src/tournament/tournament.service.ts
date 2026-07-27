import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PublishState, Tournament, TournamentStatus } from '@prisma/client';
import { AuthUserView } from '../auth/types/auth-user.type';
import {
  DOMAIN_EVENT_PUBLISHER,
  DomainEventPublisher,
} from '../common/events/domain-event.publisher';
import { CreateTournamentDto } from './dto/create-tournament.dto';
import { ListTournamentsQueryDto } from './dto/list-tournaments.query.dto';
import { UpdateTournamentDto } from './dto/update-tournament.dto';
import { TournamentEvents } from './tournament.events';
import { getNextTournamentStatus } from './tournament.lifecycle';
import { TournamentRepository } from './tournament.repository';

@Injectable()
export class TournamentService {
  constructor(
    private readonly tournaments: TournamentRepository,
    @Inject(DOMAIN_EVENT_PUBLISHER)
    private readonly events: DomainEventPublisher,
  ) {}

  async list(query: ListTournamentsQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const skip = (page - 1) * pageSize;

    const [items, total] = await this.tournaments.findManyActive({
      skip,
      take: pageSize,
      search: query.search,
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

  async getById(id: string) {
    return this.requireActiveTournament(id);
  }

  async create(dto: CreateTournamentDto, user: AuthUserView) {
    this.assertDateOrder(dto);

    try {
      const tournament = await this.tournaments.create({
        ...dto,
        createdBy: user.id,
      });

      await this.publishTournamentEvent(
        TournamentEvents.Created,
        tournament,
        user.id,
      );
      return tournament;
    } catch (error) {
      this.rethrowUniqueConflict(error);
      throw error;
    }
  }

  async update(id: string, dto: UpdateTournamentDto, user: AuthUserView) {
    const tournament = await this.requireActiveTournament(id);

    if (
      tournament.status === TournamentStatus.archived ||
      tournament.status === TournamentStatus.finished
    ) {
      throw new BadRequestException(
        `Tournament in status '${tournament.status}' cannot be updated`,
      );
    }

    this.assertDateOrder({
      registrationOpenAt:
        dto.registrationOpenAt !== undefined
          ? dto.registrationOpenAt
          : tournament.registrationOpenAt,
      registrationCloseAt:
        dto.registrationCloseAt !== undefined
          ? dto.registrationCloseAt
          : tournament.registrationCloseAt,
      startAt: dto.startAt !== undefined ? dto.startAt : tournament.startAt,
      endAt: dto.endAt !== undefined ? dto.endAt : tournament.endAt,
    });

    try {
      const updated = await this.tournaments.update(id, {
        ...dto,
        updatedBy: user.id,
      });

      await this.publishTournamentEvent(
        TournamentEvents.Updated,
        updated,
        user.id,
      );
      return updated;
    } catch (error) {
      this.rethrowUniqueConflict(error);
      throw error;
    }
  }

  async softDelete(id: string, user: AuthUserView) {
    const tournament = await this.requireActiveTournament(id);

    if (
      tournament.status !== TournamentStatus.draft &&
      tournament.status !== TournamentStatus.setup
    ) {
      throw new BadRequestException(
        'Only Draft or Setup tournaments can be soft-deleted',
      );
    }

    const deleted = await this.tournaments.softDelete(id, user.id);
    await this.publishTournamentEvent(
      TournamentEvents.SoftDeleted,
      deleted,
      user.id,
    );
    return deleted;
  }

  async moveToSetup(id: string, user: AuthUserView) {
    return this.transition(
      id,
      TournamentStatus.setup,
      user,
      TournamentEvents.MovedToSetup,
      (tournament) => {
        if (!tournament.name || tournament.name.trim().length < 3) {
          throw new BadRequestException(
            'Tournament name is required before moving to Setup',
          );
        }
      },
    );
  }

  async publish(id: string, user: AuthUserView) {
    return this.transition(
      id,
      TournamentStatus.published,
      user,
      TournamentEvents.Published,
      async (tournament) => {
        const categoryCount = await this.tournaments.countActiveCategories(
          tournament.id,
        );
        if (categoryCount < 1) {
          throw new BadRequestException(
            'At least one Category is required before publishing',
          );
        }
      },
      {
        publishState: PublishState.published,
        publishedAt: new Date(),
        publishedBy: user.id,
      },
    );
  }

  async goLive(id: string, user: AuthUserView) {
    return this.transition(
      id,
      TournamentStatus.live,
      user,
      TournamentEvents.WentLive,
    );
  }

  async finish(id: string, user: AuthUserView) {
    // Full champion/category closure checks are deferred until Playoff module exists.
    return this.transition(
      id,
      TournamentStatus.finished,
      user,
      TournamentEvents.Finished,
    );
  }

  async archive(id: string, user: AuthUserView) {
    return this.transition(
      id,
      TournamentStatus.archived,
      user,
      TournamentEvents.Archived,
    );
  }

  private async transition(
    id: string,
    target: TournamentStatus,
    user: AuthUserView,
    eventName: string,
    guard?: (tournament: Tournament) => void | Promise<void>,
    extras: {
      publishState?: PublishState;
      publishedAt?: Date | null;
      publishedBy?: string | null;
    } = {},
  ) {
    const tournament = await this.requireActiveTournament(id);
    const expected = getNextTournamentStatus(tournament.status);

    if (expected !== target) {
      throw new BadRequestException(
        `Invalid lifecycle transition from '${tournament.status}' to '${target}'`,
      );
    }

    if (guard) {
      await guard(tournament);
    }

    const updated = await this.tournaments.transitionStatus(id, target, {
      updatedBy: user.id,
      ...extras,
    });

    await this.publishTournamentEvent(eventName, updated, user.id, {
      fromStatus: tournament.status,
      toStatus: target,
    });

    return updated;
  }

  private async publishTournamentEvent(
    name: string,
    tournament: Tournament,
    actorId: string,
    extra: Record<string, unknown> = {},
  ) {
    await this.events.publish({
      name,
      occurredAt: new Date().toISOString(),
      payload: {
        tournamentId: tournament.id,
        name: tournament.name,
        status: tournament.status,
        actorId,
        ...extra,
      },
    });
  }

  private async requireActiveTournament(id: string) {
    const tournament = await this.tournaments.findActiveById(id);
    if (!tournament) {
      throw new NotFoundException('Tournament not found');
    }
    return tournament;
  }

  private assertDateOrder(input: {
    registrationOpenAt?: Date | null;
    registrationCloseAt?: Date | null;
    startAt?: Date | null;
    endAt?: Date | null;
  }) {
    if (
      input.registrationOpenAt &&
      input.registrationCloseAt &&
      input.registrationOpenAt > input.registrationCloseAt
    ) {
      throw new BadRequestException(
        'registrationOpenAt must be before or equal to registrationCloseAt',
      );
    }

    if (input.startAt && input.endAt && input.startAt > input.endAt) {
      throw new BadRequestException(
        'startAt must be before or equal to endAt',
      );
    }
  }

  private rethrowUniqueConflict(error: unknown): void {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: string }).code === 'P2002'
    ) {
      throw new ConflictException('Tournament name already exists');
    }
  }
}
