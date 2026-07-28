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
import { ListStandingsQueryDto } from './dto/list-standings.query.dto';
import { RecalculateStandingsDto } from './dto/recalculate-standings.dto';
import { StandingService } from './standing.service';

@ApiTags('standings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AuthorizationGuard)
@RequirePermissions(Permission.TOURNAMENT_MANAGE)
@Controller('tournaments/:tournamentId/categories/:categoryId/standings')
export class StandingController {
  constructor(private readonly standingService: StandingService) {}

  @Get()
  @ApiOperation({
    summary: 'List standings for category (optional groupId filter) — Step 9A',
  })
  list(
    @Param('tournamentId', ParseUUIDPipe) tournamentId: string,
    @Param('categoryId', ParseUUIDPipe) categoryId: string,
    @Query() query: ListStandingsQueryDto,
  ) {
    return this.standingService.list(
      tournamentId,
      categoryId,
      query.groupId,
    );
  }

  @Post('recalculate')
  @ApiOperation({
    summary:
      'Recalculate standings from Verified group matches (STD-03). Auto-runs on match.verified.',
  })
  recalculate(
    @Param('tournamentId', ParseUUIDPipe) tournamentId: string,
    @Param('categoryId', ParseUUIDPipe) categoryId: string,
    @Body() dto: RecalculateStandingsDto,
    @CurrentUser() user: AuthUserView,
  ) {
    return this.standingService.recalculate(tournamentId, categoryId, {
      groupId: dto.groupId,
      actorId: user.id,
    });
  }
}
