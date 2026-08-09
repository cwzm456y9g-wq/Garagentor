import { CheckResult, DefectSeverity, DefectStatus, InspectionType } from '@prisma/client';
import { z } from 'zod';
import { paginationSchema } from '@/server/anfrage';

/**
 * Eingabeprüfung für Prüfprotokolle und Mängel. Aus class-validator übersetzt.
 *
 * Das Protokoll ist ein Nachweisdokument nach ASR A1.7 und muss über die
 * Nutzungsdauer der Anlage aufbewahrt werden. Entsprechend großzügig sind die
 * Grenzen für Unterschriften – ein handgeschriebener Zug auf einem
 * hochauflösenden Tablet wird als Data-URL schnell groß.
 */
const datum = z.string().refine((wert) => !Number.isNaN(Date.parse(wert)), {
  message: 'Bitte ein gültiges Datum angeben.',
});

const jaNein = z
  .union([z.literal('true'), z.literal('false'), z.boolean()])
  .transform((wert) => wert === 'true' || wert === true)
  .optional();

/** Startet ein Prüfprotokoll; die Prüfpunkte kommen aus dem Katalog. */
export const startInspectionSchema = z
  .object({
    type: z.nativeEnum(InspectionType).optional(),
    /** Prüfdatum; Standard ist heute. */
    date: datum.optional(),
    /** Sachkundige Person aus dem Mitarbeiterstamm. */
    inspectorId: z.string().optional(),
    /** Name der prüfenden Person, auch bei Fremdprüfung. */
    inspectorName: z.string().max(200).optional(),
    /** Zugehöriger Auftrag. */
    orderId: z.string().optional(),
  })
  .strict();

export type StartInspectionDto = z.infer<typeof startInspectionSchema>;

export const inspectionCheckResultSchema = z
  .object({
    /** Schlüssel des Prüfpunkts aus dem Katalog. */
    key: z.string().max(60),
    result: z.nativeEnum(CheckResult),
    /** Messwert, z. B. Schließkraft in Newton. */
    measuredValue: z
      .number()
      .refine((wert) => Number.isFinite(wert) && Math.round(wert * 100) === wert * 100, {
        message: 'Höchstens zwei Nachkommastellen.',
      })
      .optional(),
    comment: z.string().max(2000).optional(),
  })
  .strict();

export type InspectionCheckResultDto = z.infer<typeof inspectionCheckResultSchema>;

/** Trägt die Ergebnisse einzelner Prüfpunkte nach. */
export const recordChecksSchema = z
  .object({
    checks: z.array(inspectionCheckResultSchema).max(200),
  })
  .strict();

export type RecordChecksDto = z.infer<typeof recordChecksSchema>;

export const completeInspectionSchema = z
  .object({
    /** Ohne Angabe wird das Ergebnis aus den Prüfpunkten abgeleitet. */
    summary: z.string().max(2000).optional(),
    recommendation: z.string().max(2000).optional(),
    /** Unterschrift der prüfenden Person als Data-URL. */
    signatureInspector: z.string().max(500_000).optional(),
    /** Unterschrift des Kunden als Data-URL. */
    signatureCustomer: z.string().max(500_000).optional(),
    signedByName: z.string().max(200).optional(),
    /**
     * Abweichende Prüffrist in Monaten; Standard ist das Intervall aus den
     * Einstellungen.
     */
    intervalMonths: z.number().int().min(1).max(120).optional(),
  })
  .strict();

export type CompleteInspectionDto = z.infer<typeof completeInspectionSchema>;

export const inspectionQuerySchema = z.intersection(
  paginationSchema,
  z.object({
    doorId: z.string().optional(),
    customerId: z.string().optional(),
    type: z.nativeEnum(InspectionType).optional(),
    /** Nur noch nicht abgeschlossene Protokolle. */
    openOnly: jaNein,
    from: datum.optional(),
    to: datum.optional(),
  }),
);

export type InspectionQueryDto = z.infer<typeof inspectionQuerySchema>;

export const createDefectSchema = z
  .object({
    severity: z.nativeEnum(DefectSeverity).optional(),
    title: z.string().max(300),
    description: z.string().max(4000).optional(),
    /** Prüfpunkt, aus dem der Mangel hervorgeht. */
    checkKey: z.string().max(60).optional(),
    /** Ohne Angabe je nach Schweregrad ermittelt. */
    dueDate: datum.optional(),
  })
  .strict();

export type CreateDefectDto = z.infer<typeof createDefectSchema>;

export const resolveDefectSchema = z
  .object({
    resolvedNote: z.string().max(2000).optional(),
  })
  .strict();

export type ResolveDefectDto = z.infer<typeof resolveDefectSchema>;

export const defectQuerySchema = z.intersection(
  paginationSchema,
  z.object({
    doorId: z.string().optional(),
    customerId: z.string().optional(),
    status: z.nativeEnum(DefectStatus).optional(),
    severity: z.nativeEnum(DefectSeverity).optional(),
    /** Nur Mängel mit überschrittener Frist. */
    overdueOnly: jaNein,
  }),
);

export type DefectQueryDto = z.infer<typeof defectQuerySchema>;

/**
 * Bearbeitungsstand eines Mangels. Stand im Controller selbst, weil er aus
 * einem einzigen Feld besteht.
 */
export const updateDefectStatusSchema = z
  .object({
    status: z.nativeEnum(DefectStatus),
  })
  .strict();

export type UpdateDefectStatusDto = z.infer<typeof updateDefectStatusSchema>;
