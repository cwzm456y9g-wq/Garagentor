import { Role } from '@prisma/client';
import { abfrage } from '@/server/anfrage';
import { geschuetzt } from '@/server/anmeldung';
import { json } from '@/server/antwort';
import { mailService } from '@/server/dienste/mail/mail.service';
import { mailLogQuerySchema } from '@/server/dienste/mail/dto/mail.dto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = geschuetzt(
  async (anfrage) => json(await mailService.findAll(abfrage(anfrage, mailLogQuerySchema))),
  [Role.GESCHAEFTSFUEHRUNG, Role.BUERO, Role.BUCHHALTUNG],
);
