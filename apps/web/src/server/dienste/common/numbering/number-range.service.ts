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
    if (!existing) await this.createDefault(entity, year, client);

    // Ein einziges UPDATE zählt hoch und sperrt die Zeile dabei bis zum Ende
    // der Transaktion.
    //
    // Vorher wurde erst gelesen und dann ein ausgerechneter Wert geschrieben.
    // Zwei gleichzeitige Belege lasen denselben Stand und bekamen dieselbe
    // Nummer; gerettet hat nur die Eindeutigkeit in der Datenbank – als
    // Fehlermeldung. Nachgemessen: von sechs gleichzeitig angelegten Angeboten
    // kam genau eines durch, fünf scheiterten an „quoteNumber existiert
    // bereits". Zwei Leute im Büro genügen dafür.
    const erhoeht = await client.numberRange.update({
      where: { entity },
      data: { nextNumber: { increment: 1 } },
    });

    // Bei Jahreswechsel beginnt die Nummerierung wieder bei 1. Der Zähler steht
    // hier schon eins weiter; er wird auf 2 gesetzt, weil die 1 gerade
    // vergeben wird. Wer gleichzeitig anfragt, wartet an der Sperre und sieht
    // danach das neue Jahr.
    if (erhoeht.yearlyReset && erhoeht.currentYear !== year) {
      const zurueckgesetzt = await client.numberRange.update({
        where: { entity },
        data: { nextNumber: 2, currentYear: year },
      });
      return this.format(zurueckgesetzt.prefix, zurueckgesetzt.suffix, 1, zurueckgesetzt.padding, {
        yearlyReset: true,
        year,
      });
    }

    return this.format(
      erhoeht.prefix,
      erhoeht.suffix,
      // `update` liefert den Stand danach – vergeben wird der davor.
      erhoeht.nextNumber - 1,
      erhoeht.padding,
      { yearlyReset: erhoeht.yearlyReset, year },
    );
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
    // `upsert` statt `create`: Legen zwei Aufrufe den Kreis im selben Moment
    // zum ersten Mal an, soll der zweite den ersten vorfinden und nicht an der
    // Eindeutigkeit scheitern. Das `update` bleibt leer – ein bestehender
    // Kreis darf sich dabei nicht verändern.
    return client.numberRange.upsert({
      where: { entity },
      update: {},
      create: {
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
