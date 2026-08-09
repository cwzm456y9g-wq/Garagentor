import type { PrismaClient } from '@prisma/client';
import { prisma } from '@/server/prisma';

import { NUMBER_RANGE_DEFAULTS } from '@garagentor/shared';
import { type Prisma } from '@prisma/client';

/** Entitäten mit eigenem Nummernkreis. */
export type NumberedEntity = (typeof NUMBER_RANGE_DEFAULTS)[number]['entity'];

export class NumberRangeService {
  /**
   * Vergibt die nächste Belegnummer und zählt den Nummernkreis atomar hoch.
   *
   * Der Aufruf muss in derselben Transaktion erfolgen wie das Anlegen des
   * Belegs, damit bei einem Fehlschlag keine Lücke in der Nummernfolge
   * entsteht. Ist kein Nummernkreis hinterlegt, wird er aus den Vorgaben in
   * @garagentor/shared angelegt.
   */
  async next(entity: NumberedEntity, tx?: Prisma.TransactionClient): Promise<string> {
    const client = tx ?? prisma;
    const year = new Date().getFullYear();

    const existing = await client.numberRange.findUnique({ where: { entity } });
    const range = existing ?? (await this.createDefault(entity, year, client));

    // Bei Jahreswechsel beginnt die Nummerierung wieder bei 1.
    const resetNeeded = range.yearlyReset && range.currentYear !== year;
    const number = resetNeeded ? 1 : range.nextNumber;

    const updated = await client.numberRange.update({
      where: { entity },
      data: { nextNumber: number + 1, currentYear: year },
    });

    return this.format(updated.prefix, updated.suffix, number, updated.padding, {
      yearlyReset: updated.yearlyReset,
      year,
    });
  }

  /** Zeigt die nächste Nummer an, ohne den Zähler zu verändern. */
  async preview(entity: NumberedEntity): Promise<string> {
    const year = new Date().getFullYear();
    const range = await prisma.numberRange.findUnique({ where: { entity } });
    if (!range) {
      const fallback = NUMBER_RANGE_DEFAULTS.find((item) => item.entity === entity);
      if (!fallback) return `${entity}-1`;
      return this.format(fallback.prefix, '', 1, fallback.padding, {
        yearlyReset: fallback.yearlyReset,
        year,
      });
    }

    const number = range.yearlyReset && range.currentYear !== year ? 1 : range.nextNumber;
    return this.format(range.prefix, range.suffix, number, range.padding, {
      yearlyReset: range.yearlyReset,
      year,
    });
  }

  private async createDefault(
    entity: NumberedEntity,
    year: number,
    client: Prisma.TransactionClient | PrismaClient,
  ) {
    const defaults = NUMBER_RANGE_DEFAULTS.find((item) => item.entity === entity);
    return client.numberRange.create({
      data: {
        entity,
        prefix: defaults?.prefix ?? '',
        padding: defaults?.padding ?? 4,
        yearlyReset: defaults?.yearlyReset ?? true,
        nextNumber: 1,
        currentYear: year,
      },
    });
  }

  /** Beispiel: `RE-2026-0042` bzw. `K-00042` ohne Jahresreset. */
  private format(
    prefix: string,
    suffix: string,
    number: number,
    padding: number,
    options: { yearlyReset: boolean; year: number },
  ): string {
    const counter = `${number}`.padStart(padding, '0');
    const yearPart = options.yearlyReset ? `${options.year}-` : '';
    return `${prefix}${yearPart}${counter}${suffix}`;
  }
}

export const numbers = new NumberRangeService();
