import { Module } from '@nestjs/common';
import { FeldansichtController } from './feldansicht.controller';
import { FeldansichtService } from './feldansicht.service';

@Module({
  controllers: [FeldansichtController],
  providers: [FeldansichtService],
})
export class FeldansichtModule {}
