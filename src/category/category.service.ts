import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Category,
  LockState,
  Prisma,
  Tournament,
  TournamentStatus,
} from '@prisma/client';
import { AuthUserView } from '../auth/types/auth-user.type';
import {
  DOMAIN_EVENT_PUBLISHER,
  DomainEventPublisher,
} from '../common/events/domain-event.publisher';
import { CATEGORY_MUTABLE_TOURNAMENT_STATUSES } from './category-registration.rules';
import { CategoryEvents } from './category.events';
import { CategoryRepository } from './category.repository';
import { CreateCategoryDto } from './dto/create-category.dto';
import { ListCategoriesQueryDto } from './dto/list-categories.query.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@Injectable()
export class CategoryService {
  constructor(
    private readonly categories: CategoryRepository,
    @Inject(DOMAIN_EVENT_PUBLISHER)
    private readonly events: DomainEventPublisher,
  ) {}

  async list(tournamentId: string, query: ListCategoriesQueryDto) {
    await this.requireActiveTournament(tournamentId);

    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const skip = (page - 1) * pageSize;

    const [items, total] = await this.categories.findManyActive({
      tournamentId,
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

  async getById(tournamentId: string, categoryId: string) {
    return this.requireCategoryInTournament(tournamentId, categoryId);
  }

  async create(
    tournamentId: string,
    dto: CreateCategoryDto,
    user: AuthUserView,
  ) {
    const tournament = await this.requireActiveTournament(tournamentId);
    this.assertTournamentAllowsCategoryMutation(tournament);

    try {
      const category = await this.categories.create({
        tournamentId,
        name: dto.name,
        format: dto.format,
        visibility: dto.visibility,
        configuration: dto.configuration as Prisma.InputJsonValue | undefined,
        createdBy: user.id,
      });

      await this.publishCategoryEvent(
        CategoryEvents.Created,
        category,
        user.id,
      );
      return category;
    } catch (error) {
      this.rethrowUniqueConflict(error);
      throw error;
    }
  }

  async update(
    tournamentId: string,
    categoryId: string,
    dto: UpdateCategoryDto,
    user: AuthUserView,
  ) {
    const tournament = await this.requireActiveTournament(tournamentId);
    this.assertTournamentAllowsCategoryMutation(tournament);

    const category = await this.requireCategoryInTournament(
      tournamentId,
      categoryId,
    );

    if (category.lockState === LockState.locked) {
      throw new BadRequestException(
        'Locked category cannot be updated (CAT-04)',
      );
    }

    const touchesStructure =
      dto.name !== undefined ||
      dto.format !== undefined ||
      dto.configuration !== undefined;

    if (touchesStructure) {
      await this.assertNoBlockingArtifacts(categoryId);
    }

    try {
      const updated = await this.categories.update(categoryId, {
        ...dto,
        configuration:
          dto.configuration === null
            ? Prisma.DbNull
            : (dto.configuration as Prisma.InputJsonValue | undefined),
        updatedBy: user.id,
      });

      await this.publishCategoryEvent(
        CategoryEvents.Updated,
        updated,
        user.id,
      );
      return updated;
    } catch (error) {
      this.rethrowUniqueConflict(error);
      throw error;
    }
  }

  async softDelete(
    tournamentId: string,
    categoryId: string,
    user: AuthUserView,
  ) {
    await this.requireActiveTournament(tournamentId);
    await this.requireCategoryInTournament(tournamentId, categoryId);
    await this.assertDeletable(categoryId);

    const deleted = await this.categories.softDelete(categoryId, user.id);
    await this.publishCategoryEvent(
      CategoryEvents.SoftDeleted,
      deleted,
      user.id,
    );
    return deleted;
  }

  async requireCategoryInTournament(tournamentId: string, categoryId: string) {
    const category = await this.categories.findActiveInTournament(
      tournamentId,
      categoryId,
    );
    if (!category) {
      throw new NotFoundException('Category not found');
    }
    return category;
  }

  async requireActiveTournament(tournamentId: string): Promise<Tournament> {
    const tournament =
      await this.categories.findActiveTournamentById(tournamentId);
    if (!tournament) {
      throw new NotFoundException('Tournament not found');
    }
    return tournament;
  }

  assertTournamentAllowsCategoryMutation(tournament: Tournament) {
    if (
      !CATEGORY_MUTABLE_TOURNAMENT_STATUSES.includes(tournament.status)
    ) {
      throw new BadRequestException(
        `Categories cannot be changed while tournament is '${tournament.status}'`,
      );
    }
  }

  assertTournamentAllowsRegistration(tournament: Tournament) {
    if (
      tournament.status === TournamentStatus.finished ||
      tournament.status === TournamentStatus.archived
    ) {
      throw new BadRequestException(
        `Registration is closed while tournament is '${tournament.status}'`,
      );
    }
  }

  private async assertDeletable(categoryId: string) {
    await this.assertNoBlockingArtifacts(categoryId);

    const verifiedCount =
      await this.categories.countVerifiedMatches(categoryId);
    if (verifiedCount > 0) {
      throw new BadRequestException(
        'Category with verified match history cannot be deleted (CAT-05)',
      );
    }
  }

  private async assertNoBlockingArtifacts(categoryId: string) {
    const blocking =
      await this.categories.hasBlockingCompetitionArtifact(categoryId);
    if (blocking) {
      throw new BadRequestException(
        'Category has published or locked competition artifacts (CAT-04/CAT-05)',
      );
    }
  }

  private async publishCategoryEvent(
    name: string,
    category: Category,
    actorId: string,
  ) {
    await this.events.publish({
      name,
      occurredAt: new Date().toISOString(),
      payload: {
        categoryId: category.id,
        tournamentId: category.tournamentId,
        name: category.name,
        format: category.format,
        actorId,
      },
    });
  }

  private rethrowUniqueConflict(error: unknown): void {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: string }).code === 'P2002'
    ) {
      throw new ConflictException(
        'Category name already exists in this tournament',
      );
    }
  }
}
