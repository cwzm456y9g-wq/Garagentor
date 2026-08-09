import { OrderType, QuoteStatus } from '@prisma/client';
import { z } from 'zod';
import { paginationSchema } from '@/server/anfrage';
import { lineItemSchema } from '../../common/dto/line-item.dto';

/**
 * Eingabeprüfung für Angebote. Aus class-validator übersetzt.
 *
 * Datumsangaben kommen als ISO-Zeichenkette und bleiben es auch – die Dienste
 * wandeln selbst um. `z.string().datetime()` wäre zu streng: die Oberfläche
 * schickt teils reine Tagesangaben ohne Uhrzeit, was `@IsDateString` erlaubte.
 */
const datum = z.string().refine((wert) => !Number.isNaN(Date.parse(wert)), {
  message: 'Bitte ein gültiges Datum angeben.',
});

const prozent = z
  .number()
  .min(0)
  .max(100)
  .refine((wert) => Number.isFinite(wert) && Math.round(wert * 100) === wert * 100, {
    message: 'Höchstens zwei Nachkommastellen.',
  });

const angebotsFelder = {
  customerId: z.string(),
  siteId: z.string().optional(),
  subject: z.string().max(300),
  /** Angebotsdatum; Standard ist heute. */
  date: datum.optional(),
  /** Standard: Angebotsdatum + 30 Tage. */
  validUntil: datum.optional(),
  introText: z.string().max(4000).optional(),
  outroText: z.string().max(4000).optional(),
  /** Gesamtrabatt in Prozent. */
  discountPercent: prozent.optional(),
  notes: z.string().max(4000).optional(),
  // Die Obergrenze steht bewusst da: ein Beleg mit fünfhundert Positionen ist
  // kein Angebot mehr, sondern ein Angriff auf den Speicher.
  items: z.array(lineItemSchema).max(500).default([]),
};

export const createQuoteSchema = z.object(angebotsFelder).strict();
export const updateQuoteSchema = z.object(angebotsFelder).partial().strict();

export type CreateQuoteDto = z.infer<typeof createQuoteSchema>;
export type UpdateQuoteDto = z.infer<typeof updateQuoteSchema>;

export const quoteQuerySchema = z.intersection(
  paginationSchema,
  z.object({
    status: z.nativeEnum(QuoteStatus).optional(),
    customerId: z.string().optional(),
    /** Angebote ab diesem Datum. */
    from: datum.optional(),
    /** Angebote bis zu diesem Datum. */
    to: datum.optional(),
  }),
);

export type QuoteQueryDto = z.infer<typeof quoteQuerySchema>;

export const rejectQuoteSchema = z
  .object({
    reason: z.string().max(1000).optional(),
  })
  .strict();

export type RejectQuoteDto = z.infer<typeof rejectQuoteSchema>;

export const convertQuoteSchema = z
  .object({
    type: z.nativeEnum(OrderType).optional(),
    plannedStart: datum.optional(),
    plannedEnd: datum.optional(),
    /** Bestellnummer oder Aktenzeichen des Kunden. */
    customerReference: z.string().max(100).optional(),
    /** Optionale Angebotspositionen, die mit beauftragt werden. */
    includeOptionalItemIds: z.array(z.string()).optional(),
  })
  .strict();

export type ConvertQuoteDto = z.infer<typeof convertQuoteSchema>;
