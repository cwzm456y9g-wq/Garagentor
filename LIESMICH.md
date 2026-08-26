# Garagentor – fertig gebaut für Hostinger

Dieser Branch enthält **kein Quelltext-Projekt**, sondern die fertige
Anwendung. Er wird von `tools/hostinger-branch.sh` erzeugt und bei jedem Lauf
überschrieben. Änderungen hier gehen verloren – der Quelltext liegt auf
`main`.

Gebaut aus: `58c4987` – feat(anmeldung): Bremse gegen das Durchprobieren von Passwörtern

## Einrichtung in hPanel

| Feld                | Wert                  |
| ------------------- | --------------------- |
| Framework           | **Other**             |
| Startdatei          | `server.js`          |
| Startbefehl         | `npm start`          |
| Build-Befehl        | **leer**              |
| Installationsbefehl | **leer**              |
| Ausgabeverzeichnis  | **leer**              |
| Node-Version        | 22 (mindestens 20.11) |

Es gibt **keinen Build-Befehl** – die Anwendung ist bereits gebaut. Und keinen
Installationsbefehl: 
up to date, audited 650 packages in 4s

111 packages are looking for funding
  run `npm fund` for details

8 high severity vulnerabilities

To address issues that do not require attention, run:
  npm audit fix

To address all issues (including breaking changes), run:
  npm audit fix --force

Run `npm audit` for details. würde im Wurzelverzeichnis nichts finden und
könnte danebenliegende Laufzeit wegräumen. Deshalb liegt die Anwendung in
`anwendung/`, wo npm nicht hinsieht, und `server.js` im Wurzelverzeichnis
startet sie.

## Umgebungsvariablen

Diese Werte gehören in hPanel unter „Node.js", nicht in eine Datei:

`DATABASE_URL`, `DIRECT_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`,
`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET` sowie `MAIL_*`
für den Postausgang.

Empfohlen dazu `DATABASE_SSL_CA` – das Wurzelzertifikat aus Supabase unter
Settings → Database → SSL Configuration. Die Verbindung ist auch ohne diesen
Wert verschlüsselt; mit ihm wird zusätzlich geprüft, ob am anderen Ende
wirklich Supabase antwortet.

Die Anwendung startet absichtlich nicht, wenn ein Geheimnis fehlt, noch den
Entwicklungswert enthält oder kürzer als 32 Zeichen ist.
