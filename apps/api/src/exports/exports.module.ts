import { Module } from '@nestjs/common';
import { DatevService } from './datev.service';
import { ExportsController } from './exports.controller';

@Module({
  controllers: [ExportsController],
  providers: [DatevService],
  exports: [DatevService],
})
export class ExportsModule {}
