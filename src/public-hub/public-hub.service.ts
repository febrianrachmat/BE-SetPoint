import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CategoryService } from '../category/category.service';
import { resolveCompetitionMode } from '../category/competition-mode';
import { ListCategoriesQueryDto } from '../category/dto/list-categories.query.dto';
import { DrawingService } from '../drawing/drawing.service';
import { ListMatchesQueryDto } from '../match/dto/list-matches.query.dto';
import { MatchService } from '../match/match.service';
import { PlayoffService } from '../playoff/playoff.service';
import { ScheduleService } from '../schedule/schedule.service';
import { StandingService } from '../standing/standing.service';
import { TournamentService } from '../tournament/tournament.service';

@Injectable()
export class PublicHubService {
  constructor(
    private readonly tournaments: TournamentService,
    private readonly categories: CategoryService,
    private readonly matches: MatchService,
    private readonly schedules: ScheduleService,
    private readonly drawings: DrawingService,
    private readonly standings: StandingService,
    private readonly playoffs: PlayoffService,
  ) {}

  private async requirePublicTournament(tournamentId: string) {
    return this.tournaments.getPublicById(tournamentId);
  }

  private softNotReady(error: unknown): boolean {
    return (
      error instanceof NotFoundException || error instanceof BadRequestException
    );
  }

  async listCategories(tournamentId: string, query: ListCategoriesQueryDto) {
    await this.requirePublicTournament(tournamentId);
    const result = await this.categories.list(tournamentId, query);
    return {
      ...result,
      items: result.items.map((category) => ({
        ...category,
        competitionMode: resolveCompetitionMode(category.configuration),
      })),
    };
  }

  async getCategory(tournamentId: string, categoryId: string) {
    await this.requirePublicTournament(tournamentId);
    const category = await this.categories.getById(tournamentId, categoryId);
    return {
      ...category,
      competitionMode: resolveCompetitionMode(category.configuration),
    };
  }

  async listMatches(
    tournamentId: string,
    categoryId: string,
    query: ListMatchesQueryDto,
  ) {
    await this.requirePublicTournament(tournamentId);
    try {
      const result = await this.matches.list(tournamentId, categoryId, query);
      return { ...result, ready: true as const };
    } catch (error) {
      if (this.softNotReady(error)) {
        return {
          items: [],
          pagination: {
            page: query.page ?? 1,
            pageSize: query.pageSize ?? 50,
            total: 0,
            totalPages: 0,
          },
          ready: false as const,
          reason:
            error instanceof Error
              ? error.message
              : 'Matches are not ready for guests yet',
        };
      }
      throw error;
    }
  }

  async getSchedule(tournamentId: string, categoryId: string) {
    await this.requirePublicTournament(tournamentId);
    try {
      const version = await this.schedules.getOfficialVersion(
        tournamentId,
        categoryId,
      );
      return { ready: true as const, version };
    } catch (error) {
      if (this.softNotReady(error)) {
        return {
          ready: false as const,
          version: null,
          reason:
            error instanceof Error
              ? error.message
              : 'Official schedule is not available yet',
        };
      }
      throw error;
    }
  }

  async getDrawing(tournamentId: string, categoryId: string) {
    await this.requirePublicTournament(tournamentId);
    try {
      const version = await this.drawings.getOfficialVersion(
        tournamentId,
        categoryId,
      );
      return { ready: true as const, version };
    } catch (error) {
      if (this.softNotReady(error)) {
        return {
          ready: false as const,
          version: null,
          reason:
            error instanceof Error
              ? error.message
              : 'Official drawing is not available yet',
        };
      }
      throw error;
    }
  }

  async listStandings(
    tournamentId: string,
    categoryId: string,
    groupId?: string,
  ) {
    await this.requirePublicTournament(tournamentId);
    try {
      const result = await this.standings.list(
        tournamentId,
        categoryId,
        groupId,
      );
      return { ...result, ready: true as const };
    } catch (error) {
      if (this.softNotReady(error)) {
        return {
          items: [],
          ready: false as const,
          reason:
            error instanceof Error
              ? error.message
              : 'Standings are not available yet',
        };
      }
      throw error;
    }
  }

  async getPlayoff(tournamentId: string, categoryId: string) {
    await this.requirePublicTournament(tournamentId);
    try {
      const bracket = await this.playoffs.getOfficialBracket(
        tournamentId,
        categoryId,
      );
      return { ready: true as const, bracket };
    } catch (error) {
      if (this.softNotReady(error)) {
        return {
          ready: false as const,
          bracket: null,
          reason:
            error instanceof Error
              ? error.message
              : 'Official playoff bracket is not available yet',
        };
      }
      throw error;
    }
  }
}
