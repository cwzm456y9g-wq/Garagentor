/**
 * Aus einer Punktzahl wird noch kein Geschäft. Hier entstehen die Zahlen, die
 * man wirklich braucht: Einstieg, Stopp, Ziel, Stückzahl – und die Schätzung,
 * wie lange das Ziel voraussichtlich braucht.
 *
 * Die Reihenfolge ist Absicht. Zuerst steht der Stopp, dann die Stückzahl,
 * erst danach das Ziel. Wer umgekehrt vorgeht – erst die Wunschsumme, dann der
 * Stopp – setzt bei jedem Papier einen anderen Betrag aufs Spiel und verliert
 * an einer einzigen schwankungsstarken Position mehr als an zehn ruhigen
 * zusammen.
 */

/**
 * Erstellt den Handelsplan für ein Wertpapier.
 *
 * `kapital`     – Gesamteinsatz des Depots
 * `risikoAnteil`– Anteil davon, der bei einem ausgelösten Stopp verloren geht
 * `maxAnteil`   – Obergrenze für eine einzelne Position am Gesamtdepot
 */
export function handelsplanErstellen(kennzahlen, reihe, { kapital, risikoAnteil, maxAnteil, haltedauerTage }) {
  // Der Einstieg ist der unbereinigte letzte Kurs – genau die Zahl, die der
  // Broker zeigt. Stopp und Ziel werden dagegen aus bereinigten Werten
  // gerechnet. Für die jüngsten Kerzen ist der Bereinigungsfaktor 1, weil die
  // Bereinigung rückwärts wirkt; nur wenn in den letzten zehn Tagen eine
  // Dividende abging, weichen beide um deren Höhe ab. Das ist weniger als ein
  // Prozent und liegt weit innerhalb dessen, was ein Stopp ohnehin abfedert.
  const einstieg = kennzahlen.anzeigekurs;
  if (!(einstieg > 0)) return null;

  /* Stopp -------------------------------------------------------------- */

  // Zwei Kandidaten: das Vielfache der normalen Tagesspanne und das Tief der
  // letzten zehn Tage. Der höhere von beiden ist der engere Stopp – aber
  // niemals enger als 2 % unter dem Einstieg, sonst löst ihn schon eine
  // Eröffnungslücke aus.
  const nachSpanne = kennzahlen.atr ? einstieg - 2.5 * kennzahlen.atr : einstieg * 0.9;
  const letzteTiefs = reihe.tief.slice(-10);
  const nachStruktur = letzteTiefs.length ? Math.min(...letzteTiefs) * 0.99 : nachSpanne;
  const stopp = Math.min(einstieg * 0.98, Math.max(nachSpanne, nachStruktur));

  const risikoJeStueck = einstieg - stopp;
  if (!(risikoJeStueck > 0)) return null;
  const stoppAbstand = (risikoJeStueck / einstieg) * 100;

  /* Ziele -------------------------------------------------------------- */

  // Erstes Ziel als Vielfaches des eingesetzten Risikos – ohne ein Verhältnis
  // von mindestens 2:1 muss man öfter richtig liegen als falsch, nur um bei
  // null herauszukommen.
  const ziel1 = einstieg + 2 * risikoJeStueck;
  // Zweites Ziel aus dem Trend selbst: Wohin führt die Steigung der letzten
  // Monate über die geplante Haltedauer?
  const ziel2 = einstieg * Math.exp(kennzahlen.steigungProTag * haltedauerTage);

  const drift = kennzahlen.steigungProTag;
  // Wie viele Handelstage braucht der Trend bis zum ersten Ziel? Nur sinnvoll,
  // solange die Steigung deutlich positiv ist. Bei einer fast flachen Reihe
  // ergäbe die Rechnung mehrere Jahre – eine Zahl, die zwar stimmt, aber eine
  // Genauigkeit vortäuscht, die in ihr nicht steckt. Alles jenseits eines
  // Börsenjahres bleibt deshalb unbestimmt.
  const geschaetzteTage = drift > 0 ? Math.ceil(Math.log(ziel1 / einstieg) / drift) : null;
  const tageBisZiel1 = geschaetzteTage !== null && geschaetzteTage <= 252 ? geschaetzteTage : null;

  /* Stückzahl ---------------------------------------------------------- */

  const risikobetrag = kapital * risikoAnteil;
  const nachRisiko = Math.floor(risikobetrag / risikoJeStueck);
  const nachObergrenze = Math.floor((kapital * maxAnteil) / einstieg);
  const stueck = Math.max(0, Math.min(nachRisiko, nachObergrenze));
  const einsatz = stueck * einstieg;

  return {
    einstieg,
    stopp,
    stoppAbstand,
    ziel1,
    ziel2,
    chanceRisiko: (ziel1 - einstieg) / risikoJeStueck,
    tageBisZiel1,
    haltedauerTage,
    erwarteteRenditeHaltedauer: (Math.exp(drift * haltedauerTage) - 1) * 100,
    stueck,
    einsatz,
    risikobetrag: stueck * risikoJeStueck,
    anteilAmDepot: kapital > 0 ? (einsatz / kapital) * 100 : 0,
    // Nicht durch die Obergrenze, sondern durch das Risiko begrenzt? Dann ist
    // die Position klein, weil das Papier stark schwankt – das ist gewollt und
    // soll im Bericht sichtbar sein.
    begrenztDurch: nachRisiko <= nachObergrenze ? 'Risiko' : 'Positionsgrenze',
  };
}
