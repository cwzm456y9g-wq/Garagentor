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
  if (/[#?/@]/.test(passwort)) {
    auffaelligkeiten.push(
      'Das Passwort enthält ein Sonderzeichen mit eigener Bedeutung (#, ?, / oder @). Es muss umgeschrieben werden, z. B. # als %23.',
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
