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
import { CreateTeamDto } from './dto/create-team.dto';
import { ListTeamsQueryDto } from './dto/list-teams.query.dto';
import { UpdateTeamDto } from './dto/update-team.dto';
import { WithdrawTeamDto } from './dto/withdraw-team.dto';
import { TeamService } from './team.service';

@ApiTags('teams')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AuthorizationGuard)
@RequirePermissions(Permission.TOURNAMENT_MANAGE)
@Controller('tournaments/:tournamentId/categories/:categoryId/teams')
export class TeamController {
  constructor(private readonly teamService: TeamService) {}

  @Get()
  @ApiOperation({ summary: 'List teams in a category' })
  list(
    @Param('tournamentId', ParseUUIDPipe) tournamentId: string,
    @Param('categoryId', ParseUUIDPipe) categoryId: string,
    @Query() query: ListTeamsQueryDto,
  ) {
    return this.teamService.list(tournamentId, categoryId, query);
  }

  @Get(':teamId')
  @ApiOperation({ summary: 'Get team by id' })
  getById(
    @Param('tournamentId', ParseUUIDPipe) tournamentId: string,
    @Param('categoryId', ParseUUIDPipe) categoryId: string,
    @Param('teamId', ParseUUIDPipe) teamId: string,
  ) {
    return this.teamService.getById(tournamentId, categoryId, teamId);
  }

  @Post()
  @ApiOperation({
    summary: 'Register team (optional players) into a category (TEAM-01/02)',
  })
  create(
    @Param('tournamentId', ParseUUIDPipe) tournamentId: string,
    @Param('categoryId', ParseUUIDPipe) categoryId: string,
    @Body() dto: CreateTeamDto,
    @CurrentUser() user: AuthUserView,
  ) {
    return this.teamService.create(tournamentId, categoryId, dto, user);
  }

  @Patch(':teamId')
  @ApiOperation({ summary: 'Update team identity before drawing lock' })
  update(
    @Param('tournamentId', ParseUUIDPipe) tournamentId: string,
    @Param('categoryId', ParseUUIDPipe) categoryId: string,
    @Param('teamId', ParseUUIDPipe) teamId: string,
    @Body() dto: UpdateTeamDto,
    @CurrentUser() user: AuthUserView,
  ) {
    return this.teamService.update(
      tournamentId,
      categoryId,
      teamId,
      dto,
      user,
    );
  }

  @Delete(':teamId')
  @ApiOperation({
    summary: 'Soft delete team before Drawing published/locked (TEAM-06)',
  })
  softDelete(
    @Param('tournamentId', ParseUUIDPipe) tournamentId: string,
    @Param('categoryId', ParseUUIDPipe) categoryId: string,
    @Param('teamId', ParseUUIDPipe) teamId: string,
    @CurrentUser() user: AuthUserView,
  ) {
    return this.teamService.softDelete(
      tournamentId,
      categoryId,
      teamId,
      user,
    );
  }

  @Post(':teamId/withdraw')
  @ApiOperation({
    summary: 'Withdraw team (preserves history; TEAM-07 / EX-05)',
  })
  withdraw(
    @Param('tournamentId', ParseUUIDPipe) tournamentId: string,
    @Param('categoryId', ParseUUIDPipe) categoryId: string,
    @Param('teamId', ParseUUIDPipe) teamId: string,
    @Body() dto: WithdrawTeamDto,
    @CurrentUser() user: AuthUserView,
  ) {
    return this.teamService.withdraw(
      tournamentId,
      categoryId,
      teamId,
      dto,
      user,
    );
  }
}
