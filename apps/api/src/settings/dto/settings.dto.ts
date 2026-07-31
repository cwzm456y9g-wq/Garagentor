import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDefined,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class UpsertSettingDto {
  @ApiProperty({ description: 'Beliebiger JSON-Wert', type: Object })
  @IsDefined({ message: 'Es muss ein Wert angegeben werden.' })
  value: unknown;

  @ApiPropertyOptional({ default: 'allgemein' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  category?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}

export class UpdateNumberRangeDto {
  @ApiPropertyOptional({ description: 'Präfix, z. B. "RE-"' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  prefix?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20)
  suffix?: string;

  @ApiPropertyOptional({ description: 'Stellenzahl des Zählers', minimum: 1, maximum: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10)
  padding?: number;

  @ApiPropertyOptional({ description: 'Zähler jährlich zurücksetzen' })
  @IsOptional()
  @IsBoolean()
  yearlyReset?: boolean;

  @ApiPropertyOptional({ description: 'Nächste Nummer; darf nicht verkleinert werden' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  nextNumber?: number;
}
