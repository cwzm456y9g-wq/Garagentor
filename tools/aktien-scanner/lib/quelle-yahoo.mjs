/**
 * Kursbeschaffung von Yahoo Finance – der einzige Ort im Werkzeug, der ins
 * Netz greift.
 *
 * Zwei Endpunkte werden genutzt:
 *
 *   `/v8/finance/chart`  – Tageskerzen samt bereinigtem Schlusskurs. Frei
 *                          zugänglich, ein Aufruf je Wertpapier.
 *   `/v7/finance/quote`  – Stammdaten (Marktkapitalisierung, Durchschnitts-
 *                          umsatz, Name) für bis zu 50 Symbole je Aufruf.
 *
 * Der zweite verlangt seit einiger Zeit ein Sitzungsmerkmal („crumb"), das man
 * sich mit einem Keks von der Yahoo-Seite abholt. Das passiert einmal je Lauf
 * in `sitzungHolen()`. Schlägt es fehl, arbeitet das Werkzeug ohne Stammdaten
 * weiter – die Vorauswahl greift dann auf Kurshistorie zurück statt auf
 * Marktkapitalisierung. Kein Grund, den ganzen Lauf abzubrechen.
 *
 * Yahoo hat keine zugesicherte Schnittstelle. Deshalb ist hier alles defensiv:
 * jede Antwort wird geprüft, jeder Fehlschlag betrifft nur ein Wertpapier.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const BROWSERKENNUNG =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

import { mitWiederholung, warte } from './warteschlange.mjs';

/* Sitzung ---------------------------------------------------------------- */

let sitzung = null;

/**
 * Holt Keks und Sitzungsmerkmal für die Stammdaten-Schnittstelle.
 * Ergebnis wird für den restlichen Lauf behalten; `null` heißt „ohne".
 */
export async function sitzungHolen() {
  if (sitzung !== null) return sitzung.merkmal ? sitzung : null;
  try {
    const antwort = await fetch('https://fc.yahoo.com/', {
      headers: { 'User-Agent': BROWSERKENNUNG },
    });
    const kekse = (antwort.headers.getSetCookie?.() ?? [])
      .map((keks) => keks.split(';')[0])
      .join('; ');
    if (!kekse) throw new Error('kein Keks erhalten');

    const merkmalAntwort = await fetch('https://query1.finance.yahoo.com/v1/test/getcrumb', {
      headers: { 'User-Agent': BROWSERKENNUNG, cookie: kekse },
    });
    const merkmal = (await merkmalAntwort.text()).trim();
    // Bei einer Sperre kommt hier eine HTML-Seite statt eines kurzen Wortes.
    if (!merkmalAntwort.ok || !merkmal || merkmal.length > 40 || merkmal.includes('<')) {
      throw new Error(`unerwartete Antwort (${merkmalAntwort.status})`);
    }
    sitzung = { kekse, merkmal };
    return sitzung;
  } catch (fehler) {
    sitzung = { kekse: '', merkmal: '' };
    process.stderr.write(
      `Hinweis: Stammdaten stehen nicht zur Verfügung (${fehler.message}). ` +
        'Die Vorauswahl läuft ohne Marktkapitalisierung weiter.\n',
    );
    return null;
  }
}

/* Rohabruf --------------------------------------------------------------- */

async function holen(adresse, { mitSitzung = false } = {}) {
  return mitWiederholung(async () => {
    const kopfzeilen = { 'User-Agent': BROWSERKENNUNG, accept: 'application/json' };
    if (mitSitzung && sitzung?.kekse) kopfzeilen.cookie = sitzung.kekse;

    const antwort = await fetch(adresse, { headers: kopfzeilen, signal: AbortSignal.timeout(20000) });

    // 404 heißt: Symbol gibt es nicht. Ein zweiter Versuch ändert daran nichts.
    if (antwort.status === 404) {
      const fehler = new Error('Symbol unbekannt');
      fehler.endgueltig = true;
      fehler.unbekannt = true;
      throw fehler;
    }
    if (antwort.status === 429) {
      await warte(2000 + Math.random() * 2000);
      throw new Error('Ratenbremse (429)');
    }
    if (!antwort.ok) throw new Error(`HTTP ${antwort.status}`);
    return antwort.json();
  });
}

/* Kurshistorie ----------------------------------------------------------- */

