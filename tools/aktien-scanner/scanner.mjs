#!/usr/bin/env node
/**
 * Aktien-Scanner – tägliche Bestenliste aus dem gesamten Markt.
 *
 *   node tools/aktien-scanner/scanner.mjs --profil schnell --kapital 25000
 *
 * Der Ablauf in vier Schritten:
 *
 *   1. Universum   Alle handelbaren Aktien eines Marktes zusammenstellen.
 *   2. Vorauswahl  Über Stammdaten alles aussortieren, was zu klein oder zu
 *                  wenig gehandelt ist – das spart den teuren Kursabruf für
 *                  Papiere, die ohnehin durchfallen würden.
 *   3. Bewertung   Für den Rest die Kursreihe holen, zu Kennzahlen verdichten
 *                  und im Feld einen Rangplatz vergeben.
 *   4. Plan        Für die Bestenliste Einstieg, Stopp, Ziel und Stückzahl
 *                  rechnen und alles ausgeben.
 *
 * Was das Werkzeug ausdrücklich nicht kann: die Zukunft kennen. Es findet
 * Papiere, die sich zuletzt stark und stetig bewegt haben – die Annahme
 * dahinter ist, dass solche Bewegungen eine Weile anhalten. Das ist über lange
 * Zeiträume messbar, aber es ist eine Wahrscheinlichkeit, keine Zusage. Mit
 * `--pruefen` lässt sich nachrechnen, was die Regel in der Vergangenheit
 * gebracht hätte; mit `--rueckblick`, was aus den eigenen Empfehlungen wurde.
 */
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { HILFE, argumenteLesen } from './lib/argumente.mjs';
import { PROFILE, ausschliessen, kennzahlenBerechnen, ranglisteBilden } from './lib/bewertung.mjs';
import { alsCsv, alsJson, einzelheitenSchreiben, grossbetrag, prozent, tabelleSchreiben, zahl } from './lib/ausgabe.mjs';
import { alsHtml } from './lib/bericht-html.mjs';
import { handelsplanErstellen } from './lib/handelsplan.mjs';
import { gegenprobe } from './lib/pruefung.mjs';
import {
  geschaeftszahlenHolen,
  kurseHolen,
  sitzungHolen,
  stammdatenHolen,
  zwischenspeicher,
} from './lib/quelle-yahoo.mjs';
import { MASSSTAB, universumLaden } from './lib/universum.mjs';
import { nacheinander } from './lib/warteschlange.mjs';
import { rueckblickBilden, verlaufFortschreiben, verlaufLesen } from './lib/verlauf.mjs';

const WURZEL = dirname(fileURLToPath(import.meta.url));

/* Anzeige ---------------------------------------------------------------- */

function melder(leise) {
  let letzteMeldung = 0;
  return {
    schritt(text) {
      if (!leise) process.stderr.write(`\n${text}\n`);
    },
    fortschritt(fertig, gesamt, was) {
      if (leise) return;
      const jetzt = Date.now();
      // Höchstens alle 200 ms neu zeichnen. Bei mehreren tausend Abrufen wäre
      // die Ausgabe sonst langsamer als der Abruf selbst.
      if (jetzt - letzteMeldung < 200 && fertig < gesamt) return;
      letzteMeldung = jetzt;
      const anteil = Math.round((fertig / gesamt) * 100);
      process.stderr.write(`\r  ${was}: ${fertig}/${gesamt} (${anteil} %)   `);
      if (fertig === gesamt) process.stderr.write('\n');
    },
    hinweis(text) {
      if (!leise) process.stderr.write(`  ${text}\n`);
    },
  };
}

/* Kursbeschaffung -------------------------------------------------------- */

/**
 * Holt eine Kursreihe – erst aus dem Zwischenspeicher, sonst aus dem Netz.
 * Fehler werden zu `null`: Ein einzelnes Papier darf den Lauf nicht kippen.
 */
function kursbeschaffer(speicher, zeitraum) {
  return async (symbol) => {
    if (speicher) {
      const gespeichert = await speicher.lesen(symbol, zeitraum);
      if (gespeichert) return gespeichert;
    }
    try {
      const reihe = await kurseHolen(symbol, zeitraum);
      if (speicher) await speicher.schreiben(symbol, zeitraum, reihe);
      return reihe;
    } catch {
      return null;
    }
  };
}

