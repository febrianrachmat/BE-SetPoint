import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ListTournamentsQueryDto } from './dto/list-tournaments.query.dto';
import { TournamentService } from './tournament.service';

/**
 * Unauthenticated guest APIs for the public landing / tournament viewer.
 */
@ApiTags('public-tournaments')
@Controller('public/tournaments')
export class PublicTournamentController {
  constructor(private readonly tournamentService: TournamentService) {}

  @Get()
  @ApiOperation({
    summary:
      'List Published + Live tournaments for guests (optional status=published|live)',
  })
  list(@Query() query: ListTournamentsQueryDto) {
    return this.tournamentService.listPublic(query);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get a Published, Live, or Finished tournament for guests',
  })
  getById(@Param('id', ParseUUIDPipe) id: string) {
    return this.tournamentService.getPublicById(id);
  }
}
