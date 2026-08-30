/**
 * Kennzahlen aus Kursreihen – reine Rechenfunktionen, kein Netz, kein Zustand.
 *
 * Alle Funktionen erwarten Arrays in zeitlicher Reihenfolge: Index 0 ist der
 * älteste Handelstag, der letzte Index der jüngste. Fehlt zu wenig Historie,
 * kommt `null` zurück statt einer Zahl, die nach etwas aussieht, aber nichts
 * aussagt. Das ist der wichtigste Vertrag dieser Datei: Ein `null` weiter oben
 * führt dazu, dass ein Wert bei der Bewertung als „unbekannt" behandelt wird –
 * eine 0 würde dagegen als „schlecht" durchgehen und die Rangliste verfälschen.
 */

/** Arithmetisches Mittel; `null` bei leerer Reihe. */
export function mittel(werte) {
  if (!werte?.length) return null;
  let summe = 0;
  for (const wert of werte) summe += wert;
  return summe / werte.length;
}

/** Standardabweichung der Stichprobe (n−1). */
export function standardabweichung(werte) {
  if (!werte || werte.length < 2) return null;
  const m = mittel(werte);
  let summe = 0;
  for (const wert of werte) summe += (wert - m) ** 2;
  return Math.sqrt(summe / (werte.length - 1));
}

/** Median – unempfindlich gegen einzelne Ausreißer, anders als das Mittel. */
export function median(werte) {
  if (!werte?.length) return null;
  const sortiert = [...werte].sort((a, b) => a - b);
  const mitte = Math.floor(sortiert.length / 2);
  return sortiert.length % 2 ? sortiert[mitte] : (sortiert[mitte - 1] + sortiert[mitte]) / 2;
}

/** Einfacher gleitender Durchschnitt der letzten `n` Werte. */
export function gleitenderDurchschnitt(werte, n) {
  if (!werte || werte.length < n) return null;
  return mittel(werte.slice(-n));
}

/**
 * Exponentiell gewichteter Durchschnitt über die gesamte Reihe.
 * Startwert ist der einfache Durchschnitt der ersten `n` Werte – so hängt das
 * Ergebnis nicht am Zufall des allerersten Kurses.
 */
export function exponentiellerDurchschnitt(werte, n) {
  if (!werte || werte.length < n) return null;
  const faktor = 2 / (n + 1);
  let wert = mittel(werte.slice(0, n));
  for (let i = n; i < werte.length; i++) wert = werte[i] * faktor + wert * (1 - faktor);
  return wert;
}

/** Tagesrenditen in Prozent-Bruchteilen (0,01 = +1 %). */
export function tagesrenditen(kurse) {
  const renditen = [];
  for (let i = 1; i < kurse.length; i++) {
    if (kurse[i - 1] > 0) renditen.push(kurse[i] / kurse[i - 1] - 1);
  }
  return renditen;
}

/** Rendite über die letzten `n` Handelstage in Prozent. */
export function rendite(kurse, n) {
  if (!kurse || kurse.length <= n) return null;
  const vorher = kurse[kurse.length - 1 - n];
  if (!(vorher > 0)) return null;
  return (kurse[kurse.length - 1] / vorher - 1) * 100;
}

/**
 * Rendite eines Zeitfensters, das vor `versatz` Tagen endet.
 *
 * Für den klassischen „12 minus 1"-Impuls: Der jüngste Monat wird bewusst
 * ausgeklammert, weil Aktien nach einem starken Monat kurzfristig eher
 * zurücklaufen. Wer ihn mitzählt, kauft genau diese Rückläufer.
 */
export function renditeFenster(kurse, n, versatz) {
  if (!kurse || kurse.length <= n + versatz) return null;
  const ende = kurse[kurse.length - 1 - versatz];
  const anfang = kurse[kurse.length - 1 - versatz - n];
  if (!(anfang > 0)) return null;
  return (ende / anfang - 1) * 100;
}

/** Auf ein Jahr hochgerechnete Schwankungsbreite in Prozent (252 Handelstage). */
export function jahresschwankung(kurse, n = 63) {
  const renditen = tagesrenditen(kurse.slice(-(n + 1)));
  const abweichung = standardabweichung(renditen);
  return abweichung === null ? null : abweichung * Math.sqrt(252) * 100;
}

