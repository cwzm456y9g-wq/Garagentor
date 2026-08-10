/**
 * Die Verbindungsadresse aus der Umgebung lesen – und dabei die Fehler
 * abfangen, die beim Eintragen von Hand entstehen.
 *
 * Der Wert wird in einer Weboberfläche eingefügt, meist kopiert aus einer
 * Anleitung. Dabei gehen regelmäßig Zeichen mit, die dort nicht hingehören,
 * und die Folge ist immer dieselbe unbrauchbare Meldung: Die Verbindung läuft
 * ins Leere, ohne dass jemand sagt warum.
 *
 * Diese Datei macht daraus etwas Benennbares.
 */

/** Was an einer Adresse auffällig ist, ohne das Passwort preiszugeben. */
export interface Befund {
  /** Adresse nach der Bereinigung, Passwort durch Sterne ersetzt. */
  maskiert: string;
  protokoll: string;
  benutzer: string;
  rechner: string;
  port: string;
  datenbank: string;
  parameter: string[];
  /** Länge des Passworts – verrät nichts, hilft aber gegen „leer vergessen". */
  passwortLaenge: number;
  /** Klartextliche Hinweise auf Dinge, die erfahrungsgemäß schiefgehen. */
  auffaelligkeiten: string[];
}

/**
 * Das Passwort so, wie es in der Zeichenkette steht – vor dem Dekodieren.
 *
 * `new URL` gibt das Passwort bereits ausgewertet zurück, und genau das
 * verwischt den Unterschied, auf den es hier ankommt: Ein `#`, das ordentlich
 * als `%23` geschrieben ist, sieht dekodiert aus wie ein `#`, das roh in der
 * Adresse steht. Das erste ist richtig, das zweite zerstört die Adresse. Für
 * die Warnung zählt also nur die rohe Form.
 *
 * Die Zerlegung geht vom letzten `@` aus, weil ein `@` im Passwort selbst
 * vorkommen darf – der Rechnername steht immer dahinter.
 */
