import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../auth/decorators/auth.decorators';
import {
  CompleteServiceReportDto,
  CreateMaintenanceContractDto,
  CreateServiceReportDto,
  MaintenanceContractQueryDto,
  RecordMaintenanceDto,
  ServiceReportQueryDto,
  UpdateMaintenanceContractDto,
  UpdateServiceReportDto,
} from './dto/service-report.dto';
import { ServiceReportsService } from './service-reports.service';

@ApiTags('Serviceberichte')
@ApiBearerAuth('bearer')
@Controller('service-reports')
export class ServiceReportsController {
  constructor(private readonly reports: ServiceReportsService) {}

  @Get()
  @ApiOperation({ summary: 'Serviceberichte auflisten und filtern' })
  findAll(@Query() query: ServiceReportQueryDto) {
    return this.reports.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Servicebericht mit Material abrufen' })
  findOne(@Param('id') id: string) {
    return this.reports.findOne(id);
  }

  @Post()
  @Roles(Role.GESCHAEFTSFUEHRUNG, Role.BUERO, Role.MONTEUR)
  @ApiOperation({ summary: 'Servicebericht anlegen' })
  create(@Body() dto: CreateServiceReportDto) {
    return this.reports.create(dto);
  }

  @Patch(':id')
  @Roles(Role.GESCHAEFTSFUEHRUNG, Role.BUERO, Role.MONTEUR)
  @ApiOperation({ summary: 'Entwurf eines Serviceberichts ändern' })
  update(@Param('id') id: string, @Body() dto: UpdateServiceReportDto) {
    return this.reports.update(id, dto);
  }

  @Post(':id/complete')
  @Roles(Role.GESCHAEFTSFUEHRUNG, Role.BUERO, Role.MONTEUR)
  @ApiOperation({ summary: 'Bericht abschließen und Material aus dem Lager ausbuchen' })
  complete(@Param('id') id: string, @Body() dto: CompleteServiceReportDto) {
    return this.reports.complete(id, dto);
  }

  @Delete(':id')
  @Roles(Role.GESCHAEFTSFUEHRUNG, Role.BUERO)
  @ApiOperation({ summary: 'Entwurf löschen; abgeschlossene Berichte bleiben erhalten' })
  remove(@Param('id') id: string) {
    return this.reports.remove(id);
  }
}

@ApiTags('Wartungsverträge')
@ApiBearerAuth('bearer')
@Controller('maintenance-contracts')
export class MaintenanceContractsController {
  constructor(private readonly reports: ServiceReportsService) {}

  @Get()
  @ApiOperation({ summary: 'Wartungsverträge auflisten' })
  findAll(@Query() query: MaintenanceContractQueryDto) {
    return this.reports.findContracts(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Wartungsvertrag mit abgedeckten Toranlagen' })
  findOne(@Param('id') id: string) {
    return this.reports.findContract(id);
  }

  @Post()
  @Roles(Role.GESCHAEFTSFUEHRUNG, Role.BUERO)
  @ApiOperation({ summary: 'Wartungsvertrag anlegen' })
  create(@Body() dto: CreateMaintenanceContractDto) {
    return this.reports.createContract(dto);
  }

  @Patch(':id')
  @Roles(Role.GESCHAEFTSFUEHRUNG, Role.BUERO)
  @ApiOperation({ summary: 'Wartungsvertrag ändern' })
  update(@Param('id') id: string, @Body() dto: UpdateMaintenanceContractDto) {
    return this.reports.updateContract(id, dto);
  }

  @Post(':id/record-service')
  @Roles(Role.GESCHAEFTSFUEHRUNG, Role.BUERO, Role.MONTEUR)
  @ApiOperation({ summary: 'Wartungseinsatz vermerken; der nächste Termin wird berechnet' })
  recordService(@Param('id') id: string, @Body() dto: RecordMaintenanceDto) {
    return this.reports.recordMaintenance(id, dto);
  }

  @Delete(':id')
  @Roles(Role.GESCHAEFTSFUEHRUNG, Role.BUERO)
  @ApiOperation({ summary: 'Vertrag löschen; nach dem ersten Einsatz nur kündigen' })
  remove(@Param('id') id: string) {
    return this.reports.removeContract(id);
  }
}
