import { z } from 'zod';

/** Eingabeprüfung für Einstellungen, Vorlagen und Nummernkreise. */
export const upsertSettingSchema = z
  .object({
    /** Beliebiger JSON-Wert. */
    value: z.unknown().refine((wert) => wert !== undefined, {
      message: 'Es muss ein Wert angegeben werden.',
    }),
    category: z.string().max(50).optional(),
    description: z.string().max(500).optional(),
  })
  .strict();

export type UpsertSettingDto = z.infer<typeof upsertSettingSchema>;

export const savePresetSchema = z
  .object({
    /** Name der Vorlage, z. B. „Briefkopf 2026". */
    name: z.string().max(80),
    /** Festzuhaltender Wert; ohne Angabe wird der aktuelle Stand gesichert. */
    value: z.unknown().optional(),
    /** Gleich als Favorit markieren. */
    favorite: z.boolean().optional(),
  })
  .strict();

export type SavePresetDto = z.infer<typeof savePresetSchema>;

export const updateNumberRangeSchema = z
  .object({
    /** Präfix, z. B. „RE-". */
    prefix: z.string().max(20).optional(),
    suffix: z.string().max(20).optional(),
    /** Stellenzahl des Zählers. */
    padding: z.number().int().min(1).max(10).optional(),
    /** Zähler jährlich zurücksetzen. */
    yearlyReset: z.boolean().optional(),
    /**
     * Nächste Nummer; darf nicht verkleinert werden. Eine Belegnummer zweimal
     * zu vergeben wäre nach GoBD ein Bruch der fortlaufenden Nummerierung –
     * die Prüfung darauf sitzt im Dienst.
     */
    nextNumber: z.number().int().min(1).optional(),
  })
  .strict();

export type UpdateNumberRangeDto = z.infer<typeof updateNumberRangeSchema>;
