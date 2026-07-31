import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CurrentUser, Roles } from '../auth/decorators/auth.decorators';
import { PaginationQueryDto } from '../common/dto/pagination.dto';
import { ArticlesService } from './articles.service';
import {
  ArticleQueryDto,
  CreateArticleDto,
  CreatePurchaseOrderDto,
  CreateSupplierDto,
  PurchaseOrderQueryDto,
  ReceiveDeliveryDto,
  ReorderSuggestionQueryDto,
  StockMovementDto,
  StockMovementQueryDto,
  UpdateArticleDto,
  UpdatePurchaseOrderDto,
  UpdateSupplierDto,
} from './dto/inventory.dto';
import { PurchasingService } from './purchasing.service';

@ApiTags('Lager')
@ApiBearerAuth('bearer')
@Controller('articles')
export class ArticlesController {
  constructor(private readonly articles: ArticlesService) {}

  @Get()
  @ApiOperation({ summary: 'Artikel auflisten; Meldebestand als Filter' })
  findAll(@Query() query: ArticleQueryDto) {
    return this.articles.findAll(query);
  }

  @Get('below-min-stock')
  @ApiOperation({ summary: 'Artikel unter dem Meldebestand samt Fehlmenge' })
  belowMinStock() {
    return this.articles.belowMinStock();
  }

  @Get('stock-value')
  @Roles(Role.GESCHAEFTSFUEHRUNG, Role.BUERO, Role.BUCHHALTUNG)
  @ApiOperation({ summary: 'Lagerwert zu Einkaufspreisen' })
  stockValue() {
    return this.articles.stockValue();
  }

  @Get('movements')
  @ApiOperation({ summary: 'Lagerbewegungen auflisten' })
  movements(@Query() query: StockMovementQueryDto) {
    return this.articles.movements(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Artikel mit den letzten Bewegungen' })
  findOne(@Param('id') id: string) {
    return this.articles.findOne(id);
  }

  @Post()
  @Roles(Role.GESCHAEFTSFUEHRUNG, Role.BUERO)
  @ApiOperation({ summary: 'Artikel anlegen; der Anfangsbestand wird gebucht' })
  create(@Body() dto: CreateArticleDto) {
    return this.articles.create(dto);
  }

  @Patch(':id')
  @Roles(Role.GESCHAEFTSFUEHRUNG, Role.BUERO)
  @ApiOperation({ summary: 'Stammdaten ändern; der Bestand nur über Buchungen' })
  update(@Param('id') id: string, @Body() dto: UpdateArticleDto) {
    return this.articles.update(id, dto);
  }

  @Post(':id/movements')
  @Roles(Role.GESCHAEFTSFUEHRUNG, Role.BUERO, Role.MONTEUR)
  @ApiOperation({ summary: 'Lagerbewegung buchen; bei INVENTUR zählt der Istbestand' })
  recordMovement(
    @Param('id') id: string,
    @Body() dto: StockMovementDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.articles.recordMovement(id, dto, userId);
  }

  @Delete(':id')
  @Roles(Role.GESCHAEFTSFUEHRUNG, Role.BUERO)
  @ApiOperation({ summary: 'Artikel löschen; mit Belegbezug nur deaktivieren' })
  remove(@Param('id') id: string) {
    return this.articles.remove(id);
  }
}

@ApiTags('Lieferanten')
@ApiBearerAuth('bearer')
@Controller('suppliers')
export class SuppliersController {
  constructor(private readonly purchasing: PurchasingService) {}

  @Get()
  @ApiOperation({ summary: 'Lieferanten auflisten' })
  findAll(@Query() query: PaginationQueryDto) {
    return this.purchasing.findSuppliers(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Lieferant mit Artikeln und letzten Bestellungen' })
  findOne(@Param('id') id: string) {
    return this.purchasing.findSupplier(id);
  }

  @Post()
  @Roles(Role.GESCHAEFTSFUEHRUNG, Role.BUERO)
  @ApiOperation({ summary: 'Lieferant anlegen' })
  create(@Body() dto: CreateSupplierDto) {
    return this.purchasing.createSupplier(dto);
  }

  @Patch(':id')
  @Roles(Role.GESCHAEFTSFUEHRUNG, Role.BUERO)
  @ApiOperation({ summary: 'Lieferant ändern' })
  update(@Param('id') id: string, @Body() dto: UpdateSupplierDto) {
    return this.purchasing.updateSupplier(id, dto);
  }

  @Delete(':id')
  @Roles(Role.GESCHAEFTSFUEHRUNG, Role.BUERO)
  @ApiOperation({ summary: 'Lieferant löschen; mit Artikeln nur deaktivieren' })
  remove(@Param('id') id: string) {
    return this.purchasing.removeSupplier(id);
  }
}

@ApiTags('Bestellungen')
@ApiBearerAuth('bearer')
@Controller('purchase-orders')
export class PurchaseOrdersController {
  constructor(private readonly purchasing: PurchasingService) {}

  @Get()
  @ApiOperation({ summary: 'Bestellungen auflisten' })
  findAll(@Query() query: PurchaseOrderQueryDto) {
    return this.purchasing.findOrders(query);
  }

  @Get('reorder-suggestions')
  @ApiOperation({ summary: 'Bestellvorschläge aus dem Meldebestand, nach Lieferant gruppiert' })
  reorderSuggestions(@Query() query: ReorderSuggestionQueryDto) {
    return this.purchasing.reorderSuggestions(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Bestellung mit Positionen und Wareneingängen' })
  findOne(@Param('id') id: string) {
    return this.purchasing.findOrder(id);
  }

  @Post()
  @Roles(Role.GESCHAEFTSFUEHRUNG, Role.BUERO)
  @ApiOperation({ summary: 'Bestellung anlegen' })
  create(@Body() dto: CreatePurchaseOrderDto) {
    return this.purchasing.createOrder(dto);
  }

  @Patch(':id')
  @Roles(Role.GESCHAEFTSFUEHRUNG, Role.BUERO)
  @ApiOperation({ summary: 'Bestellung im Entwurf ändern' })
  update(@Param('id') id: string, @Body() dto: UpdatePurchaseOrderDto) {
    return this.purchasing.updateOrder(id, dto);
  }

  @Post(':id/submit')
  @Roles(Role.GESCHAEFTSFUEHRUNG, Role.BUERO)
  @ApiOperation({ summary: 'Bestellung beim Lieferanten aufgeben' })
  submit(@Param('id') id: string) {
    return this.purchasing.submitOrder(id);
  }

  @Post(':id/receive')
  @Roles(Role.GESCHAEFTSFUEHRUNG, Role.BUERO, Role.MONTEUR)
  @ApiOperation({ summary: 'Wareneingang buchen; Teillieferungen sind möglich' })
  receive(
    @Param('id') id: string,
    @Body() dto: ReceiveDeliveryDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.purchasing.receiveDelivery(id, dto, userId);
  }

  @Post(':id/cancel')
  @Roles(Role.GESCHAEFTSFUEHRUNG, Role.BUERO)
  @ApiOperation({ summary: 'Bestellung stornieren' })
  cancel(@Param('id') id: string) {
    return this.purchasing.cancelOrder(id);
  }

  @Delete(':id')
  @Roles(Role.GESCHAEFTSFUEHRUNG, Role.BUERO)
  @ApiOperation({ summary: 'Entwurf löschen; aufgegebene Bestellungen werden storniert' })
  remove(@Param('id') id: string) {
    return this.purchasing.removeOrder(id);
  }
}
