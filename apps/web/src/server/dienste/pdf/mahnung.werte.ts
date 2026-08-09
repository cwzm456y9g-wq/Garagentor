import { dunningLevelLabels, DUNNING_TEXTS } from '@garagentor/shared';

/**
 * Textbausteine der Mahnung.
 *
 * Getrennt vom Satz gehalten, damit sich der Wortlaut je Stufe ohne
 * PDF-Aufbau prüfen lässt – er entscheidet, wie scharf ein Schreiben klingt.
 */

export interface Mahntext {
  bezeichnung: string;
  anschreiben: string;
  schluss: string;
}

/**
 * Anschreiben und Schlusssatz einer Mahnstufe, mit eingesetzter Frist.
 *
 * Eine unbekannte Stufe fällt auf die erste Mahnung zurück statt den Aufbau
 * abzubrechen: ein Schreiben mit etwas zu allgemeinem Wortlaut ist besser als
 * gar keines.
 */
export function mahntext(level: string, frist: string): Mahntext {
  const texte = DUNNING_TEXTS[level] ?? DUNNING_TEXTS.MAHNUNG_1;

  return {
    bezeichnung: dunningLevelLabels[level as keyof typeof dunningLevelLabels] ?? 'Mahnung',
    anschreiben: texte.anschreiben,
    schluss: texte.schluss.replace('{frist}', frist),
  };
}
