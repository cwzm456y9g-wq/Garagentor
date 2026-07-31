import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { AddressType, CustomerType, Salutation } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
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
import { CustomerHasName } from './customer-name.validator';

export class CreateCustomerDto {
  /** Trägt die Prüfung, dass je nach Kundenart ein Name gesetzt ist. */
  @ApiPropertyOptional({ enum: CustomerType, default: CustomerType.PRIVAT })
  @IsOptional()
  @IsEnum(CustomerType)
  @CustomerHasName()
  type: CustomerType = CustomerType.PRIVAT;

  @ApiPropertyOptional({ enum: Salutation })
  @IsOptional()
  @IsEnum(Salutation)
  salutation?: Salutation;

  @ApiPropertyOptional({ description: 'Pflicht für alle Kundenarten außer PRIVAT' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  companyName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  firstName?: string;

  @ApiPropertyOptional({ description: 'Pflicht für Privatkunden' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  lastName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail({}, { message: 'Bitte eine gültige E-Mail-Adresse angeben.' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(50)
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(50)
  mobile?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  website?: string;

  @ApiPropertyOptional({ description: 'Umsatzsteuer-Identifikationsnummer' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  vatId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(30)
  taxNumber?: string;

  @ApiPropertyOptional({ default: 14 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(365)
  paymentTermsDays?: number;

  @ApiPropertyOptional({ description: 'Kundenrabatt in Prozent', default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  discountPercent?: number;

  @ApiPropertyOptional({ description: 'Steuerschuldnerschaft des Leistungsempfängers' })
  @IsOptional()
  @IsBoolean()
  reverseCharge?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  creditLimit?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  notes?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class UpdateCustomerDto extends PartialType(CreateCustomerDto) {}

export class CustomerQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: CustomerType })
  @IsOptional()
  @IsEnum(CustomerType)
  type?: CustomerType;

  @ApiPropertyOptional({ description: 'Nur aktive bzw. nur inaktive Kunden' })
  @IsOptional()
  @Transform(({ value }) => (value === 'true' ? true : value === 'false' ? false : value))
  @IsBoolean()
  active?: boolean;
}

export class CreateAddressDto {
  @ApiPropertyOptional({ enum: AddressType, default: AddressType.RECHNUNG })
  @IsOptional()
  @IsEnum(AddressType)
  type: AddressType = AddressType.RECHNUNG;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  label?: string;

  @ApiPropertyOptional()
  @IsString()
  @MaxLength(200)
  street: string;

  @ApiPropertyOptional()
  @IsString()
  @MaxLength(10)
  zip: string;

  @ApiPropertyOptional()
  @IsString()
  @MaxLength(100)
  city: string;

  @ApiPropertyOptional({ default: 'DE' })
  @IsOptional()
  @IsString()
  @MaxLength(2)
  country?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

export class UpdateAddressDto extends PartialType(CreateAddressDto) {}

export class CreateContactDto {
  @ApiPropertyOptional({ enum: Salutation })
  @IsOptional()
  @IsEnum(Salutation)
  salutation?: Salutation;

  @ApiPropertyOptional()
  @IsString()
  @MaxLength(100)
  firstName: string;

  @ApiPropertyOptional()
  @IsString()
  @MaxLength(100)
  lastName: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  position?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(50)
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(50)
  mobile?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

export class UpdateContactDto extends PartialType(CreateContactDto) {}

export class CreateSiteDto {
  @ApiPropertyOptional()
  @IsString()
  @MaxLength(200)
  name: string;

  @ApiPropertyOptional()
  @IsString()
  @MaxLength(200)
  street: string;

  @ApiPropertyOptional()
  @IsString()
  @MaxLength(10)
  zip: string;

  @ApiPropertyOptional()
  @IsString()
  @MaxLength(100)
  city: string;

  @ApiPropertyOptional({ default: 'DE' })
  @IsOptional()
  @IsString()
  @MaxLength(2)
  country?: string;

  @ApiPropertyOptional({ description: 'Hinweise zur Zufahrt oder Schlüsselübergabe' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  accessNotes?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  contactName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(50)
  contactPhone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class UpdateSiteDto extends PartialType(CreateSiteDto) {}
