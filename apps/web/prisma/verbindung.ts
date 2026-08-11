import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { bereinige, tlsFuer } from '../src/server/db-adresse';

/**
 * Ein Prisma-Client für die Skripte neben der Anwendung – Demodaten und das
 * Anlegen des ersten Administrators.
 *
 * Nötig geworden, weil der Client keine eigene Datenbankverbindung mehr
 * mitbringt: Seit die Abfragen ohne Prismas Rust-Anteil gebaut werden
 * (`engineType = "client"`, siehe schema.prisma), muss jeder Aufrufer den
 * Treiber selbst mitgeben. `new PrismaClient()` ohne Adapter läuft nicht mehr.
 *
 * Bevorzugt wird `DIRECT_URL`: Diese Skripte schreiben viel am Stück, und der
 * Pooler ist dafür der falsche Weg – er reicht weder Sitzungsvariablen noch
 * längere Sperren durch. Fehlt sie, tut es auch die gewöhnliche Adresse.
 */
export function skriptClient(): PrismaClient {
  const roh = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!roh) throw new Error('Weder DIRECT_URL noch DATABASE_URL ist gesetzt.');

  const connectionString = bereinige(roh);

  return new PrismaClient({
    adapter: new PrismaPg({
      connectionString,
      ssl: tlsFuer(connectionString, process.env.DATABASE_SSL_CA),
    }),
  });
}
