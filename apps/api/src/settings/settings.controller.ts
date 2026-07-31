import { Body, Controller, Delete, Get, Param, Patch, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../auth/decorators/auth.decorators';
import { UpdateNumberRangeDto, UpsertSettingDto } from './dto/settings.dto';
import { SettingsService } from './settings.service';

@ApiTags('Einstellungen')
@ApiBearerAuth('bearer')
@Controller('settings')
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Get()
  @ApiOperation({ summary: 'Einstellungen auflisten, optional nach Kategorie' })
  findAll(@Query('category') category?: string) {
    return this.settings.findAll(category);
  }

  @Get('number-ranges')
  @Roles(Role.GESCHAEFTSFUEHRUNG, Role.BUERO)
  @ApiOperation({ summary: 'Nummernkreise inklusive der noch nicht angelegten' })
  numberRanges() {
    return this.settings.findNumberRanges();
  }

  @Get('number-ranges/:entity/preview')
  @Roles(Role.GESCHAEFTSFUEHRUNG, Role.BUERO)
  @ApiOperation({ summary: 'Nächste Nummer anzeigen, ohne den Zähler zu erhöhen' })
  previewNumber(@Param('entity') entity: string) {
    return this.settings.previewNumber(entity);
  }

  @Patch('number-ranges/:entity')
  @Roles(Role.GESCHAEFTSFUEHRUNG)
  @ApiOperation({ summary: 'Nummernkreis ändern; der Zähler darf nicht sinken' })
  updateNumberRange(@Param('entity') entity: string, @Body() dto: UpdateNumberRangeDto) {
    return this.settings.updateNumberRange(entity, dto);
  }

  @Get(':key')
  @ApiOperation({ summary: 'Einzelne Einstellung lesen' })
  findOne(@Param('key') key: string) {
    return this.settings.findOne(key);
  }

  @Put(':key')
  @Roles(Role.GESCHAEFTSFUEHRUNG)
  @ApiOperation({ summary: 'Einstellung anlegen oder ersetzen' })
  upsert(@Param('key') key: string, @Body() dto: UpsertSettingDto) {
    return this.settings.upsert(key, dto);
  }

  @Delete(':key')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Einstellung entfernen' })
  remove(@Param('key') key: string) {
    return this.settings.remove(key);
  }
}
