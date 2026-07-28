import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { StandingController } from './standing.controller';
import { StandingRepository } from './standing.repository';
import { StandingService } from './standing.service';

@Module({
  imports: [AuthModule],
  controllers: [StandingController],
  providers: [StandingService, StandingRepository],
  exports: [StandingService],
})
export class StandingModule {}
