import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Player, TeamStatus } from '@prisma/client';
import { AuthUserView } from '../../auth/types/auth-user.type';
import {
  DOMAIN_EVENT_PUBLISHER,
  DomainEventPublisher,
} from '../../common/events/domain-event.publisher';
import { CategoryService } from '../category.service';
import { TeamService } from '../team/team.service';
import { CreatePlayerDto } from './dto/create-player.dto';
import { ListPlayersQueryDto } from './dto/list-players.query.dto';
import { UpdatePlayerDto } from './dto/update-player.dto';
import { PlayerEvents } from './player.events';
import { PlayerRepository } from './player.repository';

@Injectable()
export class PlayerService {
  constructor(
    private readonly players: PlayerRepository,
    private readonly teams: TeamService,
    private readonly categories: CategoryService,
    @Inject(DOMAIN_EVENT_PUBLISHER)
    private readonly events: DomainEventPublisher,
  ) {}

  async list(
    tournamentId: string,
    categoryId: string,
    teamId: string,
    query: ListPlayersQueryDto,
  ) {
    await this.categories.requireCategoryInTournament(
      tournamentId,
      categoryId,
    );
    await this.teams.requireTeamInCategory(categoryId, teamId);

    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const skip = (page - 1) * pageSize;

    const [items, total] = await this.players.findManyActive({
      teamId,
      skip,
      take: pageSize,
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

  async getById(
    tournamentId: string,
    categoryId: string,
    teamId: string,
    playerId: string,
  ) {
    await this.categories.requireCategoryInTournament(
      tournamentId,
      categoryId,
    );
    await this.teams.requireTeamInCategory(categoryId, teamId);
    return this.requirePlayerOnTeam(teamId, playerId);
  }

  async create(
    tournamentId: string,
    categoryId: string,
    teamId: string,
    dto: CreatePlayerDto,
    user: AuthUserView,
  ) {
    const category = await this.categories.requireCategoryInTournament(
      tournamentId,
      categoryId,
    );
    const tournament =
      await this.categories.requireActiveTournament(tournamentId);
    const team = await this.teams.requireTeamInCategory(categoryId, teamId);

    if (team.status === TeamStatus.withdrawn || team.withdrawalFlag) {
      throw new BadRequestException(
        'Cannot add players to a withdrawn team',
      );
    }

    this.teams.assertRegistrationWindow(tournament.status);
    await this.teams.assertDrawingAllowsRegistration(categoryId);
    await this.teams.assertNoDuplicatePlayersInCategory(categoryId, [
      dto.displayName,
    ]);

    const player = await this.players.create({
      teamId,
      displayName: dto.displayName,
      createdBy: user.id,
    });

    await this.teams.recomputeEligibility(
      teamId,
      category.configuration,
      user.id,
    );

    await this.publishPlayerEvent(
      PlayerEvents.Created,
      player,
      tournamentId,
      categoryId,
      user.id,
    );

    return player;
  }

  async update(
    tournamentId: string,
    categoryId: string,
    teamId: string,
    playerId: string,
    dto: UpdatePlayerDto,
    user: AuthUserView,
  ) {
    const tournament =
      await this.categories.requireActiveTournament(tournamentId);
    await this.categories.requireCategoryInTournament(
      tournamentId,
      categoryId,
    );
    const team = await this.teams.requireTeamInCategory(categoryId, teamId);
    const player = await this.requirePlayerOnTeam(teamId, playerId);

    if (team.status === TeamStatus.withdrawn || team.withdrawalFlag) {
      throw new BadRequestException(
        'Cannot update players on a withdrawn team',
      );
    }

    this.teams.assertRegistrationWindow(tournament.status);
    await this.teams.assertDrawingAllowsRegistration(categoryId);

    if (dto.displayName !== undefined) {
      await this.teams.assertNoDuplicatePlayersInCategory(
        categoryId,
        [dto.displayName],
        playerId,
      );
    }

    const updated = await this.players.update(playerId, {
      ...dto,
      updatedBy: user.id,
    });

    await this.publishPlayerEvent(
      PlayerEvents.Updated,
      updated,
      tournamentId,
      categoryId,
      user.id,
    );

    return updated;
  }

  async softDelete(
    tournamentId: string,
    categoryId: string,
    teamId: string,
    playerId: string,
    user: AuthUserView,
  ) {
    const category = await this.categories.requireCategoryInTournament(
      tournamentId,
      categoryId,
    );
    await this.teams.requireTeamInCategory(categoryId, teamId);
    await this.requirePlayerOnTeam(teamId, playerId);
    await this.teams.assertDrawingAllowsRegistration(categoryId);

    const deleted = await this.players.softDelete(playerId, user.id);

    await this.teams.recomputeEligibility(
      teamId,
      category.configuration,
      user.id,
    );

    await this.publishPlayerEvent(
      PlayerEvents.SoftDeleted,
      deleted,
      tournamentId,
      categoryId,
      user.id,
    );

    return deleted;
  }

  private async requirePlayerOnTeam(teamId: string, playerId: string) {
    const player = await this.players.findActiveOnTeam(teamId, playerId);
    if (!player) {
      throw new NotFoundException('Player not found');
    }
    return player;
  }

  private async publishPlayerEvent(
    name: string,
    player: Player,
    tournamentId: string,
    categoryId: string,
    actorId: string,
  ) {
    await this.events.publish({
      name,
      occurredAt: new Date().toISOString(),
      payload: {
        playerId: player.id,
        teamId: player.teamId,
        categoryId,
        tournamentId,
        displayName: player.displayName,
        actorId,
      },
    });
  }
}
