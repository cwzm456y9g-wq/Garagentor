import { Prisma } from '@prisma/client';
import { Logger } from '@/server/nest-ersatz';
import { prisma } from '@/server/prisma';
import { documents } from '../documents/documents.service';
import { csvDatei, fuerJson } from './tabelle';
import { zipBauen, type ZipEintrag } from './zip';

/**
 * Vollständige Sicherung aller Daten – zum Herunterladen und Weglegen.
 *
 * Der Zweck ist nicht der tägliche Betrieb, sondern der Tag, an dem etwas
 * fehlt: ein versehentlich gelöschter Kunde, ein Anbieterwechsel, eine
 * Betriebsprüfung, die Unterlagen sehen will. Deshalb liegt in der Sicherung
 * jede Tabelle zweimal – als CSV zum Ansehen und als JSON zum Wiedereinspielen
 * – und dazu ein Zettel, der erklärt, was darin steht.
 *
 * Die Tabellenliste steht bewußt **nicht** von Hand in dieser Datei. Sie kommt
 * aus dem Datenmodell selbst, sonst fehlte in der Sicherung genau die Tabelle,
 * die zuletzt dazukam – und das fiele erst auf, wenn man sie braucht. Eine
 * Prüfung im Testlauf hält dagegen fest, daß keine Tabelle unbeabsichtigt
 * herausfällt.
 */

/** Tabellen, die nicht in eine Sicherung gehören. */
const AUSGENOMMEN = new Set([
  // Anmeldungen laufen ohnehin ab und wären nach dem Einspielen wertlos –
  // in einer Datei auf einem Rechner sind sie nur ein Risiko.
  'RefreshToken',
]);

/**
 * Felder, die geschwärzt werden.
 *
 * Die Regel greift über den Namen, nicht über eine Liste: Käme morgen ein
 * zweites Geheimnis ins Datenmodell, wäre es sonst am Tag seiner Einführung in
 * jeder Sicherung enthalten. Lieber ein Feld zuviel geschwärzt – welche es
 * traf, steht in der Liesmich-Datei.
 */
const GEHEIM = /passwort|password|hash|token|secret|geheim/i;

/** Wieviel an Dokumenten höchstens mitgepackt wird. */
const DOKUMENTE_GRENZE_BYTES = 200 * 1024 * 1024;

interface Tabellenstand {
  modell: string;
  tabelle: string;
  zeilen: number;
  geschwaerzt: string[];
}

export class SicherungService {
  private readonly logger = new Logger(SicherungService.name);

  /** Alle Modelle des Datenmodells, ohne die ausgenommenen. */
  private modelle() {
    return Prisma.dmmf.datamodel.models.filter((modell) => !AUSGENOMMEN.has(modell.name));
  }

  /**
   * Der Zugriffsname am Prisma-Klienten.
   *
   * Prisma benennt die Zugriffe wie das Modell, nur mit kleinem Anfang:
   * `ServiceReport` wird zu `serviceReport`.
   */
  private zugriff(modell: string): string {
    return modell.charAt(0).toLowerCase() + modell.slice(1);
  }

  private async tabelleLesen(modell: (typeof Prisma.dmmf.datamodel.models)[number]) {
    const spalten = modell.fields
      .filter((feld) => feld.kind === 'scalar' || feld.kind === 'enum')
      .map((feld) => feld.name);

    const geschwaerzt = spalten.filter((spalte) => GEHEIM.test(spalte));
    const sichtbar = spalten.filter((spalte) => !GEHEIM.test(spalte));

    const delegat = (
      prisma as unknown as Record<string, { findMany: (a: unknown) => Promise<unknown[]> }>
    )[this.zugriff(modell.name)];

    // Feste Reihenfolge, damit zwei Sicherungen vergleichbar bleiben.
    const roh = (await delegat.findMany({
      select: Object.fromEntries(sichtbar.map((spalte) => [spalte, true])),
      orderBy: sichtbar.includes('id') ? { id: 'asc' } : undefined,
    })) as Array<Record<string, unknown>>;

    return { spalten: sichtbar, geschwaerzt, zeilen: roh };
  }

