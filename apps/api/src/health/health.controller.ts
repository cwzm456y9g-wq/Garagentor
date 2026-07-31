import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';

@ApiTags('System')
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: 'Erreichbarkeit von API und Datenbank prüfen' })
  async check(): Promise<{ status: string; database: string; timestamp: string }> {
    let database = 'ok';
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      database = 'nicht erreichbar';
    }

    return {
      status: database === 'ok' ? 'ok' : 'eingeschränkt',
      database,
      timestamp: new Date().toISOString(),
    };
  }
}
