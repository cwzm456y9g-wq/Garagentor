import { Role } from '@prisma/client';
import * as argon2 from 'argon2';

/**
 * Der Anmeldedienst arbeitet gegen ein nachgebildetes Prisma.
 *
 * Vorher hing dieser Test an NestJS' Testmodul, das die Abhängigkeiten
 * einspritzte. Ohne DI genügt es, das Modul `@/server/prisma` zu ersetzen –
 * geprüft wird dasselbe: dass eine falsche Anmeldung nicht verrät, ob das
 * Konto existiert, und dass ein zweitverwendeter Refresh-Token alle Sitzungen
 * beendet.
 */
const prismaMock = {
  user: { findUnique: jest.fn(), update: jest.fn() },
  refreshToken: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    deleteMany: jest.fn(),
  },
};

jest.mock('@/server/prisma', () => ({ prisma: prismaMock }));

process.env.JWT_ACCESS_SECRET = 'test-access-secret-mindestens-32-zeichen-lang';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-mindestens-32-zeichen-lang';
process.env.DATABASE_URL = 'postgresql://localhost:5432/test';

import { abmelden, anmelden, erneuern, passwortAendern } from '@/server/dienste/anmeldedienst';

const benutzer = {
  id: 'user-1',
  email: 'admin@example.test',
  firstName: 'Katrin',
  lastName: 'Weber',
  role: Role.ADMIN,
  active: true,
  employeeId: null,
};

let passwortHash: string;

beforeAll(async () => {
  passwortHash = await argon2.hash('Garagentor2026!', { type: argon2.argon2id });
}, 30_000);

beforeEach(() => {
  jest.clearAllMocks();
  prismaMock.refreshToken.create.mockResolvedValue({});
  prismaMock.refreshToken.update.mockResolvedValue({});
  prismaMock.refreshToken.updateMany.mockResolvedValue({ count: 0 });
  prismaMock.refreshToken.deleteMany.mockResolvedValue({ count: 0 });
  prismaMock.user.update.mockResolvedValue({});
});

describe('Anmelden', () => {
  it('gibt ein Tokenpaar samt Benutzer zurück', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ ...benutzer, passwordHash: passwortHash });

    const ergebnis = await anmelden({
      email: benutzer.email,
      password: 'Garagentor2026!',
    });

    expect(ergebnis.accessToken).toEqual(expect.any(String));
    expect(ergebnis.refreshToken).toEqual(expect.any(String));
    expect(ergebnis.accessToken).not.toBe(ergebnis.refreshToken);
    expect(ergebnis.user).toMatchObject({ id: 'user-1', role: Role.ADMIN });
    // Der Hash darf den Dienst nicht verlassen.
    expect(JSON.stringify(ergebnis.user)).not.toContain(passwortHash);
  });

  it('weist ein falsches Passwort ab', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ ...benutzer, passwordHash: passwortHash });

    await expect(anmelden({ email: benutzer.email, password: 'falsch' })).rejects.toMatchObject({
      status: 401,
      message: 'E-Mail-Adresse oder Passwort ist falsch.',
    });
  });

  it('nennt bei unbekannter Adresse denselben Fehler wie bei falschem Passwort', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);

    await expect(
      anmelden({ email: 'gibtsnicht@example.test', password: 'egal' }),
    ).rejects.toMatchObject({ status: 401, message: 'E-Mail-Adresse oder Passwort ist falsch.' });
  });

  it('sperrt deaktivierte Konten aus', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      ...benutzer,
      active: false,
      passwordHash: passwortHash,
    });

    await expect(
      anmelden({ email: benutzer.email, password: 'Garagentor2026!' }),
    ).rejects.toMatchObject({ status: 403 });
  });
});

describe('Erneuern', () => {
  async function tokenBesorgen(): Promise<string> {
    prismaMock.user.findUnique.mockResolvedValue({ ...benutzer, passwordHash: passwortHash });
    const { refreshToken } = await anmelden({
      email: benutzer.email,
      password: 'Garagentor2026!',
    });
    return refreshToken;
  }

  it('entwertet den alten Token und gibt einen neuen aus', async () => {
    const alt = await tokenBesorgen();
    prismaMock.refreshToken.findUnique.mockResolvedValue({
      id: 'token-1',
      userId: benutzer.id,
      revokedAt: null,
      expiresAt: new Date(Date.now() + 86_400_000),
    });

    const neu = await erneuern(alt);

    expect(neu.refreshToken).not.toBe(alt);
    expect(prismaMock.refreshToken.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'token-1' } }),
    );
  });

  it('beendet alle Sitzungen, wenn ein entwerteter Token erneut vorgelegt wird', async () => {
    const alt = await tokenBesorgen();
    prismaMock.refreshToken.findUnique.mockResolvedValue({
      id: 'token-1',
      userId: benutzer.id,
      revokedAt: new Date(),
      expiresAt: new Date(Date.now() + 86_400_000),
    });

    await expect(erneuern(alt)).rejects.toMatchObject({ status: 401 });
    // Der Verdacht auf Diebstahl beendet jede Sitzung des Benutzers.
    expect(prismaMock.refreshToken.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: benutzer.id, revokedAt: null } }),
    );
  });

  it('lehnt einen Access-Token als Refresh-Token ab', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ ...benutzer, passwordHash: passwortHash });
    const { accessToken } = await anmelden({
      email: benutzer.email,
      password: 'Garagentor2026!',
    });

    await expect(erneuern(accessToken)).rejects.toMatchObject({ status: 401 });
  });

  it('lehnt einen abgelaufenen Token ab', async () => {
    const alt = await tokenBesorgen();
    prismaMock.refreshToken.findUnique.mockResolvedValue({
      id: 'token-1',
      userId: benutzer.id,
      revokedAt: null,
      expiresAt: new Date(Date.now() - 1000),
    });

    await expect(erneuern(alt)).rejects.toMatchObject({ status: 401 });
  });
});

describe('Passwort ändern', () => {
  it('beendet nach der Änderung alle Sitzungen', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ ...benutzer, passwordHash: passwortHash });

    await passwortAendern(benutzer.id, {
      currentPassword: 'Garagentor2026!',
      newPassword: 'NochEinLangesPasswort1!',
    });

    expect(prismaMock.user.update).toHaveBeenCalled();
    expect(prismaMock.refreshToken.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: benutzer.id, revokedAt: null } }),
    );
  });

  it('weist ein falsches aktuelles Passwort ab', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ ...benutzer, passwordHash: passwortHash });

    await expect(
      passwortAendern(benutzer.id, {
        currentPassword: 'falsch',
        newPassword: 'NochEinLangesPasswort1!',
      }),
    ).rejects.toMatchObject({ status: 400 });
  });
});

describe('Abmelden', () => {
  it('entwertet den Token still, auch wenn er unbekannt ist', async () => {
    await expect(abmelden('unbekannter-token')).resolves.toEqual({ success: true });
    expect(prismaMock.refreshToken.updateMany).toHaveBeenCalled();
  });
});
