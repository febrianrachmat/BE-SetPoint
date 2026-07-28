import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ScheduleModule } from '../schedule/schedule.module';
import { MatchController } from './match.controller';
import { MatchRepository } from './match.repository';
import { MatchService } from './match.service';

@Module({
  imports: [AuthModule, ScheduleModule],
  controllers: [MatchController],
  providers: [MatchService, MatchRepository],
  exports: [MatchService],
})
export class MatchModule {}
