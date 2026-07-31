import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { calculateDocumentTotals, type DocumentTotals } from '@garagentor/shared';
import { LineItemType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

/**
 * Position eines Belegs. Angebot, Auftrag und Rechnung verwenden dieselbe
 * Struktur, damit ein Beleg ohne Umbau in den nächsten überführt werden kann.
 */
export class LineItemDto {
  @ApiPropertyOptional({ enum: LineItemType, default: LineItemType.LEISTUNG })
  @IsOptional()
  @IsEnum(LineItemType)
  type: LineItemType = LineItemType.LEISTUNG;

  @ApiPropertyOptional({ description: 'Übernimmt Bezeichnung und Preis aus dem Artikelstamm' })
  @IsOptional()
  @IsString()
  articleId?: string;

  @ApiProperty()
  @IsString()
  @MaxLength(300)
  title: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  description?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(-999_999)
  @Max(999_999)
  quantity: number = 1;

  @ApiPropertyOptional({ default: 'Stk' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  unit: string = 'Stk';

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(-9_999_999)
  @Max(9_999_999)
  unitPrice: number = 0;

  @ApiPropertyOptional({ description: 'Positionsrabatt in Prozent', default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  discountPercent: number = 0;

  @ApiPropertyOptional({ description: 'Umsatzsteuersatz in Prozent', default: 19 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  vatRate: number = 19;

  @ApiPropertyOptional({ description: 'Nur bei Angeboten: Position ist optional' })
  @IsOptional()
  @IsBoolean()
  optional?: boolean;
}

/** In der Datenbank abzulegende Positionszeile. */
export interface PreparedLineItem {
  position: number;
  type: LineItemType;
  articleId: string | null;
  title: string;
  description: string | null;
  quantity: number;
  unit: string;
  unitPrice: number;
  discountPercent: number;
  vatRate: number;
  netAmount: number;
  /** Nur für Angebotspositionen gesetzt; andere Belegarten kennen kein Feld dafür. */
  optional?: boolean;
}

/** Entfernt das nur für Angebote gültige Feld `optional`. */
export function withoutOptionalFlag(item: PreparedLineItem): Omit<PreparedLineItem, 'optional'> {
  const rest = { ...item };
  delete rest.optional;
  return rest;
}

/**
 * Nummeriert die Positionen fortlaufend und berechnet Netto je Zeile sowie die
 * Belegsummen. Optionale Angebotspositionen bleiben außen vor, weil sie erst
 * mit der Beauftragung Teil der Summe werden.
 */
export function prepareLineItems(
  items: LineItemDto[],
  discountPercent = 0,
): { prepared: PreparedLineItem[]; totals: DocumentTotals } {
  const prepared = items.map((item, index) => {
    const { netAmount } = calculateDocumentTotals([
      {
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        discountPercent: item.discountPercent,
        vatRate: item.vatRate,
        type: item.type,
      },
    ]);

    return {
      position: index + 1,
      type: item.type,
      articleId: item.articleId ?? null,
      title: item.title,
      description: item.description ?? null,
      quantity: item.quantity,
      unit: item.unit,
      unitPrice: item.unitPrice,
      discountPercent: item.discountPercent,
      vatRate: item.vatRate,
      netAmount,
      ...(item.optional === undefined ? {} : { optional: item.optional }),
    };
  });

  const totals = calculateDocumentTotals(
    items
      .filter((item) => !item.optional)
      .map((item) => ({
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        discountPercent: item.discountPercent,
        vatRate: item.vatRate,
        type: item.type,
      })),
    discountPercent,
  );

  return { prepared, totals };
}
