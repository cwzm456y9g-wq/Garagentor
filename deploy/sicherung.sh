#!/usr/bin/env bash
#
# Sichert die Supabase-Datenbank in ein Verzeichnis und räumt alte Stände auf.
#
# Gedacht für einen nächtlichen Cron-Eintrag – auf deinem Rechner, einem NAS
# oder einem kleinen Server. Nicht auf Hostingers Webhosting: dort steht
# `pg_dump` in der Regel nicht zur Verfügung.
#
#   0 2 * * *  /pfad/zu/sicherung.sh >> /var/log/garagentor-sicherung.log 2>&1
#
# Warum überhaupt selbst sichern: Der Free-Plan von Supabase sichert nur
# eingeschränkt und kennt keine Wiederherstellung auf den Zeitpunkt. Für
# Buchungsbelege gilt eine zehnjährige Aufbewahrungspflicht – die trägt kein
# Tarif, der Projekte nach einer Woche Ruhe pausiert.
#
# Wichtig: Eine synchronisierte Kopie (iCloud, Nextcloud) ersetzt keine
# revisionssichere Ablage. Für Buchungsbelege gelten eigene Aufbewahrungs- und
# Unveränderbarkeitspflichten; die Sicherung hier schützt vor Datenverlust,
# nicht vor einer Betriebsprüfung.

set -euo pipefail

# Die direkte Verbindung (Port 5432), nicht der Pooler: pg_dump braucht eine
# Sitzung, die der Pooler im Transaction mode nicht durchreicht.
: "${DIRECT_URL:?DIRECT_URL muss gesetzt sein – die direkte Supabase-Verbindung}"

ZIEL="${SICHERUNG_ZIEL:-$HOME/garagentor-sicherungen}"
BEHALTEN_TAGE="${SICHERUNG_BEHALTEN_TAGE:-30}"

STAND="$(date +%Y-%m-%d_%H%M)"
mkdir -p "$ZIEL"

DATEI="$ZIEL/garagentor_$STAND.sql.gz"

echo "[$(date '+%F %T')] Sicherung nach $DATEI"

# --no-owner und --no-privileges: Die Rollen von Supabase gibt es beim
# Zurückspielen anderswo nicht, und ohne die Angaben scheitert der Import.
pg_dump "$DIRECT_URL" \
  --no-owner \
  --no-privileges \
  --format=plain \
  | gzip -9 > "$DATEI.unfertig"

# Erst nach vollständigem Durchlauf umbenennen. Eine abgebrochene Sicherung
# soll nicht wie eine gültige aussehen.
mv "$DATEI.unfertig" "$DATEI"

GROESSE="$(du -h "$DATEI" | cut -f1)"
echo "[$(date '+%F %T')] fertig, $GROESSE"

# Eine Sicherung, die sich nicht lesen lässt, ist keine.
if ! gzip -t "$DATEI"; then
  echo "[$(date '+%F %T')] FEHLER: $DATEI ist beschädigt" >&2
  exit 1
fi

ENTFERNT="$(find "$ZIEL" -name 'garagentor_*.sql.gz' -mtime "+$BEHALTEN_TAGE" -print -delete | wc -l)"
if [ "$ENTFERNT" -gt 0 ]; then
  echo "[$(date '+%F %T')] $ENTFERNT Sicherungen älter als $BEHALTEN_TAGE Tage entfernt"
fi

# Hochgeladene Dateien liegen in Supabase Storage und werden hier nicht
# mitgesichert. Sie lassen sich über die Supabase-Oberfläche oder die CLI
# ausleiten – für Prüfprotokollfotos ist das der zweite Teil der Hausaufgabe.
echo "[$(date '+%F %T')] Hinweis: Supabase Storage wird von diesem Skript nicht gesichert."
