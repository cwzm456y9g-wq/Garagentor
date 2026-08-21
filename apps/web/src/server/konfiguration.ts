/**
 * Laufzeitkonfiguration aus der Umgebung.
 *
 * Bei Hostinger werden diese Werte in hPanel unter „Node.js" als
 * Umgebungsvariablen gesetzt. Sie gehören nicht ins Verzeichnis und nicht in
 * eine Sicherung.
 */
export interface Konfiguration {
  umgebung: 'development' | 'test' | 'production';
  jwt: {
    zugangsGeheimnis: string;
    erneuerungsGeheimnis: string;
    zugangsDauer: string;
    erneuerungsDauer: string;
  };
  /**
   * Hochgeladene Dateien liegen in Supabase Storage, nicht auf der Platte:
   * Auf Hostingers geteiltem Webhosting übersteht ein Verzeichnis das nächste
   * Ausrollen nicht zuverlässig.
   */
  uploads: {
    maxBytes: number;
    /** Name des privaten Buckets in Supabase Storage. */
    bucket: string;
    supabaseUrl: string | null;
    /**
     * Der Dienstschlüssel umgeht RLS und darf den Browser nie erreichen. Er
     * wird ausschließlich serverseitig gelesen.
     */
    dienstSchluessel: string | null;
  };
  /**
   * Postausgang. Die Feldnamen folgen hier den Umgebungsvariablen
   * (`MAIL_SECURE`, `MAIL_FROM` …), damit beim Eintragen in hPanel klar ist,
   * welcher Wert wohin gehört.
   *
   * Die Zugangsdaten stehen bewusst in der Umgebung und nicht in den
   * Einstellungen: sie gehören nicht in die Datenbank und nicht in eine
   * Sicherung, die jemand herumreicht. Ohne `host` ist der Versand schlicht
   * nicht eingerichtet – die Anwendung läuft trotzdem.
   */
  mail: {
    host: string | null;
    port: number;
    /** Verschlüsselte Verbindung ab dem ersten Byte (Port 465). */
    secure: boolean;
    user: string | null;
    password: string | null;
    from: string | null;
    replyTo: string | null;
    /** Stille Kopie an den eigenen Posteingang, etwa fürs Archiv. */
    bcc: string | null;
  };
  /**
   * Geheimnis, mit dem sich der nächtliche Cron-Aufruf ausweist. Die Jobs
   * laufen nicht mehr im Prozess, sondern werden von außen angestoßen – ohne
   * dieses Geheimnis könnte sie jeder auslösen.
   */
  cronGeheimnis: string | null;
}

const ENTWICKLUNGS_GEHEIMNIS = 'dev-geheimnis-bitte-ersetzen';

function geheimnis(name: string, wert: string | undefined, produktiv: boolean): string {
  if (!wert) {
    if (produktiv) {
      throw new Error(`${name} muss im Produktivbetrieb gesetzt sein.`);
    }
    return `${ENTWICKLUNGS_GEHEIMNIS}-${name}`;
  }
  if (produktiv && wert.includes('bitte-ersetzen')) {
    throw new Error(`${name} enthält noch den Entwicklungswert.`);
  }
  if (produktiv && wert.length < 32) {
    throw new Error(`${name} muss mindestens 32 Zeichen lang sein.`);
  }
  return wert;
}

let zwischenspeicher: Konfiguration | null = null;

export function konfiguration(): Konfiguration {
  if (zwischenspeicher) return zwischenspeicher;

  const umgebung = (process.env.NODE_ENV ?? 'development') as Konfiguration['umgebung'];
  const produktiv = umgebung === 'production';

  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL ist nicht gesetzt.');
  }

  zwischenspeicher = {
    umgebung,
    jwt: {
      zugangsGeheimnis: geheimnis('JWT_ACCESS_SECRET', process.env.JWT_ACCESS_SECRET, produktiv),
      erneuerungsGeheimnis: geheimnis(
        'JWT_REFRESH_SECRET',
        process.env.JWT_REFRESH_SECRET,
        produktiv,
      ),
      zugangsDauer: process.env.JWT_ACCESS_TTL ?? '15m',
      erneuerungsDauer: process.env.JWT_REFRESH_TTL ?? '7d',
    },
    uploads: {
      maxBytes: Number.parseInt(process.env.MAX_UPLOAD_MB ?? '50', 10) * 1024 * 1024,
      bucket: process.env.SUPABASE_BUCKET?.trim() || 'dokumente',
      supabaseUrl: process.env.SUPABASE_URL?.trim() || null,
      dienstSchluessel: process.env.SUPABASE_SERVICE_ROLE_KEY || null,
    },
    mail: {
      host: process.env.MAIL_HOST?.trim() || null,
      port: Number.parseInt(process.env.MAIL_PORT ?? '587', 10),
      // Port 465 spricht von Anfang an TLS, 587 beginnt offen und wechselt per
      // STARTTLS. Wer das verwechselt, bekommt eine Zeitüberschreitung.
      secure: process.env.MAIL_SECURE === 'true' || process.env.MAIL_PORT === '465',
      user: process.env.MAIL_USER?.trim() || null,
      password: process.env.MAIL_PASSWORD || null,
      from: process.env.MAIL_FROM?.trim() || null,
      replyTo: process.env.MAIL_REPLY_TO?.trim() || null,
      bcc: process.env.MAIL_BCC?.trim() || null,
    },
    cronGeheimnis: process.env.CRON_SECRET?.trim() || null,
  };

  return zwischenspeicher;
}
