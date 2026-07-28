import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CourtController } from './court.controller';
import { CourtRepository } from './court.repository';
import { CourtService } from './court.service';

@Module({
  imports: [AuthModule],
  controllers: [CourtController],
  providers: [CourtService, CourtRepository],
  exports: [CourtService],
})
export class CourtModule {}
