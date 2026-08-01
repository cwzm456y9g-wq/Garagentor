# Garagentor

Branchensoftware für Garagentor-Fachbetriebe: kaufmännische Abwicklung vom Angebot
bis zur Mahnung, dazu das Branchenmodul für Toranlagen mit wiederkehrenden Prüfungen
nach **ASR A1.7** und digitalen Serviceberichten.

## Monorepo

| Pfad              | Paket                | Inhalt                                                |
| ----------------- | -------------------- | ----------------------------------------------------- |
| `apps/api`        | `@garagentor/api`    | NestJS-Backend mit Prisma und PostgreSQL              |
| `apps/web`        | `@garagentor/web`    | Next.js-Frontend (App Router)                         |
| `packages/shared` | `@garagentor/shared` | Enums, Typen, Beleg- und Datumslogik für beide Seiten |

Verwaltet mit npm-Workspaces – installiert wird ausschließlich im Wurzelverzeichnis.

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

# API (Port 4000) und Web (Port 3000) starten
npm run dev
```

- Web: <http://localhost:3000> – Anmeldung unter `/login`
- API: <http://localhost:4000/api>
- OpenAPI-Dokumentation: <http://localhost:4000/api/docs>

Die Zugangsdaten der Demodaten werden am Ende des Seed-Laufs ausgegeben.

Ohne Docker genügt eine beliebige erreichbare PostgreSQL-Instanz ab Version 14;
dann entfällt `npm run db:up` und in der `.env` wird `DATABASE_URL` auf diese
Instanz gezeigt. Die `.env` liegt bewusst nur im Wurzelverzeichnis – API, Prisma
und Compose lesen dieselbe Datei.

`packages/shared` wird über sein Build-Ergebnis eingebunden. Ein `npm install`
allein genügt deshalb nicht; `npm run setup` (oder `npm run build:shared`) muss
einmal gelaufen sein, sonst finden API und Web das Paket nicht. `npm run dev`
baut es vorab und hält es anschließend im Watch-Modus.

## Skripte im Wurzelverzeichnis

| Skript                 | Wirkung                                            |
| ---------------------- | -------------------------------------------------- |
| `npm run setup`        | Paket bauen, Client erzeugen, migrieren, Demodaten |
| `npm run dev`          | Shared, API und Web parallel im Watch-Modus        |
| `npm run build`        | Alle Workspaces bauen                              |
| `npm run build:shared` | Nur das gemeinsame Paket bauen                     |
| `npm run typecheck`    | TypeScript-Prüfung ohne Ausgabe                    |
| `npm run lint`         | ESLint über alle Workspaces                        |
| `npm test`             | Tests aller Workspaces                             |
| `npm run db:up/down`   | PostgreSQL per Docker Compose starten/stoppen      |
| `npm run db:generate`  | Prisma-Client erzeugen                             |
| `npm run db:migrate`   | Prisma-Migrationen anwenden                        |
| `npm run db:seed`      | Demodaten einspielen                               |

Im Workspace `@garagentor/api` legt `npm run db:admin` den ersten Administrator
an; erwartet werden `ADMIN_EMAIL` und `ADMIN_PASSWORD`.

## Produktivbetrieb

Auf einem eigenen Server genügen Docker und eine Domain, die per A-Eintrag auf
den Server zeigt. Caddy holt das Zertifikat selbst und liefert Oberfläche und
Schnittstelle unter derselben Domain aus – damit entfällt CORS.

```bash
cp .env.prod.example .env.prod
chmod 600 .env.prod
# Domain, Mailadresse und Passwörter eintragen. Secrets erzeugen mit:
openssl rand -base64 48

docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build
```

Der Dienst `migrate` bringt das Schema vor dem Start der Anwendung auf Stand.
Weil es keine Selbstregistrierung gibt, wird der erste Zugang anschließend
angelegt – derselbe Aufruf setzt später ein vergessenes Passwort zurück und
beendet dabei alle offenen Sitzungen des Kontos:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod \
  run --rm -e ADMIN_EMAIL=chefin@example.de -e ADMIN_PASSWORD='…' \
  migrate npm run db:admin --workspace @garagentor/api
```

Datenbank, API und Oberfläche hängen nur am internen Netz; von außen ist allein
Caddy auf Port 80 und 443 erreichbar. Die OpenAPI-Dokumentation ist im
Produktivbetrieb bewusst abgeschaltet.

### Sicherung

`deploy/sicherung.sh` legt Datenbankauszug, Dokumentenablage und Prüfsummen in
einem Tagesverzeichnis ab und entfernt Stände, die älter als 30 Tage sind. Als
nächtlicher Cron-Eintrag auf dem Server:

```
0 2 * * *  ZIEL=/var/backups/garagentor /opt/garagentor/deploy/sicherung.sh >> /var/log/garagentor-sicherung.log 2>&1
```

`ZIEL` darf ein synchronisierter Ordner sein (iCloud Drive, Nextcloud, ein
eingebundener Netzspeicher). Zurückgespielt wird ein Stand mit:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod stop api web
docker compose -f docker-compose.prod.yml --env-file .env.prod exec -T postgres \
  pg_restore -U garagentor -d garagentor --clean --if-exists --no-owner < datenbank.dump
docker compose -f docker-compose.prod.yml --env-file .env.prod start api web
```

Eine synchronisierte Kopie ersetzt keine revisionssichere Ablage: für
Buchungsbelege gelten eigene Aufbewahrungs- und Unveränderbarkeitspflichten
(GoBD). Das gehört vor dem Echtbetrieb mit der Steuerberatung geklärt.

## Hinweis

Das Modul ASR A1.7 bildet den organisatorischen Ablauf der Prüfung ab und
ersetzt weder die Beauftragung einer befähigten bzw. sachkundigen Person noch
die Prüfung der jeweils gültigen Fassung des Regelwerks.
