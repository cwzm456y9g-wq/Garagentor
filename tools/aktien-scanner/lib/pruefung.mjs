/**
 * Die Gegenprobe: Hätte dieselbe Auswahlregel in der Vergangenheit funktioniert?
 *
 * Ein Bewertungsverfahren, das nur die Gegenwart sortiert, ist nicht überprüfbar
 * – es sieht immer plausibel aus. Deshalb rechnet dieses Modul den Lauf an
 * vergangenen Stichtagen noch einmal durch: Die Kursreihen werden auf den Stand
 * von damals gekürzt, die Rangliste neu gebildet, und dann wird nachgesehen,
 * was aus den damaligen Spitzenplätzen bis heute geworden ist.
 *
 * Entscheidend ist die Kürzung. Wer versehentlich auch nur einen Tag aus der
 * Zukunft in die Kennzahlen lässt, bekommt Ergebnisse, die jeden Zweifel
 * ausräumen und trotzdem wertlos sind. Deshalb geschieht der Schnitt hier an
 * einer einzigen Stelle, in `bisTag()`, und alles andere rechnet mit dem, was
 * dabei herauskommt.
 *
 * Was die Zahlen nicht enthalten: Gebühren, Spanne zwischen An- und
 * Verkaufskurs, Steuern – und alle Papiere, die es heute nicht mehr gibt. Der
 * letzte Punkt ist der schwerste: Wer nur überlebende Unternehmen prüft, misst
 * das Ergebnis zu freundlich. Die Zahlen taugen also für den Vergleich zweier
 * Profile, nicht als Renditeversprechen.
 */
import { ausschliessen, kennzahlenBerechnen, ranglisteBilden } from './bewertung.mjs';
import { median, mittel } from './kennzahlen.mjs';

/** Schneidet eine Kursreihe auf den Stand von vor `versatz` Handelstagen. */
function bisTag(reihe, versatz) {
  if (versatz <= 0) return reihe;
  const bis = reihe.angepasst.length - versatz;
  if (bis < 60) return null;
  const kuerzen = (feld) => reihe[feld].slice(0, bis);
  return {
    ...reihe,
    zeit: kuerzen('zeit'),
    offen: kuerzen('offen'),
    hoch: kuerzen('hoch'),
    tief: kuerzen('tief'),
    schluss: kuerzen('schluss'),
    angepasst: kuerzen('angepasst'),
    volumen: kuerzen('volumen'),
    // Der Anzeigekurs muss mitwandern, sonst rechnet der Filter mit dem
    // heutigen Kurs gegen die Kennzahlen von damals.
    letzterKurs: reihe.schluss[bis - 1],
  };
}

/** Rendite in Prozent von `versatz` Tagen vor dem Ende über `horizont` Tage. */
function vorwaertsrendite(reihe, versatz, horizont) {
  const kurse = reihe.angepasst;
  const start = kurse.length - versatz - 1;
  const ende = Math.min(kurse.length - 1, start + horizont);
  if (start < 0 || ende <= start || !(kurse[start] > 0)) return null;
  return (kurse[ende] / kurse[start] - 1) * 100;
}

/**
 * Führt die Gegenprobe durch.
 *
 * `stichtage` ist die Zahl der geprüften Zeitpunkte, `horizont` die
 * Haltedauer in Handelstagen, `anzahl` die Größe der jeweiligen Auswahl.
 */
export function gegenprobe(reihen, masstabReihe, { gewichte, grenzen, stichtage, horizont, anzahl }) {
  const laeufe = [];
  // Der Kalender für die Stichtage kommt aus der längsten vorhandenen Reihe.
  // Eine beliebige zu nehmen wäre falsch: Papiere mit Handelspausen haben
  // weniger Kerzen, und ihr n-ter Tag von hinten liegt weiter zurück.
  const kalender = (masstabReihe ?? reihen.reduce((a, b) => (b.zeit.length > a.zeit.length ? b : a))).zeit;

  for (let nummer = 0; nummer < stichtage; nummer++) {
    // Die Stichtage überlappen sich nicht: Jeder liegt eine volle Haltedauer
    // vor dem nächsten. Überlappende Fenster würden dieselbe Marktphase
    // mehrfach zählen und die Streuung künstlich klein rechnen.
    const versatz = horizont * (nummer + 1);

    const masstabDamals = masstabReihe ? bisTag(masstabReihe, versatz) : null;
    const masstab = masstabDamals
      ? (() => {
          const k = kennzahlenBerechnen(masstabDamals);
          return k ? { r63: k.r63 ?? 0, r126: k.r126 ?? 0 } : null;
        })()
      : null;

    const kandidaten = [];
    const alleRenditen = [];

    for (const reihe of reihen) {
      const damals = bisTag(reihe, versatz);
      if (!damals) continue;
      const kennzahlen = kennzahlenBerechnen(damals, masstab);
      if (!kennzahlen) continue;
      if (ausschliessen(kennzahlen, grenzen).length) continue;

      const nachher = vorwaertsrendite(reihe, versatz, horizont);
      if (nachher === null) continue;

      kandidaten.push({ symbol: reihe.symbol, name: reihe.name, kennzahlen, nachher });
      alleRenditen.push(nachher);
    }

    // Weniger als das Dreifache der Auswahlgröße im Feld: Dann ist die
    // Rangliste keine Auswahl mehr, sondern fast das ganze Feld – der
    // Vergleich mit dem Feld würde sich selbst prüfen.
    if (kandidaten.length < anzahl * 3) continue;

    const bewertet = ranglisteBilden(kandidaten, gewichte).sort((a, b) => b.punkte - a.punkte);
    const auswahl = bewertet.slice(0, anzahl);
    const renditen = auswahl.map((e) => e.nachher);

    laeufe.push({
      stichtag: new Date(kalender[Math.max(0, kalender.length - versatz - 1)]).toISOString().slice(0, 10),
      geprueft: kandidaten.length,
      auswahl: auswahl.length,
      mittelAuswahl: mittel(renditen),
      medianAuswahl: median(renditen),
      mittelFeld: mittel(alleRenditen),
      medianFeld: median(alleRenditen),
      trefferquote: (renditen.filter((r) => r > 0).length / renditen.length) * 100,
      beste: auswahl
        .slice(0, 3)
        .map((e) => ({ symbol: e.symbol, punkte: e.punkte, nachher: e.nachher })),
    });
  }

  if (!laeufe.length) return { laeufe: [], gesamt: null };

  const vorsprung = laeufe.map((l) => l.medianAuswahl - l.medianFeld);
  return {
    laeufe,
    gesamt: {
      stichtage: laeufe.length,
      horizont,
      mittelAuswahl: mittel(laeufe.map((l) => l.mittelAuswahl)),
      medianAuswahl: median(laeufe.map((l) => l.medianAuswahl)),
      medianFeld: median(laeufe.map((l) => l.medianFeld)),
      vorsprung: median(vorsprung),
      // Wie oft lag die Auswahl vor dem Rest des Feldes? Die Kennzahl, auf die
      // es ankommt: Eine gute Rendite in einem Jahr, in dem alles stieg, sagt
      // über das Verfahren nichts aus.
      besserAlsFeld: (vorsprung.filter((v) => v > 0).length / vorsprung.length) * 100,
      trefferquote: mittel(laeufe.map((l) => l.trefferquote)),
    },
  };
}
