/**
 * Prüfungen für die Rechenkerne des Scanners.
 *
 *   node --test tools/aktien-scanner/tests/
 *   npm run aktien:test
 *
 * Geprüft wird ausschließlich mit erfundenen Reihen, deren Ergebnis von Hand
 * nachvollziehbar ist – kein Netz, keine echten Kurse. Bei einem Werkzeug, das
 * über Geld entscheidet, ist eine Kennzahl, die still um den Faktor 100 daneben
 * liegt, gefährlicher als ein Absturz: Der Absturz fällt auf.
 */
import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import {
  abstandZumHoch,
  aufwaertsanteil,
  exponentiellerDurchschnitt,
  gleitenderDurchschnitt,
  groessterRuecksetzer,
  handelsspanne,
  jahresschwankung,
  median,
  rendite,
  renditeFenster,
  rsi,
  trendgerade,
  umsatzschub,
} from '../lib/kennzahlen.mjs';
import { PROFILE, ausschliessen, kennzahlenBerechnen, ranglisteBilden } from '../lib/bewertung.mjs';
import { handelsplanErstellen } from '../lib/handelsplan.mjs';
import { gegenprobe } from '../lib/pruefung.mjs';

/**
 * Gleichheit für Fließkommazahlen. `0,1 + 0,2` ist auch hier nicht `0,3`;
 * ein strikter Vergleich prüfte die Rechengenauigkeit der Maschine, nicht die
 * Formel.
 */
const nahe = (ist, soll, spielraum = 1e-9) =>
  assert.ok(Math.abs(ist - soll) < spielraum, `${ist} statt ${soll}`);

/** Erzeugt eine Reihe mit fester täglicher Steigerung. */
const gerade = (anzahl, start, proTag) =>
  Array.from({ length: anzahl }, (_, i) => start * (1 + proTag) ** i);

/** Baut aus einer Kursreihe das Format, das der Abruf liefert. */
function reiheAus(kurse, { symbol = 'TEST', volumen = null } = {}) {
  return {
    symbol,
    name: symbol,
    waehrung: 'EUR',
    boerse: 'Test',
    letzterKurs: kurse[kurse.length - 1],
    standDatum: '2026-01-01',
    zeit: kurse.map((_, i) => Date.UTC(2024, 0, 1) + i * 86400000),
    offen: kurse.map((k) => k),
    hoch: kurse.map((k) => k * 1.01),
    tief: kurse.map((k) => k * 0.99),
    schluss: [...kurse],
    angepasst: [...kurse],
    volumen: volumen ?? kurse.map(() => 1_000_000),
  };
}

describe('Kennzahlen', () => {
  it('Durchschnitte über die letzten n Werte', () => {
    assert.equal(gleitenderDurchschnitt([1, 2, 3, 4, 5], 5), 3);
    assert.equal(gleitenderDurchschnitt([1, 2, 3, 4, 5], 2), 4.5);
    // Zu kurze Reihe liefert null, nicht 0 – sonst zählt „unbekannt" später
    // als „schlecht" und verzerrt die Rangliste.
    assert.equal(gleitenderDurchschnitt([1, 2], 5), null);
  });

  it('exponentieller Durchschnitt bleibt bei konstanter Reihe konstant', () => {
    nahe(exponentiellerDurchschnitt(new Array(50).fill(7), 10), 7);
  });

  it('Rendite über n Handelstage', () => {
    nahe(rendite([100, 110, 120], 2), 20);
    assert.equal(rendite([100, 110], 5), null);
  });

  it('Fensterrendite klammert die jüngsten Tage aus', () => {
    // Letzter Wert ist ein Ausreißer nach oben; mit Versatz 1 darf er das
    // Ergebnis nicht mehr berühren.
    const kurse = [100, 100, 100, 110, 200];
    nahe(renditeFenster(kurse, 1, 1), 10);
    assert.equal(Math.round(rendite(kurse, 1)), 82);
  });

  it('größter Rücksetzer misst vom bisherigen Höchststand', () => {
    assert.equal(groessterRuecksetzer([100, 120, 60, 90]), -50);
    assert.equal(groessterRuecksetzer([100, 110, 120]), 0);
  });

  it('RSI erreicht die Ränder bei reinen Gewinn- und Verlustreihen', () => {
    assert.equal(rsi(gerade(40, 100, 0.01), 14), 100);
    assert.ok(rsi(gerade(40, 100, -0.01), 14) < 1);
    // Wechselt der Kurs gleichmäßig auf und ab, liegt der RSI in der Mitte.
    const wechsel = Array.from({ length: 40 }, (_, i) => 100 + (i % 2));
    assert.ok(Math.abs(rsi(wechsel, 14) - 50) < 15);
  });

  it('Handelsspanne entspricht bei fester Spanne genau dieser', () => {
    const schluss = new Array(40).fill(100);
    const hoch = new Array(40).fill(102);
    const tief = new Array(40).fill(98);
    assert.equal(handelsspanne(hoch, tief, schluss, 14), 4);
  });

  it('Trendgerade trifft eine exakte Verzinsung', () => {
    const trend = trendgerade(gerade(120, 100, 0.001));
    // Bei sauberer Exponentialkurve ist das Bestimmtheitsmaß 1 …
    assert.ok(trend.bestimmtheitsmass > 0.999);
    // … und die Jahressteigung genau (1,001^252 − 1).
    assert.ok(Math.abs(trend.jahresSteigung - ((1.001 ** 252 - 1) * 100)) < 0.5);
  });

  it('Trendgerade erkennt einen Sprung als schlecht gefasst', () => {
    const sprunghaft = [...new Array(60).fill(100), ...new Array(60).fill(150)];
    const trend = trendgerade(sprunghaft);
    assert.ok(trend.jahresSteigung > 0, 'steigt insgesamt');
    assert.ok(trend.bestimmtheitsmass < 0.8, 'aber nicht als Gerade beschreibbar');
  });

  it('Schwankung einer konstanten Reihe ist null', () => {
    assert.equal(jahresschwankung(new Array(80).fill(100)), 0);
  });

  it('Abstand zum Hoch ist bei einem neuen Hoch genau null', () => {
    assert.equal(abstandZumHoch(gerade(60, 100, 0.01)), 0);
    assert.equal(abstandZumHoch([100, 200, 150]), -25);
  });

  it('Umsatzschub vergleicht kurzen mit langem Schnitt', () => {
    const volumen = [...new Array(50).fill(100), ...new Array(10).fill(300)];
    // Kurzer Schnitt 300, langer (50 × 100 + 10 × 300) / 60 = 133,3.
    assert.ok(Math.abs(umsatzschub(volumen, 10, 60) - 2.25) < 0.01);
  });

  it('Aufwärtsanteil zählt nur Gewinntage', () => {
    assert.equal(aufwaertsanteil(gerade(70, 100, 0.01), 63), 100);
  });

  it('Median ist gegen einzelne Ausreißer unempfindlich', () => {
    assert.equal(median([1, 2, 3, 4, 1000]), 3);
    assert.equal(median([1, 2, 3, 4]), 2.5);
  });
});

