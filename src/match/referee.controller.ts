import { Controller, Get, UseGuards } from '@nestjs/common';
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
import { MatchService } from './match.service';

@ApiTags('referee')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AuthorizationGuard)
@RequirePermissions(Permission.MATCH_SCORE)
@Controller('referee')
export class RefereeController {
  constructor(private readonly matchService: MatchService) {}

  @Get('assignments')
  @ApiOperation({
    summary: 'List active match assignments for the current referee',
  })
  listMine(@CurrentUser() user: AuthUserView) {
    return this.matchService.listMyAssignments(user);
  }
}
