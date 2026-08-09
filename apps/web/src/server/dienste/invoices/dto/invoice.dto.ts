import { InvoiceStatus, InvoiceType, PaymentMethod } from '@prisma/client';
import { z } from 'zod';
import { paginationSchema } from '@/server/anfrage';
import { lineItemSchema } from '../../common/dto/line-item.dto';

/**
 * Eingabeprüfung für Rechnungen und Zahlungen. Aus class-validator übersetzt.
 *
 * Die Grenzen sind hier nicht kosmetisch: ein Skontosatz über 20 % oder eine
 * Frist über 90 Tage ist im Handwerk kein Zahlungsanreiz mehr, sondern ein
 * Tippfehler – und der fiele erst auf, wenn der Kunde ihn zieht.
 */
const datum = z.string().refine((wert) => !Number.isNaN(Date.parse(wert)), {
  message: 'Bitte ein gültiges Datum angeben.',
});

const zweiStellen = (wert: number) =>
  Number.isFinite(wert) && Math.round(wert * 100) === wert * 100;

const betrag = (min: number, max: number, meldung?: string) =>
  z
    .number()
    .min(min, meldung ? { message: meldung } : undefined)
    .max(max)
    .refine(zweiStellen, { message: 'Höchstens zwei Nachkommastellen.' });

const rechnungsFelder = {
  customerId: z.string(),
  orderId: z.string().optional(),
  type: z.nativeEnum(InvoiceType).optional(),
  subject: z.string().max(300),
  /** Rechnungsdatum; Standard ist heute. */
  date: datum.optional(),
  /** Standard: Rechnungsdatum + Zahlungsziel des Kunden. */
  dueDate: datum.optional(),
  /** Leistungsdatum für den Steuerausweis. */
  serviceDate: datum.optional(),
  introText: z.string().max(4000).optional(),
  outroText: z.string().max(4000).optional(),
  discountPercent: betrag(0, 100).optional(),
  /** Skontosatz in Prozent; ohne Angabe aus den Einstellungen. */
  skontoPercent: betrag(0, 20).optional(),
  /** Skontofrist in Tagen ab Rechnungsdatum. */
  skontoDays: z.number().int().min(0).max(90).optional(),
  notes: z.string().max(4000).optional(),
  items: z.array(lineItemSchema).max(500).default([]),
};

export const createInvoiceSchema = z.object(rechnungsFelder).strict();
export const updateInvoiceSchema = z.object(rechnungsFelder).partial().strict();

export type CreateInvoiceDto = z.infer<typeof createInvoiceSchema>;
export type UpdateInvoiceDto = z.infer<typeof updateInvoiceSchema>;

/** `true` als Text oder als Wahrheitswert, wie der bisherige Transform. */
const jaNein = z
  .union([z.literal('true'), z.literal('false'), z.boolean()])
  .transform((wert) => wert === 'true' || wert === true)
  .optional();

export const invoiceQuerySchema = z.intersection(
  paginationSchema,
  z.object({
    status: z.nativeEnum(InvoiceStatus).optional(),
    type: z.nativeEnum(InvoiceType).optional(),
    customerId: z.string().optional(),
    /** Nur offene Posten. */
    openOnly: jaNein,
    /** Nur überfällige Rechnungen. */
    overdueOnly: jaNein,
    from: datum.optional(),
    to: datum.optional(),
  }),
);

export type InvoiceQueryDto = z.infer<typeof invoiceQuerySchema>;

export const createPaymentSchema = z
  .object({
    /** Zahlbetrag in Euro. */
    amount: betrag(0.01, 99_999_999, 'Der Zahlbetrag muss größer als null sein.'),
    /** Zahlungsdatum; Standard ist heute. */
    date: datum.optional(),
    method: z.nativeEnum(PaymentMethod).optional(),
    /** Verwendungszweck oder Belegnummer. */
    reference: z.string().max(200).optional(),
    notes: z.string().max(1000).optional(),
  })
  .strict();

export type CreatePaymentDto = z.infer<typeof createPaymentSchema>;

export const cancelInvoiceSchema = z
  .object({
    /** Grund der Stornierung. */
    reason: z.string().max(1000).optional(),
  })
  .strict();

export type CancelInvoiceDto = z.infer<typeof cancelInvoiceSchema>;
