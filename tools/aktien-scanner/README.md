# Aktien-Scanner

Durchsucht täglich den gesamten Aktienmarkt und stellt die Werte nach vorn, die
sich am stärksten **und** am schnellsten aufwärts bewegen – mit Einstieg, Stopp,
Ziel und Stückzahl für ein vorgegebenes Depot.

```bash
npm run aktien                                        # US-Markt, ausgewogenes Profil
npm run aktien -- --profil schnell --kapital 25000    # auf Tempo getrimmt
npm run aktien -- --markt deutschland --profil solide # DAX bis SDAX, ruhige Trends
npm run aktien -- --hilfe                             # alle Schalter
```

Ein vollständiger Lauf über den US-Markt dauert rund **35 Sekunden** und prüft
etwa 2.300 Aktien. Ohne Anmeldung, ohne Schlüssel, ohne Abhängigkeiten – das
Werkzeug nutzt nur die Standardbibliothek von Node.

## Was es wirklich tut – und was nicht

Es findet Aktien, die sich zuletzt **stark und stetig** nach oben bewegt haben.
Dahinter steht eine Beobachtung, die sich über Jahrzehnte und viele Märkte
messen lässt: Solche Bewegungen halten häufiger an, als der Zufall es erklärt.

Es ist keine Vorhersage. Ein Werkzeug, das die lukrativsten Aktien von morgen
kennt, gibt es nicht – wer eines verkauft, verkauft etwas anderes. Was hier
entsteht, ist eine nachvollziehbare, jeden Tag gleich gemessene Vorauswahl aus
mehreren tausend Papieren. Die Entscheidung trifft weiterhin ein Mensch.

Zwei Schalter sind deshalb genauso wichtig wie die Bestenliste selbst:

- `--pruefen` rechnet dieselbe Regel an vergangenen Stichtagen durch und zeigt,
  was sie damals gebracht hätte – auch, wenn das Ergebnis unangenehm ist.
- `--rueckblick` wertet aus, was aus den eigenen früheren Empfehlungen wurde.

## Die vier Schritte eines Laufs

| Schritt        | Was passiert                                                                       | Aufwand              |
| -------------- | ---------------------------------------------------------------------------------- | -------------------- |
| **Universum**  | Amtliches Verzeichnis der US-Börsen laden, Fonds und Optionsscheine aussortieren   | 2 Abrufe             |
| **Vorauswahl** | Über Stammdaten alles ausschließen, was zu klein oder zu wenig gehandelt ist       | ~120 Abrufe zu je 50 |
| **Bewertung**  | Für den Rest zwei Jahre Kurshistorie holen, Kennzahlen bilden, Rangplätze vergeben | 1 Abruf je Aktie     |
| **Plan**       | Für die Bestenliste Einstieg, Stopp, Ziel und Stückzahl rechnen                    | –                    |

Die Vorauswahl ist der Grund für die kurze Laufzeit: Aus rund 6.000 gelisteten
Aktien werden etwa 2.300, für die sich die Kurshistorie überhaupt lohnt.
Abgerufene Kursreihen liegen danach im Zwischenspeicher; ein zweiter Lauf am
selben Tag – etwa mit anderem Profil – kommt ohne einen einzigen Netzaufruf aus.

## Wie bewertet wird

Jede Aktie bekommt sieben Gruppenwertungen. Jede beruht auf **Rangplätzen im
Feld**, nicht auf festen Schwellen: Gemessen wird immer „wie schlägt sich dieses
Papier heute gegen alle anderen", nie „mehr als 30 % ist gut". Damit bleibt die
Bewertung in einem starken wie in einem schwachen Marktjahr vergleichbar.

| Gruppe          | Frage                                              | Kennzahlen                                                       |
| --------------- | -------------------------------------------------- | ---------------------------------------------------------------- |
| **Impuls**      | Läuft die Aktie seit Monaten?                      | Renditen über 1, 3, 6 und 12 Monate, gewichtet                   |
| **Trendgüte**   | Ist der Anstieg planbar oder ein Zufallssprung?    | Jahressteigung der Trendgeraden × Bestimmtheitsmaß               |
| **Tempo**       | Wie viel Strecke bringt ein Handelstag?            | Tagesdrift geteilt durch die normale Tagesspanne, Beschleunigung |
| **Rel. Stärke** | Besser als der Gesamtmarkt – oder nur mitgetragen? | Überrendite gegenüber S&P 500 bzw. DAX                           |
| **Struktur**    | Zeigen alle Zeitebenen in dieselbe Richtung?       | Kurs über 50er/200er, Abstand zum Jahreshoch, RSI, MACD          |
| **Umsatz**      | Steckt Geld hinter der Bewegung?                   | Umsatzschub der letzten Tage, absolute Handelbarkeit             |
| **Stabilität**  | Was hat der Anstieg an Nerven gekostet?            | Sortino-Verhältnis, größter Rücksetzer, Schwankungsbreite        |

