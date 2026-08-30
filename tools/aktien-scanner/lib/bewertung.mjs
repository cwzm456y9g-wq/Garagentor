/**
 * Aus Kursreihen wird eine Rangliste.
 *
 * Das Verfahren in zwei Schritten:
 *
 * 1. `kennzahlenBerechnen` verdichtet eine Kursreihe zu rund zwanzig Rohwerten
 *    – Impuls, Trendgüte, Tempo, Schwankung, Umsatz.
 * 2. `ranglisteBilden` vergleicht jeden Rohwert mit dem Feld und macht daraus
 *    einen Rangplatz von 0 bis 100.
 *
 * Der zweite Schritt ist der wichtige. Absolute Schwellen („mehr als 30 %
 * Jahresrendite ist gut") sind vom Marktumfeld abhängig: 2022 hätte kaum eine
 * Aktie sie erreicht, 2021 fast jede. Ein Rangplatz misst dagegen immer gegen
 * dieselbe Frage – wie schlägt sich dieses Papier heute gegen alle anderen –
 * und bleibt damit über die Jahre vergleichbar.
 *
 * Fehlt ein Rohwert (zu kurze Historie, Lücke in den Daten), bekommt er den
 * Platz 45 statt 0. Unbekannt ist nicht dasselbe wie schlecht; eine 0 würde
 * jungen Börsengängen ein Urteil verpassen, für das die Daten fehlen.
 */
import {
  abstandZumHoch,
  abstandZumTief,
  abwaertsabweichung,
  aufwaertsanteil,
  gleitenderDurchschnitt,
  groessterRuecksetzer,
  handelsspanne,
  jahresschwankung,
  macd,
  mittel,
  rendite,
  renditeFenster,
  rsi,
  schlimmsterTag,
  trendgerade,
  umsatzschub,
} from './kennzahlen.mjs';

const UNBEKANNT = 45;

/* Gewichtungsprofile ----------------------------------------------------- */

/**
 * Drei Grundhaltungen. Sie unterscheiden sich nicht in den Kennzahlen, sondern
 * darin, welche davon den Ausschlag gibt.
 *
 *   `schnell`     – Tempo vor allem. Sucht Papiere, die je Handelstag am
 *                   meisten Strecke machen. Nimmt dafür Schwankung in Kauf.
 *   `ausgewogen`  – Trendgüte und Impuls tragen gemeinsam, Risiko zählt mit.
 *   `solide`      – Ruhiger, planbarer Aufwärtstrend. Ein Papier, das sich
 *                   verdoppelt und dabei zweimal 40 % abgibt, fällt hier durch.
 */
export const PROFILE = {
  schnell: {
    beschreibung: 'Tempo zuerst – kurze Haltedauer, höhere Schwankung',
    gewichte: { tempo: 30, impuls: 24, trend: 14, struktur: 12, umsatz: 10, staerke: 8, stabilitaet: 2 },
    haltedauerTage: 21,
  },
  ausgewogen: {
    beschreibung: 'Trendgüte und Impuls gemeinsam, Risiko wird abgezogen',
    gewichte: { tempo: 18, impuls: 20, trend: 22, struktur: 12, umsatz: 6, staerke: 12, stabilitaet: 10 },
    haltedauerTage: 42,
  },
  solide: {
    beschreibung: 'Planbarer Aufwärtstrend, Schwankung und Rücksetzer zählen schwer',
    gewichte: { tempo: 6, impuls: 15, trend: 25, struktur: 14, umsatz: 5, staerke: 10, stabilitaet: 25 },
    haltedauerTage: 63,
  },
};

/* Schritt 1: Rohwerte ---------------------------------------------------- */

/**
 * Verdichtet eine Kursreihe zu Kennzahlen.
 *
 * `masstab` sind die Renditen des Vergleichsindex ({ r63, r126 }); fehlt er,
 * bleibt die relative Stärke unbestimmt.
 */
