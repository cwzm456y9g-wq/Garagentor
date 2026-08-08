import { Controller, Get, Query, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProduces, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import type { Response } from 'express';
import { Roles } from '../auth/decorators/auth.decorators';
import { DatevService } from './datev.service';
import { DatevQueryDto } from './dto/datev.dto';

@ApiTags('Exporte')
@ApiBearerAuth('bearer')
@Roles(Role.GESCHAEFTSFUEHRUNG, Role.BUCHHALTUNG)
@Controller('exports')
export class ExportsController {
  constructor(private readonly datev: DatevService) {}

  @Get('datev/vorschau')
  @ApiOperation({
    summary: 'Was der Buchungsstapel enthalten würde, samt Beanstandungen',
  })
  async vorschau(@Query() query: DatevQueryDto) {
    const stapel = await this.datev.stapel(query);

    return {
      von: stapel.von,
      bis: stapel.bis,
      anzahl: stapel.buchungen.length,
      summe: stapel.summe,
      beanstandungen: stapel.beanstandungen,
      einstellungen: stapel.einstellungen,
      // Eine Handvoll Zeilen reicht zum Hinsehen; der Rest steht in der Datei.
      buchungen: stapel.buchungen.slice(0, 50),
    };
  }

  @Get('datev')
  @ApiProduces('text/csv')
  @ApiOperation({ summary: 'Buchungsstapel im DATEV-Format (EXTF) herunterladen' })
  async herunterladen(@Query() query: DatevQueryDto, @Res() response: Response): Promise<void> {
    const { inhalt, dateiname } = await this.datev.datei(query);

    // Windows-1252 gehört in den Kopf, sonst rät der Browser auf UTF-8.
    response.setHeader('Content-Type', 'text/csv; charset=windows-1252');
    response.setHeader('Content-Disposition', `attachment; filename="${dateiname}"`);
    response.setHeader('Content-Length', inhalt.length);
    response.setHeader('Cache-Control', 'no-store');
    response.end(inhalt);
  }
}
