import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MAIL_DOCUMENT_TYPES, type MailDocumentType } from '@garagentor/shared';
import { EntityType, MailStatus } from '@prisma/client';
import { IsEnum, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';

export class MailPreviewDto {
  @ApiProperty({ enum: MAIL_DOCUMENT_TYPES })
  @IsIn(MAIL_DOCUMENT_TYPES as unknown as string[])
  art: MailDocumentType;

  @ApiProperty()
  @IsString()
  id: string;
}

export class SendMailDto extends MailPreviewDto {
  @ApiProperty({ description: 'Empfänger, mehrere durch Komma getrennt' })
  @IsString()
  @MaxLength(500)
  an: string;

  @ApiPropertyOptional({ description: 'Kopie an weitere Empfänger' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  kopie?: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(300)
  betreff: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  // Ein Anschreiben ist kein Aufsatz; die Grenze hält versehentlich
  // eingefügte Belegtexte aus dem Rumpf heraus.
  @MaxLength(10_000)
  text: string;
}

export class MailLogQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: EntityType })
  @IsOptional()
  @IsEnum(EntityType)
  entityType?: EntityType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  entityId?: string;

  @ApiPropertyOptional({ enum: MailStatus })
  @IsOptional()
  @IsEnum(MailStatus)
  status?: MailStatus;
}
