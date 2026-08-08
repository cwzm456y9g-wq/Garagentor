import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/auth.decorators';
import { FeldansichtService } from './feldansicht.service';

@ApiTags('Feldansicht')
@ApiBearerAuth('bearer')
@Controller('mein-tag')
export class FeldansichtController {
  constructor(private readonly feldansicht: FeldansichtService) {}

  @Get()
  @ApiQuery({ name: 'datum', required: false, description: 'Abweichender Tag, Standard ist heute' })
  @ApiOperation({ summary: 'Termine, offene Protokolle und Berichte des angemeldeten Benutzers' })
  meinTag(@CurrentUser('id') userId: string, @Query('datum') datum?: string) {
    return this.feldansicht.meinTag(userId, datum);
  }
}
