import { geschuetzt } from '@/server/anmeldung';
import { json } from '@/server/antwort';
import { mailService } from '@/server/dienste/mail/mail.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Zeigt nur, ob ein Postausgang eingerichtet ist – die Zugangsdaten selbst
// verlassen den Server nicht.
export const GET = geschuetzt(async () => json(mailService.status()));
