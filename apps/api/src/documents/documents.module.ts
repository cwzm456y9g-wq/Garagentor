import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import type { AppConfig } from '../config/configuration';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';

@Module({
  imports: [
    // Dateien werden im Speicher entgegengenommen und erst nach der Prüfung
    // von Typ und Größe unter einem neu vergebenen Namen abgelegt.
    //
    // Die Größengrenze kommt bewusst aus einer Factory: ein direkter Aufruf
    // von loadConfiguration() im Dekorator läuft bereits beim Import dieses
    // Moduls – also bevor ConfigModule die .env des Wurzelverzeichnisses
    // eingelesen hat. Die Anwendung ließe sich dann nur starten, wenn die
    // Variablen zusätzlich in der Shell exportiert sind.
    MulterModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        storage: memoryStorage(),
        limits: {
          fileSize: config.getOrThrow<AppConfig['uploads']>('uploads').maxBytes,
          files: 1,
        },
      }),
    }),
  ],
  controllers: [DocumentsController],
  providers: [DocumentsService],
  exports: [DocumentsService],
})
export class DocumentsModule {}
