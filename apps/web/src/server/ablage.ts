import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { konfiguration } from './konfiguration';
import { HttpFehler } from './fehler';

/**
 * Dateiablage in Supabase Storage.
 *
 * Vorher lagen hochgeladene Dateien auf der Platte des Servers. Auf Hostingers
 * geteiltem Webhosting übersteht das ein Neuausrollen nicht zuverlässig – und
 * ein Prüfprotokoll, dessen Fotos verschwunden sind, ist als Nachweis wertlos.
 *
 * Der Bucket ist privat. Der Dienstschlüssel umgeht RLS und verlässt den
 * Server nie; die Oberfläche bekommt die Datei über einen eigenen Endpunkt,
 * der die Anmeldung prüft.
 */
let klient: SupabaseClient | null = null;
let bucketGeprueft = false;

function verbindung(): SupabaseClient {
  const { supabaseUrl, dienstSchluessel } = konfiguration().uploads;

  if (!supabaseUrl || !dienstSchluessel) {
    throw new HttpFehler(
      503,
      'Die Dateiablage ist nicht eingerichtet. Es fehlen SUPABASE_URL oder ' +
        'SUPABASE_SERVICE_ROLE_KEY in der Umgebung des Servers.',
    );
  }

  if (!klient) {
    klient = createClient(supabaseUrl, dienstSchluessel, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return klient;
}

/**
 * Legt den Bucket an, falls er fehlt.
 *
 * Bewusst zur Laufzeit und nicht als Einrichtungsschritt von Hand: Wer den
 * Bucket beim Ausrollen vergisst, merkt es sonst erst, wenn der Monteur vor
 * Ort ein Foto hochladen will. Der Aufruf ist wirkungslos, sobald der Bucket
 * existiert.
 */
async function bucketSicherstellen(): Promise<string> {
  const bucket = konfiguration().uploads.bucket;
  if (bucketGeprueft) return bucket;

  const { data } = await verbindung().storage.getBucket(bucket);
  if (!data) {
    const { error } = await verbindung().storage.createBucket(bucket, { public: false });
    // Ein gleichzeitiger zweiter Prozess kann uns zuvorgekommen sein.
    if (error && !/already exists/i.test(error.message)) {
      throw new HttpFehler(503, `Die Dateiablage ließ sich nicht anlegen: ${error.message}`);
    }
    console.info(`[Ablage] Bucket "${bucket}" angelegt (privat).`);
  }

  bucketGeprueft = true;
  return bucket;
}

export async function ablegen(pfad: string, inhalt: Buffer, typ: string): Promise<void> {
  const bucket = await bucketSicherstellen();
  const { error } = await verbindung()
    .storage.from(bucket)
    .upload(pfad, inhalt, { contentType: typ, upsert: false });

  if (error) {
    throw new HttpFehler(502, `Die Datei ließ sich nicht ablegen: ${error.message}`);
  }
}

export async function lesen(pfad: string): Promise<Buffer> {
  const bucket = await bucketSicherstellen();
  const { data, error } = await verbindung().storage.from(bucket).download(pfad);

  if (error || !data) {
    throw new HttpFehler(404, 'Die Datei ist in der Ablage nicht vorhanden.');
  }
  return Buffer.from(await data.arrayBuffer());
}

/** Ein fehlgeschlagenes Löschen darf den Vorgang nicht aufhalten. */
export async function entfernen(pfad: string): Promise<void> {
  const bucket = await bucketSicherstellen();
  const { error } = await verbindung().storage.from(bucket).remove([pfad]);
  if (error) {
    console.warn(`[Ablage] ${pfad} konnte nicht entfernt werden: ${error.message}`);
  }
}
