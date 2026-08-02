import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PublicTournamentController } from './public-tournament.controller';
import { TournamentController } from './tournament.controller';
import { TournamentRepository } from './tournament.repository';
import { TournamentService } from './tournament.service';

@Module({
  imports: [AuthModule],
  controllers: [TournamentController, PublicTournamentController],
  providers: [TournamentService, TournamentRepository],
  exports: [TournamentService],
})
export class TournamentModule {}
