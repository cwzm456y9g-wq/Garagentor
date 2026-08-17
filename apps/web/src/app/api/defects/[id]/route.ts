import { Role } from '@prisma/client';
import { geschuetzt } from '@/server/anmeldung';
import { json } from '@/server/antwort';
import { inspectionsService } from '@/server/dienste/doors/inspections.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Entfernt einen offenen Mangel.
 *
 * Bisher gab es unter dieser Adresse gar keinen Endpunkt – nur die
 * Unterpfade zum Beheben und zum Statuswechsel. Ein versehentlich angelegter
 * Mangel ließ sich deshalb nirgends wieder loswerden und stand für immer in
 * der Mängelliste der Anlage.
 *
 * Der Dienst zieht die Grenze: Ein behobener Mangel dokumentiert eine
 * Instandsetzung, ein Mangel aus einem abgeschlossenen Protokoll gehört zu
 * dessen Befund. Beides bleibt.
 */
export const DELETE = geschuetzt<{ id: string }>(
  async (_anfrage, { params }) => json(await inspectionsService.removeDefect(params.id)),
  [Role.GESCHAEFTSFUEHRUNG, Role.BUERO],
);
