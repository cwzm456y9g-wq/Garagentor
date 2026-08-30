/**
 * Darstellung der Ergebnisse: Konsole, JSON und CSV.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

/* Formatierung ----------------------------------------------------------- */

const STEUER = `${String.fromCharCode(27)}[`;
const farben = {
  aus: `${STEUER}0m`,
  fett: `${STEUER}1m`,
  matt: `${STEUER}2m`,
  gruen: `${STEUER}32m`,
  rot: `${STEUER}31m`,
  gelb: `${STEUER}33m`,
  blau: `${STEUER}36m`,
};

// Wird die Ausgabe in eine Datei umgeleitet, stören Steuerzeichen mehr als sie
// nützen. `NO_COLOR` ist die verbreitete Übereinkunft, sie generell abzustellen.
const farbig = process.stdout.isTTY && !process.env.NO_COLOR;
const f = (name, text) => (farbig ? `${farben[name]}${text}${farben.aus}` : String(text));

export const zahl = (wert, stellen = 2) =>
  wert == null || !Number.isFinite(wert)
    ? '–'
    : wert.toLocaleString('de-DE', {
        minimumFractionDigits: stellen,
        maximumFractionDigits: stellen,
      });

export const prozent = (wert, stellen = 1) =>
  wert == null || !Number.isFinite(wert) ? '–' : `${wert >= 0 ? '+' : ''}${zahl(wert, stellen)} %`;

export function grossbetrag(wert) {
  if (wert == null || !Number.isFinite(wert)) return '–';
  const einheiten = [
    [1e12, 'Bio.'],
    [1e9, 'Mrd.'],
    [1e6, 'Mio.'],
    [1e3, 'Tsd.'],
  ];
  for (const [schwelle, kuerzel] of einheiten) {
    if (Math.abs(wert) >= schwelle) return `${zahl(wert / schwelle, 1)} ${kuerzel}`;
  }
  return zahl(wert, 0);
}

const kuerzen = (text, laenge) =>
  text.length <= laenge ? text.padEnd(laenge) : `${text.slice(0, laenge - 1)}…`;

/* Begründung -------------------------------------------------------------- */

/**
 * Fasst die Punktzahl in einem Satz zusammen, der ohne Kenntnis der Kennzahlen
 * verständlich ist.
 *
 * Ein Bericht, den man nur mit dem Quelltext daneben lesen kann, hilft bei
 * keiner Entscheidung. Genannt werden deshalb die beiden stärksten Gruppen im
 * Klartext, zwei harte Zahlen – und, falls vorhanden, der Grund für einen
 * Abzug. Gerade der gehört dazu: Ein Papier auf Platz drei, das dort trotz
 * eines Warnzeichens steht, ist etwas anderes als eines ohne.
 */
const GRUPPENSATZ = {
  impuls: 'anhaltender Kursimpuls',
  trend: 'sauber gefasster Aufwärtstrend',
  tempo: 'hohes Tempo je Handelstag',
  staerke: 'deutlich besser als der Gesamtmarkt',
  struktur: 'intakte Aufwärtsordnung der Durchschnitte',
  umsatz: 'auffällig hoher Handelsumsatz',
  stabilitaet: 'geringe Schwankung bei steigendem Kurs',
};

export function begruendung(eintrag) {
  const k = eintrag.kennzahlen;
  const teile = [];

  const stark = Object.entries(eintrag.gruppen)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .filter(([, punkte]) => punkte >= 60)
    .map(([name]) => GRUPPENSATZ[name] ?? name);
  if (stark.length) teile.push(stark.join(' und '));

  if (k.r63 != null) teile.push(`${prozent(k.r63)} in drei Monaten`);
  if (k.tagesdrift != null) teile.push(`rechnerisch ${prozent(k.tagesdrift, 2)} je Handelstag`);
  if (k.abstandHoch52 != null && k.abstandHoch52 > -8) {
    teile.push(`nahe am Jahreshoch (${prozent(k.abstandHoch52)})`);
  }
  if (eintrag.abschlaege.length) teile.push(`Abzug: ${eintrag.abschlaege.join(', ')}`);

  return teile.join('; ');
}

/* Konsole ---------------------------------------------------------------- */

export function tabelleSchreiben(treffer) {
  const kopf = [
    '  #'.padEnd(4),
    'Symbol'.padEnd(9),
    'Name'.padEnd(26),
    'Punkte'.padStart(7),
    'Kurs'.padStart(10),
    '3 Mon.'.padStart(9),
    '%/Tag'.padStart(7),
    'Stopp'.padStart(10),
    'Ziel'.padStart(10),
    'Tage'.padStart(6),
  ].join(' ');

  process.stdout.write(`\n${f('fett', kopf)}\n${f('matt', '─'.repeat(kopf.length))}\n`);

  treffer.forEach((eintrag, i) => {
    const k = eintrag.kennzahlen;
    const p = eintrag.plan;
    const punktefarbe = eintrag.punkte >= 75 ? 'gruen' : eintrag.punkte >= 60 ? 'gelb' : 'aus';
    process.stdout.write(
      [
        `${String(i + 1).padStart(3)}.`,
        f('blau', eintrag.symbol.padEnd(9)),
        kuerzen(eintrag.name, 26),
        f(punktefarbe, zahl(eintrag.punkte, 1).padStart(7)),
        zahl(k.anzeigekurs, 2).padStart(10),
        f(k.r63 >= 0 ? 'gruen' : 'rot', prozent(k.r63).padStart(9)),
        zahl(k.tagesdrift, 2).padStart(7),
        zahl(p?.stopp, 2).padStart(10),
        zahl(p?.ziel1, 2).padStart(10),
        String(p?.tageBisZiel1 ?? '–').padStart(6),
      ].join(' ') + '\n',
    );
  });
}

