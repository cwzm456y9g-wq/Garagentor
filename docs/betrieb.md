# Betrieb: Supabase und Hostinger

Diese Datei beschreibt, welche Werte wohin gehören. **Sie enthält keine
Geheimnisse und darf keine bekommen** – Passwörter und Schlüssel gehören
ausschließlich in die Umgebung des Servers.

## Datenbank: Supabase

|             |                                            |
| ----------- | ------------------------------------------ |
| Projekt     | `garagentor`                               |
| Kennung     | `kcrozoxqjlwgofbtrkgr`                     |
| Standort    | `eu-central-1` (Frankfurt)                 |
| API-Adresse | `https://kcrozoxqjlwgofbtrkgr.supabase.co` |
| Tarif       | Free                                       |

### Die zwei Verbindungen

Prisma braucht bei Supabase zwei verschiedene Verbindungen. Beide findest du im
Supabase-Dashboard unter **Project Settings → Database → Connection string**;
die Rechnernamen des Poolers unterscheiden sich je nach Projekt, deshalb stehen
sie hier bewusst nicht ausgeschrieben – kopiere sie von dort.

- **`DATABASE_URL`** – der Pooler (Supavisor), _Transaction mode_, Port **6543**.
  Darüber läuft der laufende Betrieb. An die Adresse gehören zwei Parameter:
  `?pgbouncer=true&connection_limit=1`.
  `pgbouncer=true` schaltet Prismas vorbereitete Anweisungen ab, die der Pooler
  im Transaction mode nicht durchhält. `connection_limit=1` deshalb, weil
  Hostinger den Node-Prozess mehrfach halten und neu starten kann – ohne die
  Grenze wäre das Verbindungskontingent der Datenbank schnell aufgebraucht.

- **`DIRECT_URL`** – die direkte Verbindung, _Session mode_, Port **5432**.
  Ausschließlich für `prisma migrate`. Migrationen brauchen Sperren und
  Sitzungsvariablen, die der Pooler nicht durchreicht.

Das Datenbank-Passwort setzt du im Supabase-Dashboard unter **Project Settings →
Database → Database password**. Es gehört in die Umgebung des Servers, nicht in
dieses Verzeichnis und nicht in einen Chat.

### Absicherung

Auf allen 42 Tabellen ist Row Level Security aktiv, **ohne eine einzige
Policy**. Das ist Absicht:

- Die Anwendung spricht die Datenbank über Prisma als Rolle `postgres` an. Die
  trägt `BYPASSRLS`, für sie ändert sich dadurch nichts.
- Supabase stellt daneben automatisch eine HTTP-Schnittstelle (PostgREST) über
  dieselben Tabellen bereit, erreichbar mit dem öffentlichen `anon`-Schlüssel.
  Dieser Schlüssel steht seiner Natur nach im Browser und ist kein Geheimnis.
  Ohne RLS könnte damit jeder Kunden-, Rechnungs- und Personaldaten lesen.

Nachgemessen: Als `anon` wird der Zugriff auf `customers`, `invoices`, `users`
und `employees` mit _permission denied_ abgewiesen, während die Anwendung
weiterhin liest.

Der Supabase-Linter meldet dazu für jede der 42 Tabellen einen Hinweis
„RLS enabled, no policy", alle auf Stufe INFO. Das ist kein Mangel, sondern
genau der gewollte Zustand – Fehler oder Warnungen meldet er keine.

> Wenn später doch einmal direkt aus dem Browser auf Supabase zugegriffen werden
> soll, reicht es **nicht**, die Rechte zurückzugeben – dann müssen gezielt
> Policies entstehen.

## Was noch von dir kommen muss

- **Tarifwechsel vor dem Echtbetrieb.** Der Free-Plan pausiert Projekte nach
  etwa einer Woche ohne Zugriff und sichert nur eingeschränkt. Für Buchhaltung
  mit zehnjähriger Aufbewahrungspflicht ist das nichts. Pro kostet rund 25 $ im
  Monat und bringt tägliche Sicherungen.
- **Auftragsverarbeitungsverträge** mit Supabase _und_ Hostinger. Beides sind
  Dienstleister, die personenbezogene Daten deiner Kunden verarbeiten.
