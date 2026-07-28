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
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { AuthorizationGuard } from '../auth/guards/authorization.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Permission } from '../auth/permissions/permissions';
import { AuthUserView } from '../auth/types/auth-user.type';
import { CourtService } from './court.service';
import { CreateCourtDto } from './dto/create-court.dto';
import { DisableCourtDto } from './dto/disable-court.dto';
import { ListCourtsQueryDto } from './dto/list-courts.query.dto';
import { ReorderCourtsDto } from './dto/reorder-courts.dto';
import { UpdateCourtDto } from './dto/update-court.dto';

@ApiTags('courts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AuthorizationGuard)
@RequirePermissions(Permission.TOURNAMENT_MANAGE)
@Controller('tournaments/:tournamentId/courts')
export class CourtController {
  constructor(private readonly courtService: CourtService) {}

  @Get()
  @ApiOperation({ summary: 'List courts in display order' })
  list(
    @Param('tournamentId', ParseUUIDPipe) tournamentId: string,
    @Query() query: ListCourtsQueryDto,
  ) {
    return this.courtService.list(tournamentId, query);
  }

  @Get(':courtId')
  @ApiOperation({ summary: 'Get court by id' })
  getById(
    @Param('tournamentId', ParseUUIDPipe) tournamentId: string,
    @Param('courtId', ParseUUIDPipe) courtId: string,
  ) {
    return this.courtService.getById(tournamentId, courtId);
  }

  @Post()
  @ApiOperation({ summary: 'Create a court (label unique per tournament)' })
  create(
    @Param('tournamentId', ParseUUIDPipe) tournamentId: string,
    @Body() dto: CreateCourtDto,
    @CurrentUser() user: AuthUserView,
  ) {
    return this.courtService.create(tournamentId, dto, user);
  }

  @Patch(':courtId')
  @ApiOperation({ summary: 'Update court name, label, order, or notes' })
  update(
    @Param('tournamentId', ParseUUIDPipe) tournamentId: string,
    @Param('courtId', ParseUUIDPipe) courtId: string,
    @Body() dto: UpdateCourtDto,
    @CurrentUser() user: AuthUserView,
  ) {
    return this.courtService.update(tournamentId, courtId, dto, user);
  }

  @Post(':courtId/enable')
  @ApiOperation({ summary: 'Return a court to the available pool' })
  enable(
    @Param('tournamentId', ParseUUIDPipe) tournamentId: string,
    @Param('courtId', ParseUUIDPipe) courtId: string,
    @CurrentUser() user: AuthUserView,
  ) {
    return this.courtService.enable(tournamentId, courtId, user);
  }

  @Post(':courtId/disable')
  @ApiOperation({
    summary: 'Take a court out of the pool (unavailable or maintenance)',
  })
  disable(
    @Param('tournamentId', ParseUUIDPipe) tournamentId: string,
    @Param('courtId', ParseUUIDPipe) courtId: string,
    @Body() dto: DisableCourtDto,
    @CurrentUser() user: AuthUserView,
  ) {
    return this.courtService.disable(tournamentId, courtId, dto, user);
  }

  @Post('reorder')
  @ApiOperation({ summary: 'Reorder all active courts by listed position' })
  reorder(
    @Param('tournamentId', ParseUUIDPipe) tournamentId: string,
    @Body() dto: ReorderCourtsDto,
    @CurrentUser() user: AuthUserView,
  ) {
    return this.courtService.reorder(tournamentId, dto, user);
  }

  @Delete(':courtId')
  @ApiOperation({
    summary: 'Soft delete a court that no Schedule references',
  })
  softDelete(
    @Param('tournamentId', ParseUUIDPipe) tournamentId: string,
    @Param('courtId', ParseUUIDPipe) courtId: string,
    @CurrentUser() user: AuthUserView,
  ) {
    return this.courtService.softDelete(tournamentId, courtId, user);
  }
}
