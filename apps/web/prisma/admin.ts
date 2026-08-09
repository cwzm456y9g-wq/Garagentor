/**
 * Legt den ersten Administrator an – die Anwendung kennt bewusst keine
 * Selbstregistrierung, eine frische Datenbank hätte sonst keinen Zugang.
 *
 *   ADMIN_EMAIL=… ADMIN_PASSWORD=… npm run db:admin --workspace @garagentor/web
 *
 * Der Lauf ist wiederholbar: existiert das Konto bereits, werden Passwort,
 * Name und Rolle aktualisiert. Damit dient das Skript auch dazu, ein
 * vergessenes Administratorpasswort zurückzusetzen.
 */
import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

const MIN_PASSWORT_LAENGE = 12;

function pflicht(name: string): string {
  const wert = process.env[name]?.trim();
  if (!wert) {
    throw new Error(`${name} ist nicht gesetzt.`);
  }
  return wert;
}

async function main(): Promise<void> {
  const email = pflicht('ADMIN_EMAIL').toLowerCase();
  const passwort = pflicht('ADMIN_PASSWORD');
  const vorname = process.env.ADMIN_FIRST_NAME?.trim() || 'Administrator';
  const nachname = process.env.ADMIN_LAST_NAME?.trim() || 'Garagentor';

  if (passwort.length < MIN_PASSWORT_LAENGE) {
    throw new Error(`ADMIN_PASSWORD muss mindestens ${MIN_PASSWORT_LAENGE} Zeichen lang sein.`);
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    throw new Error('ADMIN_EMAIL ist keine gültige Adresse.');
  }

  const passwordHash = await argon2.hash(passwort, { type: argon2.argon2id });
  const vorhanden = await prisma.user.findUnique({ where: { email } });

  const user = await prisma.user.upsert({
    where: { email },
    update: { passwordHash, firstName: vorname, lastName: nachname, role: 'ADMIN', active: true },
    create: { email, passwordHash, firstName: vorname, lastName: nachname, role: 'ADMIN' },
  });

  // Ein Passwortwechsel beendet alle offenen Sitzungen des Kontos.
  const { count } = await prisma.refreshToken.deleteMany({ where: { userId: user.id } });

  console.log(
    vorhanden
      ? `Administrator ${user.email} aktualisiert; ${count} Sitzung(en) beendet.`
      : `Administrator ${user.email} angelegt.`,
  );
}

main()
  .catch((error: unknown) => {
    console.error(`Anlegen fehlgeschlagen: ${error instanceof Error ? error.message : error}`);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
