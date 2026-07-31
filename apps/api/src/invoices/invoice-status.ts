import { round } from '@garagentor/shared';
import { InvoiceStatus } from '@prisma/client';

/** Status, in denen eine Rechnung als offener Posten geführt wird. */
export const OPEN_STATUSES: InvoiceStatus[] = [
  InvoiceStatus.OFFEN,
  InvoiceStatus.TEILBEZAHLT,
  InvoiceStatus.UEBERFAELLIG,
];

/** Nur die Felder, die zur Betragsermittlung nötig sind. */
export interface InvoiceAmounts {
  grossTotal: { toNumber(): number };
  deductedAmount: { toNumber(): number };
  paidAmount: { toNumber(): number };
}

/**
 * Tatsächlich zu zahlender Betrag: Bruttosumme abzüglich bereits gestellter
 * Abschlagsrechnungen. Nur eine Schlussrechnung führt einen Abzug, bei allen
 * anderen Belegarten ist der Abzug null.
 */
export function payableAmountOf(invoice: Omit<InvoiceAmounts, 'paidAmount'>): number {
  return round(invoice.grossTotal.toNumber() - invoice.deductedAmount.toNumber());
}

/** Noch offener Betrag einer Rechnung. */
export function openAmountOf(invoice: InvoiceAmounts): number {
  return round(payableAmountOf(invoice) - invoice.paidAmount.toNumber());
}
