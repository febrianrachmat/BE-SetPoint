import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  EligibilityStatus,
  TeamStatus,
  TournamentStatus,
} from '@prisma/client';
import { AuthUserView } from '../../auth/types/auth-user.type';
import {
  DOMAIN_EVENT_PUBLISHER,
  DomainEventPublisher,
} from '../../common/events/domain-event.publisher';
import {
  extractTeamSize,
  normalizePlayerName,
  REGISTRATION_OPEN_TOURNAMENT_STATUSES,
} from '../category-registration.rules';
import { CategoryService } from '../category.service';
import { CreateTeamDto } from './dto/create-team.dto';
import { ListTeamsQueryDto } from './dto/list-teams.query.dto';
import { UpdateTeamDto } from './dto/update-team.dto';
import { WithdrawTeamDto } from './dto/withdraw-team.dto';
import { TeamEvents } from './team.events';
import { TeamRepository } from './team.repository';

@Injectable()
export class TeamService {
  constructor(
    private readonly teams: TeamRepository,
    private readonly categories: CategoryService,
    @Inject(DOMAIN_EVENT_PUBLISHER)
    private readonly events: DomainEventPublisher,
  ) {}

  async list(
    tournamentId: string,
    categoryId: string,
    query: ListTeamsQueryDto,
  ) {
    await this.categories.requireCategoryInTournament(
      tournamentId,
      categoryId,
    );

    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const skip = (page - 1) * pageSize;

    const [items, total] = await this.teams.findManyActive({
      categoryId,
      skip,
      take: pageSize,
      search: query.search,
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

  async getById(tournamentId: string, categoryId: string, teamId: string) {
    await this.categories.requireCategoryInTournament(
      tournamentId,
      categoryId,
    );
    return this.requireTeamInCategory(categoryId, teamId);
  }

  async create(
    tournamentId: string,
    categoryId: string,
    dto: CreateTeamDto,
    user: AuthUserView,
  ) {
    const category = await this.categories.requireCategoryInTournament(
      tournamentId,
      categoryId,
    );
    const tournament = await this.categories.requireActiveTournament(
      tournamentId,
    );
    this.assertRegistrationWindow(tournament.status);
    await this.assertDrawingAllowsRegistration(categoryId);

    if (dto.players?.length) {
      await this.assertNoDuplicatePlayersInCategory(
        categoryId,
        dto.players.map((player) => player.displayName),
      );
    }

    try {
      let team = await this.teams.create({
        categoryId,
        name: dto.name,
        createdBy: user.id,
        players: dto.players,
      });

      team = await this.recomputeEligibility(
        team.id,
        category.configuration,
        user.id,
      );

      await this.events.publish({
        name: TeamEvents.Registered,
        occurredAt: new Date().toISOString(),
        payload: {
          teamId: team.id,
          categoryId,
          tournamentId,
          name: team.name,
          eligibilityStatus: team.eligibilityStatus,
          actorId: user.id,
        },
      });

      return team;
    } catch (error) {
      this.rethrowUniqueConflict(error);
      throw error;
    }
  }

  async update(
    tournamentId: string,
    categoryId: string,
    teamId: string,
    dto: UpdateTeamDto,
    user: AuthUserView,
  ) {
    const tournament = await this.categories.requireActiveTournament(
      tournamentId,
    );
    await this.categories.requireCategoryInTournament(
      tournamentId,
      categoryId,
    );
    const team = await this.requireTeamInCategory(categoryId, teamId);

    if (team.status === TeamStatus.withdrawn || team.withdrawalFlag) {
      throw new BadRequestException('Withdrawn team cannot be updated');
    }

    this.assertRegistrationWindow(tournament.status);
    await this.assertDrawingAllowsRegistration(categoryId);

    try {
      const updated = await this.teams.update(teamId, {
        ...dto,
        updatedBy: user.id,
      });

      await this.events.publish({
        name: TeamEvents.Updated,
        occurredAt: new Date().toISOString(),
        payload: {
          teamId: updated.id,
          categoryId,
          tournamentId,
          name: updated.name,
          actorId: user.id,
        },
      });

      return updated;
    } catch (error) {
      this.rethrowUniqueConflict(error);
      throw error;
    }
  }

  async softDelete(
    tournamentId: string,
    categoryId: string,
    teamId: string,
    user: AuthUserView,
  ) {
    await this.categories.requireCategoryInTournament(
      tournamentId,
      categoryId,
    );
    await this.requireTeamInCategory(categoryId, teamId);

    const blocked = await this.teams.isDrawingPublishedOrLocked(categoryId);
    if (blocked) {
      throw new BadRequestException(
        'Team cannot be removed after Drawing is published or locked; withdraw instead (TEAM-06)',
      );
    }

    const deleted = await this.teams.softDelete(teamId, user.id);
    await this.events.publish({
      name: TeamEvents.SoftDeleted,
      occurredAt: new Date().toISOString(),
      payload: {
        teamId: deleted.id,
        categoryId,
        tournamentId,
        name: deleted.name,
        actorId: user.id,
      },
    });
    return deleted;
  }

  async withdraw(
    tournamentId: string,
    categoryId: string,
    teamId: string,
    dto: WithdrawTeamDto,
    user: AuthUserView,
  ) {
    await this.categories.requireCategoryInTournament(
      tournamentId,
      categoryId,
    );
    const team = await this.requireTeamInCategory(categoryId, teamId);

    if (team.status === TeamStatus.withdrawn || team.withdrawalFlag) {
      throw new BadRequestException('Team is already withdrawn');
    }

    const locked = await this.teams.isDrawingLocked(categoryId);
    if (locked) {
      throw new BadRequestException(
        'Team withdrawal is forbidden while Drawing is locked; Unlock required (LOCK-04/07)',
      );
    }

    const withdrawn = await this.teams.withdraw(teamId, dto.reason, user.id);
    await this.events.publish({
      name: TeamEvents.Withdrawn,
      occurredAt: new Date().toISOString(),
      payload: {
        teamId: withdrawn.id,
        categoryId,
        tournamentId,
        name: withdrawn.name,
        reason: dto.reason,
        actorId: user.id,
      },
    });
    return withdrawn;
  }

  async recomputeEligibility(
    teamId: string,
    configuration: unknown,
    actorId?: string,
  ) {
    const team = await this.teams.findActiveById(teamId);
    if (!team) {
      throw new NotFoundException('Team not found');
    }

    const previous = team.eligibilityStatus;
    const teamSize = extractTeamSize(configuration);
    const activePlayers = await this.teams.countActivePlayers(teamId);

    let next: EligibilityStatus = EligibilityStatus.ineligible;
    if (
      !team.withdrawalFlag &&
      team.status === TeamStatus.active &&
      teamSize !== null &&
      activePlayers === teamSize
    ) {
      next = EligibilityStatus.eligible;
    }

    if (previous === next) {
      return team;
    }

    const updated = await this.teams.updateEligibility(teamId, next, actorId);
    await this.events.publish({
      name: TeamEvents.EligibilityChanged,
      occurredAt: new Date().toISOString(),
      payload: {
        teamId,
        categoryId: team.categoryId,
        from: previous,
        to: next,
        activePlayers,
        teamSize,
        actorId,
      },
    });
    return updated;
  }

  async assertNoDuplicatePlayersInCategory(
    categoryId: string,
    displayNames: string[],
    excludePlayerId?: string,
  ) {
    const existing = await this.teams.findCategoryPlayerNames(
      categoryId,
      excludePlayerId,
    );
    const taken = new Set(
      existing.map((player) => normalizePlayerName(player.displayName)),
    );

    for (const displayName of displayNames) {
      const normalized = normalizePlayerName(displayName);
      if (taken.has(normalized)) {
        throw new ConflictException(
          `Player '${displayName}' is already assigned in this category (TEAM-05)`,
        );
      }
      taken.add(normalized);
    }
  }

  async assertDrawingAllowsRegistration(categoryId: string) {
    const blocked = await this.teams.isDrawingPublishedOrLocked(categoryId);
    if (blocked) {
      throw new BadRequestException(
        'Registration is closed after Drawing is published or locked (TEAM-02)',
      );
    }
  }

  assertRegistrationWindow(status: TournamentStatus) {
    if (!REGISTRATION_OPEN_TOURNAMENT_STATUSES.includes(status)) {
      throw new BadRequestException(
        `Team registration is not allowed while tournament is '${status}'`,
      );
    }
  }

  async requireTeamInCategory(categoryId: string, teamId: string) {
    const team = await this.teams.findActiveInCategory(categoryId, teamId);
    if (!team) {
      throw new NotFoundException('Team not found');
    }
    return team;
  }

  private rethrowUniqueConflict(error: unknown): void {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: string }).code === 'P2002'
    ) {
      const target = (error as { meta?: { target?: string[] } }).meta?.target;
      if (target?.some((field) => field.includes('seed_rank'))) {
        throw new ConflictException(
          'seedRank already used by another team in this category',
        );
      }
      throw new ConflictException(
        'Team name already exists in this category',
      );
    }
  }
}
