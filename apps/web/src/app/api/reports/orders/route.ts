import { geschuetzt } from '@/server/anmeldung';
import { json } from '@/server/antwort';
import { reportsService } from '@/server/dienste/reports/reports.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = geschuetzt(async () => json(await reportsService.orderStatistics()));
