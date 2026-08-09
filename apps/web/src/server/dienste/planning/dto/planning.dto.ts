import {
  AppointmentStatus,
  AppointmentType,
  ProjectStatus,
  TaskStatus,
  TimeEntryType,
} from '@prisma/client';
import { z } from 'zod';
import { paginationSchema } from '@/server/anfrage';

/** Eingabeprüfung für Termine, Projekte und Zeiterfassung. */
const datum = z.string().refine((wert) => !Number.isNaN(Date.parse(wert)), {
  message: 'Bitte ein gültiges Datum angeben.',
});

const jaNein = z
  .union([z.literal('true'), z.literal('false'), z.boolean()])
  .transform((wert) => wert === 'true' || wert === true)
  .optional();

/* Termine -------------------------------------------------------------- */

const terminFelder = {
  title: z.string().max(300),
  type: z.nativeEnum(AppointmentType).optional(),
  start: datum,
  end: datum,
  allDay: z.boolean().optional(),
  customerId: z.string().optional(),
  siteId: z.string().optional(),
  orderId: z.string().optional(),
  location: z.string().max(300).optional(),
  description: z.string().max(4000).optional(),
  /** Eingeteilte Mitarbeiter. */
  assigneeIds: z.array(z.string()).max(50).optional(),
};

export const createAppointmentSchema = z.object(terminFelder).strict();

/** Beim Ändern kommt der Status hinzu, den das Anlegen nicht kennt. */
export const updateAppointmentSchema = z
  .object({ ...terminFelder, status: z.nativeEnum(AppointmentStatus) })
  .partial()
  .strict();

export type CreateAppointmentDto = z.infer<typeof createAppointmentSchema>;
export type UpdateAppointmentDto = z.infer<typeof updateAppointmentSchema>;

export const appointmentQuerySchema = z.intersection(
  paginationSchema,
  z.object({
    /** Termine ab diesem Zeitpunkt. */
    from: datum.optional(),
    /** Termine bis zu diesem Zeitpunkt. */
    to: datum.optional(),
    type: z.nativeEnum(AppointmentType).optional(),
    status: z.nativeEnum(AppointmentStatus).optional(),
    customerId: z.string().optional(),
    orderId: z.string().optional(),
    /** Nur Termine dieses Mitarbeiters. */
    employeeId: z.string().optional(),
  }),
);

export type AppointmentQueryDto = z.infer<typeof appointmentQuerySchema>;

/* Projekte ------------------------------------------------------------- */

const projektFelder = {
  name: z.string().max(300),
  customerId: z.string().optional(),
  siteId: z.string().optional(),
  /** Projektleitung. */
  managerId: z.string().optional(),
  description: z.string().max(4000).optional(),
  budget: z
    .number()
    .min(0)
    .refine((wert) => Number.isFinite(wert) && Math.round(wert * 100) === wert * 100, {
      message: 'Höchstens zwei Nachkommastellen.',
    })
    .optional(),
  startDate: datum.optional(),
  endDate: datum.optional(),
};

export const createProjectSchema = z.object(projektFelder).strict();
export const updateProjectSchema = z
  .object({ ...projektFelder, status: z.nativeEnum(ProjectStatus) })
  .partial()
  .strict();

export type CreateProjectDto = z.infer<typeof createProjectSchema>;
export type UpdateProjectDto = z.infer<typeof updateProjectSchema>;

export const projectQuerySchema = z.intersection(
  paginationSchema,
  z.object({
    status: z.nativeEnum(ProjectStatus).optional(),
    customerId: z.string().optional(),
    managerId: z.string().optional(),
  }),
);

export type ProjectQueryDto = z.infer<typeof projectQuerySchema>;

const aufgabenFelder = {
  title: z.string().max(300),
  description: z.string().max(4000).optional(),
  assigneeId: z.string().optional(),
  dueDate: datum.optional(),
  /** Meilenstein im Zeitplan. */
  milestone: z.boolean().optional(),
  position: z.number().int().min(0).optional(),
};

export const createProjectTaskSchema = z.object(aufgabenFelder).strict();
export const updateProjectTaskSchema = z
  .object({ ...aufgabenFelder, status: z.nativeEnum(TaskStatus) })
  .partial()
  .strict();

export type CreateProjectTaskDto = z.infer<typeof createProjectTaskSchema>;
export type UpdateProjectTaskDto = z.infer<typeof updateProjectTaskSchema>;

/* Zeiterfassung -------------------------------------------------------- */

const zeitFelder = {
  /** Ohne Angabe der eigene Mitarbeiterdatensatz. */
  employeeId: z.string().optional(),
  type: z.nativeEnum(TimeEntryType).optional(),
  start: datum,
  end: datum,
  /** Pause in Minuten. Die Obergrenze ist ein voller Tag. */
  breakMinutes: z.number().int().min(0).max(1440).optional(),
  orderId: z.string().optional(),
  projectId: z.string().optional(),
  /** Gegenüber dem Kunden abrechenbar. */
  billable: z.boolean().optional(),
  description: z.string().max(2000).optional(),
};

export const createTimeEntrySchema = z.object(zeitFelder).strict();
export const updateTimeEntrySchema = z.object(zeitFelder).partial().strict();

export type CreateTimeEntryDto = z.infer<typeof createTimeEntrySchema>;
export type UpdateTimeEntryDto = z.infer<typeof updateTimeEntrySchema>;

export const timeEntryQuerySchema = z.intersection(
  paginationSchema,
  z.object({
    employeeId: z.string().optional(),
    orderId: z.string().optional(),
    projectId: z.string().optional(),
    type: z.nativeEnum(TimeEntryType).optional(),
    from: datum.optional(),
    to: datum.optional(),
    /** Nur abrechenbare Zeiten. */
    billableOnly: jaNein,
  }),
);

export type TimeEntryQueryDto = z.infer<typeof timeEntryQuerySchema>;
