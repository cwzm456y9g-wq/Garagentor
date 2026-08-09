/**
 * Die Eingabeprüfung der Benutzerverwaltung liegt bei den übrigen
 * Anmelde-Schemata; hier stehen nur die Typen, die der Dienst erwartet.
 */
export type {
  BenutzerAnlegen as CreateUserDto,
  BenutzerAendern as UpdateUserDto,
} from '@/server/schemata/anmeldung';
