import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { NumberingModule } from './common/numbering/numbering.module';
import { loadConfiguration } from './config/configuration';
import { HealthController } from './health/health.controller';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      // .env liegt im Wurzelverzeichnis des Monorepos.
      envFilePath: ['.env', '../../.env'],
      load: [loadConfiguration],
    }),
    ScheduleModule.forRoot(),
    PrismaModule,
    NumberingModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
