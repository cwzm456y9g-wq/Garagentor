import { prisma } from '@/server/prisma';
import { randomUUID } from 'node:crypto';
import { extname } from 'node:path';
import { ablegen, entfernen, lesen } from '@/server/ablage';
import { BadRequestException, Logger, NotFoundException } from '@/server/nest-ersatz';
import type { Paginated } from '@garagentor/shared';
import { DocumentCategory, type EntityType, type Prisma } from '@prisma/client';
import { paginate } from '@/server/anfrage';
import { konfiguration } from '@/server/konfiguration';

import type { DocumentQueryDto, UpdateDocumentDto, UploadDocumentDto } from './dto/document.dto';

/**
 * Eine hochgeladene Datei, unabhängig davon, wer sie entgegennimmt.
 *
 * Vorher kam sie von Multer aus Express. Next.js liefert stattdessen ein
 * `File` aus `request.formData()`.
 */
export interface HochgeladeneDatei {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

/** Zulässige Dateitypen der Dokumentenablage. */
const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/msword',
  'application/vnd.ms-excel',
  'text/plain',
  'text/csv',
]);

const ALLOWED_EXTENSIONS = new Set([
  '.pdf',
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.heic',
  '.docx',
  '.xlsx',
  '.doc',
  '.xls',
  '.txt',
  '.csv',
]);

export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name);
  /**
   * Konfiguration erst beim Zugriff lesen, nicht beim Laden des Moduls.
   * Next.js lädt jede Route schon während `next build`; als Feld bräuchte der
   * Bau bereits die Produktivgeheimnisse.
   */
  private get config() {
    return konfiguration();
  }

  async findAll(query: DocumentQueryDto): Promise<Paginated<unknown>> {
    const where: Prisma.DocumentWhereInput = {
      ...(query.entityType ? { entityType: query.entityType } : {}),
      ...(query.entityId ? { entityId: query.entityId } : {}),
      ...(query.entityRef ? { entityRef: query.entityRef } : {}),
      ...(query.category ? { category: query.category } : {}),
      ...(query.search
        ? {
            OR: [
              { originalName: { contains: query.search, mode: 'insensitive' } },
              { title: { contains: query.search, mode: 'insensitive' } },
              { description: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [items, total] = await prisma.$transaction([
      prisma.document.findMany({
        where,
        include: { uploadedBy: { select: { id: true, firstName: true, lastName: true } } },
        orderBy: { createdAt: 'desc' },
        skip: query.skip,
        take: query.take,
      }),
      prisma.document.count({ where }),
    ]);

    return paginate(items, total, query);
  }

  async findOne(id: string) {
    const document = await prisma.document.findUnique({
      where: { id },
      include: { uploadedBy: { select: { id: true, firstName: true, lastName: true } } },
    });
    if (!document) {
      throw new NotFoundException('Das Dokument wurde nicht gefunden.');
    }
    return document;
  }

  /**
   * Speichert eine hochgeladene Datei. Der Dateiname wird neu vergeben, damit
   * Angaben aus dem Upload nicht in den Pfad gelangen können; die Ablage
   * erfolgt nach Jahr und Monat.
   */
  async upload(file: HochgeladeneDatei, dto: UploadDocumentDto, userId?: string) {
    if (!file) {
      throw new BadRequestException('Es wurde keine Datei übermittelt.');
    }

    const extension = extname(file.originalname).toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(extension) || !ALLOWED_MIME_TYPES.has(file.mimetype)) {
      throw new BadRequestException(
        `Der Dateityp "${extension || file.mimetype}" ist nicht zugelassen.`,
      );
    }
    if (file.size > this.config.uploads.maxBytes) {
      throw new BadRequestException(
        `Die Datei ist größer als ${Math.round(this.config.uploads.maxBytes / 1024 / 1024)} MB.`,
      );
    }

    const now = new Date();
    const folder = `${now.getFullYear()}/${`${now.getMonth() + 1}`.padStart(2, '0')}`;
    const filename = `${randomUUID()}${extension}`;
    const storagePath = `${folder}/${filename}`;

    await ablegen(storagePath, file.buffer, file.mimetype);

    return prisma.document.create({
      data: {
        filename,
        originalName: file.originalname.slice(0, 255),
        mimeType: file.mimetype,
        size: file.size,
        storagePath,
        category: dto.category ?? DocumentCategory.SONSTIGES,
        entityType: dto.entityType ?? null,
        entityId: dto.entityId ?? null,
        entityRef: dto.entityRef ?? null,
        title: dto.title ?? null,
        description: dto.description ?? null,
        uploadedById: userId ?? null,
      },
    });
  }

  /** Liefert Inhalt und Metadaten für den Download. */
  async fileFor(id: string): Promise<{
    inhalt: Buffer;
    document: Awaited<ReturnType<DocumentsService['findOne']>>;
  }> {
    const document = await this.findOne(id);
    return { inhalt: await lesen(document.storagePath), document };
  }

  async update(id: string, dto: UpdateDocumentDto) {
    await this.findOne(id);

    return prisma.document.update({
      where: { id },
      data: {
        ...(dto.title === undefined ? {} : { title: dto.title }),
        ...(dto.description === undefined ? {} : { description: dto.description }),
        ...(dto.category === undefined ? {} : { category: dto.category }),
        ...(dto.entityType === undefined ? {} : { entityType: dto.entityType }),
        ...(dto.entityId === undefined ? {} : { entityId: dto.entityId }),
        ...(dto.entityRef === undefined ? {} : { entityRef: dto.entityRef }),
      },
    });
  }

  async remove(id: string) {
    const document = await this.findOne(id);

    await prisma.document.delete({ where: { id } });

    // Der Datenbankeintrag ist maßgeblich; eine fehlende Datei blockiert das
    // Löschen nicht.
    try {
      await entfernen(document.storagePath);
    } catch (error) {
      this.logger.warn(`Datei ${document.storagePath} konnte nicht entfernt werden: ${error}`);
    }

    return { deleted: true, id };
  }

  /** Alle Dokumente einer Entität, z. B. eines Auftrags. */
  async forEntity(entityType: EntityType, entityId: string) {
    return prisma.document.findMany({
      where: { entityType, entityId },
      include: { uploadedBy: { select: { id: true, firstName: true, lastName: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Bilder einer Entität als Data-URL, damit sie sich in ein PDF einbetten
   * lassen.
   *
   * Beschränkt auf JPEG und PNG: der Bildleser von react-pdf kennt weder WebP
   * noch HEIC, und ein nicht lesbares Bild bricht den ganzen Aufbau ab. Fehlt
   * eine Datei auf der Platte, wird sie übergangen – ein Protokoll ohne Foto
   * ist brauchbarer als gar keines.
   */
  async imagesFor(
    entityType: EntityType,
    entityId: string,
  ): Promise<Array<{ id: string; entityRef: string | null; title: string | null; data: string }>> {
    const documents = await prisma.document.findMany({
      where: { entityType, entityId, mimeType: { in: ['image/jpeg', 'image/png'] } },
      orderBy: { createdAt: 'asc' },
    });

    const images = await Promise.all(
      documents.map(async (document) => {
        try {
          const bytes = await lesen(document.storagePath);
          return {
            id: document.id,
            entityRef: document.entityRef,
            title: document.title,
            data: `data:${document.mimeType};base64,${bytes.toString('base64')}`,
          };
        } catch (error) {
          this.logger.warn(`Bild ${document.storagePath} konnte nicht gelesen werden: ${error}`);
          return null;
        }
      }),
    );

    return images.filter((image): image is NonNullable<typeof image> => image !== null);
  }
}

export const documents = new DocumentsService();
