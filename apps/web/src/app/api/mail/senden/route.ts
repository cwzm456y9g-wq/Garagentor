import { rumpf } from '@/server/anfrage';
import { geschuetzt } from '@/server/anmeldung';
import { json } from '@/server/antwort';
import { mailService } from '@/server/dienste/mail/mail.service';
import { sendMailSchema } from '@/server/dienste/mail/dto/mail.dto';
import { pruefeVersandrecht } from '@/server/dienste/mail/versandrechte';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = geschuetzt(async (anfrage, { benutzer }) => {
  const eingabe = await rumpf(anfrage, sendMailSchema);
  pruefeVersandrecht(eingabe.art, benutzer.role);
  return json(await mailService.senden(eingabe));
});
