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

Verwaltet mit npm-Workspaces – ein `npm install` im Wurzelverzeichnis genügt.

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

```bash
npm install
cp .env.example .env

# PostgreSQL starten
npm run db:up

# Schema anlegen und Demodaten einspielen
npm run db:migrate
npm run db:seed

# API (Port 4000) und Web (Port 3000) starten
npm run dev
```

- Web: <http://localhost:3000>
- API: <http://localhost:4000/api>
- OpenAPI-Dokumentation: <http://localhost:4000/api/docs>

Die Zugangsdaten der Demodaten werden am Ende des Seed-Laufs ausgegeben.

## Skripte im Wurzelverzeichnis

| Skript               | Wirkung                                       |
| -------------------- | --------------------------------------------- |
| `npm run dev`        | API und Web parallel im Watch-Modus           |
| `npm run build`      | Alle Workspaces bauen                         |
| `npm run typecheck`  | TypeScript-Prüfung ohne Ausgabe               |
| `npm run lint`       | ESLint über alle Workspaces                   |
| `npm test`           | Tests aller Workspaces                        |
| `npm run db:up/down` | PostgreSQL per Docker Compose starten/stoppen |
| `npm run db:migrate` | Prisma-Migrationen anwenden                   |
| `npm run db:seed`    | Demodaten einspielen                          |

## Hinweis

Das Modul ASR A1.7 bildet den organisatorischen Ablauf der Prüfung ab und
ersetzt weder die Beauftragung einer befähigten bzw. sachkundigen Person noch
die Prüfung der jeweils gültigen Fassung des Regelwerks.
