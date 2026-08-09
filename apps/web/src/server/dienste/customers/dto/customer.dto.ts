import { AddressType, CustomerType, Salutation } from '@prisma/client';
import { z } from 'zod';
import { paginationSchema } from '@/server/anfrage';

/**
 * Eingabeprüfung für Kunden, Adressen, Ansprechpartner und Objekte.
 *
 * Aus class-validator übersetzt. Die Regeln sind bewusst dieselben geblieben –
 * jede Längenbegrenzung entspricht der Spaltenbreite in der Datenbank, und eine
 * hier verlorene Prüfung fiele erst an einem abgewiesenen Beleg auf.
 */

/** Beträge mit höchstens zwei Nachkommastellen, wie class-validators maxDecimalPlaces. */
const betrag = (max = Number.MAX_SAFE_INTEGER) =>
  z
    .number()
    .min(0, { message: 'Der Wert darf nicht negativ sein.' })
    .max(max)
    .refine((wert) => Number.isFinite(wert) && Math.round(wert * 100) === wert * 100, {
      message: 'Höchstens zwei Nachkommastellen.',
    });

const email = z
  .string()
  .trim()
  .toLowerCase()
  .email({ message: 'Bitte eine gültige E-Mail-Adresse angeben.' });

/**
 * Ein Kunde braucht je nach Art einen Namen: Privatkunden den Nachnamen, alle
 * übrigen den Firmennamen. Die Prüfung sitzt über dem ganzen Objekt, weil sie
 * zwei Felder gegeneinander abwägt.
 *
 * Ohne gesetzte Kundenart wird nichts erzwungen – das trifft Teilaktualisierungen,
 * die die Art nicht mitschicken.
 */
function nameVorhanden(
  wert: { type?: CustomerType; companyName?: string | null; lastName?: string | null },
  pruefung: z.RefinementCtx,
): void {
  if (!wert.type) return;

  if (wert.type === CustomerType.PRIVAT) {
    if (!wert.lastName?.trim()) {
      pruefung.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['lastName'],
        message: 'Für Privatkunden ist der Nachname erforderlich.',
      });
    }
    return;
  }

  if (!wert.companyName?.trim()) {
    pruefung.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['companyName'],
      message: 'Für Geschäftskunden ist der Firmenname erforderlich.',
    });
  }
}

const kundenFelder = {
  type: z.nativeEnum(CustomerType).default(CustomerType.PRIVAT),
  salutation: z.nativeEnum(Salutation).optional(),
  /** Pflicht für alle Kundenarten außer PRIVAT. */
  companyName: z.string().max(200).optional(),
  firstName: z.string().max(100).optional(),
  /** Pflicht für Privatkunden. */
  lastName: z.string().max(100).optional(),
  email: email.optional(),
  phone: z.string().max(50).optional(),
  mobile: z.string().max(50).optional(),
  website: z.string().max(200).optional(),
  /** Umsatzsteuer-Identifikationsnummer. */
  vatId: z.string().max(30).optional(),
  taxNumber: z.string().max(30).optional(),
  paymentTermsDays: z.number().int().min(0).max(365).optional(),
  /** Kundenrabatt in Prozent. */
  discountPercent: betrag(100).optional(),
  /** Steuerschuldnerschaft des Leistungsempfängers. */
  reverseCharge: z.boolean().optional(),
  creditLimit: betrag().optional(),
  notes: z.string().max(4000).optional(),
  active: z.boolean().optional(),
};

export const createCustomerSchema = z.object(kundenFelder).strict().superRefine(nameVorhanden);

export const updateCustomerSchema = z
  .object(kundenFelder)
  .partial()
  .strict()
  .superRefine(nameVorhanden);

export type CreateCustomerDto = z.infer<typeof createCustomerSchema>;
export type UpdateCustomerDto = z.infer<typeof updateCustomerSchema>;

/** `true`/`false` kommen aus der Adresszeile als Text. */
const jaNein = z
  .enum(['true', 'false'])
  .transform((wert) => wert === 'true')
  .optional();

/** Die Filter der Kundenliste, aufgesetzt auf die gemeinsame Blätterung. */
export const kundenAbfrageSchema = z.intersection(
  paginationSchema,
  z.object({
    type: z.nativeEnum(CustomerType).optional(),
    active: jaNein,
  }),
);

export type CustomerQueryDto = z.infer<typeof kundenAbfrageSchema>;

const adressFelder = {
  type: z.nativeEnum(AddressType).default(AddressType.RECHNUNG),
  label: z.string().max(100).optional(),
  street: z.string().max(200),
  zip: z.string().max(10),
  city: z.string().max(100),
  country: z.string().max(2).optional(),
  isDefault: z.boolean().optional(),
};

export const createAddressSchema = z.object(adressFelder).strict();
export const updateAddressSchema = z.object(adressFelder).partial().strict();

export type CreateAddressDto = z.infer<typeof createAddressSchema>;
export type UpdateAddressDto = z.infer<typeof updateAddressSchema>;

const kontaktFelder = {
  salutation: z.nativeEnum(Salutation).optional(),
  firstName: z.string().max(100),
  lastName: z.string().max(100),
  position: z.string().max(100).optional(),
  email: email.optional(),
  phone: z.string().max(50).optional(),
  mobile: z.string().max(50).optional(),
  isPrimary: z.boolean().optional(),
  notes: z.string().max(2000).optional(),
};

export const createContactSchema = z.object(kontaktFelder).strict();
export const updateContactSchema = z.object(kontaktFelder).partial().strict();

export type CreateContactDto = z.infer<typeof createContactSchema>;
export type UpdateContactDto = z.infer<typeof updateContactSchema>;

const objektFelder = {
  name: z.string().max(200),
  street: z.string().max(200),
  zip: z.string().max(10),
  city: z.string().max(100),
  country: z.string().max(2).optional(),
  /** Hinweise zur Zufahrt oder Schlüsselübergabe. */
  accessNotes: z.string().max(2000).optional(),
  contactName: z.string().max(200).optional(),
  contactPhone: z.string().max(50).optional(),
  active: z.boolean().optional(),
};

export const createSiteSchema = z.object(objektFelder).strict();
export const updateSiteSchema = z.object(objektFelder).partial().strict();

export type CreateSiteDto = z.infer<typeof createSiteSchema>;
export type UpdateSiteDto = z.infer<typeof updateSiteSchema>;
