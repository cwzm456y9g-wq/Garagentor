import { randomUUID } from 'node:crypto';
import { createReadStream, existsSync } from 'node:fs';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';
import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { Paginated } from '@garagentor/shared';
import { DocumentCategory, EntityType, Prisma } from '@prisma/client';
import { paginate } from '../common/dto/pagination.dto';
import { loadConfiguration } from '../config/configuration';
import { PrismaService } from '../prisma/prisma.service';
import type { DocumentQueryDto, UpdateDocumentDto, UploadDocumentDto } from './dto/document.dto';

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

@Injectable()
export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name);
  private readonly config = loadConfiguration();
  private readonly uploadRoot = resolve(this.config.uploads.dir);

  constructor(private readonly prisma: PrismaService) {}

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

    const [items, total] = await this.prisma.$transaction([
      this.prisma.document.findMany({
        where,
        include: { uploadedBy: { select: { id: true, firstName: true, lastName: true } } },
        orderBy: { createdAt: 'desc' },
        skip: query.skip,
        take: query.take,
      }),
      this.prisma.document.count({ where }),
    ]);

    return paginate(items, total, query);
  }

  async findOne(id: string) {
    const document = await this.prisma.document.findUnique({
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
  async upload(file: Express.Multer.File, dto: UploadDocumentDto, userId?: string) {
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

    const absoluteFolder = join(this.uploadRoot, folder);
    await mkdir(absoluteFolder, { recursive: true });
    await writeFile(join(absoluteFolder, filename), file.buffer);

    return this.prisma.document.create({
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

  /** Liefert Dateipfad und Metadaten für den Download. */
  async fileFor(
    id: string,
  ): Promise<{ path: string; document: Awaited<ReturnType<DocumentsService['findOne']>> }> {
    const document = await this.findOne(id);
    const path = this.absolutePath(document.storagePath);

    if (!existsSync(path)) {
      throw new NotFoundException('Die Datei ist nicht mehr vorhanden.');
    }
    return { path, document };
  }

  createReadStream(path: string) {
    return createReadStream(path);
  }

  async update(id: string, dto: UpdateDocumentDto) {
    await this.findOne(id);

    return this.prisma.document.update({
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

    await this.prisma.document.delete({ where: { id } });

    // Der Datenbankeintrag ist maßgeblich; eine fehlende Datei blockiert das
    // Löschen nicht.
    try {
      await unlink(this.absolutePath(document.storagePath));
    } catch (error) {
      this.logger.warn(`Datei ${document.storagePath} konnte nicht entfernt werden: ${error}`);
    }

    return { deleted: true, id };
  }

  /** Alle Dokumente einer Entität, z. B. eines Auftrags. */
  async forEntity(entityType: EntityType, entityId: string) {
    return this.prisma.document.findMany({
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
    const documents = await this.prisma.document.findMany({
      where: { entityType, entityId, mimeType: { in: ['image/jpeg', 'image/png'] } },
      orderBy: { createdAt: 'asc' },
    });

    const images = await Promise.all(
      documents.map(async (document) => {
        try {
          const bytes = await readFile(this.absolutePath(document.storagePath));
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

  /**
   * Löst den Ablagepfad auf und stellt sicher, dass er innerhalb des
   * Upload-Verzeichnisses liegt.
   */
  private absolutePath(storagePath: string): string {
    const path = resolve(join(this.uploadRoot, storagePath));
    if (!path.startsWith(this.uploadRoot)) {
      throw new BadRequestException('Ungültiger Ablagepfad.');
    }
    return path;
  }
}