export function kennzahlenBerechnen(reihe, masstab = null) {
  const kurse = reihe.angepasst;
  if (kurse.length < 60) return null;

  const kurs = kurse[kurse.length - 1];
  const trend90 = trendgerade(kurse.slice(-90));
  const trend180 = trendgerade(kurse.slice(-180));
  if (!trend90) return null;

  const atr = handelsspanne(reihe.hoch, reihe.tief, reihe.angepasst, 14);
  const atrProzent = atr && kurs > 0 ? (atr / kurs) * 100 : null;

  const sma50 = gleitenderDurchschnitt(kurse, 50);
  const sma200 = gleitenderDurchschnitt(kurse, 200);
  const sma20 = gleitenderDurchschnitt(kurse, 20);

  const r21 = rendite(kurse, 21);
  const r63 = rendite(kurse, 63);
  const r126 = rendite(kurse, 126);
  const r252 = rendite(kurse, 252);

  // Der jüngste Monat wird bei den langen Fenstern ausgeklammert: Nach einem
  // starken Monat laufen Aktien kurzfristig eher zurück. Wer ihn mitzählt,
  // kauft die Rückläufer.
  const impuls =
    0.15 * (r21 ?? 0) +
    0.35 * (renditeFenster(kurse, 63, 5) ?? r63 ?? 0) +
    0.3 * (renditeFenster(kurse, 126, 5) ?? r126 ?? 0) +
    0.2 * (renditeFenster(kurse, 252, 21) ?? r252 ?? 0);

  const kraft90 = trend90.jahresSteigung * trend90.bestimmtheitsmass;
  const kraft180 = trend180 ? trend180.jahresSteigung * trend180.bestimmtheitsmass : null;
  const trendkraft = kraft180 === null ? kraft90 : 0.6 * kraft90 + 0.4 * kraft180;

  // Erwarteter Kursgewinn je Handelstag, aus der Steigung der Trendgeraden.
  const tagesdrift = (Math.exp(trend90.steigungProTag) - 1) * 100;
  // Tempo je Einheit Risiko: Wie viel Strecke bringt ein Tag, gemessen an dem,
  // was dieses Papier an einem gewöhnlichen Tag ohnehin schwankt. Zwei Aktien
  // mit 0,3 % Tagesdrift sind nicht gleich schnell, wenn die eine dafür 2 %
  // und die andere 6 % Tagesspanne braucht.
  const tempo = atrProzent && atrProzent > 0 ? tagesdrift / atrProzent : null;
  // Zieht das jüngste Tempo an? r21 gegen den auf einen Monat umgerechneten
  // Dreimonatsschnitt.
  const beschleunigung = r21 !== null && r63 !== null ? r21 - r63 / 3 : null;

  const relativeStaerke =
    masstab && r63 !== null && r126 !== null
      ? 0.6 * (r63 - masstab.r63) + 0.4 * (r126 - masstab.r126)
      : null;

  const macdWert = macd(kurse);
  const durchschnittsumsatz = mittel(reihe.volumen.slice(-60));

  const jahresrendite = r252 ?? (r126 !== null ? r126 * 2 : null);
  const abwaerts = abwaertsabweichung(kurse);
  const sortino = jahresrendite !== null && abwaerts > 0 ? jahresrendite / abwaerts : null;

  return {
    kurs,
    anzeigekurs: reihe.letzterKurs ?? reihe.schluss[reihe.schluss.length - 1],
    handelstage: kurse.length,
    r5: rendite(kurse, 5),
    r21,
    r63,
    r126,
    r252,
    impuls,
    trendkraft,
    jahresSteigung: trend90.jahresSteigung,
    bestimmtheitsmass: trend90.bestimmtheitsmass,
    steigungProTag: trend90.steigungProTag,
    tagesdrift,
    atr,
    atrProzent,
    tempo,
    beschleunigung,
    relativeStaerke,
    abstandHoch52: abstandZumHoch(kurse, 252),
    abstandTief52: abstandZumTief(kurse, 252),
    ueberSma20: sma20 ? (kurs / sma20 - 1) * 100 : null,
    ueberSma50: sma50 ? (kurs / sma50 - 1) * 100 : null,
    ueberSma200: sma200 ? (kurs / sma200 - 1) * 100 : null,
    // Drei Punkte: über dem 50er, über dem 200er, 50er über dem 200er. Die
    // klassische Aufwärtsordnung – erst wenn alle drei stimmen, zeigt jede
    // Zeitebene in dieselbe Richtung.
    maStapel:
      (sma50 && kurs > sma50 ? 1 : 0) +
      (sma200 && kurs > sma200 ? 1 : 0) +
      (sma50 && sma200 && sma50 > sma200 ? 1 : 0),
    rsi14: rsi(kurse, 14),
    macdAbstand: macdWert && kurs > 0 ? (macdWert.abstand / kurs) * 100 : null,
    umsatzschub: umsatzschub(reihe.volumen),
    aufwaertsanteil: aufwaertsanteil(kurse, 63),
    jahresschwankung: jahresschwankung(kurse, 63),
    abwaertsabweichung: abwaerts,
    sortino,
    ruecksetzer: groessterRuecksetzer(kurse.slice(-252)),
    schlimmsterTag: schlimmsterTag(kurse),
    durchschnittsumsatz,
    handelsvolumen: durchschnittsumsatz ? durchschnittsumsatz * kurs : null,
  };
}

