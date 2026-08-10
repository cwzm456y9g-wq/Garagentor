#!/usr/bin/env bash
#
# Legt den Branch `hostinger` neu an: die **fertig gebaute** Anwendung.
#
#   npm run hostinger
#
# Warum es diesen Branch gibt
# ---------------------------
# Auf `main` liegt der Quelltext. Daraus wird der Server erst durch eine Kette
# gebaut – Abhängigkeiten laden, gemeinsames Paket übersetzen, Next.js bauen.
# Hostingers GitHub-Anbindung führt diese Kette nicht aus, und geteiltes
# Webhosting hätte für den Bau auch weder Arbeitsspeicher noch Zeit.
#
# Deshalb enthält dieser Branch das Ergebnis statt der Zutaten: Hostinger klont
# ihn und startet ihn unverändert. Kein Bauen auf dem Server, kein Hochladen
# über den Dateimanager.
#
# Was das bedeutet
# ----------------
# * Der Branch enthält `node_modules` – das ist Absicht, sonst müsste auf dem
#   Server doch wieder installiert werden.
# * Er hat **keine gemeinsame Geschichte** mit `main` und wird bei jedem Lauf
#   überschrieben (force-push). Er ist ein Erzeugnis, kein Verlauf; sein Stand
#   steht in der Commit-Nachricht.
# * Die kompilierten Anteile (`argon2`, Prisma-Engine) stammen von *diesem*
#   Rechner. Passen sie nicht zur Architektur des Hostinger-Servers, meldet der
#   Start `MODULE_NOT_FOUND` oder „invalid ELF header". Dann hilft ein einmaliges
#   `npm rebuild` per SSH auf dem Server.

set -euo pipefail

WURZEL="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BRANCH="hostinger"

cd "$WURZEL"

HERKUNFT="$(git rev-parse --short HEAD)"
BESCHREIBUNG="$(git log -1 --pretty=%s)"
FERNE="$(git remote get-url origin)"

echo "Baue aus $HERKUNFT …"
npm run build
npm run paket

# Ein eigener, leerer Git-Baum: So bleibt das Arbeitsverzeichnis unberührt und
# der Branch bekommt garantiert keine Altlasten aus früheren Läufen.
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

# Die Anwendung liegt eine Ebene tiefer, im Ordner `anwendung/`.
#
# Das ist kein Schönheitsentscheid, sondern Notwehr gegen `npm install`:
# Ausrollwerkzeuge führen den Befehl gern ungefragt im Wurzelverzeichnis aus.
# Da unsere package.json dort keine Abhängigkeiten nennt, hielte npm alles in
# einem danebenliegenden `node_modules` für überflüssig und räumte es weg –
# also genau die Laufzeit, die wir mitliefern. Liegt sie in `anwendung/`,
# schaut npm gar nicht hin.
mkdir -p "$TMP/anwendung"
cp -R "$WURZEL/paket"/. "$TMP/anwendung"/

# Next.js legt seinem Bau eigene .gitignore-Dateien bei. Die würden genau das
# aussperren, was hier hinein soll.
find "$TMP" -name .gitignore -delete

# Zwei Einstiegspunkte im Wurzelverzeichnis, damit jede übliche Voreinstellung
# trifft: Die einen Werkzeuge suchen `server.js`, die anderen `index.js`.
cat > "$TMP/server.js" <<'EINSTIEG'
// Startet die Anwendung, die in `anwendung/` liegt.
//
// Next.js' eigenständige Startdatei setzt ihr Arbeitsverzeichnis selbst, sie
// darf also von überall aufgerufen werden. Diese Datei existiert nur, damit
// ein Ausrollwerkzeug im Wurzelverzeichnis fündig wird – und um eine Falle zu
// entschärfen, die zwei Tage gekostet hat.

