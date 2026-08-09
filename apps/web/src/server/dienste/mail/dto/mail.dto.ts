import { MAIL_DOCUMENT_TYPES, type MailDocumentType } from '@garagentor/shared';
import { EntityType, MailStatus } from '@prisma/client';
import { z } from 'zod';
import { paginationSchema } from '@/server/anfrage';

/** Eingabeprüfung für Vorschau und Versand von Belegen. */
const belegart = z.enum(
  MAIL_DOCUMENT_TYPES as unknown as [MailDocumentType, ...MailDocumentType[]],
);

export const mailPreviewSchema = z
  .object({
    art: belegart,
    id: z.string(),
  })
  .strict();

export type MailPreviewDto = z.infer<typeof mailPreviewSchema>;

export const sendMailSchema = z
  .object({
    art: belegart,
    id: z.string(),
    /** Empfänger, mehrere durch Komma getrennt. */
    an: z.string().max(500),
    /** Kopie an weitere Empfänger. */
    kopie: z.string().max(500).optional(),
    betreff: z.string().min(1).max(300),
    // Ein Anschreiben ist kein Aufsatz; die Grenze hält versehentlich
    // eingefügte Belegtexte aus dem Rumpf heraus.
    text: z.string().min(1).max(10_000),
  })
  .strict();

export type SendMailDto = z.infer<typeof sendMailSchema>;

export const mailLogQuerySchema = z.intersection(
  paginationSchema,
  z.object({
    entityType: z.nativeEnum(EntityType).optional(),
    entityId: z.string().optional(),
    status: z.nativeEnum(MailStatus).optional(),
  }),
);

export type MailLogQueryDto = z.infer<typeof mailLogQuerySchema>;
