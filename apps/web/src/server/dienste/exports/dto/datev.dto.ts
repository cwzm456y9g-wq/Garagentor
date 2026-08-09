import { z } from 'zod';

const datum = z.string().refine((wert) => !Number.isNaN(Date.parse(wert)), {
  message: 'Bitte ein gültiges Datum angeben.',
});

/** Zeitraum für den DATEV-Buchungsstapel. */
export const datevQuerySchema = z.object({
  /** Erster Tag des Zeitraums, z. B. 2026-01-01. */
  von: datum,
  /** Letzter Tag des Zeitraums, einschließlich. */
  bis: datum,
});

export type DatevQueryDto = z.infer<typeof datevQuerySchema>;
