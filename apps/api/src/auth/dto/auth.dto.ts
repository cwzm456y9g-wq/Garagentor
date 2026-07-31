import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

const normalizeEmail = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

export class LoginDto {
  @ApiProperty({ example: 'admin@tortechnik-weber.example' })
  @IsEmail({}, { message: 'Bitte eine gültige E-Mail-Adresse angeben.' })
  @Transform(normalizeEmail)
  email: string;

  @ApiProperty({ example: 'Garagentor2026!' })
  @IsString()
  @MinLength(1, { message: 'Bitte das Passwort angeben.' })
  password: string;
}

export class RefreshDto {
  @ApiProperty({ description: 'Zuletzt ausgegebener Refresh-Token' })
  @IsString()
  @MinLength(20)
  refreshToken: string;
}

export class ChangePasswordDto {
  @ApiProperty()
  @IsString()
  currentPassword: string;

  @ApiProperty({ minLength: 10, description: 'Mindestens 10 Zeichen' })
  @IsString()
  @MinLength(10, { message: 'Das neue Passwort muss mindestens 10 Zeichen lang sein.' })
  @MaxLength(200)
  newPassword: string;
}

export class CreateUserDto {
  @ApiProperty()
  @IsEmail()
  @Transform(normalizeEmail)
  email: string;

  @ApiProperty({ minLength: 10 })
  @IsString()
  @MinLength(10, { message: 'Das Passwort muss mindestens 10 Zeichen lang sein.' })
  @MaxLength(200)
  password: string;

  @ApiProperty()
  @IsString()
  @MaxLength(100)
  firstName: string;

  @ApiProperty()
  @IsString()
  @MaxLength(100)
  lastName: string;

  @ApiProperty({ enum: Role })
  @IsEnum(Role)
  role: Role;

  @ApiPropertyOptional({ description: 'Verknüpfter Mitarbeiterdatensatz' })
  @IsOptional()
  @IsString()
  employeeId?: string;
}

export class UpdateUserDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  @Transform(normalizeEmail)
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  firstName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  lastName?: string;

  @ApiPropertyOptional({ enum: Role })
  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  employeeId?: string | null;
}

export class ResetPasswordDto {
  @ApiProperty({ minLength: 10 })
  @IsString()
  @MinLength(10)
  @MaxLength(200)
  newPassword: string;
}
