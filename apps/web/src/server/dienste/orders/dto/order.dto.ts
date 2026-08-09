import { InvoiceType, OrderStatus, OrderType } from '@prisma/client';
import { z } from 'zod';
import { paginationSchema } from '@/server/anfrage';
import { lineItemSchema } from '../../common/dto/line-item.dto';

/** Eingabeprüfung für Aufträge. Aus class-validator übersetzt. */
const datum = z.string().refine((wert) => !Number.isNaN(Date.parse(wert)), {
  message: 'Bitte ein gültiges Datum angeben.',
});

const prozent = (min = 0) =>
  z
    .number()
    .min(min)
    .max(100)
    .refine((wert) => Number.isFinite(wert) && Math.round(wert * 100) === wert * 100, {
      message: 'Höchstens zwei Nachkommastellen.',
    });

const auftragsFelder = {
  customerId: z.string(),
  siteId: z.string().optional(),
  projectId: z.string().optional(),
  type: z.nativeEnum(OrderType).optional(),
  subject: z.string().max(300),
  description: z.string().max(4000).optional(),
  /** Bestellnummer oder Aktenzeichen des Kunden. */
  customerReference: z.string().max(100).optional(),
  plannedStart: datum.optional(),
  plannedEnd: datum.optional(),
  discountPercent: prozent().optional(),
  notes: z.string().max(4000).optional(),
  items: z.array(lineItemSchema).max(500).optional(),
};

export const createOrderSchema = z.object(auftragsFelder).strict();
export const updateOrderSchema = z.object(auftragsFelder).partial().strict();

export type CreateOrderDto = z.infer<typeof createOrderSchema>;
export type UpdateOrderDto = z.infer<typeof updateOrderSchema>;

export const orderQuerySchema = z.intersection(
  paginationSchema,
  z.object({
    status: z.nativeEnum(OrderStatus).optional(),
    type: z.nativeEnum(OrderType).optional(),
    customerId: z.string().optional(),
    projectId: z.string().optional(),
    /**
     * Nur noch nicht abgeschlossene Aufträge.
     *
     * Die NestJS-Fassung wandelte den Parameter mit `Boolean(wert)` um, was aus
     * der Zeichenkette `'false'` ein `true` machte. Die Oberfläche schickt nur
     * `true` oder gar nichts, traf die Falle also nie – ein direkter Aufruf mit
     * `open=false` hätte aber das Gegenteil des Gewollten bekommen.
     */
    open: z
      .enum(['true', 'false'])
      .transform((wert) => wert === 'true')
      .optional(),
  }),
);

export type OrderQueryDto = z.infer<typeof orderQuerySchema>;

export const updateOrderStatusSchema = z
  .object({
    status: z.nativeEnum(OrderStatus),
  })
  .strict();

export type UpdateOrderStatusDto = z.infer<typeof updateOrderStatusSchema>;

export const createInvoiceFromOrderSchema = z
  .object({
    type: z.nativeEnum(InvoiceType).optional(),
    /** Rechnungsdatum; Standard ist heute. */
    date: datum.optional(),
    /** Leistungsdatum für den Steuerausweis. */
    serviceDate: datum.optional(),
    /**
     * Prozentsatz für eine Abschlagsrechnung; ohne Angabe wird voll
     * abgerechnet. Die Untergrenze von 0,01 verhindert eine
     * Abschlagsrechnung über null Euro.
     */
    partialPercent: prozent(0.01).optional(),
    introText: z.string().max(4000).optional(),
    outroText: z.string().max(4000).optional(),
  })
  .strict();

export type CreateInvoiceFromOrderDto = z.infer<typeof createInvoiceFromOrderSchema>;