/* Schritt 2: Rangplätze -------------------------------------------------- */

/**
 * Wandelt einen Rohwert in einen Rangplatz von 0 bis 100 um.
 *
 * Bei Gleichstand bekommen alle Betroffenen denselben mittleren Platz – sonst
 * entschiede die Reihenfolge im Array, also der Zufall des Abrufs.
 */
function rangplaetze(werte) {
  const gueltig = [];
  for (let i = 0; i < werte.length; i++) {
    if (typeof werte[i] === 'number' && Number.isFinite(werte[i])) gueltig.push([werte[i], i]);
  }
  const plaetze = new Array(werte.length).fill(null);
  if (gueltig.length < 2) {
    for (const [, i] of gueltig) plaetze[i] = 50;
    return plaetze;
  }

  gueltig.sort((a, b) => a[0] - b[0]);
  let start = 0;
  while (start < gueltig.length) {
    let ende = start;
    while (ende + 1 < gueltig.length && gueltig[ende + 1][0] === gueltig[start][0]) ende++;
    const platz = ((start + ende) / 2 / (gueltig.length - 1)) * 100;
    for (let i = start; i <= ende; i++) plaetze[gueltig[i][1]] = platz;
    start = ende + 1;
  }
  return plaetze;
}

/** Kurve mit Höchstwert im gewünschten Bereich, fallend nach beiden Seiten. */
function fensterPunkte(wert, unten, oben, breite) {
  if (wert == null) return UNBEKANNT;
  if (wert >= unten && wert <= oben) return 100;
  const abstand = wert < unten ? unten - wert : wert - oben;
  return Math.max(0, 100 - (abstand / breite) * 100);
}

/**
 * Berechnet für alle Kandidaten die Gruppen- und die Gesamtpunktzahl.
 *
 * `kandidaten` ist eine Liste aus `{ symbol, name, kennzahlen }`.
 */
