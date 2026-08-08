import { Prisma } from '@prisma/client';

/**
 * Prisma liefert Decimal-Spalten als `Prisma.Decimal`, das sich in JSON als
 * String darstellt. Damit Oberfläche und Server dieselben Rechenhelfer aus
 * @garagentor/shared nutzen können, werden alle Decimal-Werte hier in Zahlen
 * umgewandelt. Datumsangaben bleiben unverändert und werden von der
 * JSON-Serialisierung als ISO-String ausgegeben.
 *
 * Das lief bisher als globaler Interceptor in NestJS. Ohne diesen Schritt
 * käme jeder Geldbetrag als String im Browser an – und `"456.25" + "9.13"`
 * ergibt dort keinen Fehler, sondern stillschweigend Unsinn.
 */
export function alsZahlen(wert: unknown, tiefe = 0): unknown {
  // Schutz vor zyklischen oder ungewöhnlich tiefen Strukturen.
  if (tiefe > 12 || wert === null || wert === undefined) return wert;

  if (Prisma.Decimal.isDecimal(wert)) {
    return (wert as Prisma.Decimal).toNumber();
  }

  if (wert instanceof Date || typeof wert !== 'object') return wert;

  if (Array.isArray(wert)) {
    return wert.map((eintrag) => alsZahlen(eintrag, tiefe + 1));
  }

  if (Buffer.isBuffer(wert)) return wert;

  // Nur einfache Objekte umbauen, keine Klasseninstanzen wie Ströme.
  const bauplan = Object.getPrototypeOf(wert);
  if (bauplan !== Object.prototype && bauplan !== null) return wert;

  const ergebnis: Record<string, unknown> = {};
  for (const [schluessel, eintrag] of Object.entries(wert as Record<string, unknown>)) {
    ergebnis[schluessel] = alsZahlen(eintrag, tiefe + 1);
  }
  return ergebnis;
}

/** Die übliche Antwort: JSON, Beträge als Zahlen. */
export function json(daten: unknown, status = 200): Response {
  if (daten === undefined || status === 204) {
    return new Response(null, { status: status === 200 ? 204 : status });
  }
  return Response.json(alsZahlen(daten), { status });
}

/** Antwort mit Datei-Inhalt, etwa für erzeugte PDFs oder Ausleitungen. */
export function datei(
  inhalt: Uint8Array | string,
  optionen: { typ: string; name: string; anhang?: boolean },
): Response {
  const anordnung = optionen.anhang === false ? 'inline' : 'attachment';
  // Der Dateiname wird zweifach angegeben: einmal schlicht für ältere
  // Browser, einmal nach RFC 5987 für Umlaute.
  const schlicht = optionen.name.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '');
  const koerper = typeof inhalt === 'string' ? inhalt : (inhalt as unknown as BodyInit);

  return new Response(koerper, {
    headers: {
      'Content-Type': optionen.typ,
      'Content-Disposition':
        `${anordnung}; filename="${schlicht}"; ` +
        `filename*=UTF-8''${encodeURIComponent(optionen.name)}`,
      // Belege enthalten Kundendaten und gehören in keinen Zwischenspeicher.
      'Cache-Control': 'no-store',
    },
  });
}
