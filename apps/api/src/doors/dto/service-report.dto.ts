import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { MaintenanceContractStatus, ServiceReportStatus } from '@prisma/client';
import { Type } from 'class-transformer';
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

export class ServiceMaterialDto {
  @ApiPropertyOptional({ description: 'Verbrauchter Lagerartikel' })
  @IsOptional()
  @IsString()
  articleId?: string;

  @ApiPropertyOptional()
  @IsString()
  @MaxLength(300)
  name: string;

  @ApiPropertyOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  quantity: number;

  @ApiPropertyOptional({ default: 'Stk' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  unit?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  unitPrice?: number;
}

export class CreateServiceReportDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  orderId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  doorId?: string;

  @ApiPropertyOptional({ description: 'Ausführender Monteur' })
  @IsOptional()
  @IsString()
  technicianId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  date?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  arrivalTime?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  departureTime?: string;

  @ApiPropertyOptional({ description: 'Arbeitszeit in Stunden' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(24)
  workHours?: number;

  @ApiPropertyOptional({ description: 'Fahrtzeit in Stunden' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(24)
  travelHours?: number;

  @ApiPropertyOptional({ description: 'Gefahrene Kilometer' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  travelKm?: number;

  @ApiPropertyOptional({ description: 'Vom Kunden geschilderte Störung' })
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  faultDescription?: string;

  @ApiPropertyOptional({ description: 'Ausgeführte Arbeiten' })
  @IsString()
  @MaxLength(4000)
  workPerformed: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  followUpRequired?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  followUpNote?: string;

  @ApiPropertyOptional({ type: [ServiceMaterialDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => ServiceMaterialDto)
  materials?: ServiceMaterialDto[];
}

export class UpdateServiceReportDto extends PartialType(CreateServiceReportDto) {}

export class CompleteServiceReportDto {
  @ApiPropertyOptional({ description: 'Unterschrift des Kunden als Data-URL' })
  @IsOptional()
  @IsString()
  @MaxLength(500_000)
  signatureCustomer?: string;

  @ApiPropertyOptional({ description: 'Unterschrift des Monteurs als Data-URL' })
  @IsOptional()
  @IsString()
  @MaxLength(500_000)
  signatureTechnician?: string;

  @ApiPropertyOptional({ description: 'Name der unterzeichnenden Person' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  signedByName?: string;

  @ApiPropertyOptional({
    description: 'Verbrauchtes Material aus dem Lager ausbuchen',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  deductStock?: boolean;
}

export class ServiceReportQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  orderId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  doorId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  technicianId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  customerId?: string;

  @ApiPropertyOptional({ enum: ServiceReportStatus })
  @IsOptional()
  @IsEnum(ServiceReportStatus)
  status?: ServiceReportStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  to?: string;
}

/* Wartungsverträge ---------------------------------------------------- */

export class CreateMaintenanceContractDto {
  @ApiPropertyOptional()
  @IsString()
  customerId: string;

  @ApiPropertyOptional()
  @IsString()
  @MaxLength(300)
  title: string;

  @ApiPropertyOptional({ description: 'Wartungsintervall in Monaten', default: 12 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(120)
  intervalMonths?: number;

  @ApiPropertyOptional({ description: 'Pauschale je Wartungseinsatz' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  price?: number;

  @ApiPropertyOptional()
  @IsDateString()
  startDate: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ description: 'Kündigungsfrist in Monaten', default: 3 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(24)
  noticePeriodMonths?: number;

  @ApiPropertyOptional({ description: 'Enthält die wiederkehrende Prüfung nach ASR A1.7' })
  @IsOptional()
  @IsBoolean()
  includesInspection?: boolean;

  @ApiPropertyOptional({ description: 'Abgedeckte Toranlagen', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  doorIds?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  notes?: string;
}

export class UpdateMaintenanceContractDto extends PartialType(CreateMaintenanceContractDto) {
  @ApiPropertyOptional({ enum: MaintenanceContractStatus })
  @IsOptional()
  @IsEnum(MaintenanceContractStatus)
  status?: MaintenanceContractStatus;
}

export class MaintenanceContractQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  customerId?: string;

  @ApiPropertyOptional({ enum: MaintenanceContractStatus })
  @IsOptional()
  @IsEnum(MaintenanceContractStatus)
  status?: MaintenanceContractStatus;

  @ApiPropertyOptional({ description: 'Nur Verträge mit fälliger Wartung' })
  @IsOptional()
  @Type(() => Boolean)
  dueOnly?: boolean;
}

export class RecordMaintenanceDto {
  @ApiPropertyOptional({ description: 'Datum des Wartungseinsatzes; Standard ist heute' })
  @IsOptional()
  @IsDateString()
  date?: string;
}
