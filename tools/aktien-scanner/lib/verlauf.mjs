/**
 * Das Tagebuch: Jeder Lauf schreibt seine Auswahl mit Datum und Kurs fort.
 *
 * Damit lässt sich später die einzige Frage beantworten, die wirklich zählt –
 * was ist aus den Empfehlungen geworden. Ein Werkzeug, das jeden Tag eine neue
 * Liste ausgibt und die alte vergisst, kann sich nie irren; man merkt es nur
 * nicht.
 *
 * Die Datei wächst um wenige Kilobyte je Lauf. Bei täglicher Ausführung sind
 * das etwa 1,5 MB im Jahr – klein genug, um sie am Stück zu lesen, und groß
 * genug, dass sich nach ein paar Monaten etwas daraus ablesen lässt.
 */
import { readFile } from 'node:fs/promises';
import { schreibenMitOrdner } from './ausgabe.mjs';

export async function verlaufLesen(pfad) {
  try {
    const inhalt = JSON.parse(await readFile(pfad, 'utf8'));
    return Array.isArray(inhalt?.laeufe) ? inhalt.laeufe : [];
  } catch {
    return [];
  }
}

/**
 * Hängt den heutigen Lauf an. Ein zweiter Lauf am selben Tag mit demselben
 * Profil ersetzt den ersten – sonst stünde dieselbe Auswahl mehrfach im
 * Tagebuch und verzerrte jede Auswertung.
 */
export async function verlaufFortschreiben(pfad, lauf, treffer) {
  const bisher = await verlaufLesen(pfad);
  const gefiltert = bisher.filter((e) => !(e.datum === lauf.datum && e.profil === lauf.profil));

  gefiltert.push({
    datum: lauf.datum,
    zeitpunkt: lauf.zeitpunkt,
    profil: lauf.profil,
    markt: lauf.markt,
    auswahl: treffer.map((eintrag) => ({
      symbol: eintrag.symbol,
      name: eintrag.name,
      punkte: eintrag.punkte,
      kurs: eintrag.kennzahlen.anzeigekurs,
      waehrung: eintrag.waehrung,
      stopp: eintrag.plan?.stopp ?? null,
      ziel: eintrag.plan?.ziel1 ?? null,
      tageBisZiel: eintrag.plan?.tageBisZiel1 ?? null,
    })),
  });

  gefiltert.sort((a, b) => a.datum.localeCompare(b.datum) || a.profil.localeCompare(b.profil));
  await schreibenMitOrdner(pfad, `${JSON.stringify({ laeufe: gefiltert }, null, 2)}\n`);
  return gefiltert.length;
}

/**
 * Wertet zurückliegende Läufe aus: Was hat jede damalige Auswahl bis heute
 * gebracht, und wie oft wurden Ziel oder Stopp erreicht?
 *
 * `kursHolen` liefert zu einem Symbol die Kursreihe; so bleibt dieses Modul
 * frei von Netzzugriffen und lässt sich mit erfundenen Daten prüfen.
 */
export async function rueckblickBilden(laeufe, kursHolen) {
  const symbole = [...new Set(laeufe.flatMap((l) => l.auswahl.map((a) => a.symbol)))];
  const reihen = new Map();
  for (const symbol of symbole) {
    const reihe = await kursHolen(symbol);
    if (reihe) reihen.set(symbol, reihe);
  }

  const auswertung = [];
  for (const lauf of laeufe) {
    const stichtag = new Date(`${lauf.datum}T23:59:59Z`).getTime();
    const posten = [];

    for (const eintrag of lauf.auswahl) {
      const reihe = reihen.get(eintrag.symbol);
      if (!reihe) continue;

      // Alle Kerzen nach dem Stichtag – das ist der Verlauf, den es damals
      // noch nicht zu sehen gab.
      const seither = [];
      for (let i = 0; i < reihe.zeit.length; i++) {
        if (reihe.zeit[i] > stichtag) seither.push(i);
      }
      if (!seither.length) continue;

      const letzterIndex = seither[seither.length - 1];
      const jetzt = reihe.angepasst[letzterIndex];
      // Zum Vergleich mit Stopp und Ziel zählt der unbereinigte Kurs: Genau
      // den hätte die Order des Brokers gesehen.
      const roh = reihe.schluss[letzterIndex];
      const startRoh = eintrag.kurs;

      let zielErreicht = null;
      let stoppErreicht = null;
      for (const i of seither) {
        if (eintrag.ziel != null && zielErreicht === null && reihe.hoch[i] >= eintrag.ziel) {
          zielErreicht = seither.indexOf(i) + 1;
        }
        if (eintrag.stopp != null && stoppErreicht === null && reihe.tief[i] <= eintrag.stopp) {
          stoppErreicht = seither.indexOf(i) + 1;
        }
        if (zielErreicht !== null && stoppErreicht !== null) break;
      }

      posten.push({
        symbol: eintrag.symbol,
        name: eintrag.name,
        punkte: eintrag.punkte,
        einstieg: startRoh,
        jetzt: roh,
        rendite: startRoh > 0 ? (roh / startRoh - 1) * 100 : null,
        handelstage: seither.length,
        zielErreicht,
        stoppErreicht,
        // Was zuerst kam, entscheidet den Ausgang. Beides am selben Tag zählt
        // als Stopp: Wer die Kerze nicht von innen gesehen hat, weiß die
        // Reihenfolge nicht, und die vorsichtige Annahme ist die ehrlichere.
        ausgang:
          stoppErreicht !== null && (zielErreicht === null || stoppErreicht <= zielErreicht)
            ? 'Stopp'
            : zielErreicht !== null
              ? 'Ziel'
              : 'offen',
      });
    }

    if (!posten.length) continue;
    const renditen = posten.map((p) => p.rendite).filter((r) => r !== null);
    auswertung.push({
      datum: lauf.datum,
      profil: lauf.profil,
      posten,
      mittelRendite: renditen.reduce((a, b) => a + b, 0) / renditen.length,
      gewinner: (renditen.filter((r) => r > 0).length / renditen.length) * 100,
      zielQuote: (posten.filter((p) => p.ausgang === 'Ziel').length / posten.length) * 100,
      stoppQuote: (posten.filter((p) => p.ausgang === 'Stopp').length / posten.length) * 100,
    });
  }

  return auswertung;
}
