import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { AuthorizationGuard } from '../auth/guards/authorization.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Permission } from '../auth/permissions/permissions';
import { AuthUserView } from '../auth/types/auth-user.type';
import { ListMatchesQueryDto } from './dto/list-matches.query.dto';
import { AssignRefereeDto } from './dto/assign-referee.dto';
import { ScoreDeltaDto, ScoreSideDto } from './dto/score-adjust.dto';
import { ScorePointDto } from './dto/score-point.dto';
import { MatchService } from './match.service';

@ApiTags('matches')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AuthorizationGuard)
@RequirePermissions(Permission.MATCH_SCORE)
@Controller('tournaments/:tournamentId/categories/:categoryId/matches')
export class MatchController {
  constructor(private readonly matchService: MatchService) {}

  @Get()
  @ApiOperation({
    summary:
      'List matches on Official Locked Schedule (requires Live Ready) — Step 8A',
  })
  list(
    @Param('tournamentId', ParseUUIDPipe) tournamentId: string,
    @Param('categoryId', ParseUUIDPipe) categoryId: string,
    @Query() query: ListMatchesQueryDto,
  ) {
    return this.matchService.list(tournamentId, categoryId, query);
  }

  @Get(':matchId')
  @ApiOperation({ summary: 'Get match detail' })
  getById(
    @Param('tournamentId', ParseUUIDPipe) tournamentId: string,
    @Param('categoryId', ParseUUIDPipe) categoryId: string,
    @Param('matchId', ParseUUIDPipe) matchId: string,
  ) {
    return this.matchService.getById(tournamentId, categoryId, matchId);
  }

  @Post(':matchId/referees')
  @RequirePermissions(Permission.TOURNAMENT_MANAGE)
  @ApiOperation({
    summary: 'Assign a referee user to this match by email (Admin)',
  })
  assignReferee(
    @Param('tournamentId', ParseUUIDPipe) tournamentId: string,
    @Param('categoryId', ParseUUIDPipe) categoryId: string,
    @Param('matchId', ParseUUIDPipe) matchId: string,
    @Body() dto: AssignRefereeDto,
    @CurrentUser() user: AuthUserView,
  ) {
    return this.matchService.assignReferee(
      tournamentId,
      categoryId,
      matchId,
      dto.email,
      user,
    );
  }

  @Post(':matchId/warm-up')
  @ApiOperation({ summary: 'waiting → warm_up (MATCH-05; Tournament Live)' })
  warmUp(
    @Param('tournamentId', ParseUUIDPipe) tournamentId: string,
    @Param('categoryId', ParseUUIDPipe) categoryId: string,
    @Param('matchId', ParseUUIDPipe) matchId: string,
    @CurrentUser() user: AuthUserView,
  ) {
    return this.matchService.warmUp(tournamentId, categoryId, matchId, user);
  }

  @Post(':matchId/start')
  @ApiOperation({ summary: 'warm_up → live (MATCH-06)' })
  start(
    @Param('tournamentId', ParseUUIDPipe) tournamentId: string,
    @Param('categoryId', ParseUUIDPipe) categoryId: string,
    @Param('matchId', ParseUUIDPipe) matchId: string,
    @CurrentUser() user: AuthUserView,
  ) {
    return this.matchService.start(tournamentId, categoryId, matchId, user);
  }

  @Post(':matchId/score/point')
  @ApiOperation({
    summary:
      'Apply one scored point while Match is live (Step 8B). Body: { side: A|B }',
  })
  scorePoint(
    @Param('tournamentId', ParseUUIDPipe) tournamentId: string,
    @Param('categoryId', ParseUUIDPipe) categoryId: string,
    @Param('matchId', ParseUUIDPipe) matchId: string,
    @Body() dto: ScorePointDto,
    @CurrentUser() user: AuthUserView,
  ) {
    return this.matchService.scorePoint(
      tournamentId,
      categoryId,
      matchId,
      dto.side,
      user,
    );
  }

