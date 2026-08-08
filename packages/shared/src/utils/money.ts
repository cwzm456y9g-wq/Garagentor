import { INTEREST_POINTS } from '../constants';
import { addDays } from './dates';

/**
 * Beträge werden im gesamten System als Zahl in Euro geführt und bei jeder
 * Berechnung kaufmännisch auf zwei Nachkommastellen gerundet. Die Funktionen
 * hier kommen ohne Abhängigkeiten außerhalb dieses Pakets aus, damit API und
 * Web exakt dieselben Summen ermitteln.
 */

/**
 * Kaufmännisches Runden auf `decimals` Stellen (Rundung von der Null weg).
 *
 * Die Verschiebung des Dezimalpunkts erfolgt über die Exponentialschreibweise,
 * weil `Math.round(1.005 * 100)` wegen der Binärdarstellung 100 statt 101
 * liefern würde.
 */
export function round(value: number, decimals = 2): number {
  if (!Number.isFinite(value)) return 0;
  const sign = value < 0 ? -1 : 1;
  const abs = Math.abs(value);

  const shifted = Number(`${abs}e${decimals}`);
  if (!Number.isFinite(shifted)) {
    // Werte in Exponentialschreibweise (z. B. 1e-7) lassen sich nicht anhängen.
    return sign * (Math.round(abs * 10 ** decimals) / 10 ** decimals);
  }

  const rounded = Number(`${Math.round(shifted)}e-${decimals}`);
  return sign * (Number.isFinite(rounded) ? rounded : 0);
}

export interface LineItemInput {
  quantity: number;
  unitPrice: number;
  /** Positionsrabatt in Prozent. */
  discountPercent?: number;
  /** Umsatzsteuersatz in Prozent. */
  vatRate: number;
  /** Text- und Zwischensummenpositionen fließen nicht in die Summe ein. */
  type?: string;
}

export interface LineItemTotals {
  netAmount: number;
  vatAmount: number;
  grossAmount: number;
}

const NON_CALCULATING_TYPES = new Set(['TEXT', 'ZWISCHENSUMME']);

/** Ermittelt Netto, Steuer und Brutto einer einzelnen Position. */
export function calculateLineItem(item: LineItemInput): LineItemTotals {
  if (item.type && NON_CALCULATING_TYPES.has(item.type)) {
    return { netAmount: 0, vatAmount: 0, grossAmount: 0 };
  }
  const gross = item.quantity * item.unitPrice;
  const discount = gross * ((item.discountPercent ?? 0) / 100);
  const netAmount = round(gross - discount);
  const vatAmount = round(netAmount * (item.vatRate / 100));
  return { netAmount, vatAmount, grossAmount: round(netAmount + vatAmount) };
}

export interface DocumentTotals extends LineItemTotals {
  /** Netto vor Gesamtrabatt. */
  subtotal: number;
  discountAmount: number;
  /** Steueraufteilung je Steuersatz, aufsteigend sortiert. */
  vatBreakdown: Array<{ rate: number; net: number; vat: number }>;
}

/**
 * Summiert Positionen zu Belegsummen. Ein Gesamtrabatt wird anteilig auf die
 * Steuersätze verteilt, damit die Steueraufteilung stimmig bleibt.
 */
export function calculateDocumentTotals(
  items: LineItemInput[],
  discountPercent = 0,
): DocumentTotals {
  const netByRate = new Map<number, number>();

  for (const item of items) {
    if (item.type && NON_CALCULATING_TYPES.has(item.type)) continue;
    const { netAmount } = calculateLineItem(item);
    netByRate.set(item.vatRate, round((netByRate.get(item.vatRate) ?? 0) + netAmount));
  }

  const subtotal = round([...netByRate.values()].reduce((sum, value) => sum + value, 0));
  const factor = 1 - discountPercent / 100;
  const discountAmount = round(subtotal * (discountPercent / 100));

  const vatBreakdown = [...netByRate.entries()]
    .sort(([a], [b]) => a - b)
    .map(([rate, net]) => {
      const discountedNet = round(net * factor);
      return { rate, net: discountedNet, vat: round(discountedNet * (rate / 100)) };
    })
    .filter((row) => row.net !== 0 || row.vat !== 0);

  const netAmount = round(vatBreakdown.reduce((sum, row) => sum + row.net, 0));
  const vatAmount = round(vatBreakdown.reduce((sum, row) => sum + row.vat, 0));

  return {
    subtotal,
    discountAmount,
    netAmount,
    vatAmount,
    grossAmount: round(netAmount + vatAmount),
    vatBreakdown,
  };
}

/**
 * Verzugszinsen auf einen Betrag für die Dauer des Verzugs.
 * Den Satz liefert `interestRate()`.
 */
export function calculateInterest(amount: number, annualPercent: number, days: number): number {
  if (amount <= 0 || annualPercent <= 0 || days <= 0) return 0;
  return round((amount * (annualPercent / 100) * days) / 365);
}

/**
 * Verzugszinssatz nach § 288 BGB: Basiszinssatz zzgl. fünf Prozentpunkte,
 * bei Entgeltforderungen ohne Verbraucherbeteiligung zzgl. neun.
 *
 * Ein negativer Basiszinssatz – wie zwischen 2016 und 2022 – senkt den Satz
 * tatsächlich; unter null fällt er dabei nicht.
 */
