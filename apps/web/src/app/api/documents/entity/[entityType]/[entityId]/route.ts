import { EntityType } from '@prisma/client';
import { z } from 'zod';
import { geschuetzt } from '@/server/anmeldung';
import { json } from '@/server/antwort';
import { documents } from '@/server/dienste/documents/documents.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const artSchema = z.nativeEnum(EntityType);

export const GET = geschuetzt<{ entityType: string; entityId: string }>(
  async (_anfrage, { params }) => {
    return json(await documents.forEntity(artSchema.parse(params.entityType), params.entityId));
  },
);
