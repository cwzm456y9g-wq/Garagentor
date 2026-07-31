import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { DoorStatus, DoorType, OperationMode } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
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
} from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';

export class CreateDoorDto {
  @ApiPropertyOptional()
  @IsString()
  customerId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  siteId?: string;

  @ApiPropertyOptional({ enum: DoorType })
  @IsEnum(DoorType)
  type: DoorType;

  @ApiPropertyOptional({
    enum: OperationMode,
    default: OperationMode.KRAFTBETAETIGT,
    description: 'Kraftbetätigte Anlagen unterliegen der Prüfpflicht nach ASR A1.7',
  })
  @IsOptional()
  @IsEnum(OperationMode)
  operationMode?: OperationMode;

  @ApiPropertyOptional({ enum: DoorStatus })
  @IsOptional()
  @IsEnum(DoorStatus)
  status?: DoorStatus;

  @ApiPropertyOptional({ description: 'Einbauort, z. B. "Halle 2, Tor Nord"' })
  @IsString()
  @MaxLength(200)
  location: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  manufacturer?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  model?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  serialNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1900)
  @Max(2200)
  yearBuilt?: number;

  @ApiPropertyOptional({ description: 'Lichte Breite in Millimetern' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(50_000)
  widthMm?: number;

  @ApiPropertyOptional({ description: 'Lichte Höhe in Millimetern' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(50_000)
  heightMm?: number;

  @ApiPropertyOptional({ description: 'Torblattgewicht in Kilogramm' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  weightKg?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  driveManufacturer?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  driveModel?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  driveSerialNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  installationDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  warrantyUntil?: string;

  @ApiPropertyOptional({ description: 'Ohne Angabe aus Einbaudatum + Prüfintervall ermittelt' })
  @IsOptional()
  @IsDateString()
  nextInspectionDue?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  notes?: string;
}

export class UpdateDoorDto extends PartialType(CreateDoorDto) {}

export class DoorQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  customerId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  siteId?: string;

  @ApiPropertyOptional({ enum: DoorType })
  @IsOptional()
  @IsEnum(DoorType)
  type?: DoorType;

  @ApiPropertyOptional({ enum: DoorStatus })
  @IsOptional()
  @IsEnum(DoorStatus)
  status?: DoorStatus;

  @ApiPropertyOptional({ enum: OperationMode })
  @IsOptional()
  @IsEnum(OperationMode)
  operationMode?: OperationMode;

  @ApiPropertyOptional({ description: 'Nur Anlagen mit fälliger oder überfälliger Prüfung' })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  inspectionDue?: boolean;
}
