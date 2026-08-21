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
      'Die Dateiablage ist nicht eingerichtet. SUPABASE_URL und ' +
        'SUPABASE_SERVICE_ROLE_KEY gehören in hPanel unter „Node.js" als ' +
        'Umgebungsvariablen; danach die Anwendung dort neu starten. Unter ' +
        'Einstellungen → Dateiablage läßt sich das prüfen.',
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

/* Einrichtung ---------------------------------------------------------- */

/** Was von der Ablage bekannt ist, ohne sie anzusprechen. */
export function ablageStatus(): {
  eingerichtet: boolean;
  adresse: string | null;
  bucket: string;
  schluesselGesetzt: boolean;
  maxMb: number;
} {
  const { supabaseUrl, dienstSchluessel, bucket, maxBytes } = konfiguration().uploads;

  return {
    eingerichtet: Boolean(supabaseUrl && dienstSchluessel),
    adresse: supabaseUrl,
    bucket,
    schluesselGesetzt: Boolean(dienstSchluessel),
    // Damit die Oberfläche die Grenze nennen kann, bevor jemand eine zu große
    // Datei aussucht. Sie erst nach der Übertragung abzuweisen ist auf einer
    // Baustellenverbindung eine vergeudete Minute.
    maxMb: Math.round(maxBytes / 1024 / 1024),
  };
}

/**
 * Prüft die Ablage mit einer echten Rundreise: schreiben, lesen, löschen.
 *
 * Nur nachzusehen, ob die Umgebungsvariablen gesetzt sind, hilft nicht weit –
 * ein falsch kopierter Schlüssel ist gesetzt und trotzdem wertlos. Erst wenn
 * eine Datei tatsächlich hin- und zurückkommt, ist die Ablage brauchbar.
 *
 * Die Probedatei wird anschließend wieder entfernt; bleibt sie liegen, sagt
 * die Meldung es, statt stillschweigend Müll zu hinterlassen.
 */
export async function ablagePruefen(): Promise<{
  ok: boolean;
  meldung: string;
  rat: string | null;
  schritte: string[];
}> {
  const schritte: string[] = [];
  const status = ablageStatus();

  if (!status.eingerichtet) {
    return {
      ok: false,
      meldung: 'Es ist keine Dateiablage hinterlegt.',
      rat:
        'SUPABASE_URL und SUPABASE_SERVICE_ROLE_KEY gehören in hPanel unter „Node.js". ' +
        'Den Dienstschlüssel finden Sie in Supabase unter Project Settings → API → service_role.',
      schritte,
    };
  }

  const pfad = `_pruefung/${Date.now()}.txt`;
  const inhalt = Buffer.from('Probe der Garagentor-Anwendung');

  try {
    const bucket = await bucketSicherstellen();
    schritte.push(`Ablagefach „${bucket}" erreichbar`);

    await ablegen(pfad, inhalt, 'text/plain');
    schritte.push('Schreiben erfolgreich');

    const zurueck = await lesen(pfad);
    if (!zurueck.equals(inhalt)) {
      return {
        ok: false,
        meldung: 'Die Probedatei kam verändert zurück.',
        rat: 'Das deutet auf einen Zwischenspeicher oder eine fremde Ablage unter derselben Adresse hin.',
        schritte,
      };
    }
    schritte.push('Lesen erfolgreich, Inhalt unverändert');

    await entfernen(pfad);
    schritte.push('Probedatei wieder entfernt');

    return {
      ok: true,
      meldung: `Die Dateiablage ist einsatzbereit (Ablagefach „${bucket}").`,
      rat: null,
      schritte,
    };
  } catch (fehler) {
    const wortlaut = fehler instanceof Error ? fehler.message : String(fehler);
    const klein = wortlaut.toLowerCase();

    // Aufräumen, falls die Probedatei doch angekommen ist.
    await entfernen(pfad).catch(() => undefined);

    if (klein.includes('invalid') && klein.includes('key')) {
      return {
        ok: false,
        meldung: 'Der Dienstschlüssel wurde abgelehnt.',
        rat: 'In Supabase unter Project Settings → API den Wert bei „service_role" nehmen – nicht den anon-Schlüssel.',
        schritte,
      };
    }
    if (klein.includes('row-level security') || klein.includes('unauthorized')) {
      return {
        ok: false,
        meldung: 'Der Zugriff auf die Ablage wurde verweigert.',
        rat: 'Das passiert mit dem anon-Schlüssel: Er unterliegt RLS. Für den Server wird der service_role-Schlüssel gebraucht.',
        schritte,
      };
    }
    if (klein.includes('fetch failed') || klein.includes('enotfound')) {
      return {
        ok: false,
        meldung: 'Die Adresse der Ablage ist nicht erreichbar.',
        rat: 'SUPABASE_URL prüfen – erwartet wird die Projektadresse in der Form https://<kennung>.supabase.co.',
        schritte,
      };
    }

    return { ok: false, meldung: wortlaut, rat: null, schritte };
  }
}

/** Ein fehlgeschlagenes Löschen darf den Vorgang nicht aufhalten. */
export async function entfernen(pfad: string): Promise<void> {
  const bucket = await bucketSicherstellen();
  const { error } = await verbindung().storage.from(bucket).remove([pfad]);
  if (error) {
    console.warn(`[Ablage] ${pfad} konnte nicht entfernt werden: ${error.message}`);
  }
}
