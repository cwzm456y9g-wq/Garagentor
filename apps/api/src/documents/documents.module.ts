import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { loadConfiguration } from '../config/configuration';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';

@Module({
  imports: [
    // Dateien werden im Speicher entgegengenommen und erst nach der Prüfung
    // von Typ und Größe unter einem neu vergebenen Namen abgelegt.
    MulterModule.register({
      storage: memoryStorage(),
      limits: { fileSize: loadConfiguration().uploads.maxBytes, files: 1 },
    }),
  ],
  controllers: [DocumentsController],
  providers: [DocumentsService],
  exports: [DocumentsService],
})
export class DocumentsModule {}
