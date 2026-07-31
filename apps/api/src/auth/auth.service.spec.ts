import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { Role } from '@prisma/client';
import * as argon2 from 'argon2';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from './auth.service';

type PrismaMock = {
  user: { findUnique: jest.Mock; update: jest.Mock };
  refreshToken: {
    findUnique: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    updateMany: jest.Mock;
    deleteMany: jest.Mock;
  };
};

describe('AuthService', () => {
  let service: AuthService;
  let prisma: PrismaMock;
  let passwordHash: string;

  const user = {
    id: 'user-1',
    email: 'admin@example.test',
    firstName: 'Katrin',
    lastName: 'Weber',
    role: Role.ADMIN,
    active: true,
    employeeId: null,
  };

  beforeAll(async () => {
    passwordHash = await argon2.hash('Garagentor2026!', { type: argon2.argon2id });
  });

  beforeEach(async () => {
    process.env.JWT_ACCESS_SECRET = 'test-access-secret-mindestens-32-zeichen-lang';
    process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-mindestens-32-zeichen-lang';
    process.env.DATABASE_URL = 'postgresql://localhost:5432/test';

    prisma = {
      user: { findUnique: jest.fn(), update: jest.fn() },
      refreshToken: {
        findUnique: jest.fn(),
        create: jest.fn().mockResolvedValue({}),
        update: jest.fn().mockResolvedValue({}),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
    };

    const moduleRef = await Test.createTestingModule({
      providers: [AuthService, JwtService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = moduleRef.get(AuthService);
  });

  describe('login', () => {
    it('gibt ein Tokenpaar samt Benutzer zurück', async () => {
      prisma.user.findUnique.mockResolvedValue({ ...user, passwordHash });
      prisma.user.update.mockResolvedValue({ ...user, passwordHash });

      const result = await service.login({
        email: user.email,
        password: 'Garagentor2026!',
      });

      expect(result.accessToken).toEqual(expect.any(String));
      expect(result.refreshToken).toEqual(expect.any(String));
      expect(result.user).toMatchObject({ id: 'user-1', role: Role.ADMIN });
      // Der Refresh-Token wird ausschließlich als Hash abgelegt.
      const stored = prisma.refreshToken.create.mock.calls[0][0].data.tokenHash;
      expect(stored).toHaveLength(64);
      expect(stored).not.toContain(result.refreshToken);
    });

    it('weist ein falsches Passwort ab', async () => {
      prisma.user.findUnique.mockResolvedValue({ ...user, passwordHash });

      await expect(service.login({ email: user.email, password: 'falsch' })).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('nennt bei unbekannter Adresse denselben Fehler wie bei falschem Passwort', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.login({ email: 'unbekannt@example.test', password: 'egal' }),
      ).rejects.toThrow('E-Mail-Adresse oder Passwort ist falsch.');
    });

    it('sperrt deaktivierte Konten aus', async () => {
      prisma.user.findUnique.mockResolvedValue({ ...user, active: false, passwordHash });

      await expect(
        service.login({ email: user.email, password: 'Garagentor2026!' }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('refresh', () => {
    async function login() {
      prisma.user.findUnique.mockResolvedValue({ ...user, passwordHash });
      prisma.user.update.mockResolvedValue({ ...user, passwordHash });
      return service.login({ email: user.email, password: 'Garagentor2026!' });
    }

    it('entwertet den alten Token und gibt einen neuen aus', async () => {
      const { refreshToken } = await login();
      const tokenHash = prisma.refreshToken.create.mock.calls[0][0].data.tokenHash;

      prisma.refreshToken.findUnique.mockResolvedValue({
        id: 'token-1',
        tokenHash,
        userId: user.id,
        revokedAt: null,
        expiresAt: new Date(Date.now() + 86_400_000),
      });

      const result = await service.refresh(refreshToken);

      expect(prisma.refreshToken.update).toHaveBeenCalledWith({
        where: { id: 'token-1' },
        data: { revokedAt: expect.any(Date) },
      });
      expect(result.refreshToken).not.toBe(refreshToken);
    });

    it('beendet alle Sitzungen, wenn ein entwerteter Token erneut vorgelegt wird', async () => {
      const { refreshToken } = await login();

      prisma.refreshToken.findUnique.mockResolvedValue({
        id: 'token-1',
        userId: user.id,
        revokedAt: new Date(),
        expiresAt: new Date(Date.now() + 86_400_000),
      });

      await expect(service.refresh(refreshToken)).rejects.toBeInstanceOf(UnauthorizedException);
      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
    });

    it('lehnt einen Access-Token als Refresh-Token ab', async () => {
      const { accessToken } = await login();

      await expect(service.refresh(accessToken)).rejects.toBeInstanceOf(UnauthorizedException);
      expect(prisma.refreshToken.findUnique).not.toHaveBeenCalled();
    });

    it('lehnt einen abgelaufenen Token ab', async () => {
      const { refreshToken } = await login();

      prisma.refreshToken.findUnique.mockResolvedValue({
        id: 'token-1',
        userId: user.id,
        revokedAt: null,
        expiresAt: new Date(Date.now() - 1000),
      });

      await expect(service.refresh(refreshToken)).rejects.toThrow('Die Sitzung ist abgelaufen.');
    });
  });

  describe('changePassword', () => {
    it('beendet nach der Änderung alle Sitzungen', async () => {
      prisma.user.findUnique.mockResolvedValue({ ...user, passwordHash });
      prisma.user.update.mockResolvedValue({ ...user, passwordHash });

      await service.changePassword('user-1', {
        currentPassword: 'Garagentor2026!',
        newPassword: 'NeuesPasswort2026!',
      });

      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
    });

    it('weist ein falsches aktuelles Passwort ab', async () => {
      prisma.user.findUnique.mockResolvedValue({ ...user, passwordHash });

      await expect(
        service.changePassword('user-1', {
          currentPassword: 'falsch',
          newPassword: 'NeuesPasswort2026!',
        }),
      ).rejects.toThrow('Das aktuelle Passwort ist falsch.');
      expect(prisma.user.update).not.toHaveBeenCalled();
    });
  });
});
