import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { AuthModule } from './auth/auth.module';
import { NumberingModule } from './common/numbering/numbering.module';
import { loadConfiguration } from './config/configuration';
import { CustomersModule } from './customers/customers.module';
import { HealthController } from './health/health.controller';
import { InvoicesModule } from './invoices/invoices.module';
import { OrdersModule } from './orders/orders.module';
import { PrismaModule } from './prisma/prisma.module';
import { QuotesModule } from './quotes/quotes.module';

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
    AuthModule,
    CustomersModule,
    QuotesModule,
    OrdersModule,
    InvoicesModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