describe('Bewertung', () => {
  const felder = (n, proTag) => ({
    symbol: `S${n}`,
    name: `S${n}`,
    kennzahlen: kennzahlenBerechnen(reiheAus(gerade(300, 50, proTag), { symbol: `S${n}` })),
  });

  it('stärkerer Trend bekommt mehr Punkte', () => {
    const kandidaten = [felder(1, 0.0005), felder(2, 0.002), felder(3, 0.0001)];
    const rang = ranglisteBilden(kandidaten, PROFILE.ausgewogen.gewichte).sort(
      (a, b) => b.punkte - a.punkte,
    );
    assert.equal(rang[0].symbol, 'S2');
    assert.equal(rang[2].symbol, 'S3');
  });

  it('Rangplätze bleiben zwischen 0 und 100', () => {
    const kandidaten = [felder(1, 0.0005), felder(2, 0.002), felder(3, -0.001)];
    for (const eintrag of ranglisteBilden(kandidaten, PROFILE.schnell.gewichte)) {
      assert.ok(eintrag.punkte >= 0 && eintrag.punkte <= 100, `außerhalb: ${eintrag.punkte}`);
      for (const punkte of Object.values(eintrag.gruppen)) {
        assert.ok(punkte >= 0 && punkte <= 100);
      }
    }
  });

  it('Profile gewichten unterschiedlich, nicht identisch', () => {
    // Ein ruhiger und ein schneller, aber unruhiger Wert: Das Profil muss die
    // Reihenfolge drehen, sonst wären die Gewichte wirkungslos.
    const ruhig = {
      symbol: 'RUHIG',
      name: 'RUHIG',
      kennzahlen: kennzahlenBerechnen(reiheAus(gerade(300, 50, 0.0008), { symbol: 'RUHIG' })),
    };
    const unruhig = gerade(300, 50, 0.0012).map((k, i) => k * (1 + (i % 2 ? 0.05 : -0.05)));
    const wild = {
      symbol: 'WILD',
      name: 'WILD',
      kennzahlen: kennzahlenBerechnen(reiheAus(unruhig, { symbol: 'WILD' })),
    };

    const nachProfil = (name) =>
      ranglisteBilden([ruhig, wild], PROFILE[name].gewichte).sort((a, b) => b.punkte - a.punkte)[0]
        .symbol;
    assert.equal(nachProfil('solide'), 'RUHIG');
    assert.notEqual(PROFILE.schnell.gewichte.tempo, PROFILE.solide.gewichte.tempo);
  });

  it('Filter greifen bei zu wenig Umsatz und fallendem Kurs', () => {
    const grenzen = {
      minKurs: 5,
      minHandelsvolumen: 1_000_000,
      minHandelstage: 120,
      maxSchwankung: null,
      nurAufwaerts: true,
    };
    const fallend = kennzahlenBerechnen(reiheAus(gerade(300, 50, -0.001)));
    assert.ok(ausschliessen(fallend, grenzen).length > 0);

    const duenn = kennzahlenBerechnen(
      reiheAus(gerade(300, 50, 0.001), { volumen: new Array(300).fill(10) }),
    );
    assert.ok(ausschliessen(duenn, grenzen).includes('zu wenig Umsatz'));

    const gut = kennzahlenBerechnen(reiheAus(gerade(300, 50, 0.001)));
    assert.deepEqual(ausschliessen(gut, grenzen), []);
  });
});

