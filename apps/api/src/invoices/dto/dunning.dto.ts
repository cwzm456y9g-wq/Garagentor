import { ApiPropertyOptional } from '@nestjs/swagger';
import { DunningLevel, DunningStatus } from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';

export class DunningQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: DunningStatus })
  @IsOptional()
  @IsEnum(DunningStatus)
  status?: DunningStatus;
}

export class CreateDunningDto {
  @ApiPropertyOptional({
    enum: DunningLevel,
    description: 'Ohne Angabe wird die nächste fällige Mahnstufe verwendet',
  })
  @IsOptional()
  @IsEnum(DunningLevel)
  level?: DunningLevel;
}
