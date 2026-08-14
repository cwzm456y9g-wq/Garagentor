import { deflateRawSync } from 'node:zlib';

/**
 * Ein ZIP-Archiv aus dem Stand.
 *
 * Für ein Format, das aus drei Blöcken besteht und seit 1989 unverändert ist,
 * lohnt keine zusätzliche Abhängigkeit – dieselbe Überlegung wie bei der
 * Umwandlung nach Windows-1252 nebenan. Gepackt wird mit `zlib`, das in Node
 * ohnehin steckt.
 *
 * Aufbau, damit beim Nachlesen niemand raten muss:
 *
 *   je Datei   ein lokaler Kopf, direkt gefolgt von den gepackten Daten
 *   danach     das Inhaltsverzeichnis, ein Eintrag je Datei
 *   zum Schluß der Abschlußblock mit Anzahl und Lage des Verzeichnisses
 *
 * Bewußt nicht unterstützt: ZIP64 (Archive über 4 GB), Verschlüsselung und
 * Ordnereinträge. Ordner entstehen aus den Schrägstrichen in den Namen; jedes
 * Entpackprogramm legt sie danach an.
 */

/** Über dieser Größe stimmen die 32-Bit-Felder im Archiv nicht mehr. */
const GRENZE_BYTES = 0xffffffff;

const KOPF_LOKAL = 0x04034b50;
const KOPF_VERZEICHNIS = 0x02014b50;
const KOPF_ABSCHLUSS = 0x06054b50;

/** Namen dürfen UTF-8 sein, wenn Bit 11 gesetzt ist. */
const FLAGGE_UTF8 = 0x0800;

/** 8 = deflate; 0 wäre unkomprimiert. */
const VERFAHREN_DEFLATE = 8;

const CRC_TABELLE = (() => {
  const tabelle = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let wert = i;
    for (let bit = 0; bit < 8; bit++) {
      wert = wert & 1 ? 0xedb88320 ^ (wert >>> 1) : wert >>> 1;
    }
    tabelle[i] = wert >>> 0;
  }
  return tabelle;
})();

/** Prüfsumme, wie sie das ZIP-Format je Datei erwartet. */
export function crc32(daten: Buffer): number {
  let wert = 0xffffffff;
  for (const byte of daten) {
    wert = CRC_TABELLE[(wert ^ byte) & 0xff] ^ (wert >>> 8);
  }
  return (wert ^ 0xffffffff) >>> 0;
}

/**
 * Zeitstempel im MS-DOS-Format.
 *
 * Sekunden zählen in Zweierschritten, das Jahr beginnt bei 1980 – daher die
 * ungewohnte Rechnung. Vor 1980 gibt es keine darstellbare Zeit; ein
 * Datum davor wird auf den 1. Januar 1980 gesetzt, statt Unsinn zu schreiben.
 */
function dosZeit(zeitpunkt: Date): { zeit: number; datum: number } {
  const jahr = zeitpunkt.getFullYear();
  if (jahr < 1980) return { zeit: 0, datum: (1 << 5) | 1 };

  return {
    zeit:
      (zeitpunkt.getHours() << 11) |
      (zeitpunkt.getMinutes() << 5) |
      Math.floor(zeitpunkt.getSeconds() / 2),
    datum: ((jahr - 1980) << 9) | ((zeitpunkt.getMonth() + 1) << 5) | zeitpunkt.getDate(),
  };
}

/** Eine Datei im Archiv. */
export interface ZipEintrag {
  /** Pfad im Archiv, mit Schrägstrichen: `tabellen/kunden.csv`. */
  name: string;
  inhalt: Buffer | string;
  /** Änderungszeitpunkt; ohne Angabe der Zeitpunkt des Packens. */
  zeitpunkt?: Date;
}

/**
 * Packt die Einträge zu einem Archiv.
 *
 * Alles liegt dabei im Speicher. Für eine Sicherung eines Handwerksbetriebs
 * ist das angemessen – ginge es um Größenordnungen darüber, müßte man das
 * Archiv strömen lassen, und dann wäre eine Bibliothek die richtige Wahl.
 */
