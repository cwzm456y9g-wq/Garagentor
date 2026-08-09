import { DunningLevel, DunningStatus } from '@prisma/client';
import { z } from 'zod';
import { paginationSchema } from '@/server/anfrage';

/** Eingabeprüfung für das Mahnwesen. Aus class-validator übersetzt. */
export const dunningQuerySchema = z.intersection(
  paginationSchema,
  z.object({
    status: z.nativeEnum(DunningStatus).optional(),
  }),
);

export type DunningQueryDto = z.infer<typeof dunningQuerySchema>;

export const createDunningSchema = z
  .object({
    /** Ohne Angabe wird die nächste fällige Mahnstufe verwendet. */
    level: z.nativeEnum(DunningLevel).optional(),
  })
  .strict();

export type CreateDunningDto = z.infer<typeof createDunningSchema>;