function rohesPasswort(wert: string): string | null {
  const nachSchema = wert.replace(/^\w+:\/\//, '');
  const trenner = nachSchema.lastIndexOf('@');
  if (trenner < 0) return null;

  const zugang = nachSchema.slice(0, trenner);
  const doppelpunkt = zugang.indexOf(':');
  return doppelpunkt < 0 ? '' : zugang.slice(doppelpunkt + 1);
}

/**
 * Entfernt, was beim Kopieren mitkommt.
 *
 * * Umschließende Anführungszeichen: Anleitungen schreiben
 *   `DATABASE_URL="postgresql://…"`. Wer die ganze rechte Seite einfügt, hat
 *   die Zeichen im Wert stehen – und damit eine Adresse, die mit `"` beginnt.
 * * Ein vorangestelltes `DATABASE_URL=`: derselbe Fehler, eine Stufe früher.
 * * Leerzeichen und Zeilenumbrüche an den Rändern.
 */
export function bereinige(roh: string): string {
  let wert = roh.trim();

  if (/^DATABASE_URL\s*=/i.test(wert)) wert = wert.replace(/^DATABASE_URL\s*=/i, '').trim();
  if (/^DIRECT_URL\s*=/i.test(wert)) wert = wert.replace(/^DIRECT_URL\s*=/i, '').trim();

  const paare: [string, string][] = [
    ['"', '"'],
    ["'", "'"],
    ['`', '`'],
  ];
  for (const [auf, zu] of paare) {
    if (wert.startsWith(auf) && wert.endsWith(zu) && wert.length > 1) {
      wert = wert.slice(1, -1).trim();
    }
  }

  return wert;
}

/** Zerlegt die Adresse, ohne über eine kaputte zu stolpern. */
export function untersuche(roh: string | undefined): Befund | { fehler: string } {
  if (!roh || !roh.trim()) return { fehler: 'DATABASE_URL ist leer oder nicht gesetzt.' };

  const wert = bereinige(roh);
  const auffaelligkeiten: string[] = [];

  if (wert !== roh.trim()) {
    auffaelligkeiten.push(
      'Der Wert enthielt Anführungszeichen oder einen Variablennamen – beides wurde entfernt.',
    );
  }
  if (/\s/.test(wert)) auffaelligkeiten.push('Die Adresse enthält ein Leerzeichen.');

  let url: URL;
  try {
    url = new URL(wert);
  } catch {
    // Häufigste Gründe, warum das Zerlegen scheitert – jeder bekommt seinen
    // eigenen Satz, weil die Behebung jeweils eine andere ist.
    const ohneSchema = wert.replace(/^\w+:\/\//, '');
    const vorDemAt = ohneSchema.slice(0, ohneSchema.lastIndexOf('@') + 1);

    let grund: string;
    if (/\[|\]/.test(wert)) {
      grund =
        'Die Adresse enthält eckige Klammern. Vermutlich steht der Platzhalter [YOUR-PASSWORD] noch darin – er muss mitsamt den Klammern durch das Passwort ersetzt werden.';
    } else if (/#/.test(vorDemAt)) {
      grund =
        'Im Passwort steht eine Raute (#). Sie beendet in einer Adresse alles Weitere – Serveradresse und Port gehen dabei verloren. Sie muss als %23 geschrieben werden, oder das Passwort wird auf Buchstaben und Zahlen geändert.';
    } else if (/[?/]/.test(vorDemAt)) {
      grund =
        'Im Passwort steht ein Zeichen mit eigener Bedeutung (? oder /). Es muss umgeschrieben werden: ? als %3F, / als %2F.';
    } else {
      grund = 'Die Adresse lässt sich nicht als URL lesen.';
    }
    return { fehler: grund };
  }

  const passwort = decodeURIComponent(url.password || '');
  if (!passwort) auffaelligkeiten.push('Es ist kein Passwort angegeben.');
  if (/YOUR[-_]?PASSWORD/i.test(passwort) || /^\[.*\]$/.test(passwort)) {
    auffaelligkeiten.push('Das Passwort ist noch der Platzhalter aus der Anleitung.');
  }
  // Nur die rohe Form darf hier Alarm auslösen. Ein korrekt geschriebenes
  // `%23` ist kein Fehler, sondern die Lösung – es dekodiert lediglich zu `#`.
  const unbehandelt = rohesPasswort(wert);
  if (unbehandelt && /[#?/@]/.test(unbehandelt)) {
    auffaelligkeiten.push(
      'Das Passwort enthält ein Sonderzeichen mit eigener Bedeutung (#, ?, / oder @), und zwar unmaskiert. Es muss umgeschrieben werden: # als %23, ? als %3F, / als %2F, @ als %40.',
    );
  }

  const benutzer = decodeURIComponent(url.username || '');
  if (url.port === '6543' || url.port === '5432') {
    if (url.hostname.includes('pooler.supabase.com') && !benutzer.includes('.')) {
      auffaelligkeiten.push(
        'Beim Supabase-Pooler muss der Benutzername die Projektkennung enthalten, also postgres.<kennung> statt nur postgres.',
      );
    }
  }
  if (url.hostname.startsWith('db.') && url.hostname.endsWith('.supabase.co')) {
    auffaelligkeiten.push(
      'Das ist die Direktverbindung. Sie ist nur über IPv6 erreichbar; geteiltes Webhosting kommt dort meist nicht hin. Besser der Pooler (pooler.supabase.com).',
    );
  }

  return {
    maskiert: `${url.protocol}//${url.username}:${'*'.repeat(Math.min(passwort.length, 8))}@${url.host}${url.pathname}${url.search}`,
    protokoll: url.protocol.replace(':', ''),
    benutzer,
    rechner: url.hostname,
    port: url.port || '(nicht angegeben)',
    datenbank: url.pathname.replace(/^\//, '') || '(nicht angegeben)',
    parameter: [...url.searchParams.entries()].map(([k, v]) => `${k}=${v}`),
    passwortLaenge: passwort.length,
    auffaelligkeiten,
  };
}

/** Wie die Verbindung verschlüsselt wird – in der Form, die `pg` erwartet. */
export type TlsWahl = false | { ca?: string; rejectUnauthorized: boolean };

/**
 * Rechner, bei denen keine Verschlüsselung verlangt wird.
 *
 * `postgres` und `db` stehen darin, weil die Entwicklungsumgebung aus
 * docker-compose die Datenbank so nennt – innerhalb eines Container-Netzes.
 */
const IM_HAUS = ['localhost', '127.0.0.1', '::1', '[::1]', 'postgres', 'db'];

/**
 * Entscheidet über die Verschlüsselung der Datenbankverbindung.
 *
 * Der Anlass ist eine Falle beim Treiberwechsel: Prismas eigener Treiber
 * verschlüsselte von sich aus, `pg` tut das **nicht**. Ohne diese Entscheidung
 * liefen Passwort, Kundendaten und Rechnungen im Klartext durchs Netz – eine
 * Verschlechterung, die niemand bemerkt hätte, weil alles weiter funktioniert.
 *
 * Drei Fälle:
 *
 *   Wurzelzertifikat hinterlegt   Vollständige Prüfung. Supabase bietet das
 *                                 Zertifikat unter Settings → Database → SSL
 *                                 Configuration an.
 *   eigene Maschine               Keine Verschlüsselung. Eine Datenbank auf
 *                                 `localhost` bietet gewöhnlich gar kein TLS
 *                                 an; würde hier darauf bestanden, ließe sich
 *                                 die Anwendung nicht mehr starten. Über diese
 *                                 Verbindung geht ohnehin kein Kabel.
 *   sonst                         Verschlüsselt, Zertifikat ungeprüft.
 *                                 Mitlesen ist damit ausgeschlossen, ein
 *                                 vorgetäuschter Server nicht – dieselbe Stufe,
 *                                 auf der Prisma bisher lief.
 *
 * Steht in der Adresse ein `sslmode`, gewinnt dieser: `pg` liest die Adresse
 * nach dieser Einstellung und überschreibt sie. Das ist gewollt – wer es
 * ausdrücklich hinschreibt, meint es auch so.
 */
export function tlsFuer(adresse: string | undefined, wurzelzertifikat?: string): TlsWahl {
  const wurzel = wurzelzertifikat?.trim();
  // Zeilenumbrüche dürfen als \n geschrieben sein: Die Weboberflächen von
  // hPanel und Supabase nehmen kein mehrzeiliges Feld an.
  if (wurzel) return { ca: wurzel.replace(/\\n/g, '\n'), rejectUnauthorized: true };

  try {
    return IM_HAUS.includes(new URL(bereinige(adresse ?? '')).hostname)
      ? false
      : { rejectUnauthorized: false };
  } catch {
    // Unlesbare Adresse: Dann lieber verschlüsselt scheitern als unverschlüsselt
    // gelingen.
    return { rejectUnauthorized: false };
  }
}

/**
 * Setzt die bereinigten Adressen zurück in die Umgebung.
 *
 * Prisma liest `DATABASE_URL` selbst aus `process.env`; ein bereinigter Wert
 * muss also dort landen, bevor der Client entsteht.
 */
export function adressenBereinigen(): void {
  for (const name of ['DATABASE_URL', 'DIRECT_URL'] as const) {
    const roh = process.env[name];
    if (!roh) continue;
    const sauber = bereinige(roh);
    if (sauber !== roh) process.env[name] = sauber;
  }
}
