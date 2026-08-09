import { inspectionResultLabels } from '@garagentor/shared';

/**
 * Textaufbereitung für das Prüfprotokoll.
 *
 * Bewusst ohne Bezug auf react-pdf: die Regeln, wie ein Messwert oder ein
 * Ergebnis im Nachweis erscheint, sind fachlich und sollen sich ohne
 * PDF-Aufbau prüfen lassen.
 */

const zahlformat = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 2 });

/**
 * Messwert mit Einheit und Grenzwert, z. B. „320 N (max. 400)“.
 *
 * Ohne den Grenzwert daneben ließe sich der Wert im Nachhinein nicht mehr
 * einordnen; die Grenzen der DIN EN 12453 sind je nach Prüfpunkt verschieden.
 */
export function messwertText(
  messwert: number | null | undefined,
  einheit: string | null | undefined,
  grenzwert: number | null | undefined,
): string {
  if (messwert === null || messwert === undefined) {
    return grenzwert === null || grenzwert === undefined
      ? ''
      : `max. ${zahlformat.format(grenzwert)} ${einheit ?? ''}`.trim();
  }

  const gemessen = `${zahlformat.format(messwert)} ${einheit ?? ''}`.trim();
  return grenzwert === null || grenzwert === undefined
    ? gemessen
    : `${gemessen} (max. ${zahlformat.format(grenzwert)})`;
}

/** Prüfergebnis in Klartext; ein offenes Protokoll hat noch keines. */
export function ergebnisText(ergebnis: string | null | undefined): string {
  if (!ergebnis) return 'in Bearbeitung';
  return inspectionResultLabels[ergebnis as keyof typeof inspectionResultLabels] ?? ergebnis;
}

/**
 * Ob ein Ergebnis die weitere Nutzung der Anlage in Frage stellt. Danach
 * richtet sich, ob der Ergebniskasten hervorgehoben wird.
 */
export function istBeanstandet(ergebnis: string | null | undefined): boolean {
  return (
    ergebnis === 'NICHT_BESTANDEN' ||
    ergebnis === 'ERHEBLICHE_MAENGEL' ||
    ergebnis === 'GERINGE_MAENGEL'
  );
}
