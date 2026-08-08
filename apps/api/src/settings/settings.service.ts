import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { NUMBER_RANGE_DEFAULTS } from '@garagentor/shared';
import { Prisma } from '@prisma/client';
import { NumberRangeService } from '../common/numbering/number-range.service';
import { PrismaService } from '../prisma/prisma.service';
import type { SavePresetDto, UpdateNumberRangeDto, UpsertSettingDto } from './dto/settings.dto';

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
    this.pruefeWert(key, dto.value);
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

  /* Vorlagen ----------------------------------------------------------- */

  async findPresets(settingKey: string) {
    return this.prisma.settingPreset.findMany({
      where: { settingKey },
      orderBy: [{ favorite: 'desc' }, { name: 'asc' }],
    });
  }

  /**
   * Hält einen Stand unter einem Namen fest. Ohne übergebenen Wert wird der
   * aktuelle Inhalt der Einstellung gesichert; ein gleichnamiger Eintrag wird
   * überschrieben, damit „nochmal speichern“ nicht scheitert.
   */
  async savePreset(settingKey: string, dto: SavePresetDto) {
    const name = dto.name.trim();
    if (!name) {
      throw new BadRequestException('Die Vorlage braucht einen Namen.');
    }

    const wert = dto.value === undefined ? (await this.findOne(settingKey)).value : dto.value;
    this.pruefeWert(settingKey, wert);

    return this.prisma.$transaction(async (tx) => {
      if (dto.favorite) {
        await tx.settingPreset.updateMany({ where: { settingKey }, data: { favorite: false } });
      }
      return tx.settingPreset.upsert({
        where: { settingKey_name: { settingKey, name } },
        update: { value: wert as Prisma.InputJsonValue, favorite: dto.favorite ?? false },
        create: {
          settingKey,
          name,
          value: wert as Prisma.InputJsonValue,
          favorite: dto.favorite ?? false,
        },
      });
    });
  }

  /** Markiert eine Vorlage als Favorit; die bisherige verliert die Markierung. */
  async markPresetFavorite(settingKey: string, id: string) {
    const vorlage = await this.findPreset(settingKey, id);
    return this.prisma.$transaction(async (tx) => {
      await tx.settingPreset.updateMany({ where: { settingKey }, data: { favorite: false } });
      return tx.settingPreset.update({ where: { id: vorlage.id }, data: { favorite: true } });
    });
  }

  /** Setzt eine Vorlage als aktuellen Stand der Einstellung ein. */
  async applyPreset(settingKey: string, id: string) {
    const vorlage = await this.findPreset(settingKey, id);
    return this.upsert(settingKey, { value: vorlage.value });
  }

  async removePreset(settingKey: string, id: string) {
    const vorlage = await this.findPreset(settingKey, id);
    await this.prisma.settingPreset.delete({ where: { id: vorlage.id } });
    return { deleted: true, id: vorlage.id };
  }

  private async findPreset(settingKey: string, id: string) {
    const vorlage = await this.prisma.settingPreset.findUnique({ where: { id } });
    // Der Schlüssel muss passen, sonst ließe sich über einen fremden Pfad eine
    // Vorlage einer anderen Einstellung einsetzen.
    if (!vorlage || vorlage.settingKey !== settingKey) {
      throw new NotFoundException('Die Vorlage ist nicht hinterlegt.');
    }
    return vorlage;
  }

  /* Prüfung besonderer Einstellungen ----------------------------------- */

  /** Erlaubte Bildarten für das Logo. */
  private static readonly LOGO_TYPEN = ['image/svg+xml', 'image/png', 'image/jpeg', 'image/webp'];

  /** Obergrenze des Logos nach dem Dekodieren. */
  private static readonly LOGO_MAX_BYTES = 512 * 1024;

  /**
   * Das Logo liegt als Data-URL in der Einstellung „firma“: es ist eine einzige
   * kleine Datei, wird so von der Sicherung der Datenbank mit erfasst und lässt
   * sich beim Erzeugen der Belege unmittelbar einbetten. Ungeprüft würde hier
   * beliebiger Inhalt landen, deshalb die Kontrolle von Art und Größe.
   */
  private pruefeWert(key: string, value: unknown): void {
    if (key !== 'firma' || value === null || typeof value !== 'object') return;

    const logo = (value as { logo?: unknown }).logo;
    if (logo === undefined || logo === null || logo === '') return;

    if (typeof logo !== 'string') {
      throw new BadRequestException('Das Logo muss als Data-URL übergeben werden.');
    }

    const treffer = /^data:([a-z0-9+/.-]+);base64,([A-Za-z0-9+/=]+)$/i.exec(logo);
    if (!treffer) {
      throw new BadRequestException(
        'Das Logo muss eine Data-URL in Base64 sein, z. B. "data:image/png;base64,…".',
      );
    }

    const [, typ, daten] = treffer;
    if (!SettingsService.LOGO_TYPEN.includes(typ.toLowerCase())) {
      throw new BadRequestException(
        `Der Bildtyp "${typ}" ist nicht zugelassen. Erlaubt sind SVG, PNG, JPEG und WebP.`,
      );
    }

    // Base64 trägt vier Zeichen je drei Byte; das Füllzeichen zählt nicht mit.
    const bytes =
      Math.floor((daten.length * 3) / 4) - (daten.endsWith('==') ? 2 : daten.endsWith('=') ? 1 : 0);
    if (bytes > SettingsService.LOGO_MAX_BYTES) {
      throw new BadRequestException(
        `Das Logo ist ${Math.round(bytes / 1024)} kB groß; erlaubt sind ${
          SettingsService.LOGO_MAX_BYTES / 1024
        } kB.`,
      );
    }
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