export function ranglisteBilden(kandidaten, gewichte) {
  const spalte = (name) => rangplaetze(kandidaten.map((k) => k.kennzahlen[name]));
  const wert = (platz, i) => (platz[i] === null ? UNBEKANNT : platz[i]);

  const pImpuls = spalte('impuls');
  const pTrendkraft = spalte('trendkraft');
  const pBestimmtheit = spalte('bestimmtheitsmass');
  const pTempo = spalte('tempo');
  const pBeschleunigung = spalte('beschleunigung');
  const pAufwaerts = spalte('aufwaertsanteil');
  const pStaerke = spalte('relativeStaerke');
  const pHoch52 = spalte('abstandHoch52');
  const pMacd = spalte('macdAbstand');
  const pSchub = spalte('umsatzschub');
  const pVolumen = rangplaetze(
    kandidaten.map((k) => (k.kennzahlen.handelsvolumen > 0 ? Math.log10(k.kennzahlen.handelsvolumen) : null)),
  );
  const pSortino = spalte('sortino');
  const pRuecksetzer = rangplaetze(kandidaten.map((k) => k.kennzahlen.ruecksetzer)); // negativ: je näher an 0, desto besser
  const pSchwankung = rangplaetze(
    kandidaten.map((k) => (k.kennzahlen.jahresschwankung == null ? null : -k.kennzahlen.jahresschwankung)),
  );

  const summeGewichte = Object.values(gewichte).reduce((a, b) => a + b, 0) || 1;

  return kandidaten.map((kandidat, i) => {
    const k = kandidat.kennzahlen;

    const gruppen = {
      impuls: wert(pImpuls, i),
      trend: 0.65 * wert(pTrendkraft, i) + 0.35 * wert(pBestimmtheit, i),
      tempo: 0.55 * wert(pTempo, i) + 0.25 * wert(pBeschleunigung, i) + 0.2 * wert(pAufwaerts, i),
      staerke: wert(pStaerke, i),
      struktur:
        0.35 * ((k.maStapel ?? 0) / 3) * 100 +
        0.3 * wert(pHoch52, i) +
        // Zwischen 52 und 72 liegt der Bereich, in dem ein Aufwärtstrend
        // getragen wirkt: darunter fehlt der Druck, darüber ist die Bewegung
        // meist schon gelaufen und der Rücksetzer wahrscheinlicher.
        0.2 * fensterPunkte(k.rsi14, 52, 72, 30) +
        0.15 * wert(pMacd, i),
      umsatz: 0.6 * wert(pSchub, i) + 0.4 * wert(pVolumen, i),
      stabilitaet: 0.4 * wert(pSortino, i) + 0.3 * wert(pRuecksetzer, i) + 0.3 * wert(pSchwankung, i),
    };

    let punkte = 0;
    for (const [name, gewicht] of Object.entries(gewichte)) punkte += (gruppen[name] ?? UNBEKANNT) * gewicht;
    punkte /= summeGewichte;

    /* Abschläge --------------------------------------------------------- */
    // Kein Ausschluss, sondern ein Dämpfer: Diese Papiere können weiterhin
    // ganz oben stehen, müssen dafür aber deutlich besser sein als der Rest.
    const abschlaege = [];
    let faktor = 1;
    const daempfen = (bedingung, wieViel, grund) => {
      if (!bedingung) return;
      faktor *= wieViel;
      abschlaege.push(grund);
    };

    daempfen(k.rsi14 > 88, 0.9, 'kurzfristig heißgelaufen (RSI über 88)');
    daempfen(k.jahresschwankung > 150, 0.82, 'Schwankung über 150 % im Jahr');
    daempfen(k.jahresschwankung > 90 && k.jahresschwankung <= 150, 0.92, 'Schwankung über 90 % im Jahr');
    daempfen(k.ruecksetzer < -55, 0.9, 'Rücksetzer von über 55 % im letzten Jahr');
    daempfen(k.schlimmsterTag < -20, 0.93, 'einzelner Tagesverlust über 20 %');
    daempfen(k.bestimmtheitsmass < 0.3, 0.94, 'sprunghafter Verlauf, Trend schlecht gefasst');
    daempfen(k.handelstage < 200, 0.95, 'weniger als 200 Handelstage Historie');

    return {
      ...kandidat,
      gruppen,
      abschlaege,
      abschlagFaktor: faktor,
      punkte: Math.round(punkte * faktor * 10) / 10,
    };
  });
}

/**
 * Harte Ausschlüsse vor der Bewertung.
 *
 * Diese Grenzen sind bewusst kein Teil der Punktzahl: Ein Papier, das sich für
 * 40 Cent und 30.000 € Tagesumsatz handelt, ist nicht „etwas schlechter" –
 * es ist unbrauchbar, weil die eigene Order den Kurs bewegt. Solche Werte
 * gehören aus dem Feld, bevor sie die Rangplätze der anderen verzerren.
 */
export function ausschliessen(kennzahlen, grenzen) {
  const gruende = [];
  if (kennzahlen.handelstage < grenzen.minHandelstage) gruende.push('zu kurze Historie');
  if (kennzahlen.anzeigekurs < grenzen.minKurs) gruende.push('Kurs unter Mindestgrenze');
  if ((kennzahlen.handelsvolumen ?? 0) < grenzen.minHandelsvolumen) gruende.push('zu wenig Umsatz');
  if (grenzen.nurAufwaerts) {
    if (!(kennzahlen.ueberSma200 > 0)) gruende.push('unter dem 200-Tage-Durchschnitt');
    if (!(kennzahlen.impuls > 0)) gruende.push('kein positiver Impuls');
  }
  if (grenzen.maxSchwankung && kennzahlen.jahresschwankung > grenzen.maxSchwankung) {
    gruende.push('Schwankung über der Obergrenze');
  }
  return gruende;
}
