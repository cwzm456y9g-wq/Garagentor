/**
 * Bremse für die Anmeldung.
 *
 * Bis hierher konnte jemand so viele Passwörter durchprobieren, wie der Server
 * beantwortet. Argon2id macht jeden einzelnen Versuch teuer – aber gegen den
 * realistischen Fall hilft das wenig: Wer die Adresse des Betriebs kennt und
 * die zehntausend häufigsten Passwörter durchgeht, kommt damit durch, ohne daß
 * irgendetwas geschieht.
 *
 * Zwei Bremsen greifen unabhängig voneinander:
 *
 * **Je Konto.** Nach mehreren Fehlversuchen wird gesperrt, und die Sperre
 * verdoppelt sich mit jedem weiteren Versuch. Das trifft den gezielten Angriff
 * auf eine bekannte Adresse.
 *
 * **Je Herkunft.** Eine IP-Adresse bekommt nur eine begrenzte Zahl Versuche je
 * Zeitfenster. Das trifft den, der eine Liste von Adressen durchprobiert, und
 * schützt zugleich vor einer zweiten Gefahr: Jede Passwortprüfung kostet 64 MB
 * Speicher, und ohne diese Grenze ließe sich der Server allein durch Hämmern
 * auf das Anmeldeformular lahmlegen.
 *
 * ## Zwei bewußte Einschränkungen
 *
 * Der Stand liegt **im Arbeitsspeicher**, nicht in der Datenbank. Das spart
 * eine Migration am laufenden System und einen Schreibvorgang je Fehlversuch –
 * kostet aber die Zähler bei jedem Neustart. Wer Neustarts nicht auslösen
 * kann, gewinnt dadurch nichts; für den Betrieb ist es der richtige Tausch.
 *
 * Die **Herkunft ist nur so verläßlich wie `x-forwarded-for`**. Hinter dem
 * Proxy des Hosters setzt dieser den Wert, dort stimmt er. Käme die Anwendung
 * je ohne Proxy ans Netz, ließe er sich fälschen – die Kontobremse greift dann
 * weiterhin, die Herkunftsbremse nicht.
 */

/** Wonach gebremst wird. */
export interface Kennung {
  /** Die eingegebene Adresse – auch eine unbekannte. */
  email: string;
  /** Herkunft der Anfrage, soweit bekannt. */
  ip?: string;
}

export interface Grenzen {
  /** Fehlversuche, bis ein Konto gesperrt wird. */
  versucheBisSperre: number;
  /** Wie lange ein Fehlversuch mitzählt. */
  beobachtungsfensterMs: number;
  /** Dauer der ersten Sperre. */
  grundsperreMs: number;
  /** Obergrenze der Sperre, egal wie oft noch versucht wird. */
  hoechstsperreMs: number;
  /** Versuche je Herkunft und Zeitfenster. */
  herkunftVersuche: number;
  herkunftFensterMs: number;
  /** Wieviele Einträge je Tabelle höchstens vorgehalten werden. */
  hoechstzahlEintraege: number;
}

export const GRENZEN: Grenzen = {
  versucheBisSperre: 5,
  beobachtungsfensterMs: 15 * 60_000,
  grundsperreMs: 60_000,
  hoechstsperreMs: 15 * 60_000,
  herkunftVersuche: 30,
  herkunftFensterMs: 15 * 60_000,
  hoechstzahlEintraege: 5_000,
};

export interface Befund {
  erlaubt: boolean;
  /** Verbleibende Wartezeit in Sekunden; 0, wenn erlaubt. */
  wartenSek: number;
  grund: 'konto' | 'herkunft' | null;
}

const FREI: Befund = { erlaubt: true, wartenSek: 0, grund: null };

interface Stand {
  fehlversuche: number;
  /** Beginn des laufenden Zählfensters. */
  seit: number;
  letzterVersuch: number;
  gesperrtBis: number;
}

function neuerStand(jetzt: number): Stand {
  return { fehlversuche: 0, seit: jetzt, letzterVersuch: jetzt, gesperrtBis: 0 };
}

export class Anmeldebremse {
  private readonly konten = new Map<string, Stand>();
  private readonly herkuenfte = new Map<string, Stand>();

  constructor(private readonly grenzen: Grenzen = GRENZEN) {}

  /**
   * Darf dieser Versuch überhaupt gerechnet werden?
   *
   * Die Frage steht bewußt **vor** der Passwortprüfung: Sonst zahlte der
   * Server die 64 MB für Argon2id auch dann, wenn er die Antwort ohnehin
   * verweigert – und genau darüber ließe er sich lahmlegen.
   */
  pruefen(kennung: Kennung, jetzt = Date.now()): Befund {
    const konto = this.konten.get(schluessel(kennung.email));
    if (konto && konto.gesperrtBis > jetzt) {
      return { erlaubt: false, wartenSek: sekunden(konto.gesperrtBis - jetzt), grund: 'konto' };
    }

    if (kennung.ip) {
      const herkunft = this.herkuenfte.get(kennung.ip);
      if (herkunft && jetzt - herkunft.seit < this.grenzen.herkunftFensterMs) {
        if (herkunft.fehlversuche >= this.grenzen.herkunftVersuche) {
          return {
            erlaubt: false,
            wartenSek: sekunden(herkunft.seit + this.grenzen.herkunftFensterMs - jetzt),
            grund: 'herkunft',
          };
        }
      }
    }

    return FREI;
  }

