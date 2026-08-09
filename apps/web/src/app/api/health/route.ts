import { offen } from '@/server/anmeldung';
import { json } from '@/server/antwort';
import { prisma } from '@/server/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Ohne Anmeldung erreichbar: Überwachung und Hostinger sollen die Anwendung
// prüfen können, ohne Zugangsdaten zu hinterlegen. Preisgegeben wird nichts
// außer der Erreichbarkeit.
export const GET = offen(async () => {
  let database = 'ok';
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    database = 'nicht erreichbar';
  }

  return json({
    status: database === 'ok' ? 'ok' : 'eingeschränkt',
    database,
    timestamp: new Date().toISOString(),
  });
});
