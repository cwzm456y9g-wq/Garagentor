import { DoorStatus, DoorType, OperationMode } from '@prisma/client';
import { z } from 'zod';
import { paginationSchema } from '@/server/anfrage';

/** Eingabeprüfung für Toranlagen. Aus class-validator übersetzt. */
const datum = z.string().refine((wert) => !Number.isNaN(Date.parse(wert)), {
  message: 'Bitte ein gültiges Datum angeben.',
});

/** `true` als Text oder als Wahrheitswert, wie der bisherige Transform. */
const jaNein = z
  .union([z.literal('true'), z.literal('false'), z.boolean()])
  .transform((wert) => wert === 'true' || wert === true)
  .optional();

const anlagenFelder = {
  customerId: z.string(),
  siteId: z.string().optional(),
  type: z.nativeEnum(DoorType),
  /**
   * Kraftbetätigte Anlagen unterliegen der Prüfpflicht nach ASR A1.7. Von
   * diesem Feld hängt ab, ob die Anlage überhaupt im Prüfplan auftaucht.
   */
  operationMode: z.nativeEnum(OperationMode).optional(),
  status: z.nativeEnum(DoorStatus).optional(),
  /** Einbauort, z. B. „Halle 2, Tor Nord". */
  location: z.string().max(200),
  manufacturer: z.string().max(100).optional(),
  model: z.string().max(100).optional(),
  serialNumber: z.string().max(100).optional(),
  yearBuilt: z.number().int().min(1900).max(2200).optional(),
  /** Lichte Breite in Millimetern. */
  widthMm: z.number().int().min(0).max(50_000).optional(),
  /** Lichte Höhe in Millimetern. */
  heightMm: z.number().int().min(0).max(50_000).optional(),
  /** Torblattgewicht in Kilogramm. */
  weightKg: z
    .number()
    .min(0)
    .refine((wert) => Number.isFinite(wert) && Math.round(wert * 100) === wert * 100, {
      message: 'Höchstens zwei Nachkommastellen.',
    })
    .optional(),
  driveManufacturer: z.string().max(100).optional(),
  driveModel: z.string().max(100).optional(),
  driveSerialNumber: z.string().max(100).optional(),
  installationDate: datum.optional(),
  warrantyUntil: datum.optional(),
  /** Ohne Angabe aus Einbaudatum + Prüfintervall ermittelt. */
  nextInspectionDue: datum.optional(),
  notes: z.string().max(4000).optional(),
};

export const createDoorSchema = z.object(anlagenFelder).strict();
export const updateDoorSchema = z.object(anlagenFelder).partial().strict();

export type CreateDoorDto = z.infer<typeof createDoorSchema>;
export type UpdateDoorDto = z.infer<typeof updateDoorSchema>;

export const doorQuerySchema = z.intersection(
  paginationSchema,
  z.object({
    customerId: z.string().optional(),
    siteId: z.string().optional(),
    type: z.nativeEnum(DoorType).optional(),
    status: z.nativeEnum(DoorStatus).optional(),
    operationMode: z.nativeEnum(OperationMode).optional(),
    /** Nur Anlagen mit fälliger oder überfälliger Prüfung. */
    inspectionDue: jaNein,
  }),
);

export type DoorQueryDto = z.infer<typeof doorQuerySchema>;
