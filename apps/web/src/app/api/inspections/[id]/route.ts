import { Role } from '@prisma/client';
import { geschuetzt } from '@/server/anmeldung';
import { json } from '@/server/antwort';
import { inspectionsService } from '@/server/dienste/doors/inspections.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = geschuetzt<{ id: string }>(async (_anfrage, { params }) => {
  return json(await inspectionsService.findOne(params.id));
});

/**
 * Entfernt ein angefangenes Prüfprotokoll.
 *
 * Ein abgeschlossenes weist der Dienst ab – es ist der Nachweis der Prüfung.
 * Deshalb steht die Berechtigung hier auch nicht bei den Monteuren: Wer ein
 * Protokoll an der falschen Anlage begonnen hat, meldet sich im Büro.
 */
export const DELETE = geschuetzt<{ id: string }>(
  async (_anfrage, { params }) => json(await inspectionsService.remove(params.id)),
  [Role.GESCHAEFTSFUEHRUNG, Role.BUERO],
);
