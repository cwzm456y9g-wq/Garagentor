import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../auth/decorators/auth.decorators';
import { DunningService } from './dunning.service';
import { CreateDunningDto } from './dto/dunning.dto';
import {
  CancelInvoiceDto,
  CreateInvoiceDto,
  CreatePaymentDto,
  InvoiceQueryDto,
  UpdateInvoiceDto,
} from './dto/invoice.dto';
import { InvoicesService } from './invoices.service';

@ApiTags('Rechnungen')
@ApiBearerAuth('bearer')
@Controller('invoices')
export class InvoicesController {
  constructor(
    private readonly invoices: InvoicesService,
    private readonly dunning: DunningService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Rechnungen auflisten, offene Posten filtern' })
  findAll(@Query() query: InvoiceQueryDto) {
    return this.invoices.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Rechnung mit Positionen, Zahlungen und Mahnungen' })
  findOne(@Param('id') id: string) {
    return this.invoices.findOne(id);
  }

  @Post()
  @Roles(Role.GESCHAEFTSFUEHRUNG, Role.BUERO, Role.BUCHHALTUNG)
  @ApiOperation({ summary: 'Rechnung anlegen' })
  create(@Body() dto: CreateInvoiceDto) {
    return this.invoices.create(dto);
  }

  @Patch(':id')
  @Roles(Role.GESCHAEFTSFUEHRUNG, Role.BUERO, Role.BUCHHALTUNG)
  @ApiOperation({ summary: 'Rechnungsentwurf ändern' })
  update(@Param('id') id: string, @Body() dto: UpdateInvoiceDto) {
    return this.invoices.update(id, dto);
  }

  @Post(':id/send')
  @Roles(Role.GESCHAEFTSFUEHRUNG, Role.BUERO, Role.BUCHHALTUNG)
  @ApiOperation({ summary: 'Rechnung festschreiben und stellen' })
  send(@Param('id') id: string) {
    return this.invoices.send(id);
  }

  @Post(':id/payments')
  @Roles(Role.GESCHAEFTSFUEHRUNG, Role.BUERO, Role.BUCHHALTUNG)
  @ApiOperation({ summary: 'Zahlung buchen; der Status wird fortgeschrieben' })
  addPayment(@Param('id') id: string, @Body() dto: CreatePaymentDto) {
    return this.invoices.addPayment(id, dto);
  }

  @Delete(':id/payments/:paymentId')
  @Roles(Role.GESCHAEFTSFUEHRUNG, Role.BUCHHALTUNG)
  @ApiOperation({ summary: 'Zahlung stornieren' })
  removePayment(@Param('id') id: string, @Param('paymentId') paymentId: string) {
    return this.invoices.removePayment(id, paymentId);
  }

  @Post(':id/cancel')
  @Roles(Role.GESCHAEFTSFUEHRUNG, Role.BUCHHALTUNG)
  @ApiOperation({ summary: 'Rechnung stornieren; bei Zahlung mit Gutschrift' })
  cancel(@Param('id') id: string, @Body() dto: CancelInvoiceDto) {
    return this.invoices.cancel(id, dto);
  }

  @Post(':id/dunnings')
  @Roles(Role.GESCHAEFTSFUEHRUNG, Role.BUCHHALTUNG)
  @ApiOperation({ summary: 'Mahnung zu dieser Rechnung anlegen' })
  createDunning(@Param('id') id: string, @Body() dto: CreateDunningDto) {
    return this.dunning.createForInvoice(id, dto.level);
  }
}
