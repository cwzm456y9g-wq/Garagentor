import { bereinige, untersuche } from '@/server/db-adresse';

const POOLER = 'aws-0-eu-central-1.pooler.supabase.com';

function befund(adresse: string) {
  const ergebnis = untersuche(adresse);
  if ('fehler' in ergebnis) throw new Error(`unerwarteter Fehler: ${ergebnis.fehler}`);
  return ergebnis;
}

describe('Verbindungsadresse', () => {
  describe('Bereinigung', () => {
    it('entfernt umschließende Anführungszeichen', () => {
      expect(bereinige('"postgresql://a:b@c:5432/d"')).toBe('postgresql://a:b@c:5432/d');
      expect(bereinige("'postgresql://a:b@c:5432/d'")).toBe('postgresql://a:b@c:5432/d');
    });

    it('entfernt einen vorangestellten Variablennamen', () => {
      expect(bereinige('DATABASE_URL="postgresql://a:b@c:5432/d"')).toBe(
        'postgresql://a:b@c:5432/d',
      );
      expect(bereinige('  DIRECT_URL=postgresql://a:b@c:5432/d\n')).toBe(
        'postgresql://a:b@c:5432/d',
      );
    });

    it('lässt eine saubere Adresse in Ruhe', () => {
      expect(bereinige('postgresql://a:b@c:5432/d')).toBe('postgresql://a:b@c:5432/d');
    });
  });

  describe('Sonderzeichen im Passwort', () => {
    // Der Grund für diesen Test: Ein maskiertes `#` dekodiert zu `#`. Wer die
    // dekodierte Form prüft, meldet die richtige Schreibweise als Fehler – und
    // schickt jemanden auf die Suche nach einem Problem, das es nicht gibt.
    it('schweigt, wenn das Sonderzeichen maskiert ist', () => {
      const ergebnis = befund(`postgresql://postgres.kennung:Ab%23cd1234@${POOLER}:5432/postgres`);

      expect(ergebnis.auffaelligkeiten).toEqual([]);
      // Gezählt wird die entschlüsselte Länge: `Ab%23cd1234` sind neun Zeichen.
      expect(ergebnis.passwortLaenge).toBe(9);
      expect(ergebnis.rechner).toBe(POOLER);
      expect(ergebnis.port).toBe('5432');
    });

    it('meldet ein unmaskiertes @', () => {
      const ergebnis = befund(`postgresql://postgres.kennung:Ab@cd@${POOLER}:5432/postgres`);

      expect(ergebnis.auffaelligkeiten).toEqual([expect.stringContaining('unmaskiert')]);
    });

    it('nennt den Schrägstrich beim Namen', () => {
      const ergebnis = untersuche(`postgresql://postgres.kennung:Ab/cd@${POOLER}:5432/postgres`);

      expect(ergebnis).toEqual({ fehler: expect.stringContaining('%2F') });
    });

    it('nennt die Raute beim Namen, wenn die Adresse daran zerbricht', () => {
      const ergebnis = untersuche(`postgresql://postgres.kennung:Ab#cd@${POOLER}:5432/postgres`);

      expect(ergebnis).toEqual({ fehler: expect.stringContaining('%23') });
    });
  });

  describe('Wiedererkennbare Fehlbedienungen', () => {
    it('erkennt den Platzhalter aus der Anleitung', () => {
      const ergebnis = befund(
        `postgresql://postgres.kennung:[YOUR-PASSWORD]@${POOLER}:5432/postgres`,
      );

      expect(ergebnis.auffaelligkeiten).toEqual([expect.stringContaining('Platzhalter')]);
    });

    it('erkennt den fehlenden Projektnamen beim Pooler', () => {
      const ergebnis = befund(`postgresql://postgres:geheim1234@${POOLER}:5432/postgres`);

      expect(ergebnis.auffaelligkeiten).toEqual([expect.stringContaining('postgres.<kennung>')]);
    });

    it('warnt vor der Direktverbindung, die nur über IPv6 geht', () => {
      const ergebnis = befund(
        'postgresql://postgres:geheim1234@db.kennung.supabase.co:5432/postgres',
      );

      expect(ergebnis.auffaelligkeiten).toEqual([expect.stringContaining('IPv6')]);
    });

    it('sagt es, wenn gar nichts gesetzt ist', () => {
      expect(untersuche(undefined)).toEqual({ fehler: expect.stringContaining('leer') });
      expect(untersuche('   ')).toEqual({ fehler: expect.stringContaining('leer') });
    });
  });

  describe('Maskierung', () => {
    it('gibt das Passwort nicht preis', () => {
      const ergebnis = befund(
        `postgresql://postgres.kennung:Ab%23cd1234@${POOLER}:6543/postgres?pgbouncer=true`,
      );

      expect(ergebnis.maskiert).not.toContain('cd1234');
      expect(ergebnis.maskiert).toContain('postgres.kennung:********@');
      expect(ergebnis.parameter).toEqual(['pgbouncer=true']);
    });
  });
});