/* Vorauswahl ------------------------------------------------------------- */

/**
 * Dünnt das Universum über Stammdaten aus, bevor die Kurshistorie abgerufen
 * wird.
 *
 * Der Gewinn ist erheblich: Von rund 6.000 gelisteten US-Aktien bleiben je nach
 * Grenzwerten ein paar hundert bis zweitausend übrig. Die Stammdaten kommen in
 * Bündeln zu 50 – 120 Aufrufe statt 6.000.
 *
 * Stehen keine Stammdaten zur Verfügung, geht die Liste unverändert weiter.
 * Die Grenzwerte greifen dann später auf Basis der Kursreihe; das kostet Zeit,
 * aber es kostet kein Ergebnis.
 */
async function vorauswahl(universum, werte, anzeige) {
  const sitzung = await sitzungHolen();
  if (!sitzung) return { liste: universum, stammdaten: new Map() };

  const buendel = [];
  for (let i = 0; i < universum.length; i += 50) buendel.push(universum.slice(i, i + 50));

  const stammdaten = new Map();
  await nacheinander(
    buendel,
    Math.min(6, werte.gleichzeitig),
    async (teil) => {
      try {
        const karte = await stammdatenHolen(teil.map((e) => e.symbol));
        for (const [symbol, datensatz] of karte) stammdaten.set(symbol, datensatz);
      } catch {
        // Ein misslungenes Bündel heißt: Diese 50 Papiere gehen ungefiltert
        // weiter. Besser zu viel prüfen als etwas Gutes zu verlieren.
      }
    },
    (fertig, gesamt) => anzeige.fortschritt(fertig, gesamt, 'Stammdaten'),
  );

  if (!stammdaten.size) return { liste: universum, stammdaten };

  const liste = universum.filter(({ symbol }) => {
    const daten = stammdaten.get(symbol);
    if (!daten) return true; // unbekannt: im Zweifel drinlassen
    if (daten.art && daten.art !== 'EQUITY') return false;
    if (daten.kurs != null && daten.kurs < werte.minKurs) return false;
    if (daten.marktkapital != null && daten.marktkapital < werte.minMarktkapital) return false;
    if (daten.durchschnittsumsatz != null && daten.kurs != null) {
      if (daten.durchschnittsumsatz * daten.kurs < werte.minUmsatz) return false;
    }
    return true;
  });

  return { liste, stammdaten };
}

/* Hauptlauf -------------------------------------------------------------- */