/**
 * Tageskerzen eines Wertpapiers, bereits um Dividenden und Splits bereinigt.
 *
 * Bereinigt ist wichtig: Ein Aktiensplit halbiert den Kurs über Nacht. Ohne
 * Bereinigung liest jede Impuls-Kennzahl daraus einen Absturz von 50 %.
 *
 * Hoch, Tief und Eröffnung werden mit demselben Faktor skaliert wie der
 * Schlusskurs. Sonst passt die Handelsspanne (ATR) nicht mehr zu den Kursen,
 * mit denen sie verrechnet wird, und der Stopp läge daneben.
 */
export async function kurseHolen(symbol, zeitraum = '2y') {
  const adresse =
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}` +
    `?range=${zeitraum}&interval=1d&includePrePost=false`;
  const rohdaten = await holen(adresse);

  const ergebnis = rohdaten?.chart?.result?.[0];
  if (!ergebnis?.timestamp?.length) throw new Error('keine Kursreihe in der Antwort');

  const kerzen = ergebnis.indicators?.quote?.[0];
  const bereinigt = ergebnis.indicators?.adjclose?.[0]?.adjclose;
  if (!kerzen?.close) throw new Error('unvollständige Kursreihe');

  const zeit = [];
  const offen = [];
  const hoch = [];
  const tief = [];
  const schluss = [];
  const angepasst = [];
  const volumen = [];

  for (let i = 0; i < ergebnis.timestamp.length; i++) {
    const roh = kerzen.close[i];
    // Feiertage und Handelsunterbrechungen liefern Lücken. Sie zu behalten
    // hieße, sie irgendwo weiter unten füllen zu müssen – hier fallen sie weg.
    if (roh == null || !(roh > 0)) continue;
    const angepassterKurs = bereinigt?.[i] != null && bereinigt[i] > 0 ? bereinigt[i] : roh;
    const faktor = angepassterKurs / roh;

    zeit.push(ergebnis.timestamp[i] * 1000);
    offen.push((kerzen.open?.[i] ?? roh) * faktor);
    hoch.push((kerzen.high?.[i] ?? roh) * faktor);
    tief.push((kerzen.low?.[i] ?? roh) * faktor);
    schluss.push(roh);
    angepasst.push(angepassterKurs);
    volumen.push(kerzen.volume?.[i] ?? 0);
  }

  if (schluss.length < 30) throw new Error(`nur ${schluss.length} Handelstage vorhanden`);

  return {
    symbol,
    name: ergebnis.meta?.longName || ergebnis.meta?.shortName || symbol,
    waehrung: ergebnis.meta?.currency ?? '',
    boerse: ergebnis.meta?.fullExchangeName ?? '',
    letzterKurs: ergebnis.meta?.regularMarketPrice ?? schluss[schluss.length - 1],
    hoch52Wochen: ergebnis.meta?.fiftyTwoWeekHigh ?? null,
    tief52Wochen: ergebnis.meta?.fiftyTwoWeekLow ?? null,
    standDatum: new Date(zeit[zeit.length - 1]).toISOString().slice(0, 10),
    zeit,
    offen,
    hoch,
    tief,
    schluss,
    angepasst,
    volumen,
  };
}

/* Stammdaten ------------------------------------------------------------- */

/**
 * Stammdaten für bis zu 50 Symbole in einem Aufruf.
 *
 * Zurück kommt eine Map Symbol → Datensatz. Fehlende Symbole fehlen einfach;
 * die Aufrufer behandeln das als „unbekannt", nicht als Fehler.
 */
export async function stammdatenHolen(symbole) {
  if (!sitzung?.merkmal) return new Map();
  const adresse =
    'https://query1.finance.yahoo.com/v7/finance/quote' +
    `?symbols=${symbole.map(encodeURIComponent).join(',')}` +
    `&crumb=${encodeURIComponent(sitzung.merkmal)}`;

  const rohdaten = await holen(adresse, { mitSitzung: true });
  const karte = new Map();
  for (const eintrag of rohdaten?.quoteResponse?.result ?? []) {
    karte.set(eintrag.symbol, {
      symbol: eintrag.symbol,
      name: eintrag.longName || eintrag.shortName || eintrag.symbol,
      marktkapital: eintrag.marketCap ?? null,
      durchschnittsumsatz: eintrag.averageDailyVolume3Month ?? null,
      kurs: eintrag.regularMarketPrice ?? null,
      waehrung: eintrag.currency ?? '',
      boerse: eintrag.fullExchangeName ?? '',
      art: eintrag.quoteType ?? '',
      kgv: eintrag.trailingPE ?? null,
      kgvErwartet: eintrag.forwardPE ?? null,
    });
  }
  return karte;
}

/**
 * Geschäftszahlen eines Unternehmens – Wachstum, Marge, Verschuldung.
 *
 * Bewusst nur für die Endauswahl gedacht: Ein Aufruf je Wertpapier ist zu
 * teuer, um ihn über den ganzen Markt zu ziehen, und für die Frage „läuft die
 * Aktie gerade" tragen die Zahlen ohnehin wenig bei. Für die Frage „steht
 * hinter dem Lauf ein Geschäft" sind sie das Entscheidende.
 */
export async function geschaeftszahlenHolen(symbol) {
  if (!sitzung?.merkmal) return null;
  const module = 'defaultKeyStatistics,financialData,summaryProfile';
  const adresse =
    `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(symbol)}` +
    `?modules=${module}&crumb=${encodeURIComponent(sitzung.merkmal)}`;
  try {
    const rohdaten = await holen(adresse, { mitSitzung: true });
    const block = rohdaten?.quoteSummary?.result?.[0];
    if (!block) return null;
    const kennzahlen = block.defaultKeyStatistics ?? {};
    const finanzen = block.financialData ?? {};
    const profil = block.summaryProfile ?? {};
    const zahl = (feld) => (typeof feld?.raw === 'number' ? feld.raw : null);
    return {
      branche: profil.sector ?? '',
      teilbranche: profil.industry ?? '',
      land: profil.country ?? '',
      umsatzwachstum: zahl(finanzen.revenueGrowth) === null ? null : zahl(finanzen.revenueGrowth) * 100,
      gewinnwachstum: zahl(finanzen.earningsGrowth) === null ? null : zahl(finanzen.earningsGrowth) * 100,
      bruttomarge: zahl(finanzen.grossMargins) === null ? null : zahl(finanzen.grossMargins) * 100,
      gewinnmarge: zahl(kennzahlen.profitMargins) === null ? null : zahl(kennzahlen.profitMargins) * 100,
      eigenkapitalrendite: zahl(finanzen.returnOnEquity) === null ? null : zahl(finanzen.returnOnEquity) * 100,
      verschuldungsgrad: zahl(finanzen.debtToEquity),
      kgvErwartet: zahl(kennzahlen.forwardPE),
      analystenurteil: finanzen.recommendationKey ?? '',
      kursziel: zahl(finanzen.targetMeanPrice),
    };
  } catch {
    return null;
  }
}

/* Zwischenspeicher ------------------------------------------------------- */

/**
 * Legt Kursreihen auf der Platte ab und gibt sie am selben Handelstag von dort
 * zurück.
 *
 * Der zweite Lauf eines Tages – etwa mit anderer Gewichtung oder anderem
 * Profil – kommt so ohne einen einzigen Netzaufruf aus. Bei mehreren tausend
 * Symbolen ist das der Unterschied zwischen Minuten und Sekunden, und es
 * schont das Kontingent beim Anbieter.
 */
export function zwischenspeicher(verzeichnis, gueltigkeitStunden = 8) {
  const pfadFuer = (symbol, zeitraum) =>
    join(verzeichnis, `${symbol.replace(/[^A-Za-z0-9._^-]/g, '_')}.${zeitraum}.json`);

  return {
    async vorbereiten() {
      await mkdir(verzeichnis, { recursive: true });
    },

    async lesen(symbol, zeitraum) {
      try {
        const inhalt = JSON.parse(await readFile(pfadFuer(symbol, zeitraum), 'utf8'));
        const alter = (Date.now() - new Date(inhalt.abgerufen).getTime()) / 3600000;
        if (alter > gueltigkeitStunden) return null;
        return inhalt.daten;
      } catch {
        return null;
      }
    },

    async schreiben(symbol, zeitraum, daten) {
      try {
        await writeFile(
          pfadFuer(symbol, zeitraum),
          JSON.stringify({ abgerufen: new Date().toISOString(), daten }),
        );
      } catch {
        // Ein voller oder schreibgeschützter Datenträger darf den Lauf nicht
        // beenden – der Zwischenspeicher ist eine Abkürzung, keine Bedingung.
      }
    },
  };
}
