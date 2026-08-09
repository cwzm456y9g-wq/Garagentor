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

## Hostinger: Node.js-Webhosting

Die Anwendung läuft als **ein** Node-Prozess. Das ist der Grund, warum die
frühere getrennte API in die Next.js-Anwendung gewandert ist: Geteiltes
Webhosting gibt in der Regel eine Node-Anwendung pro Domain her.

### Paket bauen und hochladen

```bash
npm ci
npm run build
npm run paket        # legt ./paket an
```

Das Verzeichnis `paket/` hochladen. In hPanel unter **Node.js** eintragen:

|              |                       |
| ------------ | --------------------- |
| Startdatei   | `apps/web/server.js`  |
| Node-Version | 22 (mindestens 20.11) |

> **Wenn die Anwendung nicht startet:** `argon2` (Passwörter) und
> `@prisma/client` enthalten kompilierte Anteile. Sind sie auf einer anderen
> Architektur oder Node-Version gebaut worden als der Server sie hat, laden sie
> dort nicht. Dann statt des fertigen Pakets die Quellen hochladen und auf dem
> Server `npm ci && npm run build` laufen lassen. Umgekehrt kann dem Server für
> den Bau der Arbeitsspeicher fehlen – deshalb ist das Paket der erste Versuch.

### Umgebungsvariablen

Diese Werte gehören in hPanel unter „Node.js", **nicht** in eine Datei im
Paket und nicht ins Verzeichnis:

| Variable                    | Wofür                                                                |
| --------------------------- | -------------------------------------------------------------------- |
| `DATABASE_URL`              | Supabase-Pooler, Port 6543, mit `?pgbouncer=true&connection_limit=1` |
| `DIRECT_URL`                | Supabase direkt, Port 5432, nur für Migrationen                      |
| `JWT_ACCESS_SECRET`         | mindestens 32 Zeichen, etwa `openssl rand -base64 48`                |
| `JWT_REFRESH_SECRET`        | ein **anderer** Wert, ebenso lang                                    |
| `SUPABASE_URL`              | `https://kcrozoxqjlwgofbtrkgr.supabase.co`                           |
| `SUPABASE_SERVICE_ROLE_KEY` | für die Dateiablage; umgeht RLS, gehört nie in den Browser           |
| `CRON_SECRET`               | weist den nächtlichen Aufruf aus                                     |
| `MAIL_*`                    | Postausgang; ohne `MAIL_HOST` läuft alles, nur ohne Versand          |

Die Anwendung weigert sich im Produktivbetrieb zu starten, wenn ein Geheimnis
noch den Entwicklungswert enthält oder kürzer als 32 Zeichen ist. Das ist
Absicht.

### Der nächtliche Lauf

Die vier Läufe – abgelaufene Angebote, überfällige Rechnungen, alte Tokens,
ausgelaufene Wartungsverträge – liefen früher als Zeitplan im Prozess. Auf
Webhosting geht das nicht: Hostinger startet die Anwendung bei Bedarf und lässt
sie zwischendurch ruhen, ein Zeitplan im Prozess feuert dann schlicht nicht.

In hPanel unter **Cron-Jobs** einen Eintrag anlegen, täglich gegen 2 Uhr:

```
curl -fsS -X POST https://deine-domain.de/api/cron \
  -H "Authorization: Bearer DEIN_CRON_SECRET"
```

Das hat einen erwünschten Nebeneffekt: Der tägliche Aufruf fasst die Datenbank
an, damit kommt das Supabase-Projekt nie auf sieben Tage ohne Zugriff und wird
auf dem Free-Plan nicht pausiert.

### Erreichbarkeit

`GET /api/health` antwortet ohne Anmeldung und meldet, ob die Datenbank
erreichbar ist. Geeignet für eine Überwachung, ohne Zugangsdaten zu hinterlegen.

## Was noch von dir kommen muss

- **Tarifwechsel vor dem Echtbetrieb.** Der Free-Plan pausiert Projekte nach
  etwa einer Woche ohne Zugriff und sichert nur eingeschränkt. Für Buchhaltung
  mit zehnjähriger Aufbewahrungspflicht ist das nichts. Pro kostet rund 25 $ im
  Monat und bringt tägliche Sicherungen.
- **Auftragsverarbeitungsverträge** mit Supabase _und_ Hostinger. Beides sind
  Dienstleister, die personenbezogene Daten deiner Kunden verarbeiten.
