import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../auth/decorators/auth.decorators';
import {
  CreateInvoiceFromOrderDto,
  CreateOrderDto,
  OrderQueryDto,
  UpdateOrderDto,
  UpdateOrderStatusDto,
} from './dto/order.dto';
import { OrdersService } from './orders.service';

@ApiTags('Aufträge')
@ApiBearerAuth('bearer')
@Controller('orders')
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Get()
  @ApiOperation({ summary: 'Aufträge auflisten und filtern' })
  findAll(@Query() query: OrderQueryDto) {
    return this.orders.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Auftrag mit Positionen, Terminen und Belegen' })
  findOne(@Param('id') id: string) {
    return this.orders.findOne(id);
  }

  @Get(':id/costs')
  @Roles(Role.GESCHAEFTSFUEHRUNG, Role.BUERO, Role.BUCHHALTUNG)
  @ApiOperation({ summary: 'Nachkalkulation: Zeiten, Material und Abrechnung' })
  costs(@Param('id') id: string) {
    return this.orders.costs(id);
  }

  @Post()
  @Roles(Role.GESCHAEFTSFUEHRUNG, Role.BUERO)
  @ApiOperation({ summary: 'Auftrag anlegen' })
  create(@Body() dto: CreateOrderDto) {
    return this.orders.create(dto);
  }

  @Patch(':id')
  @Roles(Role.GESCHAEFTSFUEHRUNG, Role.BUERO)
  @ApiOperation({ summary: 'Auftrag ändern' })
  update(@Param('id') id: string, @Body() dto: UpdateOrderDto) {
    return this.orders.update(id, dto);
  }

  @Patch(':id/status')
  @Roles(Role.GESCHAEFTSFUEHRUNG, Role.BUERO, Role.MONTEUR)
  @ApiOperation({ summary: 'Auftragsstatus wechseln' })
  changeStatus(@Param('id') id: string, @Body() dto: UpdateOrderStatusDto) {
    return this.orders.changeStatus(id, dto.status);
  }

  @Post(':id/invoice')
  @Roles(Role.GESCHAEFTSFUEHRUNG, Role.BUERO, Role.BUCHHALTUNG)
  @ApiOperation({ summary: 'Rechnung, Abschlags- oder Schlussrechnung erzeugen' })
  createInvoice(@Param('id') id: string, @Body() dto: CreateInvoiceFromOrderDto) {
    return this.orders.createInvoice(id, dto);
  }

  @Delete(':id')
  @Roles(Role.GESCHAEFTSFUEHRUNG, Role.BUERO)
  @ApiOperation({ summary: 'Auftrag löschen; mit Rechnungen nur stornieren' })
  remove(@Param('id') id: string) {
    return this.orders.remove(id);
  }
}
