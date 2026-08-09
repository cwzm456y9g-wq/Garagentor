import { PurchaseOrderStatus, StockMovementType } from '@prisma/client';
import { z } from 'zod';
import { paginationSchema } from '@/server/anfrage';

/** Eingabeprüfung für Lager, Lieferanten und Bestellungen. */
const datum = z.string().refine((wert) => !Number.isNaN(Date.parse(wert)), {
  message: 'Bitte ein gültiges Datum angeben.',
});

const nachkomma = (stellen: number) => (wert: number) => {
  const faktor = 10 ** stellen;
  return Number.isFinite(wert) && Math.round(wert * faktor) === wert * faktor;
};

const geld = (max = Number.MAX_SAFE_INTEGER) =>
  z.number().min(0).max(max).refine(nachkomma(2), { message: 'Höchstens 2 Nachkommastellen.' });

const menge = (min = 0) =>
  z.number().min(min).refine(nachkomma(3), { message: 'Höchstens 3 Nachkommastellen.' });

const jaNein = z
  .union([z.literal('true'), z.literal('false'), z.boolean()])
  .transform((wert) => wert === 'true' || wert === true)
  .optional();

/* Artikel -------------------------------------------------------------- */

const artikelFelder = {
  name: z.string().max(300),
  description: z.string().max(4000).optional(),
  category: z.string().max(100).optional(),
  manufacturer: z.string().max(100).optional(),
  /** Artikelnummer des Herstellers. */
  manufacturerNumber: z.string().max(100).optional(),
  ean: z.string().max(20).optional(),
  unit: z.string().max(20).optional(),
  purchasePrice: geld().optional(),
  salesPrice: geld().optional(),
  vatRate: geld(100).optional(),
  /** Anfangsbestand; spätere Änderungen nur über Buchungen. */
  stock: menge().optional(),
  /** Meldebestand. */
  minStock: menge().optional(),
  storageLocation: z.string().max(100).optional(),
  supplierId: z.string().optional(),
  /** Leistungen werden nicht bestandsgeführt. */
  stockManaged: z.boolean().optional(),
  active: z.boolean().optional(),
};

export const createArticleSchema = z.object(artikelFelder).strict();
export const updateArticleSchema = z.object(artikelFelder).partial().strict();

export type CreateArticleDto = z.infer<typeof createArticleSchema>;
export type UpdateArticleDto = z.infer<typeof updateArticleSchema>;

export const articleQuerySchema = z.intersection(
  paginationSchema,
  z.object({
    category: z.string().optional(),
    supplierId: z.string().optional(),
    /** Nur Artikel unter dem Meldebestand. */
    belowMinStock: jaNein,
    active: jaNein,
  }),
);

export type ArticleQueryDto = z.infer<typeof articleQuerySchema>;

export const stockMovementSchema = z
  .object({
    type: z.nativeEnum(StockMovementType),
    /**
     * Menge, bei Abgängen positiv angegeben; bei INVENTUR der gezählte Bestand.
     * Das Vorzeichen setzt der Dienst je nach Bewegungsart – so kann eine
     * versehentlich negative Eingabe keinen Zugang aus einem Abgang machen.
     */
    quantity: menge(),
    /** Zugehöriger Auftrag. */
    orderId: z.string().optional(),
    reference: z.string().max(200).optional(),
    note: z.string().max(1000).optional(),
  })
  .strict();

export type StockMovementDto = z.infer<typeof stockMovementSchema>;

export const stockMovementQuerySchema = z.intersection(
  paginationSchema,
  z.object({
    articleId: z.string().optional(),
    orderId: z.string().optional(),
    type: z.nativeEnum(StockMovementType).optional(),
    from: datum.optional(),
    to: datum.optional(),
  }),
);

export type StockMovementQueryDto = z.infer<typeof stockMovementQuerySchema>;

/* Lieferanten ---------------------------------------------------------- */

const lieferantenFelder = {
  name: z.string().max(200),
  contactName: z.string().max(200).optional(),
  email: z.string().max(200).optional(),
  phone: z.string().max(50).optional(),
  street: z.string().max(200).optional(),
  zip: z.string().max(10).optional(),
  city: z.string().max(100).optional(),
  /** Eigene Kundennummer beim Lieferanten. */
  customerNumber: z.string().max(50).optional(),
  vatId: z.string().max(30).optional(),
  paymentTermsDays: z.number().int().min(0).max(365).optional(),
  /** Skonto in Prozent. */
  discountPercent: geld(100).optional(),
  notes: z.string().max(4000).optional(),
  active: z.boolean().optional(),
};

export const createSupplierSchema = z.object(lieferantenFelder).strict();
export const updateSupplierSchema = z.object(lieferantenFelder).partial().strict();

export type CreateSupplierDto = z.infer<typeof createSupplierSchema>;
export type UpdateSupplierDto = z.infer<typeof updateSupplierSchema>;

/* Bestellungen --------------------------------------------------------- */

export const purchaseOrderItemSchema = z
  .object({
    articleId: z.string().optional(),
    title: z.string().max(300),
    quantity: menge(0.001),
    unit: z.string().max(20).optional(),
    unitPrice: geld().optional(),
    vatRate: geld(100).optional(),
  })
  .strict();

export type PurchaseOrderItemDto = z.infer<typeof purchaseOrderItemSchema>;

const bestellFelder = {
  supplierId: z.string(),
  expectedAt: datum.optional(),
  notes: z.string().max(4000).optional(),
  items: z
    .array(purchaseOrderItemSchema)
    .min(1, { message: 'Eine Bestellung braucht mindestens eine Position.' })
    .max(300),
};

export const createPurchaseOrderSchema = z.object(bestellFelder).strict();
export const updatePurchaseOrderSchema = z.object(bestellFelder).partial().strict();

export type CreatePurchaseOrderDto = z.infer<typeof createPurchaseOrderSchema>;
export type UpdatePurchaseOrderDto = z.infer<typeof updatePurchaseOrderSchema>;

export const purchaseOrderQuerySchema = z.intersection(
  paginationSchema,
  z.object({
    supplierId: z.string().optional(),
    status: z.nativeEnum(PurchaseOrderStatus).optional(),
  }),
);

export type PurchaseOrderQueryDto = z.infer<typeof purchaseOrderQuerySchema>;

export const receiptItemSchema = z
  .object({
    /** Bestellposition. */
    itemId: z.string(),
    /** Gelieferte Menge dieser Teillieferung. */
    quantity: menge(0.001),
  })
  .strict();

export type ReceiptItemDto = z.infer<typeof receiptItemSchema>;

/** Wareneingang, auch als Teillieferung. */
export const receiveDeliverySchema = z
  .object({
    items: z.array(receiptItemSchema).min(1).max(300),
    /** Lieferdatum; Standard ist heute. */
    date: datum.optional(),
    /** Lieferscheinnummer. */
    reference: z.string().max(100).optional(),
  })
  .strict();

export type ReceiveDeliveryDto = z.infer<typeof receiveDeliverySchema>;

/** Erzeugt aus allen Artikeln unter Meldebestand Bestellvorschläge. */
export const reorderSuggestionQuerySchema = z.object({
  /** Nur Artikel dieses Lieferanten. */
  supplierId: z.string().optional(),
});

export type ReorderSuggestionQueryDto = z.infer<typeof reorderSuggestionQuerySchema>;
