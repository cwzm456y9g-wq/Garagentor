import { Module } from '@nestjs/common';
import { PdfModule } from '../pdf/pdf.module';
import { MailController } from './mail.controller';
import { MailService } from './mail.service';

@Module({
  // Der Anhang entsteht beim Versand neu, damit er den aktuellen Stand des
  // Belegs zeigt und nicht eine ältere Ablage.
  imports: [PdfModule],
  controllers: [MailController],
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}
