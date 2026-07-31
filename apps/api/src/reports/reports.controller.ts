import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../auth/decorators/auth.decorators';
import { ReportsService } from './reports.service';

@ApiTags('Auswertungen')
@ApiBearerAuth('bearer')
@Controller('reports')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'Kennzahlen der Startseite' })
  dashboard() {
    return this.reports.dashboard();
  }

  @Get('revenue')
  @Roles(Role.GESCHAEFTSFUEHRUNG, Role.BUERO, Role.BUCHHALTUNG)
  @ApiOperation({ summary: 'Umsatz je Monat eines Jahres' })
  revenue(@Query('year') year?: string) {
    return this.reports.revenueByMonth(year ? Number.parseInt(year, 10) : undefined);
  }

  @Get('top-customers')
  @Roles(Role.GESCHAEFTSFUEHRUNG, Role.BUERO, Role.BUCHHALTUNG)
  @ApiOperation({ summary: 'Umsatzstärkste Kunden im Zeitraum' })
  topCustomers(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('limit') limit?: string,
  ) {
    return this.reports.topCustomers(from, to, limit ? Number.parseInt(limit, 10) : undefined);
  }

  @Get('open-items')
  @Roles(Role.GESCHAEFTSFUEHRUNG, Role.BUERO, Role.BUCHHALTUNG)
  @ApiOperation({ summary: 'Offene Posten mit Verzugstagen' })
  openItems() {
    return this.reports.openItems();
  }

  @Get('employee-hours')
  @Roles(Role.GESCHAEFTSFUEHRUNG, Role.BUERO, Role.BUCHHALTUNG)
  @ApiOperation({ summary: 'Erfasste Stunden je Mitarbeiter' })
  employeeHours(@Query('from') from?: string, @Query('to') to?: string) {
    return this.reports.employeeHours(from, to);
  }

  @Get('orders')
  @ApiOperation({ summary: 'Auftragslage nach Status und Art' })
  orders() {
    return this.reports.orderStatistics();
  }

  @Get('inspections')
  @ApiOperation({ summary: 'Prüfstatistik nach ASR A1.7 mit offenen Mängeln' })
  inspections(@Query('year') year?: string) {
    return this.reports.inspectionStatistics(year ? Number.parseInt(year, 10) : undefined);
  }
}
