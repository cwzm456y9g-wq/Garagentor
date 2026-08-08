import { Global, Module } from '@nestjs/common';
import { AuditService } from './audit.service';

/**
 * Global, damit jeder Dienst protokollieren kann, ohne dass die Modulliste
 * dafür angefasst werden muss – wie beim PrismaModule.
 */
@Global()
@Module({
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
