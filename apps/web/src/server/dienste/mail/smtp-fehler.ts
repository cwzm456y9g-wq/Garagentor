/**
 * SMTP-Fehler in verständliche Sätze übersetzen.
 *
 * Was ein Mailserver zurückgibt, ist für den Betrieb unbrauchbar: „535 5.7.8
 * Error: authentication failed" sagt niemandem, daß das Kennwort nicht stimmt,
 * und „ESOCKET wrong version number" schon gar nicht, daß Port und
 * Verschlüsselung nicht zueinander passen.
 *
 * Deshalb steht hier zu jedem bekannten Fehlerbild ein Satz, der sagt, was
 * schiefging, und einer, der sagt, was zu tun ist. Was nicht erkannt wird,
 * kommt im Wortlaut durch – lieber eine englische Meldung als eine erfundene
 * deutsche.
 */

export interface Fehlerbild {
  /** Was passiert ist, in einem Satz. */
  meldung: string;
  /** Was der Betrieb dagegen tun kann. */
  rat: string | null;
  /** Der ursprüngliche Wortlaut, für den Fall, daß doch jemand nachsieht. */
  wortlaut: string;
}

/** Kennung und Text aus dem, was nodemailer wirft. */
function zerlegen(fehler: unknown): { code: string; antwort: number | null; text: string } {
  const roh = fehler as { code?: unknown; responseCode?: unknown; message?: unknown } | null;

  return {
    code: typeof roh?.code === 'string' ? roh.code : '',
    antwort: typeof roh?.responseCode === 'number' ? roh.responseCode : null,
    text: typeof roh?.message === 'string' ? roh.message : String(fehler),
  };
}

export function smtpFehlerbild(fehler: unknown): Fehlerbild {
  const { code, antwort, text } = zerlegen(fehler);
  const klein = text.toLowerCase();

  // Anmeldung abgelehnt. Der häufigste Fall, und fast immer dasselbe: Es ist
  // nicht das Kennwort des Postfachs, sondern eines für Programme nötig.
  if (code === 'EAUTH' || antwort === 535 || antwort === 534 || klein.includes('invalid login')) {
    return {
      meldung: 'Der Mailserver hat die Anmeldedaten abgelehnt.',
      rat:
        'MAIL_USER muß die vollständige Adresse sein, nicht nur der Teil vor dem @. ' +
        'Verlangt der Anbieter ein eigenes Kennwort für Programme, gehört dieses in ' +
        'MAIL_PASSWORD – nicht das, mit dem man sich am Webmail anmeldet.',
      wortlaut: text,
    };
  }

  // Name nicht auflösbar: fast immer ein Tippfehler im Servernamen.
  if (code === 'ENOTFOUND' || code === 'EAI_AGAIN' || klein.includes('getaddrinfo')) {
    return {
      meldung: 'Der Servername ist nicht auffindbar.',
      rat: 'Bitte MAIL_HOST prüfen – dort gehört der Name des Postausgangsservers hin, nicht die eigene Domain.',
      wortlaut: text,
    };
  }

  // Auf die Kennung allein ist kein Verlaß: nodemailer verpackt den Fehler des
  // Netzes und meldet ihn als ESOCKET – die Ursache steht dann nur noch im
  // Wortlaut. Am lebenden Server nachgemessen: „connect ECONNREFUSED 1.2.3.4:25".
  if (code === 'ECONNREFUSED' || klein.includes('econnrefused')) {
    return {
      meldung: 'Der Server ist erreichbar, nimmt auf diesem Port aber nichts an.',
      rat: 'Üblich sind 465 (durchgehend verschlüsselt) und 587 (beginnt offen, wechselt per STARTTLS). Bitte MAIL_PORT prüfen.',
      wortlaut: text,
    };
  }

  // Verwechselte Verschlüsselung. Das Fehlerbild ist unverwechselbar und die
  // Ursache immer dieselbe – deshalb steht hier die Auflösung und nicht nur
  // „TLS-Fehler".
  if (klein.includes('wrong version number') || klein.includes('ssl3_get_record')) {
    return {
      meldung: 'Port und Verschlüsselung passen nicht zueinander.',
      rat: 'Zu Port 465 gehört MAIL_SECURE=true, zu Port 587 gehört MAIL_SECURE=false. Umgekehrt gibt es genau diesen Fehler.',
      wortlaut: text,
    };
  }

  if (klein.includes('self signed') || klein.includes('unable to verify')) {
    return {
      meldung: 'Das Zertifikat des Mailservers ließ sich nicht prüfen.',
      rat: 'Meist steht im MAIL_HOST ein anderer Name als im Zertifikat. Bitte den Namen verwenden, den der Anbieter für den Postausgang nennt.',
      wortlaut: text,
    };
  }

  if (code === 'ETIMEDOUT' || code === 'ECONNECTION' || klein.includes('timeout')) {
    return {
      meldung: 'Der Mailserver hat nicht geantwortet.',
      rat:
        'Das kommt vor, wenn Port 465 mit MAIL_SECURE=false angesprochen wird – die Verbindung ' +
        'wartet dann auf eine Begrüßung, die nie kommt. Sonst blockiert der Anbieter den ausgehenden Port.',
      wortlaut: text,
    };
  }

  // Umschlag abgelehnt: Absender oder Empfänger paßt dem Server nicht.
  if (code === 'EENVELOPE' || antwort === 550 || antwort === 553) {
    return {
      meldung: 'Der Mailserver hat Absender oder Empfänger abgelehnt.',
      rat: 'Viele Anbieter versenden nur unter der Adresse, mit der man sich angemeldet hat. MAIL_FROM sollte zu MAIL_USER passen.',
      wortlaut: text,
    };
  }

  if (antwort === 554 || klein.includes('spam')) {
    return {
      meldung: 'Der Mailserver hat die Nachricht abgewiesen.',
      rat: 'Der Server hält sie für unerwünscht. Bei einer Testmail liegt das meist daran, daß Absender und angemeldetes Postfach auseinandergehen.',
      wortlaut: text,
    };
  }

  return {
    meldung: 'Der Versand ist fehlgeschlagen.',
    rat: null,
    wortlaut: text,
  };
}
