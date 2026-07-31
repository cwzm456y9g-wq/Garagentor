import { Injectable, Logger, Module } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CustomersModule } from '../customers/customers.module';
import { QuotesController } from './quotes.controller';
import { QuotesService } from './quotes.service';

/** Setzt abgelaufene Angebote nächtlich auf ABGELAUFEN. */
@Injectable()
class QuoteExpiryTask {
  private readonly logger = new Logger(QuoteExpiryTask.name);

  constructor(private readonly quotes: QuotesService) {}

  @Cron(CronExpression.EVERY_DAY_AT_1AM)
  async run(): Promise<void> {
    const count = await this.quotes.expireOverdue();
    if (count > 0) {
      this.logger.log(`${count} Angebote als abgelaufen gekennzeichnet`);
    }
  }
}

@Module({
  imports: [CustomersModule],
  controllers: [QuotesController],
  providers: [QuotesService, QuoteExpiryTask],
  exports: [QuotesService],
})
export class QuotesModule {}
