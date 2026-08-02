import { Module } from '@nestjs/common';
import { CategoryModule } from '../category/category.module';
import { DrawingModule } from '../drawing/drawing.module';
import { MatchModule } from '../match/match.module';
import { PlayoffModule } from '../playoff/playoff.module';
import { ScheduleModule } from '../schedule/schedule.module';
import { StandingModule } from '../standing/standing.module';
import { TournamentModule } from '../tournament/tournament.module';
import { PublicHubController } from './public-hub.controller';
import { PublicHubService } from './public-hub.service';

@Module({
  imports: [
    TournamentModule,
    CategoryModule,
    MatchModule,
    ScheduleModule,
    DrawingModule,
    StandingModule,
    PlayoffModule,
  ],
  controllers: [PublicHubController],
  providers: [PublicHubService],
})
export class PublicHubModule {}
