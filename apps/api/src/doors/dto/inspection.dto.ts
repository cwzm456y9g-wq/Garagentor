import { ApiPropertyOptional } from '@nestjs/swagger';
import { CheckResult, DefectSeverity, DefectStatus, InspectionType } from '@prisma/client';
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
import { PaginationQueryDto } from '../../common/dto/pagination.dto';

/** Startet ein Prüfprotokoll; die Prüfpunkte kommen aus dem Katalog. */
export class StartInspectionDto {
  @ApiPropertyOptional({ enum: InspectionType, default: InspectionType.WIEDERKEHRENDE_PRUEFUNG })
  @IsOptional()
  @IsEnum(InspectionType)
  type?: InspectionType;

  @ApiPropertyOptional({ description: 'Prüfdatum; Standard ist heute' })
  @IsOptional()
  @IsDateString()
  date?: string;

  @ApiPropertyOptional({ description: 'Sachkundige Person aus dem Mitarbeiterstamm' })
  @IsOptional()
  @IsString()
  inspectorId?: string;

  @ApiPropertyOptional({ description: 'Name der prüfenden Person, auch bei Fremdprüfung' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  inspectorName?: string;

  @ApiPropertyOptional({ description: 'Zugehöriger Auftrag' })
  @IsOptional()
  @IsString()
  orderId?: string;
}

export class InspectionCheckResultDto {
  @ApiPropertyOptional({ description: 'Schlüssel des Prüfpunkts aus dem Katalog' })
  @IsString()
  @MaxLength(60)
  key: string;

  @ApiPropertyOptional({ enum: CheckResult })
  @IsEnum(CheckResult)
  result: CheckResult;

  @ApiPropertyOptional({ description: 'Messwert, z. B. Schließkraft in Newton' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  measuredValue?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  comment?: string;
}

/** Trägt die Ergebnisse einzelner Prüfpunkte nach. */
export class RecordChecksDto {
  @ApiPropertyOptional({ type: [InspectionCheckResultDto] })
  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => InspectionCheckResultDto)
  checks: InspectionCheckResultDto[];
}

export class CompleteInspectionDto {
  @ApiPropertyOptional({
    description: 'Ohne Angabe wird das Ergebnis aus den Prüfpunkten abgeleitet',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  summary?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  recommendation?: string;

  @ApiPropertyOptional({ description: 'Unterschrift der prüfenden Person als Data-URL' })
  @IsOptional()
  @IsString()
  @MaxLength(500_000)
  signatureInspector?: string;

  @ApiPropertyOptional({ description: 'Unterschrift des Kunden als Data-URL' })
  @IsOptional()
  @IsString()
  @MaxLength(500_000)
  signatureCustomer?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  signedByName?: string;

  @ApiPropertyOptional({
    description:
      'Abweichende Prüffrist in Monaten; Standard ist das Intervall aus den Einstellungen',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(120)
  intervalMonths?: number;
}

export class InspectionQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  doorId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  customerId?: string;

  @ApiPropertyOptional({ enum: InspectionType })
  @IsOptional()
  @IsEnum(InspectionType)
  type?: InspectionType;

  @ApiPropertyOptional({ description: 'Nur noch nicht abgeschlossene Protokolle' })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  openOnly?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  to?: string;
}

export class CreateDefectDto {
  @ApiPropertyOptional({ enum: DefectSeverity, default: DefectSeverity.GERING })
  @IsOptional()
  @IsEnum(DefectSeverity)
  severity?: DefectSeverity;

  @ApiPropertyOptional()
  @IsString()
  @MaxLength(300)
  title: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  description?: string;

  @ApiPropertyOptional({ description: 'Prüfpunkt, aus dem der Mangel hervorgeht' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  checkKey?: string;

  @ApiPropertyOptional({ description: 'Ohne Angabe je nach Schweregrad ermittelt' })
  @IsOptional()
  @IsDateString()
  dueDate?: string;
}

export class ResolveDefectDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  resolvedNote?: string;
}

export class DefectQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  doorId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  customerId?: string;

  @ApiPropertyOptional({ enum: DefectStatus })
  @IsOptional()
  @IsEnum(DefectStatus)
  status?: DefectStatus;

  @ApiPropertyOptional({ enum: DefectSeverity })
  @IsOptional()
  @IsEnum(DefectSeverity)
  severity?: DefectSeverity;

  @ApiPropertyOptional({ description: 'Nur Mängel mit überschrittener Frist' })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  overdueOnly?: boolean;
}
