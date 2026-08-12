import { MaintenanceContractStatus, ServiceReportStatus } from '@prisma/client';
import { z } from 'zod';
import { paginationSchema } from '@/server/anfrage';

/** Eingabeprüfung für Serviceberichte und Wartungsverträge. */
const datum = z.string().refine((wert) => !Number.isNaN(Date.parse(wert)), {
  message: 'Bitte ein gültiges Datum angeben.',
});

const nachkomma = (stellen: number) => (wert: number) => {
  const faktor = 10 ** stellen;
  return Number.isFinite(wert) && Math.round(wert * faktor) === wert * faktor;
};

export const serviceMaterialSchema = z
  .object({
    /** Verbrauchter Lagerartikel. */
    articleId: z.string().optional(),
    name: z.string().max(300),
    quantity: z.number().min(0).refine(nachkomma(3), { message: 'Höchstens 3 Nachkommastellen.' }),
    unit: z.string().max(20).optional(),
    unitPrice: z
      .number()
      .min(0)
      .refine(nachkomma(2), { message: 'Höchstens 2 Nachkommastellen.' })
      .optional(),
  })
  .strict();

export type ServiceMaterialDto = z.infer<typeof serviceMaterialSchema>;

const berichtsFelder = {
  orderId: z.string().optional(),
  doorId: z.string().optional(),
  /** Ausführender Monteur. */
  technicianId: z.string().optional(),
  date: datum.optional(),
  arrivalTime: datum.optional(),
  departureTime: datum.optional(),
  /** Arbeitszeit in Stunden. */
  workHours: z
    .number()
    .min(0)
    .max(24)
    .refine(nachkomma(2), { message: 'Höchstens 2 Nachkommastellen.' })
    .optional(),
  /**
   * Fahrtkostenpauschale in Euro.
   *
   * Kein Stundenwert: Die Anfahrt wird als fester Betrag berechnet, unabhängig
   * davon, wie lange sie gedauert hat. Die gefahrenen Kilometer bleiben
   * daneben stehen – sie dienen der eigenen Nachkalkulation, nicht der
   * Rechnung.
   */
  travelFlatRate: z
    .number()
    .min(0)
    .max(9_999_999)
    .refine(nachkomma(2), { message: 'Höchstens 2 Nachkommastellen.' })
    .optional(),
  /** Gefahrene Kilometer. */
  travelKm: z
    .number()
    .min(0)
    .refine(nachkomma(2), { message: 'Höchstens 2 Nachkommastellen.' })
    .optional(),
  /** Vom Kunden geschilderte Störung. */
  faultDescription: z.string().max(4000).optional(),
  /** Ausgeführte Arbeiten. */
  workPerformed: z.string().max(4000),
  followUpRequired: z.boolean().optional(),
  followUpNote: z.string().max(2000).optional(),
  materials: z.array(serviceMaterialSchema).max(100).optional(),
};

export const createServiceReportSchema = z.object(berichtsFelder).strict();
export const updateServiceReportSchema = z.object(berichtsFelder).partial().strict();

export type CreateServiceReportDto = z.infer<typeof createServiceReportSchema>;
export type UpdateServiceReportDto = z.infer<typeof updateServiceReportSchema>;

export const completeServiceReportSchema = z
  .object({
    /** Unterschrift des Kunden als Data-URL. */
    signatureCustomer: z.string().max(500_000).optional(),
    /** Unterschrift des Monteurs als Data-URL. */
    signatureTechnician: z.string().max(500_000).optional(),
    /** Name der unterzeichnenden Person. */
    signedByName: z.string().max(200).optional(),
    /** Verbrauchtes Material aus dem Lager ausbuchen. */
    deductStock: z.boolean().optional(),
  })
  .strict();

export type CompleteServiceReportDto = z.infer<typeof completeServiceReportSchema>;

export const serviceReportQuerySchema = z.intersection(
  paginationSchema,
  z.object({
    orderId: z.string().optional(),
    doorId: z.string().optional(),
    technicianId: z.string().optional(),
    customerId: z.string().optional(),
    status: z.nativeEnum(ServiceReportStatus).optional(),
    from: datum.optional(),
    to: datum.optional(),
  }),
);

export type ServiceReportQueryDto = z.infer<typeof serviceReportQuerySchema>;

/* Wartungsverträge ---------------------------------------------------- */

const vertragsFelder = {
  customerId: z.string(),
  title: z.string().max(300),
  /** Wartungsintervall in Monaten. */
  intervalMonths: z.number().int().min(1).max(120).optional(),
  /** Pauschale je Wartungseinsatz. */
  price: z
    .number()
    .min(0)
    .refine(nachkomma(2), { message: 'Höchstens 2 Nachkommastellen.' })
    .optional(),
  startDate: datum,
  endDate: datum.optional(),
  /** Kündigungsfrist in Monaten. */
  noticePeriodMonths: z.number().int().min(0).max(24).optional(),
  /** Enthält die wiederkehrende Prüfung nach ASR A1.7. */
  includesInspection: z.boolean().optional(),
  /** Abgedeckte Toranlagen. */
  doorIds: z.array(z.string()).optional(),
  notes: z.string().max(4000).optional(),
};

export const createMaintenanceContractSchema = z.object(vertragsFelder).strict();

/** Beim Ändern kommt der Status hinzu, den das Anlegen nicht kennt. */
export const updateMaintenanceContractSchema = z
  .object({
    ...vertragsFelder,
    status: z.nativeEnum(MaintenanceContractStatus),
  })
  .partial()
  .strict();

export type CreateMaintenanceContractDto = z.infer<typeof createMaintenanceContractSchema>;
export type UpdateMaintenanceContractDto = z.infer<typeof updateMaintenanceContractSchema>;

export const maintenanceContractQuerySchema = z.intersection(
  paginationSchema,
  z.object({
    customerId: z.string().optional(),
    status: z.nativeEnum(MaintenanceContractStatus).optional(),
    /**
     * Nur Verträge mit fälliger Wartung.
     *
     * Wie beim Auftragsfilter `open` wandelte die NestJS-Fassung den Wert mit
     * `Boolean(...)` um und machte aus `'false'` ein `true`. Hier wird gelesen,
     * was dasteht.
     */
    dueOnly: z
      .enum(['true', 'false'])
      .transform((wert) => wert === 'true')
      .optional(),
  }),
);

export type MaintenanceContractQueryDto = z.infer<typeof maintenanceContractQuerySchema>;

export const recordMaintenanceSchema = z
  .object({
    /** Datum des Wartungseinsatzes; Standard ist heute. */
    date: datum.optional(),
  })
  .strict();

export type RecordMaintenanceDto = z.infer<typeof recordMaintenanceSchema>;
