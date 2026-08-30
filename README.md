# Garagentor

Branchensoftware für Garagentor-Fachbetriebe: kaufmännische Abwicklung vom Angebot
bis zur Mahnung, dazu das Branchenmodul für Toranlagen mit wiederkehrenden Prüfungen
nach **ASR A1.7** und digitalen Serviceberichten.

## Monorepo

| Pfad              | Paket                | Inhalt                                                  |
| ----------------- | -------------------- | ------------------------------------------------------- |
| `apps/web`        | `@garagentor/web`    | Die Anwendung: Oberfläche und API in einem Prozess      |
| `packages/shared` | `@garagentor/shared` | Enums, Typen, Beleg- und Datumslogik für beide Seiten   |
| `tools`           | –                    | Umzugsskript, Paketierung für Hostinger, Aktien-Scanner |

Verwaltet mit npm-Workspaces – installiert wird ausschließlich im Wurzelverzeichnis.

Oberfläche und Schnittstelle liegen bewusst in **einer** Anwendung: Das Ziel ist
Hostingers Node.js-Webhosting, und das gibt in der Regel eine Node-Anwendung pro
Domain her. Die API erreichst du unter `/api`. Die Datenbank ist Supabase in
Frankfurt; Einzelheiten in [`docs/betrieb.md`](docs/betrieb.md).

## Fachlicher Umfang

**Kaufmännisch**

- Kunden mit Adressen, Ansprechpartnern und Objekten
- Angebote → Aufträge → Rechnungen (inkl. Abschlags- und Schlussrechnungen)
- Zahlungen und mehrstufiges Mahnwesen mit Mahngebühren und Verzugszinsen
- Nummernkreise je Belegart, jährlich zurücksetzbar

**Branchenmodul Garagentor**

- Toranlagen je Objekt mit Hersteller, Typ, Antrieb und Maßen
- Wiederkehrende Prüfung nach ASR A1.7 mit vollständigem Prüfkatalog
  (DIN EN 12604 / 12453, DGUV Information 208-022) inklusive Kraftmessung
- Mängelverfolgung mit Schweregrad und Frist
- Serviceberichte mit Zeiten, Material, Anfahrt und Unterschriften
- Wartungsverträge mit Intervall und automatischer Fälligkeitsberechnung

**Betrieb**

- Lager mit Artikeln, Beständen und Lagerbewegungen
- Lieferanten und Bestellungen mit Wareneingang
- Terminplanung, Projekte, Zeiterfassung
- Personal mit Qualifikationen (u. a. Sachkunde für kraftbetätigte Tore) und Abwesenheiten
- Dokumentenablage, Auswertungen, Einstellungen und globale Suche

## Schnellstart

Voraussetzungen: Node.js ≥ 20.11 (siehe `.nvmrc`) und Docker für die Datenbank.

```bash
npm install
cp .env.example .env

# PostgreSQL starten
npm run db:up

# Gemeinsames Paket bauen, Prisma-Client erzeugen,
# Schema anlegen und Demodaten einspielen
npm run setup

# Anwendung starten (Port 3000)
npm run dev
```

Alles liegt unter <http://localhost:3000> – Anmeldung unter `/login`, die
Schnittstelle unter `/api`. Die Zugangsdaten der Demodaten werden am Ende des
Seed-Laufs ausgegeben.

Ohne Docker genügt eine beliebige erreichbare PostgreSQL-Instanz ab Version 14;
dann entfällt `npm run db:up` und in der `.env` zeigen `DATABASE_URL` und
`DIRECT_URL` auf diese Instanz. Die `.env` liegt bewusst nur im
Wurzelverzeichnis – Anwendung, Prisma und Compose lesen dieselbe Datei.

`packages/shared` wird über sein Build-Ergebnis eingebunden. Ein `npm install`
allein genügt deshalb nicht; `npm run setup` (oder `npm run build:shared`) muss
einmal gelaufen sein, sonst findet die Anwendung das Paket nicht. `npm run dev`
baut es vorab und hält es anschließend im Watch-Modus.

## Skripte im Wurzelverzeichnis

