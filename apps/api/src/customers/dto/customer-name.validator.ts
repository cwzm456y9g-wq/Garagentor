import { CustomerType } from '@prisma/client';
import {
  registerDecorator,
  ValidatorConstraint,
  type ValidationArguments,
  type ValidationOptions,
  type ValidatorConstraintInterface,
} from 'class-validator';

interface NamedCustomer {
  type?: CustomerType;
  companyName?: string | null;
  lastName?: string | null;
}

/**
 * Ein Kunde braucht je nach Art einen Namen: Privatkunden den Nachnamen,
 * alle übrigen den Firmennamen. Die Prüfung sitzt auf Klassenebene, weil sie
 * zwei Felder gegeneinander abwägt und bei einem `undefined`-Wert sonst
 * zusätzlich die Längenprüfung anschlagen würde.
 */
@ValidatorConstraint({ name: 'customerHasName', async: false })
class CustomerHasNameConstraint implements ValidatorConstraintInterface {
  validate(_value: unknown, args: ValidationArguments): boolean {
    const dto = args.object as NamedCustomer;
    // Bei Teilaktualisierungen ohne Kundenart wird nichts erzwungen.
    if (!dto.type) return true;

    return dto.type === CustomerType.PRIVAT
      ? Boolean(dto.lastName?.trim())
      : Boolean(dto.companyName?.trim());
  }

  defaultMessage(args: ValidationArguments): string {
    const dto = args.object as NamedCustomer;
    return dto.type === CustomerType.PRIVAT
      ? 'Für Privatkunden ist der Nachname erforderlich.'
      : 'Für Geschäftskunden ist der Firmenname erforderlich.';
  }
}

export function CustomerHasName(options?: ValidationOptions) {
  return function (object: object, propertyName: string): void {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options,
      validator: CustomerHasNameConstraint,
    });
  };
}
