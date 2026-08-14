import { geschuetzt } from '@/server/anmeldung';
import { datei } from '@/server/antwort';
import { pdf } from '@/server/dienste/pdf/pdf.service';

// @react-pdf/renderer erzeugt das Dokument im Node-Prozess; auf Edge liefe es
// nicht. Zwischenspeichern verbietet sich, weil Belege Kundendaten tragen.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Die Bescheinigung für den Kunden – Ergebnis ohne die Einzelprüfpunkte.
 *
 * Das vollständige Protokoll liegt unter `/pdf` und bleibt im Haus.
 */
export const GET = geschuetzt<{ id: string }>(async (_anfrage, { params }) => {
  const { buffer, dateiname } = await pdf.pruefbescheinigung(params.id);
  return datei(buffer, { typ: 'application/pdf', name: dateiname, anhang: false });
});