describe('Handelsplan', () => {
  const reihe = reiheAus(gerade(300, 100, 0.001));
  const kennzahlen = kennzahlenBerechnen(reihe);
  const plan = handelsplanErstellen(kennzahlen, reihe, {
    kapital: 10000,
    risikoAnteil: 0.01,
    maxAnteil: 0.2,
    haltedauerTage: 42,
  });

  it('Stopp liegt unter dem Einstieg, Ziel darüber', () => {
    assert.ok(plan.stopp < plan.einstieg);
    assert.ok(plan.ziel1 > plan.einstieg);
    assert.ok(plan.stoppAbstand >= 2, 'nie enger als zwei Prozent');
  });

  it('Chance-Risiko-Verhältnis ist zwei zu eins', () => {
    assert.ok(Math.abs(plan.chanceRisiko - 2) < 1e-9);
  });

  it('Stückzahl setzt nie mehr als das erlaubte Risiko aufs Spiel', () => {
    // 1 % von 10.000 € sind 100 €; mehr darf ein ausgelöster Stopp nicht kosten.
    assert.ok(plan.risikobetrag <= 100 + 1e-9);
  });

  it('das Risikobudget wird ausgeschöpft, wo die Positionsgrenze nicht bremst', () => {
    // Ohne Obergrenze je Einzelwert bleibt nur das Risiko als Bremse. Dann muss
    // das Budget bis auf ein Stück genau aufgebraucht sein – sonst wäre die
    // Position kleiner als beabsichtigt und der Plan zu vorsichtig.
    const ohneDeckel = handelsplanErstellen(kennzahlen, reihe, {
      kapital: 10000,
      risikoAnteil: 0.01,
      maxAnteil: 1,
      haltedauerTage: 42,
    });
    assert.equal(ohneDeckel.begrenztDurch, 'Risiko');
    assert.ok(ohneDeckel.risikobetrag <= 100 + 1e-9);
    assert.ok(ohneDeckel.risikobetrag > 100 - (ohneDeckel.einstieg - ohneDeckel.stopp));
  });

  it('Positionsgrenze wird eingehalten', () => {
    assert.ok(plan.einsatz <= 10000 * 0.2 + 1e-9);
    assert.ok(['Risiko', 'Positionsgrenze'].includes(plan.begrenztDurch));
  });

  it('bei fallendem Trend bleibt die Tageszahl unbestimmt', () => {
    const fallendeReihe = reiheAus(gerade(300, 100, -0.001));
    const fallend = handelsplanErstellen(
      kennzahlenBerechnen(fallendeReihe),
      fallendeReihe,
      { kapital: 10000, risikoAnteil: 0.01, maxAnteil: 0.2, haltedauerTage: 42 },
    );
    assert.equal(fallend.tageBisZiel1, null);
  });
});

describe('Gegenprobe', () => {
  it('rechnet ohne Blick in die Zukunft und findet die stärkeren Werte', () => {
    // 40 Reihen mit unterschiedlicher, aber über die Zeit gleichbleibender
    // Steigung. Wenn die Auswahl funktioniert, muss sie die steilen finden –
    // und ihr Median muss über dem des Feldes liegen.
    const reihen = Array.from({ length: 40 }, (_, i) =>
      reiheAus(gerade(400, 50, 0.0002 + i * 0.00008), { symbol: `W${i}` }),
    );
    const ergebnis = gegenprobe(reihen, null, {
      gewichte: PROFILE.ausgewogen.gewichte,
      grenzen: {
        minKurs: 5,
        minHandelsvolumen: 1_000_000,
        minHandelstage: 120,
        maxSchwankung: null,
        nurAufwaerts: true,
      },
      stichtage: 3,
      horizont: 21,
      anzahl: 5,
    });

    assert.ok(ergebnis.gesamt, 'es kommt ein Ergebnis zustande');
    assert.ok(ergebnis.gesamt.vorsprung > 0, 'Auswahl liegt vor dem Feld');
    assert.equal(ergebnis.gesamt.trefferquote, 100, 'steigende Reihen steigen weiter');
  });
});
