import * as QRCode from 'qrcode';

/**
 * GiroCode nach der EPC-Spezifikation für SEPA-Überweisungen (Version 002).
 * Banking-Apps lesen den Code und füllen Empfänger, IBAN, Betrag und
 * Verwendungszweck vor – das spart Tippfehler im Verwendungszweck und bringt
 * Zahlungen erfahrungsgemäß schneller herein.
 */
export interface GiroCodeInput {
  /** Empfängername, höchstens 70 Zeichen. */
  name: string;
  iban: string;
  bic?: string | null;
  /** Betrag in Euro; muss zwischen 0,01 und 999.999.999,99 liegen. */
  amount: number;
  /** Verwendungszweck, höchstens 140 Zeichen. */
  reference: string;
}

const MAX_AMOUNT = 999999999.99;

/** Leerzeichen aus einer IBAN entfernen; im Code steht sie ohne Trennung. */
function normalisiereIban(iban: string): string {
  return iban.replace(/\s+/g, '').toUpperCase();
}

/**
 * Baut die Nutzdaten des Codes. Die Zeilenfolge ist festgelegt und darf nicht
 * umgestellt werden; leere Felder bleiben als leere Zeile stehen.
 *
 * Gibt `null` zurück, wenn die Angaben für eine Überweisung nicht ausreichen –
 * dann bleibt der Code weg, statt einen unbrauchbaren abzudrucken.
 */
export function buildGiroCodePayload(input: GiroCodeInput): string | null {
  const iban = normalisiereIban(input.iban ?? '');
  const name = (input.name ?? '').trim().slice(0, 70);

  if (!iban || !name) return null;
  if (!Number.isFinite(input.amount) || input.amount < 0.01 || input.amount > MAX_AMOUNT) {
    return null;
  }

  return [
    'BCD',
    '002',
    '1', // Zeichenkodierung UTF-8
    'SCT',
    (input.bic ?? '').replace(/\s+/g, '').toUpperCase(),
    name,
    iban,
    `EUR${input.amount.toFixed(2)}`,
    '', // Zweckcode
    '', // Strukturierte Referenz
    (input.reference ?? '').trim().slice(0, 140),
  ].join('\n');
}

/**
 * Erzeugt den Code als PNG-Data-URL zum Einbetten in den Beleg.
 * Fehlerkorrekturstufe M ist in der EPC-Spezifikation vorgeschrieben.
 */
export async function renderGiroCode(input: GiroCodeInput): Promise<string | null> {
  const payload = buildGiroCodePayload(input);
  if (!payload) return null;

  return QRCode.toDataURL(payload, {
    errorCorrectionLevel: 'M',
    margin: 0,
    scale: 8,
    color: { dark: '#12202fff', light: '#ffffffff' },
  });
}
