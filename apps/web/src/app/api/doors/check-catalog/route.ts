import { OperationMode } from '@prisma/client';
import { ASR_A17_CHECK_CATALOG, CLOSING_FORCE_LIMITS, checkCatalogFor } from '@garagentor/shared';
import { z } from 'zod';
import { abfrage } from '@/server/anfrage';
import { geschuetzt } from '@/server/anmeldung';
import { json } from '@/server/antwort';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const schema = z.object({ operationMode: z.nativeEnum(OperationMode).optional() });

// Der Prüfkatalog nach ASR A1.7 samt der Grenzwerte für die Kraftmessung.
// Er kommt aus dem geteilten Paket, nicht aus der Datenbank – die Grenzwerte
// stehen in der Norm und sind nicht Sache einer Einstellung.
export const GET = geschuetzt(async (anfrage) => {
  const { operationMode } = abfrage(anfrage, schema);
  return json({
    checks: operationMode ? checkCatalogFor(operationMode) : ASR_A17_CHECK_CATALOG,
    forceLimits: CLOSING_FORCE_LIMITS,
  });
});
