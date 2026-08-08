import { ApiProperty } from '@nestjs/swagger';
import { IsDateString } from 'class-validator';

export class DatevQueryDto {
  @ApiProperty({ description: 'Erster Tag des Zeitraums, z. B. 2026-01-01' })
  @IsDateString()
  von: string;

  @ApiProperty({ description: 'Letzter Tag des Zeitraums, einschließlich' })
  @IsDateString()
  bis: string;
}