Zwei Punkte, die den Unterschied machen:

**Das Bestimmtheitsmaß.** Zwei Aktien können dieselbe Jahressteigung haben: Die
eine läuft ruhig nach oben, die andere macht einen Sprung und dann ein halbes
Jahr nichts. Nur die erste ist planbar – und nur bei ihr trägt die Schätzung,
wie lange das Ziel braucht.

**Der jüngste Monat.** Bei den langen Impuls-Fenstern wird er ausgeklammert.
Nach einem sehr starken Monat laufen Aktien kurzfristig eher zurück; wer ihn
mitzählt, kauft genau diese Rückläufer.

Danach greifen **Abschläge** – kein Ausschluss, sondern ein Dämpfer: RSI über 88,
Jahresschwankung über 90 %, Rücksetzer über 55 %, ein einzelner Tagesverlust über
20 %, ein sprunghafter Verlauf. Solche Papiere können weiterhin ganz oben stehen,
müssen dafür aber deutlich besser sein als der Rest. Im Bericht steht bei jedem
Treffer, welcher Abschlag gegriffen hat.

### Die drei Profile

| Profil       | Schwerpunkt                                      | gedachte Haltedauer |
| ------------ | ------------------------------------------------ | ------------------- |
| `schnell`    | Tempo und Impuls; nimmt Schwankung in Kauf       | ~21 Handelstage     |
| `ausgewogen` | Trendgüte und Impuls, Risiko zählt mit (Vorgabe) | ~42 Handelstage     |
| `solide`     | planbarer Trend, Schwankung wiegt schwer         | ~63 Handelstage     |

## Der Handelsplan

Für jeden Treffer entstehen die Zahlen in dieser Reihenfolge – und die
Reihenfolge ist der Punkt:

1. **Stopp** – 2,5 mal die normale Tagesspanne unter dem Einstieg, begrenzt durch
   das Tief der letzten zehn Tage. Nie enger als 2 %, sonst löst ihn schon eine
   Eröffnungslücke aus.
2. **Stückzahl** – so viele, dass ein ausgelöster Stopp genau `--risiko` Prozent
   des Depots kostet, gedeckelt durch `--max-position`.
3. **Ziele** – das erste beim Doppelten des eingesetzten Risikos, das zweite aus
   der Trendsteigung über die Haltedauer des Profils.

Wer umgekehrt vorgeht – erst die Wunschsumme, dann der Stopp – setzt bei jedem
Papier einen anderen Betrag aufs Spiel und verliert an einer einzigen
schwankungsstarken Position mehr als an zehn ruhigen zusammen. Deshalb ist die
Position bei einer stark schwankenden Aktie automatisch kleiner; im JSON-Bericht
steht unter `begrenztDurch`, welche der beiden Grenzen gegriffen hat.

Zusätzlich wird geschätzt, **wie viele Handelstage** das erste Ziel bei der
bisherigen Steigung braucht. Über einem Börsenjahr bleibt der Wert leer – dort
täuschte die Rechnung eine Genauigkeit vor, die in ihr nicht steckt.

## Ausgabe

Jeder Lauf schreibt nach `tools/aktien-scanner/berichte/`:

- `bestenliste-<Datum>-<Profil>.html` – Bericht mit Karten, Balken und voller
  Rangliste; eine einzelne Datei ohne Verweise nach außen, hell und dunkel
- `…​.json` – alle Kennzahlen, Gruppenwertungen und Pläne zum Weiterverarbeiten
- `…​.csv` – Semikolon-getrennt, öffnet direkt in Excel
- `verlauf.json` – das Tagebuch: jede Auswahl mit Datum, Kurs, Stopp und Ziel

Mit `--kein-bericht` bleibt es bei der Konsolenausgabe.

## Täglich laufen lassen

Als Eintrag in der Crontab, werktags um 23:30 – nach dem US-Handelsschluss:

```cron
30 23 * * 1-5 cd /pfad/zu/Garagentor && npm run aktien -- --leise >> /var/log/aktien.log 2>&1
```

