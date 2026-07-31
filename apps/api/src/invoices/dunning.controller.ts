import { Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../auth/decorators/auth.decorators';
import { DunningService } from './dunning.service';
import { DunningQueryDto } from './dto/dunning.dto';

@ApiTags('Mahnwesen')
@ApiBearerAuth('bearer')
@Roles(Role.GESCHAEFTSFUEHRUNG, Role.BUCHHALTUNG, Role.BUERO)
@Controller('dunnings')
export class DunningController {
  constructor(private readonly dunning: DunningService) {}

  @Get()
  @ApiOperation({ summary: 'Mahnungen auflisten' })
  findAll(@Query() query: DunningQueryDto) {
    return this.dunning.findAll(query);
  }

  @Get('preview')
  @ApiOperation({ summary: 'Vorschau des Mahnlaufs, ohne etwas zu speichern' })
  preview() {
    return this.dunning.preview();
  }

  @Post('run')
  @Roles(Role.GESCHAEFTSFUEHRUNG, Role.BUCHHALTUNG)
  @ApiOperation({ summary: 'Mahnlauf ausführen und Mahnungen als Entwurf anlegen' })
  run() {
    return this.dunning.run();
  }

  @Post(':id/send')
  @Roles(Role.GESCHAEFTSFUEHRUNG, Role.BUCHHALTUNG)
  @ApiOperation({ summary: 'Mahnung als versendet kennzeichnen' })
  send(@Param('id') id: string) {
    return this.dunning.send(id);
  }

  @Post(':id/cancel')
  @Roles(Role.GESCHAEFTSFUEHRUNG, Role.BUCHHALTUNG)
  @ApiOperation({ summary: 'Mahnung abbrechen' })
  cancel(@Param('id') id: string) {
    return this.dunning.cancel(id);
  }
}
