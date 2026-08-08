import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../auth/decorators/auth.decorators';
import { SavePresetDto, UpdateNumberRangeDto, UpsertSettingDto } from './dto/settings.dto';
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

  /* Vorlagen ----------------------------------------------------------- */

  @Get(':key/presets')
  @ApiOperation({ summary: 'Vorlagen einer Einstellung auflisten, Favorit zuerst' })
  findPresets(@Param('key') key: string) {
    return this.settings.findPresets(key);
  }

  @Post(':key/presets')
  @Roles(Role.GESCHAEFTSFUEHRUNG)
  @ApiOperation({ summary: 'Aktuellen Stand als Vorlage festhalten' })
  savePreset(@Param('key') key: string, @Body() dto: SavePresetDto) {
    return this.settings.savePreset(key, dto);
  }

  @Patch(':key/presets/:id/favorite')
  @Roles(Role.GESCHAEFTSFUEHRUNG)
  @ApiOperation({ summary: 'Vorlage als Favorit markieren' })
  markPresetFavorite(@Param('key') key: string, @Param('id') id: string) {
    return this.settings.markPresetFavorite(key, id);
  }

  @Post(':key/presets/:id/apply')
  @Roles(Role.GESCHAEFTSFUEHRUNG)
  @ApiOperation({ summary: 'Vorlage als aktuellen Stand einsetzen' })
  applyPreset(@Param('key') key: string, @Param('id') id: string) {
    return this.settings.applyPreset(key, id);
  }

  @Delete(':key/presets/:id')
  @Roles(Role.GESCHAEFTSFUEHRUNG)
  @ApiOperation({ summary: 'Vorlage entfernen' })
  removePreset(@Param('key') key: string, @Param('id') id: string) {
    return this.settings.removePreset(key, id);
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