  /**
   * Ein Fehlversuch.
   *
   * Gezählt wird die **eingegebene** Adresse, auch wenn es zu ihr kein Konto
   * gibt. Andernfalls verriete das Sperrverhalten, welche Adressen existieren –
   * und damit wäre die Mühe zunichte, die anderswo in genau diese Frage
   * gesteckt wurde.
   */
  fehlversuch(kennung: Kennung, jetzt = Date.now()): { gesperrt: boolean; wartenSek: number } {
    const konto = this.zaehle(
      this.konten,
      schluessel(kennung.email),
      jetzt,
      this.grenzen.beobachtungsfensterMs,
    );

    if (kennung.ip) {
      this.zaehle(this.herkuenfte, kennung.ip, jetzt, this.grenzen.herkunftFensterMs);
    }

    if (konto.fehlversuche < this.grenzen.versucheBisSperre) {
      return { gesperrt: false, wartenSek: 0 };
    }

    // Jeder weitere Fehlversuch verdoppelt die Sperre, bis zur Obergrenze.
    const stufe = konto.fehlversuche - this.grenzen.versucheBisSperre;
    const dauer = Math.min(this.grenzen.grundsperreMs * 2 ** stufe, this.grenzen.hoechstsperreMs);
    konto.gesperrtBis = jetzt + dauer;

    return { gesperrt: true, wartenSek: sekunden(dauer) };
  }

  /** Eine geglückte Anmeldung räumt das Konto ab; die Herkunft bleibt gezählt. */
  erfolg(kennung: Kennung): void {
    this.konten.delete(schluessel(kennung.email));
  }

  /** Für die Tests und die Betriebsschau. */
  stand(): { konten: number; herkuenfte: number } {
    return { konten: this.konten.size, herkuenfte: this.herkuenfte.size };
  }

  private zaehle(
    tabelle: Map<string, Stand>,
    name: string,
    jetzt: number,
    fensterMs: number,
  ): Stand {
    let stand = tabelle.get(name);

    // Ein abgelaufenes Fenster beginnt von vorn – sonst zählte ein Fehlgriff
    // von vorletzter Woche noch gegen den heutigen Versuch.
    if (!stand || (jetzt - stand.seit >= fensterMs && stand.gesperrtBis <= jetzt)) {
      stand = neuerStand(jetzt);
      tabelle.set(name, stand);
    }

    stand.fehlversuche += 1;
    stand.letzterVersuch = jetzt;

    if (tabelle.size > this.grenzen.hoechstzahlEintraege)
      this.aufraeumen(tabelle, jetzt, fensterMs);
    return stand;
  }

  /**
   * Hält die Tabellen klein.
   *
   * Ohne das ließe sich die Bremse gegen den Server wenden: Wer Anmeldungen
   * mit Millionen erfundener Adressen schickt, legte für jede einen Eintrag an
   * und triebe den Speicher hoch. Zuerst fliegt alles Abgelaufene; reicht das
   * nicht, das Älteste.
   */
  private aufraeumen(tabelle: Map<string, Stand>, jetzt: number, fensterMs: number): void {
    for (const [name, stand] of tabelle) {
      if (jetzt - stand.letzterVersuch >= fensterMs && stand.gesperrtBis <= jetzt) {
        tabelle.delete(name);
      }
    }

    if (tabelle.size <= this.grenzen.hoechstzahlEintraege) return;

    // Eine laufende Sperre wird nie weggeräumt, auch nicht als ältester
    // Eintrag. Sonst gäbe es einen stillen Ausweg: Wer gesperrt ist, flutet
    // die Tabelle mit erfundenen Adressen und läßt sich dadurch freiräumen.
    // Lieber wächst die Tabelle über ihren Deckel hinaus – die Zahl der
    // gleichzeitig Gesperrten ist von sich aus begrenzt.
    const entbehrlich = [...tabelle.entries()]
      .filter(([, stand]) => stand.gesperrtBis <= jetzt)
      .sort((a, b) => a[1].letzterVersuch - b[1].letzterVersuch);

    const zuviel = Math.min(tabelle.size - this.grenzen.hoechstzahlEintraege, entbehrlich.length);
    for (let i = 0; i < zuviel; i++) tabelle.delete(entbehrlich[i][0]);
  }
}

function schluessel(email: string): string {
  return email.trim().toLowerCase();
}

function sekunden(ms: number): number {
  return Math.max(1, Math.ceil(ms / 1000));
}

/**
 * Die Bremse des laufenden Prozesses.
 *
 * Auf dem Webhosting läuft genau einer; käme die Anwendung je auf mehrere,
 * hätte jeder seine eigenen Zähler und die Bremse wirkte entsprechend
 * schwächer. Dann wäre der Zeitpunkt, sie in die Datenbank zu verlegen.
 */
export const anmeldebremse = new Anmeldebremse();
