import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { OrderType, QuoteStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { LineItemDto } from '../../common/dto/line-item.dto';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';

export class CreateQuoteDto {
  @ApiPropertyOptional()
  @IsString()
  customerId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  siteId?: string;

  @ApiPropertyOptional()
  @IsString()
  @MaxLength(300)
  subject: string;

  @ApiPropertyOptional({ description: 'Angebotsdatum; Standard ist heute' })
  @IsOptional()
  @IsDateString()
  date?: string;

  @ApiPropertyOptional({ description: 'Standard: Angebotsdatum + 30 Tage' })
  @IsOptional()
  @IsDateString()
  validUntil?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  introText?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  outroText?: string;

  @ApiPropertyOptional({ description: 'Gesamtrabatt in Prozent', default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  discountPercent?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  notes?: string;

  @ApiPropertyOptional({ type: [LineItemDto] })
  @IsArray()
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => LineItemDto)
  items: LineItemDto[] = [];
}

export class UpdateQuoteDto extends PartialType(CreateQuoteDto) {}

export class QuoteQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: QuoteStatus })
  @IsOptional()
  @IsEnum(QuoteStatus)
  status?: QuoteStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  customerId?: string;

  @ApiPropertyOptional({ description: 'Angebote ab diesem Datum' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ description: 'Angebote bis zu diesem Datum' })
  @IsOptional()
  @IsDateString()
  to?: string;
}

export class RejectQuoteDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reason?: string;
}

export class ConvertQuoteDto {
  @ApiPropertyOptional({ enum: OrderType, default: OrderType.MONTAGE })
  @IsOptional()
  @IsEnum(OrderType)
  type?: OrderType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  plannedStart?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  plannedEnd?: string;

  @ApiPropertyOptional({ description: 'Bestellnummer oder Aktenzeichen des Kunden' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  customerReference?: string;

  @ApiPropertyOptional({
    description: 'Optionale Angebotspositionen, die mit beauftragt werden',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  includeOptionalItemIds?: string[];
}
