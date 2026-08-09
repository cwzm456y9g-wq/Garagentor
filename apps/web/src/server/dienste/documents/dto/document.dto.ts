import { DocumentCategory, EntityType } from '@prisma/client';
import { z } from 'zod';
import { paginationSchema } from '@/server/anfrage';

/** Eingabeprüfung für die Dokumentenablage. */
export const uploadDocumentSchema = z
  .object({
    category: z.nativeEnum(DocumentCategory).optional(),
    /** Verknüpfte Entität. */
    entityType: z.nativeEnum(EntityType).optional(),
    /** Kennung des verknüpften Datensatzes. */
    entityId: z.string().optional(),
    /**
     * Feinere Zuordnung innerhalb der Entität, z. B. der Schlüssel eines
     * Prüfpunkts. Damit hängt ein Foto am richtigen Punkt des Protokolls und
     * nicht nur irgendwo an der Prüfung.
     */
    entityRef: z.string().max(60).optional(),
    title: z.string().max(300).optional(),
    description: z.string().max(2000).optional(),
  })
  .strict();

export type UploadDocumentDto = z.infer<typeof uploadDocumentSchema>;

export const updateDocumentSchema = z
  .object({
    title: z.string().max(300).optional(),
    description: z.string().max(2000).optional(),
    category: z.nativeEnum(DocumentCategory).optional(),
    entityType: z.nativeEnum(EntityType).optional(),
    entityId: z.string().optional(),
    entityRef: z.string().max(60).optional(),
  })
  .strict();

export type UpdateDocumentDto = z.infer<typeof updateDocumentSchema>;

export const documentQuerySchema = z.intersection(
  paginationSchema,
  z.object({
    entityType: z.nativeEnum(EntityType).optional(),
    entityId: z.string().optional(),
    entityRef: z.string().max(60).optional(),
    category: z.nativeEnum(DocumentCategory).optional(),
  }),
);

export type DocumentQueryDto = z.infer<typeof documentQuerySchema>;
