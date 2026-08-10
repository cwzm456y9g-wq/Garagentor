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

cp -R "$WURZEL/paket"/. "$TMP"/

# Next.js legt seinem Bau eigene .gitignore-Dateien bei. Die würden genau das
# aussperren, was hier hinein soll.
find "$TMP" -name .gitignore -delete

cat > "$TMP/LIESMICH.md" <<LIES
# Garagentor – fertig gebaut für Hostinger

Dieser Branch enthält **kein Quelltext-Projekt**, sondern die fertige
Anwendung. Er wird von \`tools/hostinger-branch.sh\` erzeugt und bei jedem Lauf
überschrieben. Änderungen hier gehen verloren – der Quelltext liegt auf
\`main\`.

Gebaut aus: \`$HERKUNFT\` – $BESCHREIBUNG

## Einrichtung in hPanel

| Feld         | Wert                  |
| ------------ | --------------------- |
| Branch       | \`hostinger\`           |
| Startdatei   | \`apps/web/server.js\`  |
| Node-Version | 22 (mindestens 20.11) |

Es gibt **keinen Build-Befehl** – die Anwendung ist bereits gebaut.

## Umgebungsvariablen

Diese Werte gehören in hPanel unter „Node.js", nicht in eine Datei:

\`DATABASE_URL\`, \`DIRECT_URL\`, \`JWT_ACCESS_SECRET\`, \`JWT_REFRESH_SECRET\`,
\`SUPABASE_URL\`, \`SUPABASE_SERVICE_ROLE_KEY\`, \`CRON_SECRET\` sowie \`MAIL_*\`
für den Postausgang.

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

Erzeugt von tools/hostinger-branch.sh. Startdatei: apps/web/server.js"

git remote add origin "$FERNE"

echo "Übertrage nach $BRANCH …"
git push -f -q origin "$BRANCH"

DATEIEN="$(find "$TMP" -type f -not -path '*/.git/*' | wc -l)"
GROESSE="$(du -sh --exclude=.git "$TMP" | cut -f1)"

cat <<HINWEIS

Branch '$BRANCH' steht: $DATEIEN Dateien, $GROESSE, gebaut aus $HERKUNFT

In hPanel unter „Node.js" eintragen:

  Repository    $FERNE
  Branch        $BRANCH
  Startdatei    apps/web/server.js
  Build-Befehl  (leer lassen)

HINWEIS
