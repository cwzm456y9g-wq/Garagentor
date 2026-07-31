import { Injectable, Logger, Module } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CustomersModule } from '../customers/customers.module';
import { DunningController } from './dunning.controller';
import { DunningService } from './dunning.service';
import { InvoicesController } from './invoices.controller';
import { InvoicesService } from './invoices.service';

/**
 * Kennzeichnet fällige Rechnungen nächtlich als überfällig. Der Mahnlauf
 * selbst wird bewusst nicht automatisch ausgelöst, damit die Buchhaltung
 * die Mahnungen vor dem Versand prüfen kann.
 */
@Injectable()
class InvoiceOverdueTask {
  private readonly logger = new Logger(InvoiceOverdueTask.name);

  constructor(private readonly invoices: InvoicesService) {}

  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async run(): Promise<void> {
    const count = await this.invoices.markOverdue();
    if (count > 0) {
      this.logger.log(`${count} Rechnungen als überfällig gekennzeichnet`);
    }
  }
}

@Module({
  imports: [CustomersModule],
  controllers: [InvoicesController, DunningController],
  providers: [InvoicesService, DunningService, InvoiceOverdueTask],
  exports: [InvoicesService, DunningService],
})
export class InvoicesModule {}
