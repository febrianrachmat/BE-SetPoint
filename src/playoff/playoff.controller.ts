import {
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
import { PlayoffService } from './playoff.service';

@ApiTags('playoff')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AuthorizationGuard)
@RequirePermissions(Permission.TOURNAMENT_MANAGE)
@Controller('tournaments/:tournamentId/categories/:categoryId/playoff')
export class PlayoffController {
  constructor(private readonly playoffService: PlayoffService) {}

  @Get()
  @ApiOperation({ summary: 'Get Playoff header — Step 10A' })
  getPlayoff(
    @Param('tournamentId', ParseUUIDPipe) tournamentId: string,
    @Param('categoryId', ParseUUIDPipe) categoryId: string,
  ) {
    return this.playoffService.getPlayoff(tournamentId, categoryId);
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
}