async function durchsuchen(werte, anzeige) {
  const beginn = Date.now();
  const profil = PROFILE[werte.profil];
  const ordner = werte.ordner ? resolve(werte.ordner) : join(WURZEL, 'berichte');
  const speicher = werte.keinZwischenspeicher
    ? null
    : zwischenspeicher(join(WURZEL, '.zwischenspeicher'), werte.frisch);
  if (speicher) await speicher.vorbereiten();
  const holeKurse = kursbeschaffer(speicher, werte.historie);

  /* 1. Universum ------------------------------------------------------- */

  anzeige.schritt('Universum zusammenstellen');
  const universum = await universumLaden({
    markt: werte.markt,
    symbole: werte.symbole,
    datei: werte.datei,
    zwischenablage: join(WURZEL, '.zwischenspeicher'),
  });
  anzeige.hinweis(`${universum.length} Wertpapiere im Markt „${werte.markt}"`);
  if (!universum.length) throw new Error('Das Universum ist leer – Markt oder Symbolliste prüfen.');

  /* 2. Vorauswahl ------------------------------------------------------ */

  let auswahl = universum;
  if (universum.length > 60) {
    anzeige.schritt('Vorauswahl über Stammdaten');
    const ergebnis = await vorauswahl(universum, werte, anzeige);
    auswahl = ergebnis.liste;
    anzeige.hinweis(`${auswahl.length} Wertpapiere erfüllen Größe und Umsatz`);
  }

  /* 3. Kurse und Kennzahlen -------------------------------------------- */

  anzeige.schritt('Kursverläufe abrufen');
  const masstabSymbol = MASSSTAB[werte.markt] ?? MASSSTAB.usa;
  const masstabReihe = await holeKurse(masstabSymbol);
  const masstabKennzahlen = masstabReihe ? kennzahlenBerechnen(masstabReihe) : null;
  const masstab = masstabKennzahlen
    ? { r63: masstabKennzahlen.r63 ?? 0, r126: masstabKennzahlen.r126 ?? 0 }
    : null;
  if (masstab) {
    anzeige.hinweis(
      `Vergleichsmaßstab ${masstabSymbol}: ${prozent(masstab.r63)} in drei Monaten, ` +
        `${prozent(masstab.r126)} in sechs`,
    );
  }

  const reihen = await nacheinander(
    auswahl,
    werte.gleichzeitig,
    async (eintrag) => holeKurse(eintrag.symbol),
    (fertig, gesamt) => anzeige.fortschritt(fertig, gesamt, 'Kurse'),
  );

  const grenzen = {
    minKurs: werte.minKurs,
    minHandelsvolumen: werte.minUmsatz,
    minHandelstage: werte.minHandelstage,
    maxSchwankung: werte.maxSchwankung || null,
    nurAufwaerts: !werte.alle,
  };

  anzeige.schritt('Kennzahlen berechnen');
  const kandidaten = [];
  const brauchbareReihen = [];
  const ausgeschieden = new Map();
  let ohneDaten = 0;

  for (let i = 0; i < auswahl.length; i++) {
    const reihe = reihen[i];
    if (!reihe || reihe.fehler || !reihe.angepasst) {
      ohneDaten++;
      continue;
    }
    brauchbareReihen.push(reihe);

    const kennzahlen = kennzahlenBerechnen(reihe, masstab);
    if (!kennzahlen) {
      ohneDaten++;
      continue;
    }

    const gruende = ausschliessen(kennzahlen, grenzen);
    if (gruende.length) {
      for (const grund of gruende) ausgeschieden.set(grund, (ausgeschieden.get(grund) ?? 0) + 1);
      continue;
    }

    kandidaten.push({
      symbol: reihe.symbol,
      name: reihe.name,
      boerse: reihe.boerse,
      waehrung: reihe.waehrung,
      standDatum: reihe.standDatum,
      kennzahlen,
      reihe,
    });
  }

  anzeige.hinweis(`${kandidaten.length} Werte bewertet, ${ohneDaten} ohne brauchbare Daten`);
  for (const [grund, anzahl] of [...ausgeschieden].sort((a, b) => b[1] - a[1])) {
    anzeige.hinweis(`ausgeschieden – ${grund}: ${anzahl}`);
  }
  if (!kandidaten.length) {
    throw new Error('Kein Wert hat die Filter überstanden. Grenzwerte lockern oder --alle setzen.');
  }

  /* 4. Rangliste und Plan ---------------------------------------------- */

  anzeige.schritt('Rangliste bilden');
  const bewertet = ranglisteBilden(kandidaten, profil.gewichte).sort((a, b) => b.punkte - a.punkte);
  const treffer = bewertet.slice(0, werte.anzahl);

  if (werte.geschaeftszahlen) {
    anzeige.schritt('Geschäftszahlen der Bestenliste');
    const zahlen = await nacheinander(
      treffer,
      Math.min(4, werte.gleichzeitig),
      async (eintrag) => geschaeftszahlenHolen(eintrag.symbol),
      (fertig, gesamt) => anzeige.fortschritt(fertig, gesamt, 'Geschäftszahlen'),
    );
    treffer.forEach((eintrag, i) => {
      eintrag.geschaeftszahlen = zahlen[i] && !zahlen[i].fehler ? zahlen[i] : null;
    });
  }

  for (const eintrag of treffer) {
    eintrag.plan = handelsplanErstellen(eintrag.kennzahlen, eintrag.reihe, {
      kapital: werte.kapital,
      risikoAnteil: werte.risiko / 100,
      maxAnteil: werte.maxPosition / 100,
      haltedauerTage: profil.haltedauerTage,
    });
  }

  const lauf = {
    zeitpunkt: new Date().toLocaleString('de-DE'),
    datum: treffer[0]?.standDatum ?? new Date().toISOString().slice(0, 10),
    markt: werte.markt,
    profil: werte.profil,
    profilBeschreibung: profil.beschreibung,
    gewichte: profil.gewichte,
    grenzen,
    kapital: werte.kapital,
    risiko: werte.risiko,
    universum: universum.length,
    geprueft: auswahl.length,
    bewertet: kandidaten.length,
    durchschnittPunkte:
      treffer.reduce((summe, e) => summe + e.punkte, 0) / Math.max(1, treffer.length),
    dauerSekunden: (Date.now() - beginn) / 1000,
  };

  return { lauf, treffer, bewertet, brauchbareReihen, masstabReihe, ordner, profil, grenzen };
}

