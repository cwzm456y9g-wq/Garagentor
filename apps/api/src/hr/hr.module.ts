import { Module } from '@nestjs/common';
import { AbsencesController, EmployeesController } from './hr.controller';
import { HrService } from './hr.service';

@Module({
  controllers: [EmployeesController, AbsencesController],
  providers: [HrService],
  exports: [HrService],
})
export class HrModule {}
