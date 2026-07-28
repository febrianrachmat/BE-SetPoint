import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DrawingController } from './drawing.controller';
import { DrawingRepository } from './drawing.repository';
import { DrawingService } from './drawing.service';

@Module({
  imports: [AuthModule],
  controllers: [DrawingController],
  providers: [DrawingService, DrawingRepository],
  exports: [DrawingService],
})
export class DrawingModule {}