/* Nachprüfungen ---------------------------------------------------------- */

function gegenprobeAusgeben(ergebnis, werte) {
  if (!ergebnis.gesamt) {
    process.stdout.write('\nGegenprobe nicht möglich – zu wenig Historie für die Stichtage.\n');
    return;
  }
  const g = ergebnis.gesamt;
  const fehlend =
    werte.stichtage > g.stichtage
      ? ` (von ${werte.stichtage} angefragt; die übrigen hatten zu wenig Werte im Feld)`
      : '';
  process.stdout.write(
    `\nGegenprobe: ${g.stichtage} Stichtage${fehlend}, Haltedauer ${g.horizont} Handelstage\n` +
      `  Auswahl, mittlerer Stichtag   ${prozent(g.medianAuswahl)}\n` +
      `  Feld, mittlerer Stichtag      ${prozent(g.medianFeld)}\n` +
      // Median der Einzelvorsprünge, nicht Differenz der beiden Zeilen darüber:
      // Ein einzelner sehr guter Monat soll das Urteil nicht tragen.
      `  Vorsprung je Stichtag (Median) ${prozent(g.vorsprung)}\n` +
      `  Besser als das Feld           ${zahl(g.besserAlsFeld, 0)} % der Stichtage\n` +
      `  Gewinner in der Auswahl       ${zahl(g.trefferquote, 0)} %\n\n`,
  );
  for (const lauf of ergebnis.laeufe) {
    process.stdout.write(
      `  ${lauf.stichtag}  Auswahl ${prozent(lauf.medianAuswahl).padStart(9)}  ` +
        `Feld ${prozent(lauf.medianFeld).padStart(9)}  ` +
        `Gewinner ${zahl(lauf.trefferquote, 0).padStart(3)} %  ` +
        `(${lauf.beste.map((b) => `${b.symbol} ${prozent(b.nachher)}`).join(', ')})\n`,
    );
  }
  process.stdout.write(
    '\n  Ohne Gebühren, Spanne und Steuern gerechnet, und nur mit Papieren, die es\n' +
      '  heute noch gibt. Die Zahlen taugen zum Vergleich der Profile, nicht als\n' +
      '  Renditeerwartung.\n',
  );
  if (werte.anzahl > 30) {
    process.stdout.write('  Hinweis: Bei großer --anzahl nähert sich die Auswahl dem Feld an.\n');
  }
}

async function rueckblickAusgeben(werte, anzeige) {
  const ordner = werte.ordner ? resolve(werte.ordner) : join(WURZEL, 'berichte');
  const laeufe = await verlaufLesen(join(ordner, 'verlauf.json'));
  if (!laeufe.length) {
    process.stdout.write(
      '\nNoch kein Tagebuch vorhanden. Es entsteht ab dem ersten Lauf ohne --kein-verlauf.\n',
    );
    return;
  }

  const speicher = werte.keinZwischenspeicher
    ? null
    : zwischenspeicher(join(WURZEL, '.zwischenspeicher'), werte.frisch);
  if (speicher) await speicher.vorbereiten();
  const holeKurse = kursbeschaffer(speicher, werte.historie);

  anzeige.schritt(`Rückblick auf ${laeufe.length} ${laeufe.length === 1 ? 'Lauf' : 'Läufe'}`);
  const auswertung = await rueckblickBilden(laeufe, holeKurse);
  if (!auswertung.length) {
    process.stdout.write('\nZu den bisherigen Läufen gibt es noch keinen Kursverlauf danach.\n');
    return;
  }

  process.stdout.write('\nWas aus den Empfehlungen wurde\n');
  process.stdout.write(
    `${'Datum'.padEnd(12)}${'Profil'.padEnd(12)}${'Werte'.padStart(6)}` +
      `${'Ø Rendite'.padStart(12)}${'Gewinner'.padStart(10)}${'Ziel'.padStart(8)}${'Stopp'.padStart(8)}\n`,
  );
  for (const eintrag of auswertung) {
    process.stdout.write(
      eintrag.datum.padEnd(12) +
        eintrag.profil.padEnd(12) +
        String(eintrag.posten.length).padStart(6) +
        prozent(eintrag.mittelRendite).padStart(12) +
        `${zahl(eintrag.gewinner, 0)} %`.padStart(10) +
        `${zahl(eintrag.zielQuote, 0)} %`.padStart(8) +
        `${zahl(eintrag.stoppQuote, 0)} %`.padStart(8) +
        '\n',
    );
  }

  const alle = auswertung.flatMap((e) => e.posten);
  const gewinner = alle.filter((p) => p.rendite > 0).length;
  process.stdout.write(
    `\nInsgesamt ${alle.length} Empfehlungen, ${zahl((gewinner / alle.length) * 100, 0)} % im Plus, ` +
      `Ø ${prozent(alle.reduce((s, p) => s + (p.rendite ?? 0), 0) / alle.length)}.\n`,
  );
}

