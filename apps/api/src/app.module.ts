import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { AuthModule } from './auth/auth.module';
import { AuditModule } from './common/audit/audit.module';
import { NumberingModule } from './common/numbering/numbering.module';
import { loadConfiguration } from './config/configuration';
import { CustomersModule } from './customers/customers.module';
import { DocumentsModule } from './documents/documents.module';
import { DoorsModule } from './doors/doors.module';
import { HealthController } from './health/health.controller';
import { HrModule } from './hr/hr.module';
import { InventoryModule } from './inventory/inventory.module';
import { InvoicesModule } from './invoices/invoices.module';
import { ExportsModule } from './exports/exports.module';
import { MailModule } from './mail/mail.module';
import { PdfModule } from './pdf/pdf.module';
import { OrdersModule } from './orders/orders.module';
import { PlanningModule } from './planning/planning.module';
import { PrismaModule } from './prisma/prisma.module';
import { QuotesModule } from './quotes/quotes.module';
import { ReportsModule } from './reports/reports.module';
import { SearchModule } from './search/search.module';
import { SettingsModule } from './settings/settings.module';

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
    AuditModule,
    NumberingModule,
    AuthModule,
    CustomersModule,
    QuotesModule,
    OrdersModule,
    InvoicesModule,
    PdfModule,
    MailModule,
    ExportsModule,
    DoorsModule,
    InventoryModule,
    PlanningModule,
    HrModule,
    DocumentsModule,
    ReportsModule,
    SettingsModule,
    SearchModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
