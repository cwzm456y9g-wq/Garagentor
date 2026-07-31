import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuthUser } from '@garagentor/shared';
import { Role } from '@prisma/client';
import { CurrentUser, Roles } from '../auth/decorators/auth.decorators';
import { AppointmentsService } from './appointments.service';
import {
  AppointmentQueryDto,
  CreateAppointmentDto,
  CreateProjectDto,
  CreateProjectTaskDto,
  CreateTimeEntryDto,
  ProjectQueryDto,
  TimeEntryQueryDto,
  UpdateAppointmentDto,
  UpdateProjectDto,
  UpdateProjectTaskDto,
  UpdateTimeEntryDto,
} from './dto/planning.dto';
import { ProjectsService } from './projects.service';
import { TimeEntriesService } from './time-entries.service';

@ApiTags('Termine')
@ApiBearerAuth('bearer')
@Controller('appointments')
export class AppointmentsController {
  constructor(private readonly appointments: AppointmentsService) {}

  @Get()
  @ApiOperation({ summary: 'Termine im Zeitraum auflisten' })
  findAll(@Query() query: AppointmentQueryDto) {
    return this.appointments.findAll(query);
  }

  @Get('day')
  @ApiOperation({ summary: 'Tagesplan des Betriebs oder eines Mitarbeiters' })
  daySchedule(@Query('date') date: string, @Query('employeeId') employeeId?: string) {
    return this.appointments.daySchedule(date, employeeId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Termin abrufen' })
  findOne(@Param('id') id: string) {
    return this.appointments.findOne(id);
  }

  @Post()
  @Roles(Role.GESCHAEFTSFUEHRUNG, Role.BUERO)
  @ApiOperation({ summary: 'Termin anlegen; Doppelbelegungen werden mitgeliefert' })
  create(@Body() dto: CreateAppointmentDto) {
    return this.appointments.create(dto);
  }

  @Patch(':id')
  @Roles(Role.GESCHAEFTSFUEHRUNG, Role.BUERO, Role.MONTEUR)
  @ApiOperation({ summary: 'Termin ändern oder Status setzen' })
  update(@Param('id') id: string, @Body() dto: UpdateAppointmentDto) {
    return this.appointments.update(id, dto);
  }

  @Delete(':id')
  @Roles(Role.GESCHAEFTSFUEHRUNG, Role.BUERO)
  @ApiOperation({ summary: 'Termin löschen' })
  remove(@Param('id') id: string) {
    return this.appointments.remove(id);
  }
}

@ApiTags('Projekte')
@ApiBearerAuth('bearer')
@Controller('projects')
export class ProjectsController {
  constructor(private readonly projects: ProjectsService) {}

  @Get()
  @ApiOperation({ summary: 'Projekte auflisten' })
  findAll(@Query() query: ProjectQueryDto) {
    return this.projects.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Projekt mit Aufgaben, Aufträgen und Fortschritt' })
  findOne(@Param('id') id: string) {
    return this.projects.findOne(id);
  }

  @Get(':id/summary')
  @Roles(Role.GESCHAEFTSFUEHRUNG, Role.BUERO, Role.BUCHHALTUNG)
  @ApiOperation({ summary: 'Budget, Auftragswert und erfasste Stunden' })
  summary(@Param('id') id: string) {
    return this.projects.summary(id);
  }

  @Post()
  @Roles(Role.GESCHAEFTSFUEHRUNG, Role.BUERO)
  @ApiOperation({ summary: 'Projekt anlegen' })
  create(@Body() dto: CreateProjectDto) {
    return this.projects.create(dto);
  }

  @Patch(':id')
  @Roles(Role.GESCHAEFTSFUEHRUNG, Role.BUERO)
  @ApiOperation({ summary: 'Projekt ändern' })
  update(@Param('id') id: string, @Body() dto: UpdateProjectDto) {
    return this.projects.update(id, dto);
  }

  @Delete(':id')
  @Roles(Role.GESCHAEFTSFUEHRUNG, Role.BUERO)
  @ApiOperation({ summary: 'Projekt löschen; mit Aufträgen nicht möglich' })
  remove(@Param('id') id: string) {
    return this.projects.remove(id);
  }

  @Post(':id/tasks')
  @Roles(Role.GESCHAEFTSFUEHRUNG, Role.BUERO)
  @ApiOperation({ summary: 'Aufgabe oder Meilenstein hinzufügen' })
  addTask(@Param('id') id: string, @Body() dto: CreateProjectTaskDto) {
    return this.projects.addTask(id, dto);
  }

  @Patch(':id/tasks/:taskId')
  @Roles(Role.GESCHAEFTSFUEHRUNG, Role.BUERO, Role.MONTEUR)
  @ApiOperation({ summary: 'Aufgabe ändern oder abhaken' })
  updateTask(
    @Param('id') id: string,
    @Param('taskId') taskId: string,
    @Body() dto: UpdateProjectTaskDto,
  ) {
    return this.projects.updateTask(id, taskId, dto);
  }

  @Delete(':id/tasks/:taskId')
  @Roles(Role.GESCHAEFTSFUEHRUNG, Role.BUERO)
  @ApiOperation({ summary: 'Aufgabe entfernen' })
  removeTask(@Param('id') id: string, @Param('taskId') taskId: string) {
    return this.projects.removeTask(id, taskId);
  }
}

@ApiTags('Zeiterfassung')
@ApiBearerAuth('bearer')
@Controller('time-entries')
export class TimeEntriesController {
  constructor(private readonly times: TimeEntriesService) {}

  @Get()
  @ApiOperation({ summary: 'Zeiten auflisten; Monteure sehen nur die eigenen' })
  findAll(@Query() query: TimeEntryQueryDto, @CurrentUser() user: AuthUser) {
    return this.times.findAll(query, user);
  }

  @Get('week')
  @ApiOperation({ summary: 'Wochenübersicht eines Mitarbeiters mit Tagessummen' })
  week(
    @Query('employeeId') employeeId: string,
    @Query('from') from: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.times.weekSummary(employeeId, from, user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Zeiteintrag abrufen' })
  findOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.times.findOne(id, user);
  }

  @Post()
  @ApiOperation({ summary: 'Zeit erfassen; Überschneidungen werden abgewiesen' })
  create(@Body() dto: CreateTimeEntryDto, @CurrentUser() user: AuthUser) {
    return this.times.create(dto, user);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Zeiteintrag ändern' })
  update(@Param('id') id: string, @Body() dto: UpdateTimeEntryDto, @CurrentUser() user: AuthUser) {
    return this.times.update(id, dto, user);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Zeiteintrag löschen' })
  remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.times.remove(id, user);
  }
}
