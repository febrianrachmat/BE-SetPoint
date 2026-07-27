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
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { AuthorizationGuard } from '../auth/guards/authorization.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Permission } from '../auth/permissions/permissions';
import { AuthUserView } from '../auth/types/auth-user.type';
import { CreateTournamentDto } from './dto/create-tournament.dto';
import { ListTournamentsQueryDto } from './dto/list-tournaments.query.dto';
import { UpdateTournamentDto } from './dto/update-tournament.dto';
import { TournamentService } from './tournament.service';

@ApiTags('tournaments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AuthorizationGuard)
@RequirePermissions(Permission.TOURNAMENT_MANAGE)
@Controller('tournaments')
export class TournamentController {
  constructor(private readonly tournamentService: TournamentService) {}

  @Get()
  @ApiOperation({ summary: 'List tournaments with search and pagination' })
  list(@Query() query: ListTournamentsQueryDto) {
    return this.tournamentService.list(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get tournament by id' })
  getById(@Param('id', ParseUUIDPipe) id: string) {
    return this.tournamentService.getById(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create tournament in Draft status' })
  create(@Body() dto: CreateTournamentDto, @CurrentUser() user: AuthUserView) {
    return this.tournamentService.create(dto, user);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update tournament identity/configuration (not lifecycle status)',
  })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTournamentDto,
    @CurrentUser() user: AuthUserView,
  ) {
    return this.tournamentService.update(id, dto, user);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Soft delete tournament (Draft/Setup only)' })
  softDelete(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUserView,
  ) {
    return this.tournamentService.softDelete(id, user);
  }

  @Post(':id/setup')
  @ApiOperation({ summary: 'Transition Draft → Setup' })
  moveToSetup(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUserView,
  ) {
    return this.tournamentService.moveToSetup(id, user);
  }

  @Post(':id/publish')
  @ApiOperation({ summary: 'Transition Setup → Published' })
  publish(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUserView,
  ) {
    return this.tournamentService.publish(id, user);
  }

  @Post(':id/go-live')
  @ApiOperation({ summary: 'Transition Published → Live' })
  goLive(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUserView,
  ) {
    return this.tournamentService.goLive(id, user);
  }

  @Post(':id/finish')
  @ApiOperation({ summary: 'Transition Live → Finished' })
  finish(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUserView,
  ) {
    return this.tournamentService.finish(id, user);
  }

  @Post(':id/archive')
  @ApiOperation({ summary: 'Transition Finished → Archived' })
  archive(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUserView,
  ) {
    return this.tournamentService.archive(id, user);
  }
}
