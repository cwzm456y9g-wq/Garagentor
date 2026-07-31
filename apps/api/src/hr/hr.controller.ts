import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuthUser } from '@garagentor/shared';
import { Role } from '@prisma/client';
import { CurrentUser, Roles } from '../auth/decorators/auth.decorators';
import {
  AbsenceQueryDto,
  CreateAbsenceDto,
  CreateEmployeeDto,
  CreateQualificationDto,
  DecideAbsenceDto,
  EmployeeQueryDto,
  UpdateAbsenceDto,
  UpdateEmployeeDto,
  UpdateQualificationDto,
} from './dto/hr.dto';
import { HrService } from './hr.service';

@ApiTags('Personal')
@ApiBearerAuth('bearer')
@Controller('employees')
export class EmployeesController {
  constructor(private readonly hr: HrService) {}

  @Get()
  @ApiOperation({ summary: 'Mitarbeiter auflisten; Sachkundige filterbar' })
  findAll(@Query() query: EmployeeQueryDto) {
    return this.hr.findAll(query);
  }

  @Get('expiring-qualifications')
  @Roles(Role.GESCHAEFTSFUEHRUNG, Role.BUERO)
  @ApiOperation({ summary: 'Ablaufende und abgelaufene Qualifikationen' })
  expiring(@Query('withinDays') withinDays?: string) {
    return this.hr.expiringQualifications(withinDays ? Number.parseInt(withinDays, 10) : undefined);
  }

  @Get(':id')
  @Roles(Role.GESCHAEFTSFUEHRUNG, Role.BUERO, Role.BUCHHALTUNG)
  @ApiOperation({ summary: 'Mitarbeiter mit Qualifikationen und Urlaubskonto' })
  findOne(@Param('id') id: string) {
    return this.hr.findOne(id);
  }

  @Get(':id/vacation')
  @Roles(Role.GESCHAEFTSFUEHRUNG, Role.BUERO)
  @ApiOperation({ summary: 'Urlaubskonto eines Jahres' })
  vacation(@Param('id') id: string, @Query('year') year?: string) {
    return this.hr.vacationBalance(id, year ? Number.parseInt(year, 10) : new Date().getFullYear());
  }

  @Post()
  @Roles(Role.GESCHAEFTSFUEHRUNG)
  @ApiOperation({ summary: 'Mitarbeiter anlegen' })
  create(@Body() dto: CreateEmployeeDto) {
    return this.hr.create(dto);
  }

  @Patch(':id')
  @Roles(Role.GESCHAEFTSFUEHRUNG)
  @ApiOperation({ summary: 'Mitarbeiter ändern' })
  update(@Param('id') id: string, @Body() dto: UpdateEmployeeDto) {
    return this.hr.update(id, dto);
  }

  @Delete(':id')
  @Roles(Role.GESCHAEFTSFUEHRUNG)
  @ApiOperation({ summary: 'Mitarbeiter löschen; mit Historie nur deaktivieren' })
  remove(@Param('id') id: string) {
    return this.hr.remove(id);
  }

  @Post(':id/qualifications')
  @Roles(Role.GESCHAEFTSFUEHRUNG, Role.BUERO)
  @ApiOperation({ summary: 'Qualifikationsnachweis hinterlegen' })
  addQualification(@Param('id') id: string, @Body() dto: CreateQualificationDto) {
    return this.hr.addQualification(id, dto);
  }

  @Patch(':id/qualifications/:qualificationId')
  @Roles(Role.GESCHAEFTSFUEHRUNG, Role.BUERO)
  @ApiOperation({ summary: 'Qualifikation ändern' })
  updateQualification(
    @Param('id') id: string,
    @Param('qualificationId') qualificationId: string,
    @Body() dto: UpdateQualificationDto,
  ) {
    return this.hr.updateQualification(id, qualificationId, dto);
  }

  @Delete(':id/qualifications/:qualificationId')
  @Roles(Role.GESCHAEFTSFUEHRUNG)
  @ApiOperation({ summary: 'Qualifikation entfernen' })
  removeQualification(@Param('id') id: string, @Param('qualificationId') qualificationId: string) {
    return this.hr.removeQualification(id, qualificationId);
  }
}

@ApiTags('Abwesenheiten')
@ApiBearerAuth('bearer')
@Controller('absences')
export class AbsencesController {
  constructor(private readonly hr: HrService) {}

  @Get()
  @ApiOperation({ summary: 'Abwesenheiten auflisten; Monteure sehen nur eigene' })
  findAll(@Query() query: AbsenceQueryDto, @CurrentUser() user: AuthUser) {
    return this.hr.findAbsences(query, user);
  }

  @Post()
  @ApiOperation({ summary: 'Abwesenheit beantragen; Werktage werden ermittelt' })
  create(@Body() dto: CreateAbsenceDto, @CurrentUser() user: AuthUser) {
    return this.hr.createAbsence(dto, user);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Beantragte Abwesenheit ändern' })
  update(@Param('id') id: string, @Body() dto: UpdateAbsenceDto, @CurrentUser() user: AuthUser) {
    return this.hr.updateAbsence(id, dto, user);
  }

  @Post(':id/decide')
  @Roles(Role.GESCHAEFTSFUEHRUNG, Role.BUERO)
  @ApiOperation({ summary: 'Antrag genehmigen oder ablehnen' })
  decide(@Param('id') id: string, @Body() dto: DecideAbsenceDto, @CurrentUser() user: AuthUser) {
    return this.hr.decideAbsence(id, dto, user);
  }

  @Post(':id/cancel')
  @ApiOperation({ summary: 'Abwesenheit stornieren' })
  cancel(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.hr.cancelAbsence(id, user);
  }
}