/* Einstieg --------------------------------------------------------------- */

async function haupt() {
  let werte;
  try {
    werte = argumenteLesen(process.argv.slice(2));
  } catch (fehler) {
    process.stderr.write(`${fehler.message}\n\nMit --hilfe gibt es die Übersicht.\n`);
    process.exitCode = 1;
    return;
  }

  if (werte.hilfe) {
    process.stdout.write(HILFE);
    return;
  }

  const anzeige = melder(werte.leise);

  if (werte.rueckblick) {
    await rueckblickAusgeben(werte, anzeige);
    return;
  }

  const { lauf, treffer, brauchbareReihen, masstabReihe, ordner, profil, grenzen } =
    await durchsuchen(werte, anzeige);

  /* Ausgabe ------------------------------------------------------------ */

  process.stdout.write(
    `\nAktien-Scanner · ${lauf.markt} · Profil ${lauf.profil} (${profil.beschreibung})\n` +
      `Kursstand ${lauf.datum} · ${zahl(lauf.geprueft, 0)} geprüft · ` +
      `${zahl(lauf.bewertet, 0)} bewertet · ${zahl(lauf.dauerSekunden, 1)} s\n`,
  );

  tabelleSchreiben(treffer);
  process.stdout.write(
    `\nHandelsplan gerechnet auf ${grossbetrag(werte.kapital)} Depot, ` +
      `${zahl(werte.risiko, 1)} % Risiko je Position ` +
      `(${grossbetrag((werte.kapital * werte.risiko) / 100)} je Trade).\n`,
  );

  einzelheitenSchreiben(treffer, 5);

  if (!werte.keinBericht) {
    const basis = join(ordner, `bestenliste-${lauf.datum}-${lauf.profil}`);
    const bericht = {
      lauf,
      treffer: treffer.map(({ reihe, ...rest }) => rest),
    };
    await alsJson(`${basis}.json`, bericht);
    await alsCsv(`${basis}.csv`, treffer);
    await alsHtml(`${basis}.html`, bericht);
    process.stdout.write(`\nBerichte: ${basis}.html · .json · .csv\n`);
  }

  if (!werte.keinVerlauf) {
    const anzahl = await verlaufFortschreiben(join(ordner, 'verlauf.json'), lauf, treffer);
    process.stdout.write(
      `Tagebuch fortgeschrieben (${anzahl} ${anzahl === 1 ? 'Lauf' : 'Läufe'}). ` +
        'Auswertung mit --rueckblick.\n',
    );
  }

  if (werte.pruefen) {
    anzeige.schritt('Gegenprobe an vergangenen Stichtagen');
    gegenprobeAusgeben(
      gegenprobe(brauchbareReihen, masstabReihe, {
        gewichte: profil.gewichte,
        grenzen,
        stichtage: werte.stichtage,
        horizont: werte.horizont,
        anzahl: werte.anzahl,
      }),
      werte,
    );
  }

  process.stdout.write(
    '\nKeine Anlageberatung. Die Auswahl beruht ausschließlich auf Kursdaten der\n' +
      'Vergangenheit und kennt weder Nachrichten noch Termine für Geschäftszahlen.\n',
  );
}

haupt().catch((fehler) => {
  process.stderr.write(`\nAbbruch: ${fehler.message}\n`);
  process.exitCode = 1;
});