export function interestRate(
  baseRatePercent: number,
  isConsumer: boolean,
  points: { VERBRAUCHER: number; UNTERNEHMEN: number } = INTEREST_POINTS,
): number {
  const aufschlag = isConsumer ? points.VERBRAUCHER : points.UNTERNEHMEN;
  return round(Math.max(0, baseRatePercent + aufschlag), 2);
}

/**
 * Letzter Termin, zu dem der Basiszinssatz neu bekanntgegeben wurde: der
 * 1. Januar oder 1. Juli vor dem Stichtag.
 */
export function lastBaseRateChange(reference: Date = new Date()): Date {
  const jahr = reference.getUTCFullYear();
  const juli = new Date(Date.UTC(jahr, 6, 1));
  return reference >= juli ? juli : new Date(Date.UTC(jahr, 0, 1));
}

/**
 * Ob der hinterlegte Basiszinssatz überholt ist, weil seither ein
 * Bekanntgabetermin verstrichen ist.
 */
export function baseRateOutdated(validFrom: string | Date, reference: Date = new Date()): boolean {
  const ab = validFrom instanceof Date ? validFrom : new Date(validFrom);
  if (Number.isNaN(ab.getTime())) return true;
  return ab < lastBaseRateChange(reference);
}

/** Aufschlag in Prozent auf einen Einkaufspreis. */
export function applyMargin(purchasePrice: number, marginPercent: number): number {
  return round(purchasePrice * (1 + marginPercent / 100));
}

/** Rohertrag in Prozent vom Verkaufspreis. */
export function marginPercent(purchasePrice: number, salesPrice: number): number {
  if (salesPrice <= 0) return 0;
  return round(((salesPrice - purchasePrice) / salesPrice) * 100, 1);
}

/* Skonto ---------------------------------------------------------------- */

/** Skontobetrag auf einen Bruttobetrag, kaufmännisch gerundet. */
export function skontoAmount(payable: number, percent: number): number {
  if (payable <= 0 || percent <= 0) return 0;
  return round(payable * (percent / 100), 2);
}

/** Letzter Tag, an dem der Abzug noch zulässig ist. */
export function skontoDeadline(invoiceDate: Date | string, days: number): Date {
  return addDays(invoiceDate instanceof Date ? invoiceDate : new Date(invoiceDate), days);
}

/**
 * Ob eine Zahlung innerhalb der Skontofrist eingegangen ist.
 *
 * Verglichen wird auf den Tag genau: eine Überweisung, die am letzten Tag um
 * 23 Uhr gutgeschrieben wird, ist rechtzeitig.
 */
export function withinSkontoPeriod(
  paymentDate: Date | string,
  invoiceDate: Date | string,
  days: number,
): boolean {
  if (days <= 0) return false;

  const frist = skontoDeadline(invoiceDate, days);
  frist.setHours(23, 59, 59, 999);

  const eingang = paymentDate instanceof Date ? new Date(paymentDate) : new Date(paymentDate);
  return !Number.isNaN(eingang.getTime()) && eingang.getTime() <= frist.getTime();
}

export interface SkontoAbgleich {
  /** Der Beleg gilt mit dieser Zahlung als ausgeglichen. */
  ausgeglichen: boolean;
  /** Gewährter Abzug; nur gesetzt, wenn der Ausgleich über Skonto zustande kam. */
  skonto: number;
  /** Was danach noch aussteht. */
  rest: number;
}

/**
 * Gleicht eine Zahlung gegen den offenen Betrag ab.
 *
 * Der Kern ist die Toleranz. Kunden runden: aus 456,25 € abzüglich 2 % werden
 * in der Überweisung gern 447,12 € statt 447,125 €, und mancher zieht den
 * Skonto auf den vollen Euro. Ohne Toleranz bliebe die Rechnung mit ein paar
 * Cent offen stehen, liefe in den Mahnlauf und müsste von Hand nachgebucht
 * werden – für jeden dieser Belege.
 *
 * Zu großzügig darf sie nicht sein: ein Kunde, der einfach zu wenig überweist,
 * soll weiter als offen geführt werden. Deshalb greift die Toleranz nur um den
 * erwarteten Betrag herum, nicht als pauschaler Nachlass.
 */
export function abgleichMitSkonto(params: {
  /** Noch offener Betrag vor dieser Zahlung. */
  offen: number;
  zahlung: number;
  /** Zulässiger Abzug, wenn fristgerecht gezahlt wurde; sonst 0. */
  skonto: number;
  /** Erlaubte Abweichung in Euro. */
  toleranz: number;
}): SkontoAbgleich {
  const { offen, zahlung, skonto, toleranz } = params;

  // Voll bezahlt – oder innerhalb der Toleranz darüber.
  if (zahlung >= offen - toleranz) {
    return { ausgeglichen: true, skonto: 0, rest: round(Math.max(0, offen - zahlung)) };
  }

  // Mit Skonto bezahlt: der erwartete Betrag ist offen abzüglich Abzug.
  const erwartet = round(offen - skonto);
  if (skonto > 0 && Math.abs(zahlung - erwartet) <= toleranz) {
    return { ausgeglichen: true, skonto: round(offen - zahlung), rest: 0 };
  }

  return { ausgeglichen: false, skonto: 0, rest: round(offen - zahlung) };
}