// Die Falle: Next.js bindet den Server an `process.env.HOSTNAME`, ersatzweise
// an 0.0.0.0. `HOSTNAME` ist auf vielen Linux-Servern aber eine ganz
// gewöhnliche Shell-Variable, in der der Rechnername steht – niemand setzt sie
// für Next.js, sie ist einfach da. Löst dieser Name auf die Netzadresse des
// Servers auf, horcht die Anwendung ausschließlich dort. Der Webserver davor
// klopft über 127.0.0.1 an und bekommt nichts.
//
// Das Tückische daran ist das Protokoll: Der Prozess startet sauber und meldet
// „Ready in 143ms". Im Browser steht trotzdem 504. Nichts an dieser Meldung
// deutet auf die Ursache.
//
// 0.0.0.0 heißt „alle Adressen" und schließt beide Fälle ein. Wer wirklich
// einschränken will, setzt BIND_HOST.
process.env.HOSTNAME = process.env.BIND_HOST || '0.0.0.0';

// Damit im Laufzeitprotokoll steht, wo tatsächlich gehorcht wird. Genau diese
// Zeile hat beim letzten Mal gefehlt.
console.log(
  `[Garagentor] Adresse ${process.env.HOSTNAME}, Port ${process.env.PORT || 3000}, Node ${process.version}`,
);

// Manche Ausrollwerkzeuge reichen in PORT keinen Port, sondern den Pfad eines
// Unix-Sockets. Next.js liest die Variable als Zahl, bekommt keine und nimmt
// 3000 – und wartet dort auf einen Anruf, der an ganz anderer Stelle klingelt.
// Auch das sieht im Protokoll nach einem gelungenen Start aus.
if (process.env.PORT && !/^\d+$/.test(process.env.PORT)) {
  console.log(
    `[Garagentor] Achtung: PORT ist keine Zahl, sondern „${process.env.PORT}". Next.js kann damit nichts anfangen und horcht auf 3000.`,
  );
}

// Ein Absturz beim Start soll im Protokoll stehen und nicht als leere Datei
// enden. Das war beim letzten Anlauf der Grund, warum nichts zu sehen war.
process.on('uncaughtException', (fehler) => {
  console.error('[Garagentor] Abbruch beim Start:', fehler);
  process.exit(1);
});
process.on('unhandledRejection', (grund) => {
  console.error('[Garagentor] Unbehandelte Ablehnung:', grund);
});

require('./anwendung/apps/web/server.js');
EINSTIEG
cp "$TMP/server.js" "$TMP/index.js"

# Die vom Bau mitgebrachte package.json in `anwendung/` nennt noch Workspaces
# und einen Next.js-Baubefehl. Dort schaut zwar niemand hin, aber ein Werkzeug,
# das doch hineinsieht, soll nicht auf die Idee kommen zu bauen.
rm -f "$TMP/anwendung/package.json"

# Die package.json des Quellprojekts wandert unverändert in den eigenständigen
# Bau. Darin stehen `"build": "next build"` und die Workspace-Angabe – für ein
# Ausrollwerkzeug sieht das aus wie ein Projekt, das erst gebaut werden muss.
# Hostinger hat daraufhin genau das versucht und ist daran gescheitert, dass der
# Quelltext hier fehlt:
#
#   „packages/shared is missing tsconfig.json, and apps/web is missing either
#    a pages or app directory required by Next.js"
#
# Die Diagnose war richtig, die Schlussfolgerung falsch: Es fehlt nichts, es ist
# nur schon gebaut. Deshalb beschreiben die beiden Dateien hier ein fertiges
# Programm – kein Bau, keine Workspaces, ein Startbefehl.
cat > "$TMP/package.json" <<PAKET
{
  "name": "garagentor",
  "version": "0.1.0",
  "private": true,
  "description": "Garagentor – fertig gebaut, bereit zum Start",
  "license": "UNLICENSED",
  "engines": {
    "node": ">=20.11.0"
  },
  "scripts": {
    "build": "echo 'Bereits gebaut – dieser Branch enthält das Ergebnis.'",
    "start": "node server.js"
  }
}
PAKET

