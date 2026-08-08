import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { InvoiceStatus, InvoiceType, PaymentMethod } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
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

export class CreateInvoiceDto {
  @ApiPropertyOptional()
  @IsString()
  customerId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  orderId?: string;

  @ApiPropertyOptional({ enum: InvoiceType, default: InvoiceType.RECHNUNG })
  @IsOptional()
  @IsEnum(InvoiceType)
  type?: InvoiceType;

  @ApiPropertyOptional()
  @IsString()
  @MaxLength(300)
  subject: string;

  @ApiPropertyOptional({ description: 'Rechnungsdatum; Standard ist heute' })
  @IsOptional()
  @IsDateString()
  date?: string;

  @ApiPropertyOptional({ description: 'Standard: Rechnungsdatum + Zahlungsziel des Kunden' })
  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @ApiPropertyOptional({ description: 'Leistungsdatum für den Steuerausweis' })
  @IsOptional()
  @IsDateString()
  serviceDate?: string;

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

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  discountPercent?: number;

  @ApiPropertyOptional({ description: 'Skontosatz in Prozent; ohne Angabe aus den Einstellungen' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(20)
  skontoPercent?: number;

  @ApiPropertyOptional({ description: 'Skontofrist in Tagen ab Rechnungsdatum' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(90)
  skontoDays?: number;

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

export class UpdateInvoiceDto extends PartialType(CreateInvoiceDto) {}

export class InvoiceQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: InvoiceStatus })
  @IsOptional()
  @IsEnum(InvoiceStatus)
  status?: InvoiceStatus;

  @ApiPropertyOptional({ enum: InvoiceType })
  @IsOptional()
  @IsEnum(InvoiceType)
  type?: InvoiceType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  customerId?: string;

  @ApiPropertyOptional({ description: 'Nur offene Posten' })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  openOnly?: boolean;

  @ApiPropertyOptional({ description: 'Nur überfällige Rechnungen' })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  overdueOnly?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  to?: string;
}

export class CreatePaymentDto {
  @ApiPropertyOptional({ description: 'Zahlbetrag in Euro' })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01, { message: 'Der Zahlbetrag muss größer als null sein.' })
  amount: number;

  @ApiPropertyOptional({ description: 'Zahlungsdatum; Standard ist heute' })
  @IsOptional()
  @IsDateString()
  date?: string;

  @ApiPropertyOptional({ enum: PaymentMethod, default: PaymentMethod.UEBERWEISUNG })
  @IsOptional()
  @IsEnum(PaymentMethod)
  method?: PaymentMethod;

  @ApiPropertyOptional({ description: 'Verwendungszweck oder Belegnummer' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  reference?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}

export class CancelInvoiceDto {
  @ApiPropertyOptional({ description: 'Grund der Stornierung' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reason?: string;
}
