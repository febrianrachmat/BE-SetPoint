import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
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
import { GenerateScheduleDto } from './dto/generate-schedule.dto';
import { ReviewScheduleVersionDto } from './dto/review-schedule-version.dto';
import { UnlockScheduleDto } from './dto/unlock-schedule.dto';
import { UpdateScheduleEntryDto } from './dto/update-schedule-entry.dto';
import { ScheduleService } from './schedule.service';

@ApiTags('schedule')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AuthorizationGuard)
@RequirePermissions(Permission.TOURNAMENT_MANAGE)
@Controller('tournaments/:tournamentId/categories/:categoryId/schedule')
export class ScheduleController {
  constructor(private readonly scheduleService: ScheduleService) {}

  @Get()
  @ApiOperation({ summary: 'Get Schedule header for a category' })
  getSchedule(
    @Param('tournamentId', ParseUUIDPipe) tournamentId: string,
    @Param('categoryId', ParseUUIDPipe) categoryId: string,
  ) {
    return this.scheduleService.getSchedule(tournamentId, categoryId);
  }

  @Get('official')
  @ApiOperation({ summary: 'Get current official Schedule version detail' })
  getOfficial(
    @Param('tournamentId', ParseUUIDPipe) tournamentId: string,
    @Param('categoryId', ParseUUIDPipe) categoryId: string,
  ) {
    return this.scheduleService.getOfficialVersion(tournamentId, categoryId);
  }

  @Post('generate')
  @ApiOperation({
    summary:
      'Generate candidate Schedule from Official Locked Drawing (no drawingVersionId)',
  })
  generate(
    @Param('tournamentId', ParseUUIDPipe) tournamentId: string,
    @Param('categoryId', ParseUUIDPipe) categoryId: string,
    @Body() dto: GenerateScheduleDto,
    @CurrentUser() user: AuthUserView,
  ) {
    return this.scheduleService.generate(tournamentId, categoryId, dto, user);
  }

  @Get('versions')
  @ApiOperation({ summary: 'List Schedule versions (newest first)' })
  listVersions(
    @Param('tournamentId', ParseUUIDPipe) tournamentId: string,
    @Param('categoryId', ParseUUIDPipe) categoryId: string,
  ) {
    return this.scheduleService.listVersions(tournamentId, categoryId);
  }

  @Get('versions/:versionId')
  @ApiOperation({
    summary: 'Get Schedule version detail with entries and matches',
  })
  getVersion(
    @Param('tournamentId', ParseUUIDPipe) tournamentId: string,
    @Param('categoryId', ParseUUIDPipe) categoryId: string,
    @Param('versionId', ParseUUIDPipe) versionId: string,
  ) {
    return this.scheduleService.getVersion(
      tournamentId,
      categoryId,
      versionId,
    );
  }

  @Patch('versions/:versionId/entries/:entryId')
  @ApiOperation({
    summary:
      'Reschedule one entry (start/end) while Schedule is unlocked — SCH-08',
  })
  updateEntry(
    @Param('tournamentId', ParseUUIDPipe) tournamentId: string,
    @Param('categoryId', ParseUUIDPipe) categoryId: string,
    @Param('versionId', ParseUUIDPipe) versionId: string,
    @Param('entryId', ParseUUIDPipe) entryId: string,
    @Body() dto: UpdateScheduleEntryDto,
    @CurrentUser() user: AuthUserView,
  ) {
    return this.scheduleService.updateEntry(
      tournamentId,
      categoryId,
      versionId,
      entryId,
      dto,
      user,
    );
  }

  @Post('versions/:versionId/review')
  @ApiOperation({
    summary: 'Review a candidate Schedule version (approve/reject) — Step 7B',
  })
  reviewVersion(
    @Param('tournamentId', ParseUUIDPipe) tournamentId: string,
    @Param('categoryId', ParseUUIDPipe) categoryId: string,
    @Param('versionId', ParseUUIDPipe) versionId: string,
    @Body() dto: ReviewScheduleVersionDto,
    @CurrentUser() user: AuthUserView,
  ) {
    return this.scheduleService.reviewVersion(
      tournamentId,
      categoryId,
      versionId,
      dto,
      user,
    );
  }

  @Post('versions/:versionId/publish')
  @ApiOperation({
    summary:
      'Publish an approved Schedule version as Official (history preserved) — Step 7B',
  })
  publishVersion(
    @Param('tournamentId', ParseUUIDPipe) tournamentId: string,
    @Param('categoryId', ParseUUIDPipe) categoryId: string,
    @Param('versionId', ParseUUIDPipe) versionId: string,
    @CurrentUser() user: AuthUserView,
  ) {
    return this.scheduleService.publishVersion(
      tournamentId,
      categoryId,
      versionId,
      user,
    );
  }

  @Post('lock')
  @ApiOperation({
    summary:
      'Lock published Schedule — freezes match times/courts (SCH-11) — Step 7C',
  })
  lock(
    @Param('tournamentId', ParseUUIDPipe) tournamentId: string,
    @Param('categoryId', ParseUUIDPipe) categoryId: string,
    @CurrentUser() user: AuthUserView,
  ) {
    return this.scheduleService.lock(tournamentId, categoryId, user);
  }

  @Post('unlock')
  @ApiOperation({
    summary: 'Exceptional Unlock with mandatory reason (LOCK-07) — Step 7C',
  })
  unlock(
    @Param('tournamentId', ParseUUIDPipe) tournamentId: string,
    @Param('categoryId', ParseUUIDPipe) categoryId: string,
    @Body() dto: UnlockScheduleDto,
    @CurrentUser() user: AuthUserView,
  ) {
    return this.scheduleService.unlock(
      tournamentId,
      categoryId,
      dto.reason,
      user,
    );
  }
}
