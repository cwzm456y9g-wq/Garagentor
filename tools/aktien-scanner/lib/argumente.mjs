/**
 * Auswertung der Kommandozeile und die Vorgabewerte des Werkzeugs.
 *
 * Die Vorgaben sind so gewählt, dass ein Aufruf ganz ohne Schalter bereits ein
 * brauchbares Ergebnis liefert. Wer nichts angibt, bekommt den US-Markt im
 * ausgewogenen Profil – das ist der Fall, für den das Werkzeug gebaut ist.
 */
import { PROFILE } from './bewertung.mjs';

export const VORGABEN = {
  markt: 'usa',
  profil: 'ausgewogen',
  anzahl: 20,
  kapital: 10000,
  risiko: 1, // Prozent des Depots, die ein ausgelöster Stopp kostet
  maxPosition: 20, // Prozent des Depots je Einzelwert
  minKurs: 5, // Papiere darunter schwanken prozentual zu stark am Spread
  minUmsatz: 5_000_000, // Tagesumsatz in Landeswährung
  minMarktkapital: 300_000_000,
  maxSchwankung: 0, // 0 = keine Obergrenze
  minHandelstage: 120,
  historie: '2y',
  gleichzeitig: 8,
  frisch: 8, // Stunden, die eine gespeicherte Kursreihe gilt
  horizont: 21,
  stichtage: 8,
};

const ZAHLENFELDER = new Set([
  'anzahl',
  'kapital',
  'risiko',
  'maxPosition',
  'minKurs',
  'minUmsatz',
  'minMarktkapital',
  'maxSchwankung',
  'minHandelstage',
  'gleichzeitig',
  'frisch',
  'horizont',
  'stichtage',
]);

const SCHALTER = {
  '--markt': 'markt',
  '--profil': 'profil',
  '--symbole': 'symbole',
  '--datei': 'datei',
  '--anzahl': 'anzahl',
  '--kapital': 'kapital',
  '--risiko': 'risiko',
  '--max-position': 'maxPosition',
  '--min-kurs': 'minKurs',
  '--min-umsatz': 'minUmsatz',
  '--min-marktkapital': 'minMarktkapital',
  '--max-schwankung': 'maxSchwankung',
  '--min-handelstage': 'minHandelstage',
  '--historie': 'historie',
  '--gleichzeitig': 'gleichzeitig',
  '--frisch': 'frisch',
  '--ordner': 'ordner',
  '--horizont': 'horizont',
  '--stichtage': 'stichtage',
};

const FLAGGEN = {
  '--alle': 'alle',
  '--geschaeftszahlen': 'geschaeftszahlen',
  '--kein-bericht': 'keinBericht',
  '--kein-verlauf': 'keinVerlauf',
  '--kein-zwischenspeicher': 'keinZwischenspeicher',
  '--pruefen': 'pruefen',
  '--rueckblick': 'rueckblick',
  '--leise': 'leise',
  '--hilfe': 'hilfe',
  '-h': 'hilfe',
};

export function argumenteLesen(argumente) {
  const werte = { ...VORGABEN, symbole: [], datei: null, ordner: null };
  const unbekannt = [];

  for (let i = 0; i < argumente.length; i++) {
    const teil = argumente[i];

    // `--anzahl=30` und `--anzahl 30` sollen beide gehen.
    const [name, direkt] = teil.includes('=') ? [teil.slice(0, teil.indexOf('=')), teil.slice(teil.indexOf('=') + 1)] : [teil, null];

    if (FLAGGEN[name]) {
      werte[FLAGGEN[name]] = true;
      continue;
    }
    if (SCHALTER[name]) {
      const feld = SCHALTER[name];
      const wert = direkt ?? argumente[++i];
      if (wert == null) throw new Error(`${name} erwartet einen Wert.`);
      if (feld === 'symbole') {
        werte.symbole = wert
          .split(',')
          .map((s) => s.trim().toUpperCase())
          .filter(Boolean);
      } else if (ZAHLENFELDER.has(feld)) {
        const zahl = Number(wert.replace(/[_\s]/g, ''));
        if (!Number.isFinite(zahl)) throw new Error(`${name} erwartet eine Zahl, nicht „${wert}".`);
        werte[feld] = zahl;
      } else {
        werte[feld] = wert;
      }
      continue;
    }
    unbekannt.push(teil);
  }

  if (unbekannt.length) throw new Error(`Unbekannte Angabe: ${unbekannt.join(', ')}`);

  // Naheliegende Schreibweisen durchlassen, statt sie mit einer Fehlermeldung
  // abzuweisen: Wer „weltweit" tippt, meint zweifelsfrei „welt".
  const MARKTNAMEN = {
    weltweit: 'welt',
    global: 'welt',
    de: 'deutschland',
    dax: 'deutschland',
    us: 'usa',
    amerika: 'usa',
  };
  werte.markt = MARKTNAMEN[werte.markt] ?? werte.markt;

  if (!PROFILE[werte.profil]) {
    throw new Error(`Profil „${werte.profil}" gibt es nicht. Möglich: ${Object.keys(PROFILE).join(', ')}.`);
  }
  if (!['usa', 'deutschland', 'welt', 'eigene'].includes(werte.markt)) {
    throw new Error(`Markt „${werte.markt}" gibt es nicht. Möglich: usa, deutschland, welt, eigene.`);
  }
  if (werte.symbole.length || werte.datei) werte.markt = werte.markt === 'usa' ? 'eigene' : werte.markt;
  if (werte.risiko <= 0 || werte.risiko > 10) {
    throw new Error('--risiko liegt sinnvoll zwischen 0,1 und 10 (Prozent des Depots je Position).');
  }

  return werte;
}