export function zipBauen(eintraege: ZipEintrag[]): Buffer {
  // Der Abschlußblock zählt die Dateien in 16 Bit. Mehr ginge nur mit ZIP64.
  if (eintraege.length > 0xffff) {
    throw new Error(`Ein einfaches ZIP faßt höchstens ${0xffff} Dateien.`);
  }

  const stuecke: Buffer[] = [];
  const verzeichnis: Buffer[] = [];
  let versatz = 0;

  for (const eintrag of eintraege) {
    const name = Buffer.from(eintrag.name, 'utf8');
    const roh = Buffer.isBuffer(eintrag.inhalt)
      ? eintrag.inhalt
      : Buffer.from(eintrag.inhalt, 'utf8');

    if (roh.byteLength > GRENZE_BYTES) {
      throw new Error(`Die Datei „${eintrag.name}" ist für ein einfaches ZIP zu groß.`);
    }

    const gepackt = deflateRawSync(roh, { level: 6 });
    const pruefsumme = crc32(roh);
    const { zeit, datum } = dosZeit(eintrag.zeitpunkt ?? new Date());

    const lokal = Buffer.alloc(30);
    lokal.writeUInt32LE(KOPF_LOKAL, 0);
    lokal.writeUInt16LE(20, 4); // benötigte Version
    lokal.writeUInt16LE(FLAGGE_UTF8, 6);
    lokal.writeUInt16LE(VERFAHREN_DEFLATE, 8);
    lokal.writeUInt16LE(zeit, 10);
    lokal.writeUInt16LE(datum, 12);
    lokal.writeUInt32LE(pruefsumme, 14);
    lokal.writeUInt32LE(gepackt.byteLength, 18);
    lokal.writeUInt32LE(roh.byteLength, 22);
    lokal.writeUInt16LE(name.byteLength, 26);
    lokal.writeUInt16LE(0, 28); // kein Zusatzfeld

    stuecke.push(lokal, name, gepackt);

    const eintragImVerzeichnis = Buffer.alloc(46);
    eintragImVerzeichnis.writeUInt32LE(KOPF_VERZEICHNIS, 0);
    eintragImVerzeichnis.writeUInt16LE(20, 4); // erzeugende Version
    eintragImVerzeichnis.writeUInt16LE(20, 6); // benötigte Version
    eintragImVerzeichnis.writeUInt16LE(FLAGGE_UTF8, 8);
    eintragImVerzeichnis.writeUInt16LE(VERFAHREN_DEFLATE, 10);
    eintragImVerzeichnis.writeUInt16LE(zeit, 12);
    eintragImVerzeichnis.writeUInt16LE(datum, 14);
    eintragImVerzeichnis.writeUInt32LE(pruefsumme, 16);
    eintragImVerzeichnis.writeUInt32LE(gepackt.byteLength, 20);
    eintragImVerzeichnis.writeUInt32LE(roh.byteLength, 24);
    eintragImVerzeichnis.writeUInt16LE(name.byteLength, 28);
    eintragImVerzeichnis.writeUInt16LE(0, 30); // Zusatzfeld
    eintragImVerzeichnis.writeUInt16LE(0, 32); // Kommentar
    eintragImVerzeichnis.writeUInt16LE(0, 34); // Datenträger
    eintragImVerzeichnis.writeUInt16LE(0, 36); // interne Merkmale
    eintragImVerzeichnis.writeUInt32LE(0, 38); // externe Merkmale
    eintragImVerzeichnis.writeUInt32LE(versatz, 42);

    verzeichnis.push(eintragImVerzeichnis, name);

    versatz += lokal.byteLength + name.byteLength + gepackt.byteLength;
    if (versatz > GRENZE_BYTES) {
      throw new Error('Das Archiv überschreitet 4 GB; dafür wäre ZIP64 nötig.');
    }
  }

  const verzeichnisBlock = Buffer.concat(verzeichnis);

  const abschluss = Buffer.alloc(22);
  abschluss.writeUInt32LE(KOPF_ABSCHLUSS, 0);
  abschluss.writeUInt16LE(0, 4); // Datenträger
  abschluss.writeUInt16LE(0, 6); // Datenträger mit Verzeichnisanfang
  abschluss.writeUInt16LE(eintraege.length, 8);
  abschluss.writeUInt16LE(eintraege.length, 10);
  abschluss.writeUInt32LE(verzeichnisBlock.byteLength, 12);
  abschluss.writeUInt32LE(versatz, 16);
  abschluss.writeUInt16LE(0, 20); // kein Archivkommentar

  return Buffer.concat([...stuecke, verzeichnisBlock, abschluss]);
}
