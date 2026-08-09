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