export const HILFE = `
Aktien-Scanner – durchsucht den Markt nach den Werten mit dem stärksten und
schnellsten Aufwärtstrend und schreibt daraus einen Handelsplan.

  node tools/aktien-scanner/scanner.mjs [Schalter]
  npm run aktien -- [Schalter]

MARKT
  --markt <name>          usa (Vorgabe), deutschland, welt (auch: weltweit)
                          oder eigene
  --symbole A,B,C         Nur diese Papiere prüfen
  --datei <pfad>          Symbolliste aus Datei, ein Symbol je Zeile

AUSWAHL
  --profil <name>         schnell | ausgewogen (Vorgabe) | solide
  --anzahl <n>            Länge der Bestenliste (Vorgabe 20)
  --alle                  Auch fallende Werte bewerten (sonst nur Aufwärtstrends)

FILTER
  --min-kurs <betrag>     Mindestkurs, Vorgabe 5
  --min-umsatz <betrag>   Mindest-Tagesumsatz in Landeswährung, Vorgabe 5.000.000
  --min-marktkapital <b>  Vorgabe 300.000.000
  --max-schwankung <p>    Obergrenze Jahresschwankung in Prozent, 0 = keine
  --min-handelstage <n>   Mindestlänge der Historie, Vorgabe 120

HANDELSPLAN
  --kapital <betrag>      Depotgröße für die Stückzahl, Vorgabe 10.000
  --risiko <prozent>      Verlust je Position bei Stopp, Vorgabe 1
  --max-position <proz.>  Obergrenze je Einzelwert, Vorgabe 20

AUSGABE
  --ordner <pfad>         Zielordner der Berichte (Vorgabe: berichte/ im Werkzeug)
  --kein-bericht          Nur Konsole, keine Dateien
  --kein-verlauf          Auswahl nicht ins Tagebuch schreiben
  --geschaeftszahlen      Für die Bestenliste zusätzlich Umsatz, Marge, Branche
  --leise                 Ohne Fortschrittsanzeige

NACHPRÜFUNG
  --rueckblick            Was ist aus den Empfehlungen früherer Läufe geworden?
  --pruefen               Dieselbe Regel an vergangenen Stichtagen durchrechnen
  --horizont <n>          Haltedauer in Handelstagen dafür, Vorgabe 21
  --stichtage <n>         Zahl der geprüften Zeitpunkte, Vorgabe 8

SONSTIGES
  --historie <zeitraum>   1y, 2y, 5y – Vorgabe 2y
  --gleichzeitig <n>      Parallele Abrufe, Vorgabe 8
  --frisch <stunden>      Gültigkeit gespeicherter Kurse, Vorgabe 8
  --kein-zwischenspeicher Immer frisch abrufen
  --hilfe                 Diese Übersicht

BEISPIELE
  npm run aktien
  npm run aktien -- --profil schnell --anzahl 15 --kapital 25000
  npm run aktien -- --markt deutschland --profil solide
  npm run aktien -- --symbole SAP.DE,SIE.DE,AAPL --kapital 5000
  npm run aktien -- --pruefen --horizont 42 --stichtage 10
  npm run aktien -- --rueckblick

Keine Anlageberatung. Das Werkzeug wertet Kursdaten nach festen Regeln aus; es
kennt weder Nachrichten noch Termine für Geschäftszahlen.
`;
