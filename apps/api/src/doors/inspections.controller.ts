import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { DefectStatus, Role } from '@prisma/client';
import { IsEnum } from 'class-validator';
import { Roles } from '../auth/decorators/auth.decorators';
import {
  CompleteInspectionDto,
  DefectQueryDto,
  InspectionQueryDto,
  RecordChecksDto,
  ResolveDefectDto,
} from './dto/inspection.dto';
import { InspectionsService } from './inspections.service';

class UpdateDefectStatusDto {
  @IsEnum(DefectStatus)
  status: DefectStatus;
}

@ApiTags('Prüfungen (ASR A1.7)')
@ApiBearerAuth('bearer')
@Controller('inspections')
export class InspectionsController {
  constructor(private readonly inspections: InspectionsService) {}

  @Get()
  @ApiOperation({ summary: 'Prüfprotokolle auflisten' })
  findAll(@Query() query: InspectionQueryDto) {
    return this.inspections.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Prüfprotokoll mit allen Prüfpunkten' })
  findOne(@Param('id') id: string) {
    return this.inspections.findOne(id);
  }

  @Patch(':id/checks')
  @Roles(Role.GESCHAEFTSFUEHRUNG, Role.BUERO, Role.MONTEUR)
  @ApiOperation({
    summary: 'Prüfergebnisse erfassen; Messwerte über dem Grenzwert gelten als Mangel',
  })
  recordChecks(@Param('id') id: string, @Body() dto: RecordChecksDto) {
    return this.inspections.recordChecks(id, dto);
  }

  @Post(':id/complete')
  @Roles(Role.GESCHAEFTSFUEHRUNG, Role.BUERO, Role.MONTEUR)
  @ApiOperation({
    summary: 'Prüfung abschließen; Ergebnis, Mängel und nächste Frist werden ermittelt',
  })
  complete(@Param('id') id: string, @Body() dto: CompleteInspectionDto) {
    return this.inspections.complete(id, dto);
  }
}

@ApiTags('Mängel')
@ApiBearerAuth('bearer')
@Controller('defects')
export class DefectsController {
  constructor(private readonly inspections: InspectionsService) {}

  @Get()
  @ApiOperation({ summary: 'Mängel auflisten und filtern' })
  findAll(@Query() query: DefectQueryDto) {
    return this.inspections.findDefects(query);
  }

  @Patch(':id/status')
  @Roles(Role.GESCHAEFTSFUEHRUNG, Role.BUERO, Role.MONTEUR)
  @ApiOperation({ summary: 'Bearbeitungsstand eines Mangels setzen' })
  updateStatus(@Param('id') id: string, @Body() dto: UpdateDefectStatusDto) {
    return this.inspections.updateDefectStatus(id, dto.status);
  }

  @Post(':id/resolve')
  @Roles(Role.GESCHAEFTSFUEHRUNG, Role.BUERO, Role.MONTEUR)
  @ApiOperation({ summary: 'Mangel als behoben melden; gibt die Anlage ggf. wieder frei' })
  resolve(@Param('id') id: string, @Body() dto: ResolveDefectDto) {
    return this.inspections.resolveDefect(id, dto);
  }
}
