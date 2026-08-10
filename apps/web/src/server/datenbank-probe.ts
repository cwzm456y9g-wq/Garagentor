import { Client } from 'pg';
import { tlsFuer } from './db-adresse';

/**
 * Fragt die Datenbank auf dem kürzesten Weg – ohne Prisma.
 *
 * Der Grund für diesen Umweg ist eine Lehre aus einer langen Inbetriebnahme:
 * Eine Prüfung, die durch dieselben Schichten läuft wie die Anwendung, kann
 * nicht sagen, an welcher davon es klemmt. Zuletzt stand genau das im Weg –
 * der Verbindungsaufbau war nachweislich in Ordnung (er meldet sich nach zehn
 * Sekunden), die Abfragegrenze griff nachweislich auch („Query read timeout"
 * nach 5,2 s), und trotzdem kam über Prisma keine Antwort zurück. Über wen
 * dann? Solange die Prüfung selbst über Prisma läuft, bleibt die Frage offen.
 *
 * Deshalb hier: ein eigener Client, eine eigene Verbindung, eigene Grenzen,
 * und danach wieder aufgelegt. Der Verbindungsvorrat der Anwendung bleibt
 * unberührt.
 *
 * Was dabei herauskommt, ist eindeutig:
 *
 *   ok           Die Datenbank ist erreichbar und antwortet. Klemmt es
 *                trotzdem, liegt es an einer Schicht darüber – nicht am Netz,
 *                nicht an den Zugangsdaten.
 *   Fehlercode   Die Datenbank antwortet ablehnend. 28P01 heißt Passwort,
 *                3D000 heißt Datenbankname, 28000 heißt Benutzer.
 *   Abbruch      Nicht einmal das. Dann steht in der Begründung, woran es lag.
 */
export interface Probe {
  ok: boolean;
  dauerMs: number;
  /** Klartext, falls es nicht geklappt hat. */
  grund?: string;
  /** SQLSTATE der Datenbank, sofern sie einen geschickt hat. */
  code?: string;
}

const GEDULD_MS = 8000;

export async function datenbankProbe(geduldMs = GEDULD_MS): Promise<Probe> {
  const start = Date.now();
  const adresse = process.env.DATABASE_URL;

  if (!adresse) return { ok: false, dauerMs: 0, grund: 'DATABASE_URL ist nicht gesetzt.' };

  const client = new Client({
    connectionString: adresse,
    ssl: tlsFuer(adresse, process.env.DATABASE_SSL_CA),
    connectionTimeoutMillis: geduldMs,
    query_timeout: geduldMs,
    // Keine weiteren Angaben. Insbesondere kein `statement_timeout`: Den
    // schreibt `pg` ins Anmeldepaket, und der Supabase-Pooler kann damit
    // nichts anfangen – die Anmeldung gelingt, die Abfrage kommt nie zurück.
  });

  try {
    await client.connect();
    await client.query('SELECT 1');
    return { ok: true, dauerMs: Date.now() - start };
  } catch (fehler) {
    const grund = fehler instanceof Error ? fehler.message.slice(0, 200) : String(fehler);
    const code = (fehler as { code?: string })?.code;
    return { ok: false, dauerMs: Date.now() - start, grund, ...(code ? { code } : {}) };
  } finally {
    // Auflegen darf nie die Auskunft verhindern; eine bereits tote Verbindung
    // wehrt sich hier gelegentlich.
    await client.end().catch(() => undefined);
  }
}
