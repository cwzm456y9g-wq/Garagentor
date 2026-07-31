import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../auth/decorators/auth.decorators';
import {
  ConvertQuoteDto,
  CreateQuoteDto,
  QuoteQueryDto,
  RejectQuoteDto,
  UpdateQuoteDto,
} from './dto/quote.dto';
import { QuotesService } from './quotes.service';

@ApiTags('Angebote')
@ApiBearerAuth('bearer')
@Controller('quotes')
export class QuotesController {
  constructor(private readonly quotes: QuotesService) {}

  @Get()
  @ApiOperation({ summary: 'Angebote auflisten und filtern' })
  findAll(@Query() query: QuoteQueryDto) {
    return this.quotes.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Angebot mit Positionen abrufen' })
  findOne(@Param('id') id: string) {
    return this.quotes.findOne(id);
  }

  @Post()
  @Roles(Role.GESCHAEFTSFUEHRUNG, Role.BUERO)
  @ApiOperation({ summary: 'Angebot anlegen; Nummer und Summen werden ermittelt' })
  create(@Body() dto: CreateQuoteDto) {
    return this.quotes.create(dto);
  }

  @Patch(':id')
  @Roles(Role.GESCHAEFTSFUEHRUNG, Role.BUERO)
  @ApiOperation({ summary: 'Angebot im Entwurf ändern' })
  update(@Param('id') id: string, @Body() dto: UpdateQuoteDto) {
    return this.quotes.update(id, dto);
  }

  @Post(':id/send')
  @Roles(Role.GESCHAEFTSFUEHRUNG, Role.BUERO)
  @ApiOperation({ summary: 'Angebot versenden; danach inhaltlich gesperrt' })
  send(@Param('id') id: string) {
    return this.quotes.send(id);
  }

  @Post(':id/accept')
  @Roles(Role.GESCHAEFTSFUEHRUNG, Role.BUERO)
  @ApiOperation({ summary: 'Angebot als angenommen kennzeichnen' })
  accept(@Param('id') id: string) {
    return this.quotes.accept(id);
  }

  @Post(':id/reject')
  @Roles(Role.GESCHAEFTSFUEHRUNG, Role.BUERO)
  @ApiOperation({ summary: 'Angebot als abgelehnt kennzeichnen' })
  reject(@Param('id') id: string, @Body() dto: RejectQuoteDto) {
    return this.quotes.reject(id, dto);
  }

  @Post(':id/convert')
  @Roles(Role.GESCHAEFTSFUEHRUNG, Role.BUERO)
  @ApiOperation({ summary: 'Angenommenes Angebot in einen Auftrag überführen' })
  convert(@Param('id') id: string, @Body() dto: ConvertQuoteDto) {
    return this.quotes.convertToOrder(id, dto);
  }

  @Delete(':id')
  @Roles(Role.GESCHAEFTSFUEHRUNG, Role.BUERO)
  @ApiOperation({ summary: 'Entwurf löschen; versendete Angebote werden storniert' })
  remove(@Param('id') id: string) {
    return this.quotes.remove(id);
  }
}