| Skript                 | Wirkung                                            |
| ---------------------- | -------------------------------------------------- |
| `npm run setup`        | Paket bauen, Client erzeugen, migrieren, Demodaten |
| `npm run dev`          | Shared und Anwendung parallel im Watch-Modus       |
| `npm run build`        | Alle Workspaces bauen                              |
| `npm run build:shared` | Nur das gemeinsame Paket bauen                     |
| `npm run paket`        | Aus dem Bau ein Hostinger-Paket schnüren           |
| `npm run typecheck`    | TypeScript-Prüfung ohne Ausgabe                    |
| `npm run lint`         | ESLint über alle Workspaces                        |
| `npm test`             | Tests aller Workspaces                             |
| `npm run db:up/down`   | PostgreSQL per Docker Compose starten/stoppen      |
| `npm run db:generate`  | Prisma-Client erzeugen                             |
| `npm run db:migrate`   | Prisma-Migrationen anwenden                        |
| `npm run db:seed`      | Demodaten einspielen                               |

Im Workspace `@garagentor/web` legt `npm run db:admin` den ersten Administrator
an; erwartet werden `ADMIN_EMAIL` und `ADMIN_PASSWORD`.

## Produktivbetrieb

Ziel ist **Hostingers Node.js-Webhosting** mit **Supabase** in Frankfurt als
Datenbank. Vollständig beschrieben – beide Verbindungen, alle
Umgebungsvariablen, der nächtliche Cron-Eintrag – in
**[docs/betrieb.md](docs/betrieb.md)**. Die Kurzfassung:

```bash
npm ci
npm run build
npm run paket        # legt ./paket an
```

Das Verzeichnis `paket/` hochladen und in hPanel unter **Node.js** als
Startdatei `apps/web/server.js` eintragen. Die Werte aus
`.env.prod.example` gehören dort als Umgebungsvariablen hinterlegt, **nicht**
als Datei ins Paket. Die Anwendung weigert sich zu starten, wenn ein Geheimnis
noch den Entwicklungswert enthält oder kürzer als 32 Zeichen ist.

Das Schema bringt `npm run db:migrate` auf Stand; es läuft über `DIRECT_URL`
und lässt sich auch vom eigenen Rechner aus anstoßen. Weil es keine
Selbstregistrierung gibt, wird der erste Zugang anschließend angelegt –
derselbe Aufruf setzt später ein vergessenes Passwort zurück und beendet dabei
alle offenen Sitzungen des Kontos:

```bash
ADMIN_EMAIL=chefin@example.de ADMIN_PASSWORD='…' \
  npm run db:admin --workspace @garagentor/web
```

Die vier nächtlichen Läufe hängen an `POST /api/cron`, ausgewiesen über
`CRON_SECRET`; `GET /api/health` antwortet ohne Anmeldung und meldet, ob die
Datenbank erreichbar ist.

### Sicherung

`deploy/sicherung.sh` zieht per `pg_dump` über `DIRECT_URL` einen Auszug,
prüft ihn und entfernt Stände, die älter als 30 Tage sind. Der Lauf gehört
**nicht** auf Hostingers Webhosting – dort steht `pg_dump` in der Regel nicht
zur Verfügung –, sondern auf den eigenen Rechner, ein NAS oder einen kleinen
Server:

```
0 2 * * *  SICHERUNG_ZIEL=/var/backups/garagentor /pfad/zu/sicherung.sh >> /var/log/garagentor-sicherung.log 2>&1
```

`SICHERUNG_ZIEL` darf ein synchronisierter Ordner sein (iCloud Drive,
Nextcloud, ein eingebundener Netzspeicher). Zurückgespielt wird ein Stand mit:

```bash
gunzip -c garagentor_2026-08-09_0200.sql.gz | psql "$DIRECT_URL"
```

Die Dokumentenablage liegt in Supabase Storage und wird von diesem Skript
nicht mitgesichert; sie lässt sich über die Supabase-CLI ausleiten.

Eine synchronisierte Kopie ersetzt keine revisionssichere Ablage: für
Buchungsbelege gelten eigene Aufbewahrungs- und Unveränderbarkeitspflichten
(GoBD). Das gehört vor dem Echtbetrieb mit der Steuerberatung geklärt.

## Hinweis

Das Modul ASR A1.7 bildet den organisatorischen Ablauf der Prüfung ab und
ersetzt weder die Beauftragung einer befähigten bzw. sachkundigen Person noch
die Prüfung der jeweils gültigen Fassung des Regelwerks.