  /**
   * Baut die Sicherung.
   *
   * `mitDokumenten` holt zusätzlich die hochgeladenen Dateien aus der Ablage.
   * Ohne sie enthält die Sicherung nur deren Verzeichnis: Belege lassen sich
   * aus den Daten neu erzeugen, ein Foto von der Baustelle nicht.
   */
  async archiv(mitDokumenten = false): Promise<{ inhalt: Buffer; dateiname: string }> {
    const zeitpunkt = new Date();
    const eintraege: ZipEintrag[] = [];
    const stand: Tabellenstand[] = [];

    for (const modell of this.modelle()) {
      const { spalten, geschwaerzt, zeilen } = await this.tabelleLesen(modell);
      const tabelle = modell.dbName ?? modell.name;

      eintraege.push({
        name: `tabellen/${tabelle}.csv`,
        inhalt: csvDatei(spalten, zeilen),
        zeitpunkt,
      });

      eintraege.push({
        name: `daten/${tabelle}.json`,
        inhalt: JSON.stringify(
          zeilen.map((zeile) =>
            Object.fromEntries(spalten.map((spalte) => [spalte, fuerJson(zeile[spalte])])),
          ),
          null,
          2,
        ),
        zeitpunkt,
      });

      stand.push({ modell: modell.name, tabelle, zeilen: zeilen.length, geschwaerzt });
    }

    const dokumente = mitDokumenten ? await this.dokumente(eintraege, zeitpunkt) : null;

    eintraege.unshift({
      name: 'LIESMICH.txt',
      inhalt: this.liesmich(zeitpunkt, stand, dokumente),
      zeitpunkt,
    });

    const inhalt = zipBauen(eintraege);
    const gesamt = stand.reduce((summe, eintrag) => summe + eintrag.zeilen, 0);
    this.logger.log(
      `Sicherung erstellt: ${stand.length} Tabellen, ${gesamt} Datensätze, ` +
        `${Math.round(inhalt.byteLength / 1024)} kB`,
    );

    return { inhalt, dateiname: `Garagentor-Sicherung-${this.stempel(zeitpunkt)}.zip` };
  }

  /** Holt die hochgeladenen Dateien dazu, bis das Größenmaß erreicht ist. */
  private async dokumente(eintraege: ZipEintrag[], zeitpunkt: Date) {
    const liste = await prisma.document.findMany({
      select: { id: true, originalName: true, size: true, category: true },
      orderBy: { createdAt: 'asc' },
    });

    let gesamt = 0;
    const dabei: string[] = [];
    const fehlend: string[] = [];

    for (const eintrag of liste) {
      if (gesamt + eintrag.size > DOKUMENTE_GRENZE_BYTES) {
        fehlend.push(`${eintrag.originalName} (zu groß für dieses Archiv)`);
        continue;
      }

      try {
        const { inhalt } = await documents.fileFor(eintrag.id);
        // Die Kennung im Namen hält zwei gleichnamige Fotos auseinander.
        eintraege.push({
          name: `dokumente/${eintrag.category}/${eintrag.id}-${this.dateiname(eintrag.originalName)}`,
          inhalt,
          zeitpunkt,
        });
        gesamt += inhalt.byteLength;
        dabei.push(eintrag.originalName);
      } catch (fehler) {
        // Eine fehlende Datei darf die ganze Sicherung nicht verhindern; sie
        // wird stattdessen im Liesmich benannt.
        this.logger.warn(`Dokument ${eintrag.id} nicht lesbar: ${fehler}`);
        fehlend.push(`${eintrag.originalName} (nicht lesbar)`);
      }
    }

    return { dabei: dabei.length, fehlend, bytes: gesamt };
  }