# Dieselbe Behandlung für die Datei der Anwendung: Sie bleibt liegen, weil die
# Modulauflösung sie braucht, verliert aber ihre Bau- und Werkzeugbefehle.
node - "$TMP/anwendung/apps/web/package.json" <<'KNOTEN'
const fs = require('node:fs');
const pfad = process.argv[2];
const paket = JSON.parse(fs.readFileSync(pfad, 'utf8'));
paket.scripts = { start: 'node server.js' };
delete paket.devDependencies;
fs.writeFileSync(pfad, JSON.stringify(paket, null, 2) + '\n');
KNOTEN

cat > "$TMP/LIESMICH.md" <<LIES
# Garagentor – fertig gebaut für Hostinger

Dieser Branch enthält **kein Quelltext-Projekt**, sondern die fertige
Anwendung. Er wird von \`tools/hostinger-branch.sh\` erzeugt und bei jedem Lauf
überschrieben. Änderungen hier gehen verloren – der Quelltext liegt auf
\`main\`.

Gebaut aus: \`$HERKUNFT\` – $BESCHREIBUNG

## Einrichtung in hPanel

| Feld                | Wert                  |
| ------------------- | --------------------- |
| Framework           | **Other**             |
| Startdatei          | \`server.js\`          |
| Startbefehl         | \`npm start\`          |
| Build-Befehl        | **leer**              |
| Installationsbefehl | **leer**              |
| Ausgabeverzeichnis  | **leer**              |
| Node-Version        | 22 (mindestens 20.11) |

Es gibt **keinen Build-Befehl** – die Anwendung ist bereits gebaut. Und keinen
Installationsbefehl: `npm install` würde im Wurzelverzeichnis nichts finden und
könnte danebenliegende Laufzeit wegräumen. Deshalb liegt die Anwendung in
\`anwendung/\`, wo npm nicht hinsieht, und \`server.js\` im Wurzelverzeichnis
startet sie.

## Umgebungsvariablen

Diese Werte gehören in hPanel unter „Node.js", nicht in eine Datei:

\`DATABASE_URL\`, \`DIRECT_URL\`, \`JWT_ACCESS_SECRET\`, \`JWT_REFRESH_SECRET\`,
\`SUPABASE_URL\`, \`SUPABASE_SERVICE_ROLE_KEY\`, \`CRON_SECRET\` sowie \`MAIL_*\`
für den Postausgang.

Empfohlen dazu \`DATABASE_SSL_CA\` – das Wurzelzertifikat aus Supabase unter
Settings → Database → SSL Configuration. Die Verbindung ist auch ohne diesen
Wert verschlüsselt; mit ihm wird zusätzlich geprüft, ob am anderen Ende
wirklich Supabase antwortet.

Die Anwendung startet absichtlich nicht, wenn ein Geheimnis fehlt, noch den
Entwicklungswert enthält oder kürzer als 32 Zeichen ist.
LIES

cd "$TMP"
git init -q
git checkout -q -b "$BRANCH"
git add -A
git \
  -c user.name="Garagentor Bau" \
  -c user.email="bau@garagentor.local" \
  commit -q -m "Fertiger Bau aus $HERKUNFT

$BESCHREIBUNG

Erzeugt von tools/hostinger-branch.sh. Startdatei: server.js"

git remote add origin "$FERNE"

echo "Übertrage nach $BRANCH …"
git push -f -q origin "$BRANCH"

DATEIEN="$(find "$TMP" -type f -not -path '*/.git/*' | wc -l)"
GROESSE="$(du -sh --exclude=.git "$TMP" | cut -f1)"

cat <<HINWEIS

Branch '$BRANCH' steht: $DATEIEN Dateien, $GROESSE, gebaut aus $HERKUNFT

In hPanel unter „Node.js" eintragen:

  Repository            $FERNE
  Branch                $BRANCH
  Startdatei            server.js       (oder Startbefehl: npm start)
  Build-Befehl          leer
  Installationsbefehl   leer
  Ausgabeverzeichnis    leer

HINWEIS
