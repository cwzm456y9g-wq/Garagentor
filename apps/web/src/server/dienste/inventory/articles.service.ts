import { prisma } from '@/server/prisma';
import { numbers } from '../common/numbering/number-range.service';
import { BadRequestException, NotFoundException } from '@/server/nest-ersatz';
import { marginPercent, round, type ArticleStockRow, type Paginated } from '@garagentor/shared';
import { Prisma, StockMovementType } from '@prisma/client';
import { orderBy, paginate } from '@/server/anfrage';

import type {
  ArticleQueryDto,
  CreateArticleDto,
  StockMovementDto,
  StockMovementQueryDto,
  UpdateArticleDto,
} from './dto/inventory.dto';

const SORTABLE = ['articleNumber', 'name', 'stock', 'salesPrice', 'category'] as const;

export class ArticlesService {
  async findAll(query: ArticleQueryDto): Promise<Paginated<unknown>> {
    const where: Prisma.ArticleWhereInput = {
      ...(query.category ? { category: query.category } : {}),
      ...(query.supplierId ? { supplierId: query.supplierId } : {}),
      ...(query.active === undefined ? {} : { active: query.active }),
      ...(query.search
        ? {
            OR: [
              { articleNumber: { contains: query.search, mode: 'insensitive' } },
              { name: { contains: query.search, mode: 'insensitive' } },
              { manufacturer: { contains: query.search, mode: 'insensitive' } },
              { manufacturerNumber: { contains: query.search, mode: 'insensitive' } },
              { ean: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    // Der Vergleich zweier Spalten ist in Prisma nur über einen Rohfilter
    // möglich; deshalb wird der Meldebestand nachgelagert gefiltert.
    if (query.belowMinStock) {
      where.stockManaged = true;
      const ids = await prisma.$queryRaw<Array<{ id: string }>>(
        Prisma.sql`SELECT id FROM articles WHERE "stockManaged" = true AND stock < "minStock"`,
      );
      where.id = { in: ids.map((row) => row.id) };
    }

    const [items, total] = await prisma.$transaction([
      prisma.article.findMany({
        where,
        include: { supplier: { select: { id: true, name: true } } },
        orderBy: orderBy(query, SORTABLE, { name: 'asc' }),
        skip: query.skip,
        take: query.take,
      }),
      prisma.article.count({ where }),
    ]);

    return paginate(
      items.map((article) => ({
        ...article,
        margin: marginPercent(article.purchasePrice.toNumber(), article.salesPrice.toNumber()),
        belowMinStock: article.stockManaged && article.stock.lessThan(article.minStock),
      })),
      total,
      query,
    );
  }

  async findOne(id: string) {
    const article = await prisma.article.findUnique({
      where: { id },
      include: {
        supplier: true,
        stockMovements: {
          orderBy: { date: 'desc' },
          take: 20,
          include: { order: { select: { id: true, orderNumber: true } } },
        },
      },
    });
    if (!article) {
      throw new NotFoundException('Der Artikel wurde nicht gefunden.');
    }

    return {
      ...article,
      margin: marginPercent(article.purchasePrice.toNumber(), article.salesPrice.toNumber()),
      belowMinStock: article.stockManaged && article.stock.lessThan(article.minStock),
    };
  }

  /** Artikel unter dem Meldebestand samt Fehlmenge und Lagerwert. */
  async belowMinStock(): Promise<ArticleStockRow[]> {
    const articles = await prisma.$queryRaw<
      Array<{
        id: string;
        articleNumber: string;
        name: string;
        stock: Prisma.Decimal;
        minStock: Prisma.Decimal;
        purchasePrice: Prisma.Decimal;
      }>
    >(
      Prisma.sql`
        SELECT id, "articleNumber", name, stock, "minStock", "purchasePrice"
        FROM articles
        WHERE "stockManaged" = true AND active = true AND stock < "minStock"
        ORDER BY name
      `,
    );

    return articles.map((article) => ({
      articleId: article.id,
      articleNumber: article.articleNumber,
      name: article.name,
      stock: article.stock.toNumber(),
      minStock: article.minStock.toNumber(),
      fehlmenge: round(article.minStock.toNumber() - article.stock.toNumber()),
      wert: round(article.stock.toNumber() * article.purchasePrice.toNumber()),
    }));
  }

  /** Lagerwert zu Einkaufspreisen. */
  async stockValue(): Promise<{ lagerwert: number; artikel: number; positionen: number }> {
    const result = await prisma.$queryRaw<
      Array<{ wert: Prisma.Decimal | null; artikel: bigint; menge: Prisma.Decimal | null }>
    >(
      Prisma.sql`
        SELECT COALESCE(SUM(stock * "purchasePrice"), 0) AS wert,
               COUNT(*) AS artikel,
               COALESCE(SUM(stock), 0) AS menge
        FROM articles
        WHERE "stockManaged" = true AND active = true
      `,
    );

    const row = result[0];
    return {
      lagerwert: round(row?.wert?.toNumber() ?? 0),
      artikel: Number(row?.artikel ?? 0),
      positionen: round(row?.menge?.toNumber() ?? 0),
    };
  }

  async create(dto: CreateArticleDto) {
    return prisma.$transaction(async (tx) => {
      const articleNumber = await numbers.next('ARTICLE', tx);
      const article = await tx.article.create({
        data: {
          articleNumber,
          name: dto.name,
          description: dto.description ?? null,
          category: dto.category ?? null,
          manufacturer: dto.manufacturer ?? null,
          manufacturerNumber: dto.manufacturerNumber ?? null,
          ean: dto.ean ?? null,
          unit: dto.unit ?? 'Stk',
          purchasePrice: dto.purchasePrice ?? 0,
          salesPrice: dto.salesPrice ?? 0,
          vatRate: dto.vatRate ?? 19,
          stock: dto.stock ?? 0,
          minStock: dto.minStock ?? 0,
          storageLocation: dto.storageLocation ?? null,
          supplierId: dto.supplierId ?? null,
          stockManaged: dto.stockManaged ?? true,
          active: dto.active ?? true,
        },
      });

      // Der Anfangsbestand wird als Zugang dokumentiert, damit die
      // Bestandshistorie lückenlos bleibt.
      if (article.stockManaged && (dto.stock ?? 0) > 0) {
        await tx.stockMovement.create({
          data: {
            articleId: article.id,
            type: StockMovementType.ZUGANG,
            quantity: dto.stock!,
            stockAfter: dto.stock!,
            note: 'Anfangsbestand bei Artikelanlage',
          },
        });
      }

      return article;
    });
  }

  /**
   * Ändert Stammdaten. Der Bestand ist ausgenommen – er ändert sich
   * ausschließlich über Buchungen, damit die Historie stimmig bleibt.
   */
  async update(id: string, dto: UpdateArticleDto) {
    await this.assertExists(id);
    // `stock` wird bewusst ignoriert – siehe recordMovement.
    const data = dto;

    return prisma.article.update({
      where: { id },
      data: {
        ...(data.name === undefined ? {} : { name: data.name }),
        ...(data.description === undefined ? {} : { description: data.description }),
        ...(data.category === undefined ? {} : { category: data.category }),
        ...(data.manufacturer === undefined ? {} : { manufacturer: data.manufacturer }),
        ...(data.manufacturerNumber === undefined
          ? {}
          : { manufacturerNumber: data.manufacturerNumber }),
        ...(data.ean === undefined ? {} : { ean: data.ean }),
        ...(data.unit === undefined ? {} : { unit: data.unit }),
        ...(data.purchasePrice === undefined ? {} : { purchasePrice: data.purchasePrice }),
        ...(data.salesPrice === undefined ? {} : { salesPrice: data.salesPrice }),
        ...(data.vatRate === undefined ? {} : { vatRate: data.vatRate }),
        ...(data.minStock === undefined ? {} : { minStock: data.minStock }),
        ...(data.storageLocation === undefined ? {} : { storageLocation: data.storageLocation }),
        ...(data.supplierId === undefined ? {} : { supplierId: data.supplierId }),
        ...(data.stockManaged === undefined ? {} : { stockManaged: data.stockManaged }),
        ...(data.active === undefined ? {} : { active: data.active }),
      },
      include: { supplier: { select: { id: true, name: true } } },
    });
  }

  /**
   * Bucht eine Lagerbewegung und schreibt den Bestand fort. Bei einer Inventur
   * gibt `quantity` den gezählten Bestand an, sonst die Bewegungsmenge.
   */
  async recordMovement(articleId: string, dto: StockMovementDto, userId?: string) {
    const article = await prisma.article.findUnique({ where: { id: articleId } });
    if (!article) {
      throw new NotFoundException('Der Artikel wurde nicht gefunden.');
    }
    if (!article.stockManaged) {
      throw new BadRequestException('Der Artikel wird nicht bestandsgeführt.');
    }

    const current = article.stock.toNumber();
    const stockAfter = this.applyMovement(current, dto);

    if (stockAfter < 0) {
      throw new BadRequestException(
        `Der Bestand würde negativ (${round(stockAfter)}). Verfügbar sind ${round(current)} ` +
          `${article.unit}.`,
      );
    }

    return prisma.$transaction(async (tx) => {
      await tx.article.update({ where: { id: articleId }, data: { stock: stockAfter } });

      return tx.stockMovement.create({
        data: {
          articleId,
          type: dto.type,
          // Bei der Inventur wird die Differenz zum Vorbestand protokolliert.
          quantity:
            dto.type === StockMovementType.INVENTUR
              ? round(Math.abs(stockAfter - current), 3)
              : dto.quantity,
          stockAfter,
          orderId: dto.orderId ?? null,
          userId: userId ?? null,
          reference: dto.reference ?? null,
          note:
            dto.type === StockMovementType.INVENTUR
              ? `Inventur: Bestand von ${round(current, 3)} auf ${round(stockAfter, 3)} korrigiert.` +
                (dto.note ? ` ${dto.note}` : '')
              : (dto.note ?? null),
        },
      });
    });
  }

  async movements(query: StockMovementQueryDto): Promise<Paginated<unknown>> {
    const where: Prisma.StockMovementWhereInput = {
      ...(query.articleId ? { articleId: query.articleId } : {}),
      ...(query.orderId ? { orderId: query.orderId } : {}),
      ...(query.type ? { type: query.type } : {}),
      ...(query.from || query.to
        ? {
            date: {
              ...(query.from ? { gte: new Date(query.from) } : {}),
              ...(query.to ? { lte: new Date(query.to) } : {}),
            },
          }
        : {}),
    };

    const [items, total] = await prisma.$transaction([
      prisma.stockMovement.findMany({
        where,
        include: {
          article: { select: { id: true, articleNumber: true, name: true, unit: true } },
          order: { select: { id: true, orderNumber: true } },
          user: { select: { id: true, firstName: true, lastName: true } },
        },
        orderBy: { date: 'desc' },
        skip: query.skip,
        take: query.take,
      }),
      prisma.stockMovement.count({ where }),
    ]);

    return paginate(items, total, query);
  }

  /** Artikel mit Belegbezug werden deaktiviert statt gelöscht. */
  async remove(id: string) {
    const article = await prisma.article.findUnique({
      where: { id },
      include: {
        _count: {
          select: { quoteItems: true, orderItems: true, invoiceItems: true, stockMovements: true },
        },
      },
    });
    if (!article) {
      throw new NotFoundException('Der Artikel wurde nicht gefunden.');
    }

    const { quoteItems, orderItems, invoiceItems, stockMovements } = article._count;
    if (quoteItems + orderItems + invoiceItems + stockMovements > 0) {
      return prisma.article.update({ where: { id }, data: { active: false } });
    }

    await prisma.article.delete({ where: { id } });
    return { deleted: true, id };
  }

  async assertExists(id: string): Promise<void> {
    const count = await prisma.article.count({ where: { id } });
    if (count === 0) {
      throw new NotFoundException('Der Artikel wurde nicht gefunden.');
    }
  }

  /** Neuer Bestand nach der Bewegung. */
  private applyMovement(current: number, dto: StockMovementDto): number {
    switch (dto.type) {
      case StockMovementType.ZUGANG:
      case StockMovementType.RETOURE:
        return round(current + dto.quantity, 3);
      case StockMovementType.ABGANG:
        return round(current - dto.quantity, 3);
      case StockMovementType.INVENTUR:
        // Der gezählte Bestand ersetzt den bisherigen.
        return round(dto.quantity, 3);
      case StockMovementType.KORREKTUR:
      case StockMovementType.UMLAGERUNG:
        return round(dto.quantity, 3);
    }
  }
}

export const articles = new ArticlesService();
