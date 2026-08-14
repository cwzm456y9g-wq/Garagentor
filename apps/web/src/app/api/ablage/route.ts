import { geschuetzt } from '@/server/anmeldung';
import { json } from '@/server/antwort';
import { ablageStatus } from '@/server/ablage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Zustand der Dateiablage.
 *
 * Wie beim Postausgang verläßt der Schlüssel den Server nicht – gemeldet wird
 * nur, ob einer gesetzt ist.
 */
export const GET = geschuetzt(async () => json(ablageStatus()));