export function einzelheitenSchreiben(treffer, anzahl = 5) {
  for (const eintrag of treffer.slice(0, anzahl)) {
    const k = eintrag.kennzahlen;
    const p = eintrag.plan;
    process.stdout.write(
      `\n${f('fett', `${eintrag.symbol} – ${eintrag.name}`)}  ` +
        `${f('matt', `${zahl(k.anzeigekurs)} ${eintrag.waehrung}`)}\n`,
    );
    process.stdout.write(`  ${begruendung(eintrag)}\n`);
    process.stdout.write(
      `  ${f('matt', 'Punkte:')} ` +
        Object.entries(eintrag.gruppen)
          .map(([name, punkte]) => `${name} ${Math.round(punkte)}`)
          .join('  ') +
        '\n',
    );
    if (p) {
      process.stdout.write(
        `  ${f('matt', 'Plan:')} Einstieg ${zahl(p.einstieg)} · Stopp ${zahl(p.stopp)} ` +
          `(${prozent(-p.stoppAbstand)}) · Ziel ${zahl(p.ziel1)} · ${zahl(p.stueck, 0)} Stück ` +
          `(${grossbetrag(p.einsatz)}) · Risiko ${grossbetrag(p.risikobetrag)}\n`,
      );
    }
    if (eintrag.geschaeftszahlen?.branche) {
      const g = eintrag.geschaeftszahlen;
      process.stdout.write(
        `  ${f('matt', 'Geschäft:')} ${g.branche}` +
          (g.umsatzwachstum != null ? ` · Umsatz ${prozent(g.umsatzwachstum)}` : '') +
          (g.gewinnmarge != null ? ` · Marge ${prozent(g.gewinnmarge)}` : '') +
          (g.analystenurteil ? ` · Analysten: ${g.analystenurteil}` : '') +
          '\n',
      );
    }
  }
}

/* Dateien ---------------------------------------------------------------- */

export async function schreibenMitOrdner(pfad, inhalt) {
  await mkdir(dirname(pfad), { recursive: true });
  await writeFile(pfad, inhalt, 'utf8');
}

export async function alsJson(pfad, bericht) {
  await schreibenMitOrdner(pfad, `${JSON.stringify(bericht, null, 2)}\n`);
}

export async function alsCsv(pfad, treffer) {
  const spalten = [
    ['rang', (e, i) => i + 1],
    ['symbol', (e) => e.symbol],
    ['name', (e) => e.name],
    ['boerse', (e) => e.boerse],
    ['waehrung', (e) => e.waehrung],
    ['punkte', (e) => e.punkte],
    ['kurs', (e) => e.kennzahlen.anzeigekurs],
    ['rendite_1m', (e) => e.kennzahlen.r21],
    ['rendite_3m', (e) => e.kennzahlen.r63],
    ['rendite_6m', (e) => e.kennzahlen.r126],
    ['rendite_12m', (e) => e.kennzahlen.r252],
    ['prozent_je_tag', (e) => e.kennzahlen.tagesdrift],
    ['trendguete', (e) => e.kennzahlen.bestimmtheitsmass],
    ['jahressteigung', (e) => e.kennzahlen.jahresSteigung],
    ['schwankung', (e) => e.kennzahlen.jahresschwankung],
    ['ruecksetzer', (e) => e.kennzahlen.ruecksetzer],
    ['rsi', (e) => e.kennzahlen.rsi14],
    ['abstand_hoch_52w', (e) => e.kennzahlen.abstandHoch52],
    ['umsatzschub', (e) => e.kennzahlen.umsatzschub],
    ['tagesumsatz', (e) => e.kennzahlen.handelsvolumen],
    ['einstieg', (e) => e.plan?.einstieg],
    ['stopp', (e) => e.plan?.stopp],
    ['ziel', (e) => e.plan?.ziel1],
    ['tage_bis_ziel', (e) => e.plan?.tageBisZiel1],
    ['stueck', (e) => e.plan?.stueck],
    ['einsatz', (e) => e.plan?.einsatz],
  ];

  // Semikolon als Trenner, Punkt als Dezimalzeichen: Excel öffnet die Datei
  // damit in Spalten, und jedes andere Werkzeug liest die Zahlen trotzdem.
  const feld = (wert) => {
    if (wert == null) return '';
    const text =
      typeof wert === 'number' ? (Math.round(wert * 10000) / 10000).toString() : String(wert);
    return /[";\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };

  const zeilen = [spalten.map(([name]) => name).join(';')];
  treffer.forEach((eintrag, i) => {
    zeilen.push(spalten.map(([, hole]) => feld(hole(eintrag, i))).join(';'));
  });
  await schreibenMitOrdner(pfad, `${zeilen.join('\n')}\n`);
}
