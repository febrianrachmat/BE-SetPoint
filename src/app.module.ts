import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { DomainEventsModule } from './common/events/domain-events.module';
import { PrismaModule } from './prisma/prisma.module';
import { CategoryModule } from './category/category.module';
import { CourtModule } from './court/court.module';
import { DrawingModule } from './drawing/drawing.module';
import { MatchModule } from './match/match.module';
import { PlayoffModule } from './playoff/playoff.module';
import { ScheduleModule } from './schedule/schedule.module';
import { StandingModule } from './standing/standing.module';
import { TournamentModule } from './tournament/tournament.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    DomainEventsModule,
    PrismaModule,
    AuthModule,
    TournamentModule,
    CategoryModule,
    CourtModule,
    DrawingModule,
    ScheduleModule,
    StandingModule,
    PlayoffModule,
    MatchModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}