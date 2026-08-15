import { einrichtung } from '@/server/dienste/mail/einrichtung';
import type { Konfiguration } from '@/server/konfiguration';

/**
 * Die Einrichtungsprüfung des Postausgangs.
 *
 * Sie beantwortet die Frage, die man von außen nicht sieht: Sind die Werte
 * falsch, oder haben sie den Server nie erreicht? Ein Tippfehler im Namen der
 * Umgebungsvariablen, die falsche Rubrik im Panel und ein vergessener Neustart
 * sehen sonst alle gleich aus.
 */
describe('Einrichtung des Postausgangs', () => {
  const vollstaendig: Konfiguration['mail'] = {
    host: 'smtp.beispiel.de',
    port: 465,
    secure: true,
    user: 'post@zeller-tore.de',
    password: 'geheim',
    from: 'Zeller Tore <post@zeller-tore.de>',
    replyTo: null,
    bcc: null,
  };

  const namen = (mail: Konfiguration['mail']) =>
    einrichtung(mail)
      .angaben.filter((angabe) => angabe.noetig && !angabe.gesetzt)
      .map((angabe) => angabe.name);

  it('meldet eine saubere Einrichtung als vollständig', () => {
    const stand = einrichtung(vollstaendig);

    expect(stand.vollstaendig).toBe(true);
    expect(stand.warnungen).toEqual([]);
  });

  it('nennt jede fehlende Pflichtangabe beim Namen', () => {
    expect(namen({ ...vollstaendig, password: null })).toEqual(['MAIL_PASSWORD']);
    expect(namen({ ...vollstaendig, host: null, from: null })).toEqual(['MAIL_HOST', 'MAIL_FROM']);
  });

  it('zählt freiwillige Angaben nicht als fehlend', () => {
    // Antwortadresse und Blindkopie sind Beiwerk – ohne sie geht Post hinaus.
    expect(einrichtung(vollstaendig).vollstaendig).toBe(true);
    expect(namen(vollstaendig)).toEqual([]);
  });

  it('gibt das Kennwort niemals aus', () => {
    // Auch nicht gekürzt: Ein Auszug verrät die Länge und oft genug den Rest.
    const kennwort = einrichtung(vollstaendig).angaben.find((a) => a.name === 'MAIL_PASSWORD');

    expect(kennwort?.gesetzt).toBe(true);
    expect(kennwort?.wert).toBeNull();
    expect(JSON.stringify(einrichtung(vollstaendig))).not.toContain('geheim');
  });

  it('zeigt die übrigen Werte, damit man Tippfehler sieht', () => {
    const host = einrichtung(vollstaendig).angaben.find((a) => a.name === 'MAIL_HOST');

    expect(host?.wert).toBe('smtp.beispiel.de');
  });

  describe('Widersprüche, die man ohne Verbindung sieht', () => {
    it('warnt nicht bei Port 465 ohne Verschlüsselungsschalter', () => {
      // Absicht: Die Konfiguration schaltet bei 465 von sich aus auf
      // durchgehende Verschlüsselung, weil der Port nichts anderes kann. Diese
      // Angabe erreicht die Prüfung deshalb nie – eine Warnung dafür würde nur
      // vortäuschen, daß der Fall geprüft wird.
      expect(einrichtung({ ...vollstaendig, port: 465, secure: false }).warnungen).toEqual([]);
    });

    it('warnt bei Port 587 mit durchgehender Verschlüsselung', () => {
      const stand = einrichtung({ ...vollstaendig, port: 587, secure: true });

      expect(stand.warnungen[0]).toMatch(/MAIL_SECURE=false/);
    });

    it('schweigt bei den richtigen Paarungen', () => {
      expect(einrichtung({ ...vollstaendig, port: 465, secure: true }).warnungen).toEqual([]);
      expect(
        einrichtung({
          ...vollstaendig,
          port: 587,
          secure: false,
        }).warnungen,
      ).toEqual([]);
    });

    it('warnt, wenn nur die Hälfte der Anmeldung dasteht', () => {
      // Nodemailer läßt die Anmeldung dann ganz weg, und der Mailserver weist
      // erst den Umschlag ab – lange nach dem Einrichten.
      expect(einrichtung({ ...vollstaendig, password: null }).warnungen[0]).toMatch(
        /fehlt MAIL_PASSWORD/,
      );
      expect(einrichtung({ ...vollstaendig, user: null }).warnungen[0]).toMatch(/fehlt MAIL_USER/);
    });

    it('warnt, wenn der Absender nicht zum angemeldeten Konto paßt', () => {
      const stand = einrichtung({
        ...vollstaendig,
        from: 'Zeller Tore <buero@andere-domain.de>',
      });

      expect(stand.warnungen[0]).toMatch(/buero@andere-domain\.de/);
      expect(stand.warnungen[0]).toMatch(/post@zeller-tore\.de/);
    });

    it('nimmt den Absender auch ohne spitze Klammern an', () => {
      expect(einrichtung({ ...vollstaendig, from: 'post@zeller-tore.de' }).warnungen).toEqual([]);
    });

    it('stört sich nicht an Groß- und Kleinschreibung', () => {
      expect(
        einrichtung({ ...vollstaendig, from: 'Zeller Tore <Post@Zeller-Tore.de>' }).warnungen,
      ).toEqual([]);
    });

    it('schweigt zum Absender, solange kein Konto hinterlegt ist', () => {
      // Ohne MAIL_USER gibt es nichts zu vergleichen; die fehlende Anmeldung
      // wird ohnehin schon gemeldet.
      const stand = einrichtung({ ...vollstaendig, user: null, password: null });

      expect(stand.warnungen.filter((satz) => satz.includes('sendet als'))).toEqual([]);
    });
  });
});
