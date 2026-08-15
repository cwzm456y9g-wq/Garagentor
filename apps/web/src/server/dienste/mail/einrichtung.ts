import type { Konfiguration } from '@/server/konfiguration';

/**
 * Was der Server von den Postausgangsdaten tatsächlich vorfindet.
 *
 * Der Anlaß ist eine wiederkehrende Sackgasse: Jemand trägt die Zugangsdaten
 * in hPanel ein, und danach geht trotzdem keine Mail hinaus. Von außen sieht
 * man nicht, ob die Werte falsch sind oder ob sie den Server nie erreicht
 * haben – ein Tippfehler im *Namen* der Variablen, die falsche Rubrik im
 * Panel, oder der fehlende Neustart sehen alle gleich aus.
 *
 * Deshalb steht hier die Frage vor der Verbindung: Welche Angaben liegen an?
 * Nicht ihr Inhalt – der bleibt auf dem Server –, sondern ob überhaupt einer
 * da ist. Erst wenn das stimmt, lohnt es sich, den Mailserver zu fragen.
 */

/** Eine Angabe des Postausgangs und ihr Zustand. */
export interface Angabe {
  name: string;
  gesetzt: boolean;
  /** Ohne diese Angabe geht gar nichts. */
  noetig: boolean;
  /** Ungefährlicher Auszug, oder null bei Geheimnissen. */
  wert: string | null;
}

export interface Einrichtung {
  /** Reicht es, um überhaupt zu senden? */
  vollstaendig: boolean;
  angaben: Angabe[];
  /** Widersprüche, die schon ohne Verbindung auffallen. */
  warnungen: string[];
}

/**
 * Prüft die Angaben gegeneinander, bevor irgendeine Verbindung aufgebaut wird.
 *
 * Die drei Fälle hier sind die, die man am Mailserver sonst nur an einer
 * kryptischen Antwort erkennt – und zwei davon erst beim ersten echten Beleg.
 */
export function einrichtung(mail: Konfiguration['mail']): Einrichtung {
  const angaben: Angabe[] = [
    { name: 'MAIL_HOST', gesetzt: Boolean(mail.host), noetig: true, wert: mail.host },
    {
      name: 'MAIL_PORT',
      gesetzt: Number.isFinite(mail.port) && mail.port > 0,
      noetig: true,
      wert: String(mail.port),
    },
    {
      name: 'MAIL_SECURE',
      gesetzt: true,
      noetig: false,
      wert: mail.secure ? 'true (durchgehend verschlüsselt)' : 'false (STARTTLS)',
    },
    { name: 'MAIL_USER', gesetzt: Boolean(mail.user), noetig: true, wert: mail.user },
    // Das Kennwort wird nie ausgegeben – auch nicht gekürzt.
    { name: 'MAIL_PASSWORD', gesetzt: Boolean(mail.password), noetig: true, wert: null },
    { name: 'MAIL_FROM', gesetzt: Boolean(mail.from), noetig: true, wert: mail.from },
    { name: 'MAIL_REPLY_TO', gesetzt: Boolean(mail.replyTo), noetig: false, wert: mail.replyTo },
    { name: 'MAIL_BCC', gesetzt: Boolean(mail.bcc), noetig: false, wert: mail.bcc },
  ];

  const warnungen: string[] = [];

  // Port und Verschlüsselung müssen zusammenpassen.
  //
  // Den umgekehrten Fall – Port 465 mit MAIL_SECURE=false – gibt es hier
  // bewußt nicht: Die Konfiguration schaltet bei 465 von sich aus auf
  // durchgehende Verschlüsselung, weil dieser Port nichts anderes kann. Eine
  // Warnung dafür könnte nie auslösen und würde nur vortäuschen, daß der Fall
  // geprüft wird.
  if (mail.port === 587 && mail.secure) {
    warnungen.push(
      'Port 587 beginnt offen und wechselt per STARTTLS. Dazu gehört MAIL_SECURE=false – sonst ' +
        'wartet die Verbindung ins Leere.',
    );
  }

  // Anmeldung nur halb hinterlegt: nodemailer läßt die Anmeldung dann ganz
  // weg, und der Mailserver weist erst den Umschlag ab.
  if (Boolean(mail.user) !== Boolean(mail.password)) {
    warnungen.push(
      mail.user
        ? 'Zu MAIL_USER fehlt MAIL_PASSWORD. Ohne beides meldet sich die Anwendung gar nicht an, ' +
            'und der Mailserver nimmt den Umschlag nicht.'
        : 'Zu MAIL_PASSWORD fehlt MAIL_USER. Dort gehört die vollständige Adresse hin, nicht nur ' +
            'der Teil vor dem @.',
    );
  }

  // Fast alle Anbieter versenden nur unter der angemeldeten Adresse.
  const absenderAdresse = adresseAus(mail.from);
  if (mail.user && absenderAdresse && !gleicheAdresse(mail.user, absenderAdresse)) {
    warnungen.push(
      `MAIL_FROM sendet als „${absenderAdresse}", angemeldet wird aber als „${mail.user}". Die ` +
        'meisten Anbieter weisen das ab. Beide sollten dieselbe Adresse tragen.',
    );
  }

  return {
    vollstaendig: angaben.every((angabe) => !angabe.noetig || angabe.gesetzt),
    angaben,
    warnungen,
  };
}

/** Holt die nackte Adresse aus „Name <adresse>". */
function adresseAus(from: string | null): string | null {
  if (!from) return null;
  const spitz = /<([^>]+)>/.exec(from);
  return (spitz ? spitz[1] : from).trim() || null;
}

function gleicheAdresse(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}
