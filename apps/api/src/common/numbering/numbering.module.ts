import { Global, Module } from '@nestjs/common';
import { NumberRangeService } from './number-range.service';

@Global()
@Module({
  providers: [NumberRangeService],
  exports: [NumberRangeService],
})
export class NumberingModule {}
