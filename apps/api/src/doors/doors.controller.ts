import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ASR_A17_CHECK_CATALOG, CLOSING_FORCE_LIMITS, checkCatalogFor } from '@garagentor/shared';
import { OperationMode, Role } from '@prisma/client';
import { Roles } from '../auth/decorators/auth.decorators';
import { DoorsService } from './doors.service';
import { CreateDoorDto, DoorQueryDto, UpdateDoorDto } from './dto/door.dto';
import { CreateDefectDto, StartInspectionDto } from './dto/inspection.dto';
import { InspectionsService } from './inspections.service';

@ApiTags('Toranlagen')
@ApiBearerAuth('bearer')
@Controller('doors')
export class DoorsController {
  constructor(
    private readonly doors: DoorsService,
    private readonly inspections: InspectionsService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Toranlagen auflisten und filtern' })
  findAll(@Query() query: DoorQueryDto) {
    return this.doors.findAll(query);
  }

  @Get('inspections-due')
  @ApiOperation({ summary: 'Anlagen mit anstehender oder überschrittener Prüffrist' })
  inspectionsDue(@Query('withinDays') withinDays?: string) {
    return this.doors.inspectionsDue(withinDays ? Number.parseInt(withinDays, 10) : undefined);
  }

  @Get('check-catalog')
  @ApiOperation({
    summary: 'Prüfkatalog nach ASR A1.7 mit den Grenzwerten der Kraftmessung',
  })
  checkCatalog(@Query('operationMode') operationMode?: OperationMode) {
    return {
      checks: operationMode ? checkCatalogFor(operationMode) : ASR_A17_CHECK_CATALOG,
      forceLimits: CLOSING_FORCE_LIMITS,
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Toranlage mit Prüfhistorie, Mängeln und Berichten' })
  findOne(@Param('id') id: string) {
    return this.doors.findOne(id);
  }

  @Post()
  @Roles(Role.GESCHAEFTSFUEHRUNG, Role.BUERO, Role.MONTEUR)
  @ApiOperation({ summary: 'Toranlage anlegen; die erste Prüffrist wird ermittelt' })
  create(@Body() dto: CreateDoorDto) {
    return this.doors.create(dto);
  }

  @Patch(':id')
  @Roles(Role.GESCHAEFTSFUEHRUNG, Role.BUERO, Role.MONTEUR)
  @ApiOperation({ summary: 'Toranlage ändern' })
  update(@Param('id') id: string, @Body() dto: UpdateDoorDto) {
    return this.doors.update(id, dto);
  }

  @Delete(':id')
  @Roles(Role.GESCHAEFTSFUEHRUNG, Role.BUERO)
  @ApiOperation({ summary: 'Toranlage löschen; mit Prüfhistorie nur stilllegen' })
  remove(@Param('id') id: string) {
    return this.doors.remove(id);
  }

  @Post(':id/inspections')
  @Roles(Role.GESCHAEFTSFUEHRUNG, Role.BUERO, Role.MONTEUR)
  @ApiOperation({ summary: 'Prüfung nach ASR A1.7 beginnen; Prüfpunkte werden vorbelegt' })
  startInspection(@Param('id') id: string, @Body() dto: StartInspectionDto) {
    return this.inspections.start(id, dto);
  }

  @Post(':id/defects')
  @Roles(Role.GESCHAEFTSFUEHRUNG, Role.BUERO, Role.MONTEUR)
  @ApiOperation({ summary: 'Mangel außerhalb einer Prüfung erfassen' })
  createDefect(@Param('id') id: string, @Body() dto: CreateDefectDto) {
    return this.inspections.createDefect(id, dto);
  }
}
