import { AbsenceStatus, AbsenceType, EmploymentType } from '@prisma/client';
import { z } from 'zod';
import { paginationSchema } from '@/server/anfrage';

/** Eingabeprüfung für Personal, Qualifikationen und Abwesenheiten. */
const datum = z.string().refine((wert) => !Number.isNaN(Date.parse(wert)), {
  message: 'Bitte ein gültiges Datum angeben.',
});

const zweiStellen = (wert: number) =>
  Number.isFinite(wert) && Math.round(wert * 100) === wert * 100;

const betrag = (max = Number.MAX_SAFE_INTEGER) =>
  z.number().min(0).max(max).refine(zweiStellen, { message: 'Höchstens zwei Nachkommastellen.' });

const jaNein = z
  .union([z.literal('true'), z.literal('false'), z.boolean()])
  .transform((wert) => wert === 'true' || wert === true)
  .optional();

const mitarbeiterFelder = {
  firstName: z.string().max(100),
  lastName: z.string().max(100),
  email: z.string().max(200).optional(),
  phone: z.string().max(50).optional(),
  mobile: z.string().max(50).optional(),
  position: z.string().max(100).optional(),
  employmentType: z.nativeEnum(EmploymentType).optional(),
  hireDate: datum,
  exitDate: datum.optional(),
  /** Wochenarbeitszeit in Stunden. */
  weeklyHours: betrag(60).optional(),
  /** Interner Stundensatz für die Nachkalkulation. */
  hourlyCost: betrag().optional(),
  /** Verrechnungssatz gegenüber Kunden. */
  hourlyRate: betrag().optional(),
  vacationDays: z.number().int().min(0).max(365).optional(),
  street: z.string().max(200).optional(),
  zip: z.string().max(10).optional(),
  city: z.string().max(100).optional(),
  birthDate: datum.optional(),
  notes: z.string().max(4000).optional(),
  active: z.boolean().optional(),
};

export const createEmployeeSchema = z.object(mitarbeiterFelder).strict();
export const updateEmployeeSchema = z.object(mitarbeiterFelder).partial().strict();

export type CreateEmployeeDto = z.infer<typeof createEmployeeSchema>;
export type UpdateEmployeeDto = z.infer<typeof updateEmployeeSchema>;

export const employeeQuerySchema = z.intersection(
  paginationSchema,
  z.object({
    employmentType: z.nativeEnum(EmploymentType).optional(),
    active: jaNein,
    /** Nur Sachkundige für die Prüfung nach ASR A1.7. */
    qualifiedInspectorsOnly: jaNein,
  }),
);

export type EmployeeQueryDto = z.infer<typeof employeeQuerySchema>;

const qualifikationsFelder = {
  name: z.string().max(200),
  issuer: z.string().max(200).optional(),
  /** Zertifikats- oder Urkundennummer. */
  certificate: z.string().max(100).optional(),
  issuedAt: datum.optional(),
  /** Ablaufdatum; ohne Angabe unbefristet. */
  expiresAt: datum.optional(),
  /**
   * Berechtigt zur wiederkehrenden Prüfung nach ASR A1.7. An diesem Kennzeichen
   * hängt, wer ein Prüfprotokoll unterschreiben darf.
   */
  qualifiesForInspection: z.boolean().optional(),
  notes: z.string().max(2000).optional(),
};

export const createQualificationSchema = z.object(qualifikationsFelder).strict();
export const updateQualificationSchema = z.object(qualifikationsFelder).partial().strict();

export type CreateQualificationDto = z.infer<typeof createQualificationSchema>;
export type UpdateQualificationDto = z.infer<typeof updateQualificationSchema>;

const abwesenheitsFelder = {
  /** Ohne Angabe der eigene Mitarbeiterdatensatz. */
  employeeId: z.string().optional(),
  type: z.nativeEnum(AbsenceType),
  from: datum,
  to: datum,
  /** Ohne Angabe aus den Werktagen im Zeitraum ermittelt. */
  days: betrag().optional(),
  reason: z.string().max(2000).optional(),
};

export const createAbsenceSchema = z.object(abwesenheitsFelder).strict();
export const updateAbsenceSchema = z.object(abwesenheitsFelder).partial().strict();

export type CreateAbsenceDto = z.infer<typeof createAbsenceSchema>;
export type UpdateAbsenceDto = z.infer<typeof updateAbsenceSchema>;

export const decideAbsenceSchema = z
  .object({
    status: z.nativeEnum(AbsenceStatus),
    reason: z.string().max(1000).optional(),
  })
  .strict();

export type DecideAbsenceDto = z.infer<typeof decideAbsenceSchema>;

export const absenceQuerySchema = z.intersection(
  paginationSchema,
  z.object({
    employeeId: z.string().optional(),
    type: z.nativeEnum(AbsenceType).optional(),
    status: z.nativeEnum(AbsenceStatus).optional(),
    from: datum.optional(),
    to: datum.optional(),
  }),
);

export type AbsenceQueryDto = z.infer<typeof absenceQuerySchema>;
