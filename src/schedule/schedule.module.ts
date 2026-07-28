import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DrawingModule } from '../drawing/drawing.module';
import { ScheduleController } from './schedule.controller';
import { ScheduleRepository } from './schedule.repository';
import { ScheduleService } from './schedule.service';

@Module({
  imports: [AuthModule, DrawingModule],
  controllers: [ScheduleController],
  providers: [ScheduleService, ScheduleRepository],
  exports: [ScheduleService],
})
export class ScheduleModule {}