  @Post(':matchId/score/point/remove')
  @ApiOperation({
    summary:
      'Remove one point from the current game/tie-break for a side (referee correction)',
  })
  removeScorePoint(
    @Param('tournamentId', ParseUUIDPipe) tournamentId: string,
    @Param('categoryId', ParseUUIDPipe) categoryId: string,
    @Param('matchId', ParseUUIDPipe) matchId: string,
    @Body() dto: ScoreSideDto,
    @CurrentUser() user: AuthUserView,
  ) {
    return this.matchService.removeScorePoint(
      tournamentId,
      categoryId,
      matchId,
      dto.side,
      user,
    );
  }

  @Post(':matchId/score/game')
  @ApiOperation({
    summary: 'Manually add or remove one game for a side. Body: { side, delta: 1|-1 }',
  })
  adjustScoreGame(
    @Param('tournamentId', ParseUUIDPipe) tournamentId: string,
    @Param('categoryId', ParseUUIDPipe) categoryId: string,
    @Param('matchId', ParseUUIDPipe) matchId: string,
    @Body() dto: ScoreDeltaDto,
    @CurrentUser() user: AuthUserView,
  ) {
    return this.matchService.adjustScoreGame(
      tournamentId,
      categoryId,
      matchId,
      dto.side,
      dto.delta,
      user,
    );
  }

  @Post(':matchId/score/set')
  @ApiOperation({
    summary: 'Manually add or remove one set for a side. Body: { side, delta: 1|-1 }',
  })
  adjustScoreSet(
    @Param('tournamentId', ParseUUIDPipe) tournamentId: string,
    @Param('categoryId', ParseUUIDPipe) categoryId: string,
    @Param('matchId', ParseUUIDPipe) matchId: string,
    @Body() dto: ScoreDeltaDto,
    @CurrentUser() user: AuthUserView,
  ) {
    return this.matchService.adjustScoreSet(
      tournamentId,
      categoryId,
      matchId,
      dto.side,
      dto.delta,
      user,
    );
  }

  @Post(':matchId/score/server')
  @ApiOperation({
    summary: 'Set which side is serving. Body: { side: A|B }',
  })
  setScoreServer(
    @Param('tournamentId', ParseUUIDPipe) tournamentId: string,
    @Param('categoryId', ParseUUIDPipe) categoryId: string,
    @Param('matchId', ParseUUIDPipe) matchId: string,
    @Body() dto: ScoreSideDto,
    @CurrentUser() user: AuthUserView,
  ) {
    return this.matchService.setScoreServer(
      tournamentId,
      categoryId,
      matchId,
      dto.side,
      user,
    );
  }

  @Post(':matchId/score/undo')
  @ApiOperation({
    summary: 'Undo the last scoring action while Match is live',
  })
  undoScore(
    @Param('tournamentId', ParseUUIDPipe) tournamentId: string,
    @Param('categoryId', ParseUUIDPipe) categoryId: string,
    @Param('matchId', ParseUUIDPipe) matchId: string,
    @CurrentUser() user: AuthUserView,
  ) {
    return this.matchService.undoScore(
      tournamentId,
      categoryId,
      matchId,
      user,
    );
  }

  @Post(':matchId/finish')
  @ApiOperation({
    summary:
      'live → finished (MATCH-09). Requires completed scoring state (8B).',
  })
  finish(
    @Param('tournamentId', ParseUUIDPipe) tournamentId: string,
    @Param('categoryId', ParseUUIDPipe) categoryId: string,
    @Param('matchId', ParseUUIDPipe) matchId: string,
    @CurrentUser() user: AuthUserView,
  ) {
    return this.matchService.finish(tournamentId, categoryId, matchId, user);
  }

  @Post(':matchId/verify')
  @ApiOperation({
    summary:
      'finished → verified (8C). Admin only; emits match.verified with result for Standing consumer. No standing update here.',
  })
  verify(
    @Param('tournamentId', ParseUUIDPipe) tournamentId: string,
    @Param('categoryId', ParseUUIDPipe) categoryId: string,
    @Param('matchId', ParseUUIDPipe) matchId: string,
    @CurrentUser() user: AuthUserView,
  ) {
    return this.matchService.verify(tournamentId, categoryId, matchId, user);
  }
}