  /** Entschärft einen Dateinamen für das Archiv. */
  private dateiname(name: string): string {
    return name.replace(/[/\\:*?"<>|]/g, '_').slice(0, 100) || 'datei';
  }

  private stempel(zeitpunkt: Date): string {
    const zwei = (wert: number) => String(wert).padStart(2, '0');
    return (
      `${zeitpunkt.getFullYear()}-${zwei(zeitpunkt.getMonth() + 1)}-${zwei(zeitpunkt.getDate())}` +
      `-${zwei(zeitpunkt.getHours())}${zwei(zeitpunkt.getMinutes())}`
    );
  }

  /** Der Zettel, der der Sicherung beiliegt. */
  private liesmich(
    zeitpunkt: Date,
    stand: Tabellenstand[],
    dokumente: { dabei: number; fehlend: string[]; bytes: number } | null,
  ): string {
    const breite = Math.max(...stand.map((eintrag) => eintrag.tabelle.length));
    const zeilen = stand
      .slice()
      .sort((a, b) => a.tabelle.localeCompare(b.tabelle, 'de'))
      .map(
        (eintrag) =>
          `  ${eintrag.tabelle.padEnd(breite)}  ${String(eintrag.zeilen).padStart(6)} Datensätze` +
          (eintrag.geschwaerzt.length > 0 ? `   (ohne ${eintrag.geschwaerzt.join(', ')})` : ''),
      );

    const gesamt = stand.reduce((summe, eintrag) => summe + eintrag.zeilen, 0);

    return [
      'Sicherung der Garagentor-Anwendung',
      '==================================',
      '',
      `Erstellt am ${zeitpunkt.toLocaleString('de-DE')}`,
      `Umfang: ${stand.length} Tabellen mit zusammen ${gesamt} Datensätzen`,
      '',
      'Was liegt hier drin',
      '-------------------',
      '',
      'tabellen/   Je Tabelle eine CSV-Datei. Zum Ansehen und Auswerten – sie',
      '            öffnet sich in Excel oder LibreOffice mit Doppelklick.',
      '            Zahlen und Daten stehen in deutscher Schreibweise, die',
      '            Spalten sind durch Semikolon getrennt.',
      '',
      'daten/      Dieselben Tabellen als JSON. Diese Dateien sind für die',
      '            Maschine gedacht: Zahlen als Zahlen, Zeitpunkte nach',
      '            ISO 8601, keine Rundung. Aus ihnen läßt sich der Bestand',
      '            wieder einspielen.',
      '',
      ...(dokumente
        ? [
            'dokumente/  Die hochgeladenen Dateien, nach Kategorie geordnet.',
            `            ${dokumente.dabei} Datei(en), ${Math.round(dokumente.bytes / 1024)} kB.`,
            '',
          ]
        : [
            'Die hochgeladenen Dateien (Fotos, eingescannte Unterlagen) sind in',
            'dieser Sicherung NICHT enthalten – nur ihr Verzeichnis in der Tabelle',
            '"documents". Für eine Sicherung mitsamt den Dateien den Haken',
            '„Hochgeladene Dateien mitsichern" setzen.',
            '',
          ]),
      ...(dokumente && dokumente.fehlend.length > 0
        ? [
            'Nicht mitgesichert werden konnten:',
            ...dokumente.fehlend.map((name) => `  - ${name}`),
            '',
          ]
        : []),
      'Was NICHT drin ist, und warum',
      '-----------------------------',
      '',
      'Kennwörter stehen nirgends in dieser Sicherung, auch nicht verschlüsselt.',
      'Nach dem Wiedereinspielen müssen die Zugänge neu vergeben werden. Das ist',
      'Absicht: Eine Datei, die auf einem Rechner oder einer Festplatte liegt,',
      'ist der falsche Ort für Anmeldedaten.',
      '',
      'Angemeldete Sitzungen fehlen aus demselben Grund.',
      '',
      'Womit umgehen',
      '-------------',
      '',
      'Diese Datei enthält den vollständigen Kundenstamm und Personaldaten. Sie',
      'unterliegt der Datenschutz-Grundverordnung: Sie gehört an einen Ort, zu',
      'dem sonst niemand Zugang hat – verschlüsselte Festplatte, abgeschlossener',
      'Schrank – und nicht in einen Mailanhang oder eine offene Wolke.',
      '',
      'Für steuerlich erhebliche Unterlagen gilt die Aufbewahrungsfrist nach',
      'GoBD; eine Sicherung ersetzt die geordnete Ablage nicht, sie ergänzt sie.',
      '',
      'Tabellen im einzelnen',
      '---------------------',
      '',
      ...zeilen,
      '',
    ].join('\n');
  }
}

export const sicherung = new SicherungService();
