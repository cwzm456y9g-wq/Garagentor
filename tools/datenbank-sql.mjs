/**
 * Schreibt eine SQL-Datei, die eine leere Datenbank einrichtet.
 *
 *   node tools/datenbank-sql.mjs chefin@example.de 'Einmalpasswort'
 *
 * Gedacht für den Fall, dass keine Kommandozeile an der Datenbank hängt: Die
 * erzeugte Datei lässt sich im SQL-Editor von Supabase einfügen und ausführen.
 * `prisma migrate deploy` wäre der übliche Weg – der setzt aber eine Umgebung
 * voraus, die nicht jeder hat.
 *
 * Zwei Eigenschaften machen die Datei brauchbar:
 *
 * 1. Sie darf mehrfach laufen. Jede Anweisung steckt in einem Block, der ein
 *    „gibt es schon" übergeht. Ob das Schema ganz, halb oder gar nicht steht,
 *    muss vorher niemand wissen – und es gehen keine Daten verloren.
 * 2. Das Passwort steht als Argon2id-Prüfsumme darin, nie im Klartext.
 *
 * Die erzeugte Datei gehört nicht ins Repository (siehe .gitignore): Prüfsumme
 * und Adresse sind nichts für ein öffentliches Verzeichnis.
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const wurzel = join(dirname(fileURLToPath(import.meta.url)), '..');
const argon2 = createRequire(join(wurzel, 'apps/web/package.json'))('argon2');

const [adresse, passwort] = process.argv.slice(2);
if (!adresse || !passwort) {
  console.error("Aufruf: node tools/datenbank-sql.mjs <e-mail> '<passwort>'");
  process.exit(1);
}

/* Migrationen der Reihe nach einlesen ---------------------------------- */

const migrationen = join(wurzel, 'apps/web/prisma/migrations');
const roh = readdirSync(migrationen)
  .filter((name) => !name.endsWith('.toml'))
  .sort()
  .map((name) => readFileSync(join(migrationen, name, 'migration.sql'), 'utf8'))
  .join('\n');

/* In einzelne Anweisungen zerlegen ------------------------------------- */

// Kommentarzeilen fallen weg, alles andere sammelt sich bis zum Semikolon am
// Zeilenende. Das trägt, weil Prisma reines DDL erzeugt – keine Funktionen,
// keine Dollar-Blöcke, in denen ein Semikolon etwas anderes bedeuten könnte.
const anweisungen = [];
let puffer = [];
for (const zeile of roh.split('\n')) {
  const nackt = zeile.trim();
  if (!nackt || nackt.startsWith('--')) continue;
  puffer.push(zeile);
  if (nackt.endsWith(';')) {
    anweisungen.push(puffer.join('\n').trim().replace(/;$/, ''));
    puffer = [];
  }
}

/* Jede Anweisung so verpacken, dass ein zweiter Lauf nichts umwirft ----- */

const verpackt = anweisungen.map(
  (anweisung) => `DO $mig$ BEGIN
${anweisung};
EXCEPTION
  WHEN duplicate_table THEN NULL;
  WHEN duplicate_object THEN NULL;
  WHEN duplicate_column THEN NULL;
  WHEN duplicate_schema THEN NULL;
  WHEN invalid_table_definition THEN NULL;
END $mig$;`,
);

/* Zugang ---------------------------------------------------------------- */

const hash = await argon2.hash(passwort, { type: argon2.argon2id });
const kennung = 'usr' + randomBytes(11).toString('hex');
const [vorname, nachname] = ['Neuer', 'Zugang'];

const inhalt = `-- =====================================================================
--  Garagentor – Datenbank einrichten
--
--  Im Supabase-Dashboard:  SQL Editor  ->  alles hier einfügen  ->  Run
--
--  Diese Datei darf mehrfach laufen. Jede Anweisung steckt in einem Block,
--  der ein „gibt es schon" stillschweigend übergeht. Was fehlt, wird
--  angelegt; was da ist, bleibt unangetastet.
--
--  Erzeugt von tools/datenbank-sql.mjs – nicht von Hand ändern.
-- =====================================================================

${verpackt.join('\n\n')}

-- =====================================================================
--  Zugang für die Anmeldung
--
--  Das Passwort steht als Argon2id-Prüfsumme, nicht im Klartext. Ein
--  zweiter Lauf setzt es auf denselben Wert zurück – hilfreich, wenn
--  jemand ausgesperrt ist.
-- =====================================================================
INSERT INTO "users" ("id", "email", "passwordHash", "firstName", "lastName", "role", "active", "createdAt", "updatedAt")
VALUES ('${kennung}', '${adresse}', '${hash}', '${vorname}', '${nachname}', 'ADMIN', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("email") DO UPDATE SET
  "passwordHash" = EXCLUDED."passwordHash",
  "role"         = 'ADMIN',
  "active"       = true,
  "updatedAt"    = CURRENT_TIMESTAMP;

-- Zur Kontrolle: Wie viele Tabellen stehen, und gibt es den Zugang?
SELECT
  (SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public') AS tabellen,
  (SELECT count(*) FROM "users" WHERE "email" = '${adresse}') AS zugang;
`;

const ziel = join(wurzel, 'garagentor-datenbank.sql');
writeFileSync(ziel, inhalt);

console.log(`Geschrieben: ${ziel}`);
console.log(`  ${anweisungen.length} Anweisungen, Zugang für ${adresse}`);
console.log('\nDie Datei enthält eine Passwort-Prüfsumme – nicht einchecken.');
