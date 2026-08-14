import { smtpFehlerbild } from '@/server/dienste/mail/smtp-fehler';

/**
 * Die Übersetzung der Mailserver-Fehler.
 *
 * Sie entscheidet, ob jemand den Postausgang zum Laufen bringt oder aufgibt:
 * „535 5.7.8 Error: authentication failed" sagt nichts, „Der Mailserver hat
 * die Anmeldedaten abgelehnt" schon – und der Rat dazu nennt die Stelle, an
 * der es fast immer hakt.
 *
 * Die Meldungen hier sind **nicht ausgedacht**. Sie stammen aus einem Lauf
 * gegen nachgestellte Mailserver und wurden aus dem Versandprotokoll
 * abgelesen. Das ist wesentlich: Ein erfundener Fehler hat die Kennung, die
 * man erwartet – nodemailer verpackt den Fehler des Netzes aber und meldet
 * `ESOCKET`, wo man `ECONNREFUSED` vermutet. Genau daran ging die Übersetzung
 * des geschlossenen Ports zuerst vorbei.
 */
describe('SMTP-Fehler', () => {
  /** So sieht aus, was nodemailer wirft. */
  const fehler = (code: string, message: string, responseCode?: number) =>
    Object.assign(new Error(message), { code, responseCode });

  it('erkennt abgelehnte Anmeldedaten und nennt die übliche Ursache', () => {
    const bild = smtpFehlerbild(
      fehler('EAUTH', 'Invalid login: 535 5.7.8 Error: authentication failed', 535),
    );

    expect(bild.meldung).toContain('Anmeldedaten abgelehnt');
    expect(bild.rat).toContain('vollständige Adresse');
  });

  it('erkennt einen Tippfehler im Servernamen', () => {
    const bild = smtpFehlerbild(
      fehler('ESOCKET', 'getaddrinfo ENOTFOUND smtp.gibtesnicht.invalid'),
    );

    expect(bild.meldung).toContain('nicht auffindbar');
    expect(bild.rat).toContain('MAIL_HOST');
  });

  it('erkennt den geschlossenen Port am Wortlaut, nicht an der Kennung', () => {
    // nodemailer meldet hier ESOCKET, nicht ECONNREFUSED.
    const bild = smtpFehlerbild(fehler('ESOCKET', 'connect ECONNREFUSED 127.0.0.1:2599'));

    expect(bild.meldung).toContain('nimmt auf diesem Port aber nichts an');
    expect(bild.rat).toContain('465');
  });

  it('löst den häufigsten Einrichtungsfehler auf: Port gegen Verschlüsselung', () => {
    const bild = smtpFehlerbild(
      fehler(
        'ESOCKET',
        'C04C6E2FE47F0000:error:0A00010B:SSL routines:tls_validate_record_header:' +
          'wrong version number:../deps/openssl/openssl/ssl/record/methods/tlsany_meth.c:77:',
      ),
    );

    expect(bild.meldung).toContain('Port und Verschlüsselung passen nicht');
    expect(bild.rat).toContain('465');
    expect(bild.rat).toContain('587');
  });

  it('erkennt die stille Zeitüberschreitung', () => {
    const bild = smtpFehlerbild(fehler('ETIMEDOUT', 'Greeting never received'));

    expect(bild.meldung).toContain('nicht geantwortet');
    expect(bild.rat).toContain('465');
  });

  it('erkennt den abgelehnten Absender', () => {
    const bild = smtpFehlerbild(
      fehler(
        'EENVELOPE',
        'Mail command failed: 550 5.7.1 Sender address rejected: not owned by user',
        550,
      ),
    );

    expect(bild.meldung).toContain('Absender oder Empfänger abgelehnt');
    expect(bild.rat).toContain('MAIL_FROM');
  });

  it('erkennt das nicht prüfbare Zertifikat', () => {
    const bild = smtpFehlerbild(fehler('ESOCKET', 'self signed certificate in certificate chain'));

    expect(bild.meldung).toContain('Zertifikat');
  });

  it('erfindet nichts, wenn das Bild unbekannt ist', () => {
    const bild = smtpFehlerbild(fehler('EUNBEKANNT', 'Etwas ganz Neues ist passiert'));

    expect(bild.meldung).toBe('Der Versand ist fehlgeschlagen.');
    expect(bild.rat).toBeNull();
    expect(bild.wortlaut).toBe('Etwas ganz Neues ist passiert');
  });

  it('behält immer den Wortlaut, damit im Zweifel nachlesbar bleibt, was kam', () => {
    const bild = smtpFehlerbild(fehler('EAUTH', '535 5.7.8 Error: authentication failed', 535));

    expect(bild.wortlaut).toBe('535 5.7.8 Error: authentication failed');
  });

  it('kommt auch mit etwas zurecht, das gar kein Fehlerobjekt ist', () => {
    expect(smtpFehlerbild('kaputt').wortlaut).toBe('kaputt');
    expect(smtpFehlerbild(null).meldung).toBe('Der Versand ist fehlgeschlagen.');
  });
});
