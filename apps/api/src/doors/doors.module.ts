import { Injectable, Logger, Module } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CustomersModule } from '../customers/customers.module';
import { DoorsController } from './doors.controller';
import { DoorsService } from './doors.service';
import { DefectsController, InspectionsController } from './inspections.controller';
import { InspectionsService } from './inspections.service';
import {
  MaintenanceContractsController,
  ServiceReportsController,
} from './service-reports.controller';
import { ServiceReportsService } from './service-reports.service';

/** Setzt abgelaufene Wartungsverträge nächtlich auf ABGELAUFEN. */
@Injectable()
class MaintenanceContractTask {
  private readonly logger = new Logger(MaintenanceContractTask.name);

  constructor(private readonly reports: ServiceReportsService) {}

  @Cron(CronExpression.EVERY_DAY_AT_4AM)
  async run(): Promise<void> {
    const count = await this.reports.expireContracts();
    if (count > 0) {
      this.logger.log(`${count} Wartungsverträge als abgelaufen gekennzeichnet`);
    }
  }
}

@Module({
  imports: [CustomersModule],
  controllers: [
    DoorsController,
    InspectionsController,
    DefectsController,
    ServiceReportsController,
    MaintenanceContractsController,
  ],
  providers: [DoorsService, InspectionsService, ServiceReportsService, MaintenanceContractTask],
  exports: [DoorsService, InspectionsService, ServiceReportsService],
})
export class DoorsModule {}
