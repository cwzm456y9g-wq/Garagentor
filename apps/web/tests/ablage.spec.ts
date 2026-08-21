/**
 * Die Dateiablage und ihre Prüfung.
 *
 * Ohne eingerichtete Ablage schlägt jeder Upload fehl – das ist gewollt, denn
 * eine Datei, die nirgends liegt, wäre schlimmer als eine Fehlermeldung. Was
 * hier geprüft wird, ist die Auskunft darüber: Sie muß sagen, was fehlt, wo es
 * hingehört und woran man den richtigen Schlüssel erkennt.
 */

const umgebung = { ...process.env };

beforeEach(() => {
  // Die Konfiguration verlangt eine Datenbankadresse, auch wenn hier keine
  // Datenbank angefaßt wird – ohne sie käme die falsche Fehlermeldung.
  process.env.DATABASE_URL = 'postgresql://pruefung@127.0.0.1:5432/pruefung';
});

afterEach(() => {
  process.env = { ...umgebung };
  jest.resetModules();
});

/** Lädt das Modul neu, damit die Konfiguration frisch gelesen wird. */
async function ablageModul() {
  jest.resetModules();
  return import('@/server/ablage');
}

describe('Dateiablage', () => {
  describe('Zustand', () => {
    it('meldet „nicht eingerichtet", solange die Werte fehlen', async () => {
      delete process.env.SUPABASE_URL;
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;

      const { ablageStatus } = await ablageModul();
      const status = ablageStatus();

      expect(status.eingerichtet).toBe(false);
      expect(status.schluesselGesetzt).toBe(false);
    });

    it('gibt den Schlüssel nicht heraus, nur daß es einen gibt', async () => {
      process.env.SUPABASE_URL = 'https://kennung.supabase.co';
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'streng-geheimer-dienstschluessel';

      const { ablageStatus } = await ablageModul();
      const status = ablageStatus();

      expect(status.eingerichtet).toBe(true);
      expect(status.schluesselGesetzt).toBe(true);
      // Der Schlüssel darf in keinem Feld auftauchen.
      expect(JSON.stringify(status)).not.toContain('streng-geheimer');
    });

    it('nennt das voreingestellte Ablagefach', async () => {
      delete process.env.SUPABASE_BUCKET;

      const { ablageStatus } = await ablageModul();

      expect(ablageStatus().bucket).toBe('dokumente');
    });
  });

  describe('Prüfung ohne Einrichtung', () => {
    it('sagt, welche Werte fehlen und wo der Schlüssel steht', async () => {
      delete process.env.SUPABASE_URL;
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;

      const { ablagePruefen } = await ablageModul();
      const befund = await ablagePruefen();

      expect(befund.ok).toBe(false);
      expect(befund.meldung).toContain('keine Dateiablage hinterlegt');
      expect(befund.rat).toContain('SUPABASE_SERVICE_ROLE_KEY');
      expect(befund.rat).toContain('service_role');
      expect(befund.schritte).toHaveLength(0);
    });

    it('spricht die Ablage dabei gar nicht erst an', async () => {
      delete process.env.SUPABASE_URL;
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;

      // Ein Netzzugriff wäre hier ein Fehler: Ohne Adresse gibt es nichts
      // anzusprechen, und der Aufruf soll sofort antworten.
      const holen = jest.spyOn(globalThis, 'fetch');

      const { ablagePruefen } = await ablageModul();
      await ablagePruefen();

      expect(holen).not.toHaveBeenCalled();
      holen.mockRestore();
    });
  });

  describe('Fehlermeldung beim Hochladen', () => {
    it('nennt hPanel und den Weg zur Prüfung, nicht nur die Variablennamen', async () => {
      delete process.env.SUPABASE_URL;
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;

      const { ablegen } = await ablageModul();

      await expect(ablegen('a/b.txt', Buffer.from('x'), 'text/plain')).rejects.toThrow(/hPanel/);
      await expect(ablegen('a/b.txt', Buffer.from('x'), 'text/plain')).rejects.toThrow(
        /Dateiablage/,
      );
    });
  });
});

/**
 * Die Obergrenze für Uploads.
 *
 * Sie steht in der Umgebung, wird aber an zwei Stellen gebraucht: Der Server
 * weist zu große Dateien ab, und die Oberfläche soll die Zahl nennen, bevor
 * jemand eine Datei aussucht. Beide müssen dieselbe Zahl sehen – eine zweite,
 * fest eingetragene Angabe im Formular wäre nach der ersten Änderung falsch.
 */
describe('Obergrenze für Uploads', () => {
  it('meldet die Grenze aus der Umgebung in Megabyte', async () => {
    process.env.MAX_UPLOAD_MB = '50';
    const { ablageStatus } = await ablageModul();

    expect(ablageStatus().maxMb).toBe(50);
  });

  it('nimmt ohne Angabe 50 MB an', async () => {
    delete process.env.MAX_UPLOAD_MB;
    const { ablageStatus } = await ablageModul();

    expect(ablageStatus().maxMb).toBe(50);
  });

  it('folgt einer abweichenden Vorgabe', async () => {
    process.env.MAX_UPLOAD_MB = '10';
    const { ablageStatus } = await ablageModul();

    expect(ablageStatus().maxMb).toBe(10);
  });
});
