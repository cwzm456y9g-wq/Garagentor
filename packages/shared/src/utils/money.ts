/**
 * Beträge werden im gesamten System als Zahl in Euro geführt und bei jeder
 * Berechnung kaufmännisch auf zwei Nachkommastellen gerundet. Die Funktionen
 * hier sind bewusst frei von Abhängigkeiten, damit API und Web exakt dieselben
 * Summen ermitteln.
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
 * Verzugszinsen nach § 288 BGB: Basiszinssatz zzgl. 5 (Verbraucher) bzw.
 * 9 Prozentpunkten (Rechtsgeschäfte ohne Verbraucherbeteiligung).
 */
export function calculateInterest(amount: number, annualPercent: number, days: number): number {
  if (amount <= 0 || annualPercent <= 0 || days <= 0) return 0;
  return round((amount * (annualPercent / 100) * days) / 365);
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