Im Repository liegt dazu `.github/workflows/aktien-scanner.yml`: Der Ablauf
startet werktags um 06:00 UTC, prüft US-Markt und Deutschland und hängt die
Berichte als Artefakt an den Lauf. Geplante Abläufe starten bei GitHub nur vom
Standardzweig aus; auf einem Arbeitszweig lässt er sich über „Run workflow" von
Hand auslösen.

## Nachprüfung

```bash
npm run aktien -- --pruefen --horizont 21 --stichtage 8
```

Die Kursreihen werden auf den Stand vergangener Stichtage gekürzt, die Rangliste
neu gebildet und dann nachgesehen, was aus den damaligen Spitzenplätzen wurde.
Verglichen wird gegen den Median aller Papiere, die damals durch die Filter
gekommen wären – denn eine gute Rendite in einem Jahr, in dem alles stieg, sagt
über das Verfahren nichts aus.

Was diese Zahlen **nicht** enthalten: Gebühren, die Spanne zwischen An- und
Verkaufskurs, Steuern – und alle Unternehmen, die es heute nicht mehr gibt. Der
letzte Punkt wiegt am schwersten: Wer nur Überlebende prüft, misst zu freundlich.
Die Zahlen taugen zum Vergleich zweier Profile, nicht als Renditeerwartung.

```bash
npm run aktien -- --rueckblick
```

Wertet das Tagebuch aus: mittlere Rendite je Lauf, Anteil der Gewinner und wie
oft zuerst das Ziel und wie oft zuerst der Stopp erreicht wurde. Kam beides am
selben Tag, zählt der Stopp – wer die Kerze nicht von innen gesehen hat, kennt
die Reihenfolge nicht, und die vorsichtige Annahme ist die ehrlichere.

## Woher die Daten kommen

Kurse und Stammdaten von Yahoo Finance über die Schnittstellen, die auch die
Website nutzt. Das Verzeichnis der handelbaren US-Aktien von NASDAQ Trader.
Beides ohne Anmeldung, beides ohne zugesicherte Verfügbarkeit: Yahoo kann die
Schnittstelle jederzeit ändern. Das Werkzeug ist darauf eingerichtet – jeder
Fehlschlag betrifft nur ein einzelnes Wertpapier, und fehlen die Stammdaten
ganz, läuft die Vorauswahl eben ohne sie weiter.

Der deutsche Markt hat kein vergleichbares freies Verzeichnis. Dort steht eine
gepflegte Liste aus DAX, MDAX, TecDAX und SDAX in `lib/universum.mjs` – das ist
praktisch alles, was in Frankfurt genug Umsatz für einen planbaren Ein- und
Ausstieg hat.

## Aufbau

| Datei                   | Inhalt                                                 |
| ----------------------- | ------------------------------------------------------ |
| `scanner.mjs`           | Ablauf und Kommandozeile                               |
| `lib/universum.mjs`     | Welche Wertpapiere überhaupt geprüft werden            |
| `lib/quelle-yahoo.mjs`  | Der einzige Ort mit Netzzugriff, samt Zwischenspeicher |
| `lib/kennzahlen.mjs`    | Reine Rechenfunktionen: Durchschnitte, RSI, ATR, Trend |
| `lib/bewertung.mjs`     | Rangplätze, Gruppenwertungen, Profile, Abschläge       |
| `lib/handelsplan.mjs`   | Stopp, Stückzahl, Ziele                                |
| `lib/pruefung.mjs`      | Gegenprobe an vergangenen Stichtagen                   |
| `lib/verlauf.mjs`       | Tagebuch und Rückblick                                 |
| `lib/ausgabe.mjs`       | Konsole, JSON, CSV                                     |
| `lib/bericht-html.mjs`  | HTML-Bericht                                           |
| `lib/warteschlange.mjs` | Parallelität und Wiederholung bei Störungen            |

`berichte/` und `.zwischenspeicher/` entstehen beim ersten Lauf und sind aus der
Versionsverwaltung ausgenommen.

Die Rechenkerne sind mit erfundenen Kursreihen abgesichert, deren Ergebnis von
Hand nachvollziehbar ist – eine Kennzahl, die still um den Faktor 100 daneben
liegt, ist bei einem Werkzeug über Geld gefährlicher als ein Absturz:

```bash
npm run aktien:test
```

---

**Keine Anlageberatung.** Dieses Werkzeug wertet öffentlich zugängliche
Kursdaten nach festen Regeln aus. Es kennt weder Nachrichten noch Termine für
Geschäftszahlen. Kursentwicklungen der Vergangenheit sind kein verlässlicher
Hinweis auf die Zukunft; bei Einzelaktien ist ein Totalverlust möglich.
