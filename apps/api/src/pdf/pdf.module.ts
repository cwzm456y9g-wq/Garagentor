import { Module } from '@nestjs/common';
import { DocumentsModule } from '../documents/documents.module';
import { PdfController } from './pdf.controller';
import { PdfService } from './pdf.service';

@Module({
  // Die Fotos zum Prüfprotokoll liegen in der Dokumentenablage; das PDF liest
  // sie über deren Dienst, damit der Pfadschutz an einer Stelle bleibt.
  imports: [DocumentsModule],
  controllers: [PdfController],
  providers: [PdfService],
  exports: [PdfService],
})
export class PdfModule {}
