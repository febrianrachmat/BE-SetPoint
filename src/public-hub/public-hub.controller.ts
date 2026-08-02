import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ListCategoriesQueryDto } from '../category/dto/list-categories.query.dto';
import { ListMatchesQueryDto } from '../match/dto/list-matches.query.dto';
import { PublicHubService } from './public-hub.service';

@ApiTags('public-hub')
@Controller('public/tournaments/:tournamentId/categories')
export class PublicHubController {
  constructor(private readonly hub: PublicHubService) {}

  @Get()
  @ApiOperation({ summary: 'List categories for a public tournament' })
  listCategories(
    @Param('tournamentId', ParseUUIDPipe) tournamentId: string,
    @Query() query: ListCategoriesQueryDto,
  ) {
    return this.hub.listCategories(tournamentId, query);
  }

  @Get(':categoryId')
  @ApiOperation({ summary: 'Get category detail for guests' })
  getCategory(
    @Param('tournamentId', ParseUUIDPipe) tournamentId: string,
    @Param('categoryId', ParseUUIDPipe) categoryId: string,
  ) {
    return this.hub.getCategory(tournamentId, categoryId);
  }

  @Get(':categoryId/matches')
  @ApiOperation({
    summary:
      'List group-stage matches for guests (empty until schedule is Live Ready)',
  })
  listMatches(
    @Param('tournamentId', ParseUUIDPipe) tournamentId: string,
    @Param('categoryId', ParseUUIDPipe) categoryId: string,
    @Query() query: ListMatchesQueryDto,
  ) {
    return this.hub.listMatches(tournamentId, categoryId, query);
  }

  @Get(':categoryId/schedule')
  @ApiOperation({ summary: 'Official schedule for guests (null if unpublished)' })
  getSchedule(
    @Param('tournamentId', ParseUUIDPipe) tournamentId: string,
    @Param('categoryId', ParseUUIDPipe) categoryId: string,
  ) {
    return this.hub.getSchedule(tournamentId, categoryId);
  }

  @Get(':categoryId/drawing')
  @ApiOperation({ summary: 'Official drawing for guests (null if unpublished)' })
  getDrawing(
    @Param('tournamentId', ParseUUIDPipe) tournamentId: string,
    @Param('categoryId', ParseUUIDPipe) categoryId: string,
  ) {
    return this.hub.getDrawing(tournamentId, categoryId);
  }

  @Get(':categoryId/standings')
  @ApiOperation({ summary: 'Standings for guests' })
  listStandings(
    @Param('tournamentId', ParseUUIDPipe) tournamentId: string,
    @Param('categoryId', ParseUUIDPipe) categoryId: string,
    @Query('groupId') groupId?: string,
  ) {
    return this.hub.listStandings(tournamentId, categoryId, groupId);
  }

  @Get(':categoryId/playoff')
  @ApiOperation({ summary: 'Official playoff bracket for guests' })
  getPlayoff(
    @Param('tournamentId', ParseUUIDPipe) tournamentId: string,
    @Param('categoryId', ParseUUIDPipe) categoryId: string,
  ) {
    return this.hub.getPlayoff(tournamentId, categoryId);
  }
}
