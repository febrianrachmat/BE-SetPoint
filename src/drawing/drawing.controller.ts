import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
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
import { DrawingService } from './drawing.service';
import { GenerateDrawingDto } from './dto/generate-drawing.dto';
import { ReviewDrawingVersionDto } from './dto/review-drawing-version.dto';
import { UnlockDrawingDto } from './dto/unlock-drawing.dto';

@ApiTags('drawing')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AuthorizationGuard)
@RequirePermissions(Permission.TOURNAMENT_MANAGE)
@Controller('tournaments/:tournamentId/categories/:categoryId/drawing')
export class DrawingController {
  constructor(private readonly drawingService: DrawingService) {}

  @Get()
  @ApiOperation({
    summary: 'Get Drawing header (+ current official version summary)',
  })
  getDrawing(
    @Param('tournamentId', ParseUUIDPipe) tournamentId: string,
    @Param('categoryId', ParseUUIDPipe) categoryId: string,
  ) {
    return this.drawingService.getDrawing(tournamentId, categoryId);
  }

  @Get('official')
  @ApiOperation({ summary: 'Get current official Drawing version detail' })
  getOfficial(
    @Param('tournamentId', ParseUUIDPipe) tournamentId: string,
    @Param('categoryId', ParseUUIDPipe) categoryId: string,
  ) {
    return this.drawingService.getOfficialVersion(tournamentId, categoryId);
  }

  @Post('generate')
  @ApiOperation({
    summary:
      'Generate a new candidate DrawingVersion with Groups and GroupMembers',
  })
  generate(
    @Param('tournamentId', ParseUUIDPipe) tournamentId: string,
    @Param('categoryId', ParseUUIDPipe) categoryId: string,
    @Body() dto: GenerateDrawingDto,
    @CurrentUser() user: AuthUserView,
  ) {
    return this.drawingService.generate(tournamentId, categoryId, dto, user);
  }

  @Get('versions')
  @ApiOperation({ summary: 'List Drawing versions / history (newest first)' })
  listVersions(
    @Param('tournamentId', ParseUUIDPipe) tournamentId: string,
    @Param('categoryId', ParseUUIDPipe) categoryId: string,
  ) {
    return this.drawingService.listVersions(tournamentId, categoryId);
  }

  @Get('versions/:versionId')
  @ApiOperation({
    summary: 'Get Drawing version detail with groups and members',
  })
  getVersion(
    @Param('tournamentId', ParseUUIDPipe) tournamentId: string,
    @Param('categoryId', ParseUUIDPipe) categoryId: string,
    @Param('versionId', ParseUUIDPipe) versionId: string,
  ) {
    return this.drawingService.getVersion(
      tournamentId,
      categoryId,
      versionId,
    );
  }

  @Post('versions/:versionId/review')
  @ApiOperation({
    summary: 'Review a candidate Drawing version (approve/reject) — Step 6B',
  })
  reviewVersion(
    @Param('tournamentId', ParseUUIDPipe) tournamentId: string,
    @Param('categoryId', ParseUUIDPipe) categoryId: string,
    @Param('versionId', ParseUUIDPipe) versionId: string,
    @Body() dto: ReviewDrawingVersionDto,
    @CurrentUser() user: AuthUserView,
  ) {
    return this.drawingService.reviewVersion(
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
      'Publish an approved Drawing version as Official (history preserved) — Step 6B',
  })
  publishVersion(
    @Param('tournamentId', ParseUUIDPipe) tournamentId: string,
    @Param('categoryId', ParseUUIDPipe) categoryId: string,
    @Param('versionId', ParseUUIDPipe) versionId: string,
    @CurrentUser() user: AuthUserView,
  ) {
    return this.drawingService.publishVersion(
      tournamentId,
      categoryId,
      versionId,
      user,
    );
  }

  @Post('lock')
  @ApiOperation({
    summary:
      'Lock published Drawing — freezes registration, withdraw, category structure (6C)',
  })
  lock(
    @Param('tournamentId', ParseUUIDPipe) tournamentId: string,
    @Param('categoryId', ParseUUIDPipe) categoryId: string,
    @CurrentUser() user: AuthUserView,
  ) {
    return this.drawingService.lock(tournamentId, categoryId, user);
  }

  @Post('unlock')
  @ApiOperation({
    summary: 'Exceptional Unlock with mandatory reason (LOCK-07) — Step 6C',
  })
  unlock(
    @Param('tournamentId', ParseUUIDPipe) tournamentId: string,
    @Param('categoryId', ParseUUIDPipe) categoryId: string,
    @Body() dto: UnlockDrawingDto,
    @CurrentUser() user: AuthUserView,
  ) {
    return this.drawingService.unlock(
      tournamentId,
      categoryId,
      dto.reason,
      user,
    );
  }
}
