import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PlayoffController } from './playoff.controller';
import { PlayoffRepository } from './playoff.repository';
import { PlayoffService } from './playoff.service';

@Module({
  imports: [AuthModule],
  controllers: [PlayoffController],
  providers: [PlayoffService, PlayoffRepository],
  exports: [PlayoffService],
})
export class PlayoffModule {}