/**
 * Abwärtsabweichung: wie die Schwankungsbreite, aber nur Verlusttage zählen.
 *
 * Kursanstiege sind kein Risiko. Eine Kennzahl, die sie mitbestraft, sortiert
 * genau die Aktien nach hinten, die gesucht sind.
 */
export function abwaertsabweichung(kurse, n = 126) {
  const renditen = tagesrenditen(kurse.slice(-(n + 1))).filter((r) => r < 0);
  if (renditen.length < 5) return null;
  let summe = 0;
  for (const r of renditen) summe += r * r;
  return Math.sqrt(summe / renditen.length) * Math.sqrt(252) * 100;
}

/** Tiefster Punkt unter dem bis dahin höchsten Stand, in Prozent (negativ). */
export function groessterRuecksetzer(kurse) {
  if (!kurse?.length) return null;
  let hoch = kurse[0];
  let schlimmster = 0;
  for (const kurs of kurse) {
    if (kurs > hoch) hoch = kurs;
    const abstand = (kurs / hoch - 1) * 100;
    if (abstand < schlimmster) schlimmster = abstand;
  }
  return schlimmster;
}

/**
 * Kleinste-Quadrate-Gerade durch die logarithmierten Kurse.
 *
 * Logarithmiert, weil ein Aufschlag von 10 % bei 20 € und bei 200 € dasselbe
 * bedeutet – auf der linearen Skala wäre der zweite zehnmal so „steil".
 *
 * Zurück kommen drei Dinge:
 *   `steigungProTag`   – mittleres Wachstum je Handelstag (logarithmisch)
 *   `jahresSteigung`   – dasselbe auf ein Jahr hochgerechnet, in Prozent
 *   `bestimmtheitsmass`– 0 bis 1: wie gut die Gerade die Reihe wirklich trifft
 *
 * Das Bestimmtheitsmaß ist der eigentliche Filter. Zwei Aktien können dieselbe
 * Jahressteigung haben: die eine läuft ruhig nach oben, die andere macht einen
 * Sprung und dann ein halbes Jahr nichts. Nur die erste ist planbar.
 */
export function trendgerade(kurse) {
  if (!kurse || kurse.length < 20) return null;
  const y = [];
  for (const kurs of kurse) {
    if (!(kurs > 0)) return null;
    y.push(Math.log(kurs));
  }
  const n = y.length;
  const mittelX = (n - 1) / 2;
  const mittelY = mittel(y);
  let zaehler = 0;
  let nennerX = 0;
  for (let i = 0; i < n; i++) {
    zaehler += (i - mittelX) * (y[i] - mittelY);
    nennerX += (i - mittelX) ** 2;
  }
  if (nennerX === 0) return null;
  const steigung = zaehler / nennerX;

  let restQuadrate = 0;
  let gesamtQuadrate = 0;
  for (let i = 0; i < n; i++) {
    const geschaetzt = mittelY + steigung * (i - mittelX);
    restQuadrate += (y[i] - geschaetzt) ** 2;
    gesamtQuadrate += (y[i] - mittelY) ** 2;
  }
  const bestimmtheitsmass = gesamtQuadrate === 0 ? 0 : 1 - restQuadrate / gesamtQuadrate;

  return {
    steigungProTag: steigung,
    jahresSteigung: (Math.exp(steigung * 252) - 1) * 100,
    bestimmtheitsmass: Math.max(0, Math.min(1, bestimmtheitsmass)),
  };
}

/**
 * Relative-Stärke-Index nach Wilder.
 *
 * Über 70 gilt als „überkauft", unter 30 als „überverkauft". Für die Bewertung
 * hier ist vor allem der Bereich 50–70 interessant: Aufwärtsdruck, aber noch
 * nicht ausgereizt.
 */
export function rsi(kurse, n = 14) {
  if (!kurse || kurse.length < n + 1) return null;
  let gewinn = 0;
  let verlust = 0;
  for (let i = 1; i <= n; i++) {
    const unterschied = kurse[i] - kurse[i - 1];
    if (unterschied >= 0) gewinn += unterschied;
    else verlust -= unterschied;
  }
  gewinn /= n;
  verlust /= n;
  for (let i = n + 1; i < kurse.length; i++) {
    const unterschied = kurse[i] - kurse[i - 1];
    gewinn = (gewinn * (n - 1) + (unterschied > 0 ? unterschied : 0)) / n;
    verlust = (verlust * (n - 1) + (unterschied < 0 ? -unterschied : 0)) / n;
  }
  if (verlust === 0) return gewinn === 0 ? 50 : 100;
  return 100 - 100 / (1 + gewinn / verlust);
}

