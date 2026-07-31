import { Module } from '@nestjs/common';
import { ArticlesService } from './articles.service';
import {
  ArticlesController,
  PurchaseOrdersController,
  SuppliersController,
} from './inventory.controller';
import { PurchasingService } from './purchasing.service';

@Module({
  controllers: [ArticlesController, SuppliersController, PurchaseOrdersController],
  providers: [ArticlesService, PurchasingService],
  exports: [ArticlesService, PurchasingService],
})
export class InventoryModule {}
