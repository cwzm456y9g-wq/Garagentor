import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { NUMBER_RANGE_DEFAULTS } from '@garagentor/shared';
import { Prisma } from '@prisma/client';
import { NumberRangeService } from '../common/numbering/number-range.service';
import { PrismaService } from '../prisma/prisma.service';
import type { UpdateNumberRangeDto, UpsertSettingDto } from './dto/settings.dto';

@Injectable()
export class SettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly numbers: NumberRangeService,
  ) {}

  async findAll(category?: string) {
    return this.prisma.setting.findMany({
      where: category ? { category } : {},
      orderBy: [{ category: 'asc' }, { key: 'asc' }],
    });
  }

  async findOne(key: string) {
    const setting = await this.prisma.setting.findUnique({ where: { key } });
    if (!setting) {
      throw new NotFoundException(`Die Einstellung "${key}" ist nicht hinterlegt.`);
    }
    return setting;
  }

  /** Legt eine Einstellung an oder ersetzt ihren Wert. */
  async upsert(key: string, dto: UpsertSettingDto) {
    return this.prisma.setting.upsert({
      where: { key },
      update: {
        value: dto.value as Prisma.InputJsonValue,
        ...(dto.category === undefined ? {} : { category: dto.category }),
        ...(dto.description === undefined ? {} : { description: dto.description }),
      },
      create: {
        key,
        value: dto.value as Prisma.InputJsonValue,
        category: dto.category ?? 'allgemein',
        description: dto.description ?? null,
      },
    });
  }

  async remove(key: string) {
    await this.findOne(key);
    await this.prisma.setting.delete({ where: { key } });
    return { deleted: true, key };
  }

  /* Nummernkreise ------------------------------------------------------ */

  async findNumberRanges() {
    const ranges = await this.prisma.numberRange.findMany({ orderBy: { entity: 'asc' } });
    const configured = new Set(ranges.map((range) => range.entity));

    // Noch nicht angelegte Nummernkreise erscheinen mit ihren Vorgaben.
    const missing = NUMBER_RANGE_DEFAULTS.filter((item) => !configured.has(item.entity)).map(
      (item) => ({
        entity: item.entity,
        prefix: item.prefix,
        suffix: '',
        nextNumber: 1,
        padding: item.padding,
        yearlyReset: item.yearlyReset,
        currentYear: new Date().getFullYear(),
        updatedAt: null,
        konfiguriert: false,
      }),
    );

    return [...ranges.map((range) => ({ ...range, konfiguriert: true })), ...missing].sort((a, b) =>
      a.entity.localeCompare(b.entity),
    );
  }

  /**
   * Ändert einen Nummernkreis. Der Zähler darf nicht zurückgesetzt werden,
   * damit keine Belegnummer doppelt vergeben wird.
   */
  async updateNumberRange(entity: string, dto: UpdateNumberRangeDto) {
    const known = NUMBER_RANGE_DEFAULTS.some((item) => item.entity === entity);
    if (!known) {
      throw new BadRequestException(`Für "${entity}" ist kein Nummernkreis vorgesehen.`);
    }

    const existing = await this.prisma.numberRange.findUnique({ where: { entity } });

    if (dto.nextNumber !== undefined && existing && dto.nextNumber < existing.nextNumber) {
      throw new BadRequestException(
        `Der Zähler kann nicht unter den erreichten Wert ${existing.nextNumber} gesetzt werden.`,
      );
    }

    const defaults = NUMBER_RANGE_DEFAULTS.find((item) => item.entity === entity)!;
    const year = new Date().getFullYear();

    return this.prisma.numberRange.upsert({
      where: { entity },
      update: {
        ...(dto.prefix === undefined ? {} : { prefix: dto.prefix }),
        ...(dto.suffix === undefined ? {} : { suffix: dto.suffix }),
        ...(dto.padding === undefined ? {} : { padding: dto.padding }),
        ...(dto.yearlyReset === undefined ? {} : { yearlyReset: dto.yearlyReset }),
        ...(dto.nextNumber === undefined ? {} : { nextNumber: dto.nextNumber }),
      },
      create: {
        entity,
        prefix: dto.prefix ?? defaults.prefix,
        suffix: dto.suffix ?? '',
        padding: dto.padding ?? defaults.padding,
        yearlyReset: dto.yearlyReset ?? defaults.yearlyReset,
        nextNumber: dto.nextNumber ?? 1,
        currentYear: year,
      },
    });
  }

  /** Zeigt die nächste Nummer, ohne den Zähler zu verändern. */
  async previewNumber(entity: string) {
    const known = NUMBER_RANGE_DEFAULTS.find((item) => item.entity === entity);
    if (!known) {
      throw new BadRequestException(`Für "${entity}" ist kein Nummernkreis vorgesehen.`);
    }
    return { entity, naechsteNummer: await this.numbers.preview(known.entity) };
  }
}
