import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../../auth/decorators/permissions.decorator';
import { AuthorizationGuard } from '../../auth/guards/authorization.guard';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { Permission } from '../../auth/permissions/permissions';
import { AuthUserView } from '../../auth/types/auth-user.type';
import { CreatePlayerDto } from './dto/create-player.dto';
import { ListPlayersQueryDto } from './dto/list-players.query.dto';
import { UpdatePlayerDto } from './dto/update-player.dto';
import { PlayerService } from './player.service';

@ApiTags('players')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AuthorizationGuard)
@RequirePermissions(Permission.TOURNAMENT_MANAGE)
@Controller(
  'tournaments/:tournamentId/categories/:categoryId/teams/:teamId/players',
)
export class PlayerController {
  constructor(private readonly playerService: PlayerService) {}

  @Get()
  @ApiOperation({ summary: 'List players on a team' })
  list(
    @Param('tournamentId', ParseUUIDPipe) tournamentId: string,
    @Param('categoryId', ParseUUIDPipe) categoryId: string,
    @Param('teamId', ParseUUIDPipe) teamId: string,
    @Query() query: ListPlayersQueryDto,
  ) {
    return this.playerService.list(tournamentId, categoryId, teamId, query);
  }

  @Get(':playerId')
  @ApiOperation({ summary: 'Get player by id' })
  getById(
    @Param('tournamentId', ParseUUIDPipe) tournamentId: string,
    @Param('categoryId', ParseUUIDPipe) categoryId: string,
    @Param('teamId', ParseUUIDPipe) teamId: string,
    @Param('playerId', ParseUUIDPipe) playerId: string,
  ) {
    return this.playerService.getById(
      tournamentId,
      categoryId,
      teamId,
      playerId,
    );
  }

  @Post()
  @ApiOperation({ summary: 'Add player to a team (TEAM-03/05)' })
  create(
    @Param('tournamentId', ParseUUIDPipe) tournamentId: string,
    @Param('categoryId', ParseUUIDPipe) categoryId: string,
    @Param('teamId', ParseUUIDPipe) teamId: string,
    @Body() dto: CreatePlayerDto,
    @CurrentUser() user: AuthUserView,
  ) {
    return this.playerService.create(
      tournamentId,
      categoryId,
      teamId,
      dto,
      user,
    );
  }

  @Patch(':playerId')
  @ApiOperation({ summary: 'Update player display name' })
  update(
    @Param('tournamentId', ParseUUIDPipe) tournamentId: string,
    @Param('categoryId', ParseUUIDPipe) categoryId: string,
    @Param('teamId', ParseUUIDPipe) teamId: string,
    @Param('playerId', ParseUUIDPipe) playerId: string,
    @Body() dto: UpdatePlayerDto,
    @CurrentUser() user: AuthUserView,
  ) {
    return this.playerService.update(
      tournamentId,
      categoryId,
      teamId,
      playerId,
      dto,
      user,
    );
  }

  @Delete(':playerId')
  @ApiOperation({
    summary: 'Soft delete player before Drawing published/locked',
  })
  softDelete(
    @Param('tournamentId', ParseUUIDPipe) tournamentId: string,
    @Param('categoryId', ParseUUIDPipe) categoryId: string,
    @Param('teamId', ParseUUIDPipe) teamId: string,
    @Param('playerId', ParseUUIDPipe) playerId: string,
    @CurrentUser() user: AuthUserView,
  ) {
    return this.playerService.softDelete(
      tournamentId,
      categoryId,
      teamId,
      playerId,
      user,
    );
  }
}
