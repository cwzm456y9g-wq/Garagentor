import { calculateDocumentTotals, type DocumentTotals } from '@garagentor/shared';
import { LineItemType } from '@prisma/client';
import { z } from 'zod';

/** Zahl mit begrenzter Nachkommastellenzahl, wie class-validators maxDecimalPlaces. */
const genau = (stellen: number, min: number, max: number) => {
  const faktor = 10 ** stellen;
  return z
    .number()
    .min(min)
    .max(max)
    .refine((wert) => Number.isFinite(wert) && Math.round(wert * faktor) === wert * faktor, {
      message: `Höchstens ${stellen} Nachkommastellen.`,
    });
};

/**
 * Position eines Belegs. Angebot, Auftrag und Rechnung verwenden dieselbe
 * Struktur, damit ein Beleg ohne Umbau in den nächsten überführt werden kann.
 */
export const lineItemSchema = z
  .object({
    type: z.nativeEnum(LineItemType).default(LineItemType.LEISTUNG),
    /** Übernimmt Bezeichnung und Preis aus dem Artikelstamm. */
    articleId: z.string().optional(),
    title: z.string().max(300),
    description: z.string().max(4000).optional(),
    quantity: genau(3, -999_999, 999_999).default(1),
    unit: z.string().max(20).default('Stk'),
    unitPrice: genau(2, -9_999_999, 9_999_999).default(0),
    /** Positionsrabatt in Prozent. */
    discountPercent: genau(2, 0, 100).default(0),
    /** Umsatzsteuersatz in Prozent. */
    vatRate: genau(2, 0, 100).default(19),
    /** Nur bei Angeboten: Position ist optional. */
    optional: z.boolean().optional(),
  })
  .strict();

export type LineItemDto = z.infer<typeof lineItemSchema>;

/** In der Datenbank abzulegende Positionszeile. */
export interface PreparedLineItem {
  position: number;
  type: LineItemType;
  articleId: string | null;
  title: string;
  description: string | null;
  quantity: number;
  unit: string;
  unitPrice: number;
  discountPercent: number;
  vatRate: number;
  netAmount: number;
  /** Nur für Angebotspositionen gesetzt; andere Belegarten kennen kein Feld dafür. */
  optional?: boolean;
}

/** Entfernt das nur für Angebote gültige Feld `optional`. */
export function withoutOptionalFlag(item: PreparedLineItem): Omit<PreparedLineItem, 'optional'> {
  const rest = { ...item };
  delete rest.optional;
  return rest;
}

/**
 * Nummeriert die Positionen fortlaufend und berechnet Netto je Zeile sowie die
 * Belegsummen. Optionale Angebotspositionen bleiben außen vor, weil sie erst
 * mit der Beauftragung Teil der Summe werden.
 */
export function prepareLineItems(
  items: LineItemDto[],
  discountPercent = 0,
): { prepared: PreparedLineItem[]; totals: DocumentTotals } {
  const prepared = items.map((item, index) => {
    const { netAmount } = calculateDocumentTotals([
      {
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        discountPercent: item.discountPercent,
        vatRate: item.vatRate,
        type: item.type,
      },
    ]);

    return {
      position: index + 1,
      type: item.type,
      articleId: item.articleId ?? null,
      title: item.title,
      description: item.description ?? null,
      quantity: item.quantity,
      unit: item.unit,
      unitPrice: item.unitPrice,
      discountPercent: item.discountPercent,
      vatRate: item.vatRate,
      netAmount,
      ...(item.optional === undefined ? {} : { optional: item.optional }),
    };
  });

  const totals = calculateDocumentTotals(
    items
      .filter((item) => !item.optional)
      .map((item) => ({
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        discountPercent: item.discountPercent,
        vatRate: item.vatRate,
        type: item.type,
      })),
    discountPercent,
  );

  return { prepared, totals };
}