/**
 * Mittlere wahre Handelsspanne (Average True Range) nach Wilder.
 *
 * Misst, wie weit sich der Kurs an einem gewöhnlichen Tag bewegt – inklusive
 * Kurslücken zwischen Schluss und nächster Eröffnung. Grundlage für den
 * Stopp-Abstand: Ein Stopp innerhalb der normalen Tagesbewegung wird vom
 * Rauschen ausgelöst, nicht vom Trendbruch.
 */
export function handelsspanne(hoch, tief, schluss, n = 14) {
  if (!schluss || schluss.length < n + 1) return null;
  const spannen = [];
  for (let i = 1; i < schluss.length; i++) {
    spannen.push(
      Math.max(
        hoch[i] - tief[i],
        Math.abs(hoch[i] - schluss[i - 1]),
        Math.abs(tief[i] - schluss[i - 1]),
      ),
    );
  }
  if (spannen.length < n) return null;
  let wert = mittel(spannen.slice(0, n));
  for (let i = n; i < spannen.length; i++) wert = (wert * (n - 1) + spannen[i]) / n;
  return wert;
}

/** MACD-Linie und Signal – misst, ob sich der Aufwärtsdruck gerade verstärkt. */
export function macd(kurse, kurz = 12, lang = 26, signal = 9) {
  if (!kurse || kurse.length < lang + signal) return null;
  const linie = [];
  for (let i = lang; i <= kurse.length; i++) {
    const fenster = kurse.slice(0, i);
    const schnell = exponentiellerDurchschnitt(fenster, kurz);
    const langsam = exponentiellerDurchschnitt(fenster, lang);
    if (schnell === null || langsam === null) continue;
    linie.push(schnell - langsam);
  }
  if (linie.length < signal) return null;
  const signallinie = exponentiellerDurchschnitt(linie, signal);
  return {
    linie: linie[linie.length - 1],
    signal: signallinie,
    abstand: linie[linie.length - 1] - signallinie,
  };
}

/** Anteil der Handelstage mit Kursgewinn, in Prozent. */
export function aufwaertsanteil(kurse, n = 63) {
  const renditen = tagesrenditen(kurse.slice(-(n + 1)));
  if (renditen.length < 10) return null;
  return (renditen.filter((r) => r > 0).length / renditen.length) * 100;
}

/** Abstand zum höchsten Kurs der letzten `n` Tage, in Prozent (0 = neues Hoch). */
export function abstandZumHoch(kurse, n = 252) {
  if (!kurse?.length) return null;
  const fenster = kurse.slice(-n);
  const hoch = Math.max(...fenster);
  if (!(hoch > 0)) return null;
  return (kurse[kurse.length - 1] / hoch - 1) * 100;
}

/** Abstand zum tiefsten Kurs der letzten `n` Tage, in Prozent. */
export function abstandZumTief(kurse, n = 252) {
  if (!kurse?.length) return null;
  const fenster = kurse.slice(-n);
  const tief = Math.min(...fenster);
  if (!(tief > 0)) return null;
  return (kurse[kurse.length - 1] / tief - 1) * 100;
}

/**
 * Umsatzschub: Volumen der letzten Tage gegen den längeren Schnitt.
 *
 * 1,0 ist normal, ab etwa 1,5 steckt sichtbar mehr Geld hinter der Bewegung.
 * Ein Kursanstieg ohne Umsatz trägt selten weit.
 */
export function umsatzschub(volumen, kurz = 10, lang = 60) {
  if (!volumen || volumen.length < lang) return null;
  const schnitt = mittel(volumen.slice(-lang));
  const jetzt = mittel(volumen.slice(-kurz));
  if (!(schnitt > 0)) return null;
  return jetzt / schnitt;
}

/** Größte einzelne Tagesbewegung nach unten der letzten `n` Tage, in Prozent. */
export function schlimmsterTag(kurse, n = 126) {
  const renditen = tagesrenditen(kurse.slice(-(n + 1)));
  if (!renditen.length) return null;
  return Math.min(...renditen) * 100;
}
