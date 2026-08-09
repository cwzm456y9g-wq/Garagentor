#!/usr/bin/env bash
#
# Legt aus dem Bau ein Verzeichnis, das sich auf Hostinger hochladen lässt.
#
#   npm run paket
#
# Next.js schreibt mit `output: 'standalone'` einen eigenständigen Server samt
# der tatsächlich benötigten Abhängigkeiten. Zwei Dinge fehlen darin, weil sie
# üblicherweise ein CDN ausliefert – hier müssen sie mit:
#
#   .next/static   die Bausteine der Oberfläche
#   public         Symbole, Service Worker
#
# Achtung bei nativen Modulen: argon2 (Passwörter) und @prisma/client bringen
# kompilierte Anteile mit. Sind sie hier auf einer anderen Architektur oder
# Node-Version gebaut worden als der Hostinger-Server sie hat, starten sie dort
# nicht. Im Zweifel auf dem Server selbst `npm ci && npm run build` laufen
# lassen, statt das fertige Paket hochzuladen.

set -euo pipefail

WURZEL="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
QUELLE="$WURZEL/apps/web/.next/standalone"
ZIEL="$WURZEL/paket"

if [ ! -d "$QUELLE" ]; then
  echo "Kein Bau gefunden. Erst 'npm run build' laufen lassen." >&2
  exit 1
fi

rm -rf "$ZIEL"
mkdir -p "$ZIEL"

cp -R "$QUELLE"/. "$ZIEL"/
cp -R "$WURZEL/apps/web/.next/static" "$ZIEL/apps/web/.next/static"
cp -R "$WURZEL/apps/web/public" "$ZIEL/apps/web/public"

# Prisma braucht das Schema zur Laufzeit nicht, wohl aber für Migrationen auf
# dem Server. Es kostet nichts, es mitzuschicken.
mkdir -p "$ZIEL/apps/web/prisma"
cp -R "$WURZEL/apps/web/prisma/schema.prisma" "$ZIEL/apps/web/prisma/"
cp -R "$WURZEL/apps/web/prisma/migrations" "$ZIEL/apps/web/prisma/"

# Ballast entfernen.
#
# Next.js legt seinem eigenständigen Bau Dinge bei, die diese Anwendung nicht
# anfasst. Auf geteiltem Webhosting zählt das doppelt: Der Upload geht über
# hPanel, und jede Datei zählt gegen das Inode-Kontingent.
#
# Jeder Posten ist nachgesehen, nicht vermutet – und nach dem Entfernen ist das
# Paket erneut gestartet und geprüft worden:
#
#   sharp       Bildverarbeitung für `next/image`. Kommt im Quelltext nirgends
#               vor, und in public/ liegt kein einziges Bild. 32 MB in zwei
#               Varianten, eine davon für musl (Alpine) – die passt zu keinem
#               Hostinger-Server.
#   typescript  Werkzeug zum Übersetzen. Der Bau ist zu diesem Zeitpunkt fertig;
#               zur Laufzeit ruft es niemand auf. 8,7 MB.
#
# Sollte später doch `next/image` dazukommen, gehört sharp wieder hinein –
# Next.js meldet das dann beim Start unmissverständlich.
for BALLAST in \
  "$ZIEL/node_modules/@img" \
  "$ZIEL/node_modules/sharp" \
  "$ZIEL/node_modules/typescript"; do
  rm -rf "$BALLAST"
done

GROESSE="$(du -sh "$ZIEL" | cut -f1)"

cat <<HINWEIS

Paket liegt in: $ZIEL  ($GROESSE)

Startdatei für hPanel:  apps/web/server.js
Node-Version:           22 (mindestens 20.11)

Diese Werte gehören in hPanel unter „Node.js" als Umgebungsvariablen –
nicht in eine Datei im Paket:

  DATABASE_URL, DIRECT_URL, JWT_ACCESS_SECRET, JWT_REFRESH_SECRET,
  SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, CRON_SECRET
  sowie MAIL_* für den Postausgang.

HINWEIS
