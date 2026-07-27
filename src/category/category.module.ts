import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CategoryController } from './category.controller';
import { CategoryRepository } from './category.repository';
import { CategoryService } from './category.service';
import { PlayerController } from './player/player.controller';
import { PlayerRepository } from './player/player.repository';
import { PlayerService } from './player/player.service';
import { TeamController } from './team/team.controller';
import { TeamRepository } from './team/team.repository';
import { TeamService } from './team/team.service';

@Module({
  imports: [AuthModule],
  controllers: [CategoryController, TeamController, PlayerController],
  providers: [
    CategoryService,
    CategoryRepository,
    TeamService,
    TeamRepository,
    PlayerService,
    PlayerRepository,
  ],
  exports: [CategoryService, TeamService, PlayerService],
})
export class CategoryModule {}
