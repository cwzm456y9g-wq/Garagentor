import { Module } from '@nestjs/common';
import { AppointmentsService } from './appointments.service';
import {
  AppointmentsController,
  ProjectsController,
  TimeEntriesController,
} from './planning.controller';
import { ProjectsService } from './projects.service';
import { TimeEntriesService } from './time-entries.service';

@Module({
  controllers: [AppointmentsController, ProjectsController, TimeEntriesController],
  providers: [AppointmentsService, ProjectsService, TimeEntriesService],
  exports: [AppointmentsService, ProjectsService, TimeEntriesService],
})
export class PlanningModule {}
