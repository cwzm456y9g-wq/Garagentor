import { createHash, randomBytes } from 'node:crypto';
import type { AuthUser, JwtPayload, LoginResponse } from '@garagentor/shared';
import type { User } from '@prisma/client';
import jwt from 'jsonwebtoken';
import { konfiguration } from '../konfiguration';
import { nichtAngemeldet, ungueltig, verboten } from '../fehler';
import { prisma } from '../prisma';
import { blindHash, passwortHashen, passwortPruefen } from '../passwort';

/** Kontext des anfragenden Geräts, wird am Refresh-Token vermerkt. */
export interface Geraetekontext {
  userAgent?: string;
  ipAddress?: string;
}

export function alsAuthUser(benutzer: User): AuthUser {
  return {
    id: benutzer.id,
    email: benutzer.email,
    firstName: benutzer.firstName,
    lastName: benutzer.lastName,
    role: benutzer.role,
    employeeId: benutzer.employeeId,
  };
}

export { passwortHashen };

/** Nur der Hash des Tokens wird gespeichert, nie der Token selbst. */
function tokenHash(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

const pruefePasswort = passwortPruefen;

/** Wandelt Angaben wie `15m`, `7d` oder `900` in Sekunden um. */
function inSekunden(dauer: string): number {
  const treffer = /^(\d+)([smhd])?$/.exec(dauer.trim());
  if (!treffer) return 900;

  const wert = Number.parseInt(treffer[1], 10);
  switch (treffer[2]) {
    case 'd':
      return wert * 86_400;
    case 'h':
      return wert * 3_600;
    case 'm':
      return wert * 60;
    default:
      return wert;
  }
}

async function tokenAusgeben(benutzer: User, geraet: Geraetekontext): Promise<LoginResponse> {
  const config = konfiguration();
  const basis = { sub: benutzer.id, email: benutzer.email, role: benutzer.role };

  // Laufzeiten werden in Sekunden übergeben, damit die Konfiguration sowohl
  // `15m` als auch `900` akzeptieren kann.
  const zugangsDauer = inSekunden(config.jwt.zugangsDauer);

  const accessToken = jwt.sign({ ...basis, typ: 'access' }, config.jwt.zugangsGeheimnis, {
    expiresIn: zugangsDauer,
  });

  // Ein Zufallsanteil stellt sicher, dass zwei Tokens derselben Sekunde
  // unterschiedliche Hashes ergeben.
  const refreshToken = jwt.sign(
    { ...basis, typ: 'refresh', jti: randomBytes(16).toString('hex') },
    config.jwt.erneuerungsGeheimnis,
    { expiresIn: inSekunden(config.jwt.erneuerungsDauer) },
  );

  const entschluesselt = jwt.decode(refreshToken) as { exp: number };

  await prisma.refreshToken.create({
    data: {
      tokenHash: tokenHash(refreshToken),
      userId: benutzer.id,
      expiresAt: new Date(entschluesselt.exp * 1000),
      userAgent: geraet.userAgent?.slice(0, 255),
      ipAddress: geraet.ipAddress,
    },
  });

  return {
    accessToken,
    refreshToken,
    expiresIn: zugangsDauer,
    user: alsAuthUser(benutzer),
  };
}

export async function anmelden(
  eingabe: { email: string; password: string },
  geraet: Geraetekontext = {},
): Promise<LoginResponse> {
  const benutzer = await prisma.user.findUnique({ where: { email: eingabe.email } });

  // Auch bei unbekannter Adresse wird verifiziert, damit die Antwortzeit
  // keinen Rückschluss auf die Existenz des Kontos zulässt.
  const hash = benutzer?.passwordHash ?? (await blindHash());
  const stimmt = await pruefePasswort(hash, eingabe.password);

  if (!benutzer || !stimmt) {
    throw nichtAngemeldet('E-Mail-Adresse oder Passwort ist falsch.');
  }
  if (!benutzer.active) {
    throw verboten('Das Benutzerkonto ist deaktiviert.');
  }

  await prisma.user.update({
    where: { id: benutzer.id },
    data: { lastLoginAt: new Date() },
  });

  return tokenAusgeben(benutzer, geraet);
}

/**
 * Tauscht einen Refresh-Token gegen ein neues Tokenpaar. Der alte Token wird
 * dabei entwertet (Rotation). Wird ein bereits entwerteter Token erneut
 * vorgelegt, deutet das auf Diebstahl hin – dann werden alle Sitzungen des
 * Benutzers beendet.
 */
export async function erneuern(
  refreshToken: string,
  geraet: Geraetekontext = {},
): Promise<LoginResponse> {
  const config = konfiguration();

  let inhalt: JwtPayload;
  try {
    inhalt = jwt.verify(refreshToken, config.jwt.erneuerungsGeheimnis) as JwtPayload;
  } catch {
    throw nichtAngemeldet('Der Refresh-Token ist ungültig oder abgelaufen.');
  }

  if (inhalt.typ !== 'refresh') {
    throw nichtAngemeldet('Es wurde kein Refresh-Token übergeben.');
  }

  const abgelegt = await prisma.refreshToken.findUnique({
    where: { tokenHash: tokenHash(refreshToken) },
  });

  if (!abgelegt) {
    throw nichtAngemeldet('Der Refresh-Token ist unbekannt.');
  }

  if (abgelegt.revokedAt) {
    console.warn(
      `Bereits entwerteter Refresh-Token für Benutzer ${abgelegt.userId} vorgelegt – ` +
        'alle Sitzungen werden beendet.',
    );
    await alleSitzungenBeenden(abgelegt.userId);
    throw nichtAngemeldet('Die Sitzung wurde aus Sicherheitsgründen beendet.');
  }

  if (abgelegt.expiresAt < new Date()) {
    throw nichtAngemeldet('Die Sitzung ist abgelaufen. Bitte erneut anmelden.');
  }

  const benutzer = await prisma.user.findUnique({ where: { id: abgelegt.userId } });
  if (!benutzer || !benutzer.active) {
    throw verboten('Das Benutzerkonto ist deaktiviert.');
  }

  await prisma.refreshToken.update({
    where: { id: abgelegt.id },
    data: { revokedAt: new Date() },
  });

  return tokenAusgeben(benutzer, geraet);
}

/** Beendet die übergebene Sitzung; ein unbekannter Token bleibt folgenlos. */
export async function abmelden(refreshToken: string): Promise<{ success: true }> {
  await prisma.refreshToken.updateMany({
    where: { tokenHash: tokenHash(refreshToken), revokedAt: null },
    data: { revokedAt: new Date() },
  });
  return { success: true };
}

export async function passwortAendern(
  benutzerId: string,
  eingabe: { currentPassword: string; newPassword: string },
): Promise<{ success: true }> {
  const benutzer = await prisma.user.findUnique({ where: { id: benutzerId } });
  if (!benutzer) {
    throw nichtAngemeldet('Benutzer nicht gefunden.');
  }

  if (!(await pruefePasswort(benutzer.passwordHash, eingabe.currentPassword))) {
    throw ungueltig('Das aktuelle Passwort ist falsch.');
  }
  if (eingabe.currentPassword === eingabe.newPassword) {
    throw ungueltig('Das neue Passwort muss sich vom bisherigen unterscheiden.');
  }

  await prisma.user.update({
    where: { id: benutzerId },
    data: { passwordHash: await passwortHashen(eingabe.newPassword) },
  });

  // Nach einer Passwortänderung müssen sich alle Geräte neu anmelden.
  await alleSitzungenBeenden(benutzerId);
  return { success: true };
}

export async function eigenesKonto(benutzerId: string): Promise<AuthUser> {
  const benutzer = await prisma.user.findUnique({ where: { id: benutzerId } });
  if (!benutzer) {
    throw nichtAngemeldet('Benutzer nicht gefunden.');
  }
  return alsAuthUser(benutzer);
}

export async function alleSitzungenBeenden(benutzerId: string): Promise<void> {
  await prisma.refreshToken.updateMany({
    where: { userId: benutzerId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

/** Entfernt abgelaufene und entwertete Tokens; wird täglich aufgerufen. */
export async function abgelaufeneTokensEntfernen(): Promise<number> {
  const grenze = new Date();
  grenze.setDate(grenze.getDate() - 30);

  const ergebnis = await prisma.refreshToken.deleteMany({
    where: {
      OR: [{ expiresAt: { lt: new Date() } }, { revokedAt: { lt: grenze } }],
    },
  });
  return ergebnis.count;
}
