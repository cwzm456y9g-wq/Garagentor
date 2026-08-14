import { MAIL_TEMPLATE_DEFAULTS, type MailDocumentType } from '@garagentor/shared';

/**
 * Anschreiben für den Belegversand.
 *
 * Bewusst ohne Bezug auf Nodemailer oder Prisma: welcher Platzhalter wodurch
 * ersetzt wird, entscheidet, was beim Kunden ankommt, und soll sich einzeln
 * prüfen lassen.
 */

export interface MailVorlage {
  betreff: string;
  text: string;
}

/** Werte, mit denen die Platzhalter gefüllt werden. */
export type Platzhalter = Partial<
  Record<
    | 'anrede'
    | 'kunde'
    | 'nummer'
    | 'betreff'
    | 'datum'
    | 'betrag'
    | 'faellig'
    | 'stufe'
    | 'anlage'
    | 'firma',
    string
  >
>;

/**
 * Setzt die bekannten Platzhalter ein.
 *
 * Unbekannte Platzhalter bleiben stehen, statt zu verschwinden: eine sichtbare
 * `{kundr}` fällt im Entwurf auf, eine stillschweigend geleerte Stelle nicht.
 * Fehlende Werte werden dagegen zu einem leeren Text – der Platzhalter war
 * richtig, die Angabe fehlt am Beleg.
 */
export function setzePlatzhalter(text: string, werte: Platzhalter): string {
  return text.replace(/\{([a-zäöüß]+)\}/gi, (treffer, name: string) => {
    const schluessel = name.toLowerCase() as keyof Platzhalter;
    if (!(schluessel in werte)) return treffer;
    return werte[schluessel] ?? '';
  });
}

/**
 * Vorlage einer Belegart, mit den Vorgaben als Rückfall.
 *
 * Eine leere Vorlage aus den Einstellungen gilt als „nicht gepflegt“ – sonst
 * ginge eine Mail ohne Betreff hinaus, nur weil jemand das Feld geleert hat.
 */
export function vorlageFuer(
  art: MailDocumentType,
  gepflegt: Partial<Record<MailDocumentType, Partial<MailVorlage>>> | null | undefined,
): MailVorlage {
  const vorgabe = MAIL_TEMPLATE_DEFAULTS[art];
  const eigene = gepflegt?.[art];

  return {
    betreff: eigene?.betreff?.trim() || vorgabe.betreff,
    text: eigene?.text?.trim() || vorgabe.text,
  };
}

/**
 * Hängt die Signatur an den Text. Ohne gepflegte Signatur bleibt es beim
 * Gruß, damit die Mail nicht abrupt endet.
 */
export function mitSignatur(text: string, signatur: string | null | undefined): string {
  const gruss = 'Mit freundlichen Grüßen';
  const unterschrift = signatur?.trim();

  return unterschrift ? `${text}\n\n${gruss}\n\n${unterschrift}` : `${text}\n\n${gruss}`;
}

/**
 * Prüft eine Empfängerangabe grob auf Form. Der Mailserver entscheidet
 * endgültig; hier geht es darum, offensichtlichen Unsinn nicht erst zu
 * verschicken.
 */
export function istEmpfaengerGueltig(adresse: string): boolean {
  return /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]{2,}$/.test(adresse.trim());
}

/**
 * Die Absenderzeile aus Anzeigename und `MAIL_FROM`.
 *
 * `MAIL_FROM` darf beides sein: eine nackte Adresse oder schon
 * „Name <adresse>“. Kommt aus den Einstellungen ein Anzeigename dazu, muss
 * daraus wieder eine gültige Zeile werden – und nicht
 * „Betrieb <Betrieb <post@…>>“. Genau das stand vorher in jeder Mail, und
 * Postfächer zeigten den Absender als „Betrieb>“ an.
 */
export function absenderZeile(
  absender: string | null | undefined,
  from: string | null | undefined,
): string | undefined {
  const rohwert = from?.trim();
  if (!rohwert) return undefined;

  // Die Adresse steckt in spitzen Klammern, wenn ein Name davorsteht.
  const adresse = rohwert.match(/<([^>]+)>/)?.[1]?.trim() ?? rohwert;
  const name = absender?.trim();

  if (!name) return rohwert;
  // Anführungszeichen im Namen würden die Zeile zerlegen.
  return `"${name.replace(/"/g, '')}" <${adresse}>`;
}

/** Zerlegt eine Liste von Empfängern, getrennt durch Komma oder Semikolon. */
export function empfaengerListe(eingabe: string | null | undefined): string[] {
  return (eingabe ?? '')
    .split(/[,;]/)
    .map((adresse) => adresse.trim())
    .filter(Boolean);
}
