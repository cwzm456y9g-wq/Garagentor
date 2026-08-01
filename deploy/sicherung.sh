#!/usr/bin/env bash
#
# Sichert Datenbank und Dokumentenablage in ein Verzeichnis und räumt alte
# Stände auf. Gedacht für einen nächtlichen Cron-Eintrag auf dem Server:
#
#   0 2 * * *  /opt/garagentor/deploy/sicherung.sh >> /var/log/garagentor-sicherung.log 2>&1
#
# Das Zielverzeichnis darf ein synchronisierter Ordner sein (iCloud Drive,
# Nextcloud, ein eingebundener Netzspeicher). Wichtig: eine synchronisierte
# Kopie ersetzt keine revisionssichere Ablage – für Buchungsbelege gelten
# eigene Aufbewahrungs- und Unveränderbarkeitspflichten.

set -euo pipefail

PROJEKT_VERZEICHNIS="${PROJEKT_VERZEICHNIS:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"

# Benutzer und Datenbankname stehen in der .env.prod; docker compose reicht
# sie nur an die Container weiter, nicht an dieses Skript.
if [ -f "${PROJEKT_VERZEICHNIS}/.env.prod" ]; then
  set -a
  # shellcheck disable=SC1091
  . "${PROJEKT_VERZEICHNIS}/.env.prod"
  set +a
fi

ZIEL="${ZIEL:-/var/backups/garagentor}"
AUFBEWAHRUNG_TAGE="${AUFBEWAHRUNG_TAGE:-30}"
COMPOSE=(docker compose -f "${PROJEKT_VERZEICHNIS}/docker-compose.prod.yml" --env-file "${PROJEKT_VERZEICHNIS}/.env.prod")

stempel="$(date +%Y-%m-%d_%H%M)"
mkdir -p "${ZIEL}"

# In ein temporäres Verzeichnis schreiben und erst am Ende umbenennen, damit
# ein abgebrochener Lauf keine halbe Sicherung hinterlässt, die der
# Synchronisationsdienst sofort hochlädt.
arbeit="$(mktemp -d "${ZIEL}/.lauf-XXXXXX")"
trap 'rm -rf "${arbeit}"' EXIT

echo "[$(date +%H:%M:%S)] Datenbank sichern …"
"${COMPOSE[@]}" exec -T postgres pg_dump \
  --username "${POSTGRES_USER:-garagentor}" \
  --dbname "${POSTGRES_DB:-garagentor}" \
  --format=custom \
  > "${arbeit}/datenbank.dump"

echo "[$(date +%H:%M:%S)] Dokumentenablage sichern …"
"${COMPOSE[@]}" exec -T api tar -cf - -C /app uploads > "${arbeit}/dokumente.tar"

gzip -9 "${arbeit}/dokumente.tar"

# Die Dateinamen bewusst relativ und ausdrücklich benennen: das Arbeits-
# verzeichnis wird gleich umbenannt, absolute Pfade wären danach falsch,
# und ein Glob nähme die Prüfsummendatei selbst mit auf.
(cd "${arbeit}" && sha256sum datenbank.dump dokumente.tar.gz > pruefsummen.txt)

mv "${arbeit}" "${ZIEL}/${stempel}"
trap - EXIT

groesse="$(du -sh "${ZIEL}/${stempel}" | cut -f1)"
echo "[$(date +%H:%M:%S)] Sicherung ${stempel} abgelegt (${groesse})."

# Ältere Stände entfernen. -mindepth 1 -maxdepth 1 trifft nur die
# Tagesverzeichnisse, nicht deren Inhalt.
geloescht=0
while IFS= read -r -d '' alt; do
  rm -rf "${alt}"
  geloescht=$((geloescht + 1))
done < <(find "${ZIEL}" -mindepth 1 -maxdepth 1 -type d -name '20*' -mtime "+${AUFBEWAHRUNG_TAGE}" -print0)

[ "${geloescht}" -gt 0 ] && echo "[$(date +%H:%M:%S)] ${geloescht} Stände älter als ${AUFBEWAHRUNG_TAGE} Tage entfernt."

echo "[$(date +%H:%M:%S)] Fertig."
