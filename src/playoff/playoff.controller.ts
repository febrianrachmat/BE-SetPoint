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
import { ReviewBracketDto } from './dto/review-bracket.dto';
import { UnlockPlayoffDto } from './dto/unlock-playoff.dto';
import { PlayoffService } from './playoff.service';

@ApiTags('playoff')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AuthorizationGuard)
@RequirePermissions(Permission.TOURNAMENT_MANAGE)
@Controller('tournaments/:tournamentId/categories/:categoryId/playoff')
export class PlayoffController {
  constructor(private readonly playoffService: PlayoffService) {}

  @Get()
  @ApiOperation({ summary: 'Get Playoff header — Step 10A/10B' })
  getPlayoff(
    @Param('tournamentId', ParseUUIDPipe) tournamentId: string,
    @Param('categoryId', ParseUUIDPipe) categoryId: string,
  ) {
    return this.playoffService.getPlayoff(tournamentId, categoryId);
  }

  @Get('official')
  @ApiOperation({ summary: 'Get current official Bracket detail' })
  getOfficial(
    @Param('tournamentId', ParseUUIDPipe) tournamentId: string,
    @Param('categoryId', ParseUUIDPipe) categoryId: string,
  ) {
    return this.playoffService.getOfficialBracket(tournamentId, categoryId);
  }

  @Get('champion')
  @ApiOperation({ summary: 'Get declared Champion (Step 10C)' })
  getChampion(
    @Param('tournamentId', ParseUUIDPipe) tournamentId: string,
    @Param('categoryId', ParseUUIDPipe) categoryId: string,
  ) {
    return this.playoffService.getChampion(tournamentId, categoryId);
  }

  @Post('generate')
  @ApiOperation({
    summary:
      'Generate candidate Bracket from qualified standings (A1vsB2 / B1vsA2 MVP)',
  })
  generate(
    @Param('tournamentId', ParseUUIDPipe) tournamentId: string,
    @Param('categoryId', ParseUUIDPipe) categoryId: string,
    @CurrentUser() user: AuthUserView,
  ) {
    return this.playoffService.generate(tournamentId, categoryId, user);
  }

  @Get('brackets')
  @ApiOperation({ summary: 'List Bracket versions (newest first)' })
  listBrackets(
    @Param('tournamentId', ParseUUIDPipe) tournamentId: string,
    @Param('categoryId', ParseUUIDPipe) categoryId: string,
  ) {
    return this.playoffService.listBrackets(tournamentId, categoryId);
  }

  @Get('brackets/:bracketId')
  @ApiOperation({ summary: 'Get Bracket detail with matches' })
  getBracket(
    @Param('tournamentId', ParseUUIDPipe) tournamentId: string,
    @Param('categoryId', ParseUUIDPipe) categoryId: string,
    @Param('bracketId', ParseUUIDPipe) bracketId: string,
  ) {
    return this.playoffService.getBracket(
      tournamentId,
      categoryId,
      bracketId,
    );
  }

  @Post('brackets/:bracketId/review')
  @ApiOperation({ summary: 'Review candidate Bracket (approve|reject) — 10B' })
  review(
    @Param('tournamentId', ParseUUIDPipe) tournamentId: string,
    @Param('categoryId', ParseUUIDPipe) categoryId: string,
    @Param('bracketId', ParseUUIDPipe) bracketId: string,
    @Body() dto: ReviewBracketDto,
    @CurrentUser() user: AuthUserView,
  ) {
    return this.playoffService.reviewBracket(
      tournamentId,
      categoryId,
      bracketId,
      dto,
      user,
    );
  }

  @Post('brackets/:bracketId/publish')
  @ApiOperation({
    summary: 'Publish approved Bracket as Official (demotes prior) — 10B',
  })
  publish(
    @Param('tournamentId', ParseUUIDPipe) tournamentId: string,
    @Param('categoryId', ParseUUIDPipe) categoryId: string,
    @Param('bracketId', ParseUUIDPipe) bracketId: string,
    @CurrentUser() user: AuthUserView,
  ) {
    return this.playoffService.publishBracket(
      tournamentId,
      categoryId,
      bracketId,
      user,
    );
  }

  @Post('lock')
  @ApiOperation({ summary: 'Lock Published Playoff (Playoff Ready) — 10B' })
  lock(
    @Param('tournamentId', ParseUUIDPipe) tournamentId: string,
    @Param('categoryId', ParseUUIDPipe) categoryId: string,
    @CurrentUser() user: AuthUserView,
  ) {
    return this.playoffService.lock(tournamentId, categoryId, user);
  }

  @Post('unlock')
  @ApiOperation({ summary: 'Unlock Playoff with mandatory reason — 10B' })
  unlock(
    @Param('tournamentId', ParseUUIDPipe) tournamentId: string,
    @Param('categoryId', ParseUUIDPipe) categoryId: string,
    @Body() dto: UnlockPlayoffDto,
    @CurrentUser() user: AuthUserView,
  ) {
    return this.playoffService.unlock(tournamentId, categoryId, dto, user);
  }
}
