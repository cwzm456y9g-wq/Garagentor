import { geschuetzt } from '@/server/anmeldung';
import { datei } from '@/server/antwort';
import { pdf } from '@/server/dienste/pdf/pdf.service';

// @react-pdf/renderer erzeugt das Dokument im Node-Prozess; auf Edge liefe es
// nicht. Zwischenspeichern verbietet sich, weil Belege Kundendaten tragen.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = geschuetzt<{ id: string }>(async (_anfrage, { params }) => {
  const { buffer, dateiname } = await pdf.servicebericht(params.id);
  // `inline`: der Beleg soll sich im Browser ansehen lassen, das Herunterladen
  // bleibt trotzdem möglich.
  return datei(buffer, { typ: 'application/pdf', name: dateiname, anhang: false });
});
