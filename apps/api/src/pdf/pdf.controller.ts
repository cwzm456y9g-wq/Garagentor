import { Controller, Get, Param, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProduces, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { PdfService } from './pdf.service';

@ApiTags('Belege als PDF')
@ApiBearerAuth('bearer')
@Controller()
export class PdfController {
  constructor(private readonly pdf: PdfService) {}

  @Get('invoices/:id/pdf')
  @ApiProduces('application/pdf')
  @ApiOperation({ summary: 'Rechnung als PDF nach DIN 5008' })
  async rechnung(@Param('id') id: string, @Res() response: Response): Promise<void> {
    const { buffer, dateiname } = await this.pdf.rechnung(id);
    this.ausliefern(response, buffer, dateiname);
  }

  @Get('quotes/:id/pdf')
  @ApiProduces('application/pdf')
  @ApiOperation({ summary: 'Angebot als PDF nach DIN 5008' })
  async angebot(@Param('id') id: string, @Res() response: Response): Promise<void> {
    const { buffer, dateiname } = await this.pdf.angebot(id);
    this.ausliefern(response, buffer, dateiname);
  }

  /**
   * `inline` statt `attachment`: der Beleg soll sich im Browser ansehen lassen,
   * das Herunterladen bleibt trotzdem möglich.
   */
  private ausliefern(response: Response, buffer: Buffer, dateiname: string): void {
    response.setHeader('Content-Type', 'application/pdf');
    response.setHeader('Content-Disposition', `inline; filename="${dateiname}"`);
    response.setHeader('Content-Length', buffer.length);
    // Belege können sich ändern, solange sie Entwurf sind.
    response.setHeader('Cache-Control', 'no-store');
    response.end(buffer);
  }
}
