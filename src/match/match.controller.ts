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
