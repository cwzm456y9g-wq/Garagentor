import { Role } from '@prisma/client';
import { z } from 'zod';

/**
 * Eingabeprüfung für Anmeldung und Benutzerverwaltung.
 *
 * `.strict()` überall: NestJS wies mit `forbidNonWhitelisted` unbekannte Felder
 * ab, und das soll so bleiben. Wer versehentlich `role` an einen Endpunkt
 * schickt, der sie nicht annehmen darf, bekommt einen Fehler statt stiller
 * Wirkungslosigkeit.
 */
const email = z
  .string()
  .trim()
  .toLowerCase()
  .email({ message: 'Bitte eine gültige E-Mail-Adresse angeben.' });

export const anmeldeSchema = z
  .object({
    email,
    password: z.string().min(1, { message: 'Bitte das Passwort angeben.' }),
  })
  .strict();

export const erneuerungsSchema = z
  .object({
    refreshToken: z.string().min(20),
  })
  .strict();

export const passwortwechselSchema = z
  .object({
    currentPassword: z.string(),
    newPassword: z
      .string()
      .min(10, { message: 'Das neue Passwort muss mindestens 10 Zeichen lang sein.' })
      .max(200),
  })
  .strict();

export const benutzerAnlegenSchema = z
  .object({
    email,
    password: z
      .string()
      .min(10, { message: 'Das Passwort muss mindestens 10 Zeichen lang sein.' })
      .max(200),
    firstName: z.string().max(100),
    lastName: z.string().max(100),
    role: z.nativeEnum(Role),
    employeeId: z.string().optional(),
  })
  .strict();

export const benutzerAendernSchema = z
  .object({
    email: email.optional(),
    firstName: z.string().max(100).optional(),
    lastName: z.string().max(100).optional(),
    role: z.nativeEnum(Role).optional(),
    active: z.boolean().optional(),
    employeeId: z.string().nullable().optional(),
  })
  .strict();

export const passwortZuruecksetzenSchema = z
  .object({
    newPassword: z.string().min(10).max(200),
  })
  .strict();

export type BenutzerAnlegen = z.infer<typeof benutzerAnlegenSchema>;
export type BenutzerAendern = z.infer<typeof benutzerAendernSchema>;
