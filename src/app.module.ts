import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { DomainEventsModule } from './common/events/domain-events.module';
import { PrismaModule } from './prisma/prisma.module';
import { CategoryModule } from './category/category.module';
import { DrawingModule } from './drawing/drawing.module';
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
    DrawingModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}