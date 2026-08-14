import { aufOkSetzen, fehlendeMesswerte, offenePunkte } from '@/lib/pruefpunkte';

/**
 * Das Sammelsetzen der Prüfpunkte.
 *
 * Der Griff spart 28 von 31 Klicks – und darf dabei nichts verlieren und
 * nichts behaupten. Beides steht hier auf dem Prüfstand.
 */
describe('Prüfpunkte auf „in Ordnung" setzen', () => {
  const katalog = [
    { key: 'SICHT_TORBLATT' },
    { key: 'SICHT_FUEHRUNG' },
    { key: 'SCHUTZ_LICHTSCHRANKE' },
    { key: 'MESS_SCHLIESSKRAFT', limitValue: 400 },
    { key: 'MESS_RESTKRAFT', limitValue: 150 },
  ];

  const offen = { result: 'NICHT_GEPRUEFT', measuredValue: '' };

  it('setzt die offenen Punkte ohne Grenzwert', () => {
    const stand = aufOkSetzen(katalog, {
      SICHT_TORBLATT: offen,
      SICHT_FUEHRUNG: offen,
      SCHUTZ_LICHTSCHRANKE: offen,
      MESS_SCHLIESSKRAFT: offen,
      MESS_RESTKRAFT: offen,
    });

    expect(stand.SICHT_TORBLATT.result).toBe('OK');
    expect(stand.SICHT_FUEHRUNG.result).toBe('OK');
    expect(stand.SCHUTZ_LICHTSCHRANKE.result).toBe('OK');
  });

  it('läßt Meßpunkte ohne Wert in Ruhe – sonst stünde eine Messung im Protokoll, die keine war', () => {
    const stand = aufOkSetzen(katalog, {
      MESS_SCHLIESSKRAFT: offen,
      MESS_RESTKRAFT: offen,
    });

    expect(stand.MESS_SCHLIESSKRAFT.result).toBe('NICHT_GEPRUEFT');
    expect(stand.MESS_RESTKRAFT.result).toBe('NICHT_GEPRUEFT');
  });

  it('setzt einen Meßpunkt mit, sobald der Wert dasteht', () => {
    const stand = aufOkSetzen(katalog, {
      MESS_SCHLIESSKRAFT: { result: 'NICHT_GEPRUEFT', measuredValue: '320' },
    });

    expect(stand.MESS_SCHLIESSKRAFT.result).toBe('OK');
    expect(stand.MESS_SCHLIESSKRAFT.measuredValue).toBe('320');
  });

  it('überschreibt keinen eingetragenen Mangel', () => {
    // Der wichtigste Fall: Wer einen Mangel gefunden hat, darf ihn nicht
    // durch einen Griff auf „alles in Ordnung" verlieren.
    const stand = aufOkSetzen(katalog, {
      SICHT_TORBLATT: { result: 'MANGEL', measuredValue: '' },
      SICHT_FUEHRUNG: offen,
    });

    expect(stand.SICHT_TORBLATT.result).toBe('MANGEL');
    expect(stand.SICHT_FUEHRUNG.result).toBe('OK');
  });

  it('rührt auch „nicht zutreffend" nicht an', () => {
    const stand = aufOkSetzen(katalog, {
      SCHUTZ_LICHTSCHRANKE: { result: 'NICHT_ZUTREFFEND', measuredValue: '' },
    });

    expect(stand.SCHUTZ_LICHTSCHRANKE.result).toBe('NICHT_ZUTREFFEND');
  });

  it('behält Meßwert und Bemerkung des Punktes', () => {
    const stand = aufOkSetzen([{ key: 'SICHT_TORBLATT' }], {
      SICHT_TORBLATT: {
        result: 'NICHT_GEPRUEFT',
        measuredValue: '',
        comment: 'Lackschaden, ohne Einfluß auf die Funktion',
      } as never,
    });

    expect(stand.SICHT_TORBLATT.result).toBe('OK');
    expect((stand.SICHT_TORBLATT as { comment?: string }).comment).toBe(
      'Lackschaden, ohne Einfluß auf die Funktion',
    );
  });

  it('läßt Punkte anderer Gruppen unberührt', () => {
    // Der Knopf je Gruppe bekommt nur seine eigenen Punkte.
    const stand = aufOkSetzen([{ key: 'SICHT_TORBLATT' }], {
      SICHT_TORBLATT: offen,
      SCHUTZ_LICHTSCHRANKE: offen,
    });

    expect(stand.SICHT_TORBLATT.result).toBe('OK');
    expect(stand.SCHUTZ_LICHTSCHRANKE.result).toBe('NICHT_GEPRUEFT');
  });

  it('verändert den übergebenen Stand nicht', () => {
    const vorher = { SICHT_TORBLATT: offen };
    aufOkSetzen(katalog, vorher);

    expect(vorher.SICHT_TORBLATT.result).toBe('NICHT_GEPRUEFT');
  });

  describe('Auskunft für die Oberfläche', () => {
    it('zählt die offenen Punkte', () => {
      const staende = {
        SICHT_TORBLATT: { result: 'OK', measuredValue: '' },
        SICHT_FUEHRUNG: offen,
        MESS_SCHLIESSKRAFT: offen,
      };

      expect(offenePunkte(katalog, staende).map((p) => p.key)).toEqual([
        'SICHT_FUEHRUNG',
        'SCHUTZ_LICHTSCHRANKE',
        'MESS_SCHLIESSKRAFT',
        'MESS_RESTKRAFT',
      ]);
    });

    it('benennt genau die Punkte, die auf einen Meßwert warten', () => {
      const staende = {
        SICHT_TORBLATT: offen,
        MESS_SCHLIESSKRAFT: { result: 'NICHT_GEPRUEFT', measuredValue: '320' },
        MESS_RESTKRAFT: offen,
      };

      expect(fehlendeMesswerte(katalog, staende).map((p) => p.key)).toEqual(['MESS_RESTKRAFT']);
    });

    it('meldet nichts Offenes, wenn alles beurteilt ist', () => {
      const fertig = Object.fromEntries(
        katalog.map((p) => [p.key, { result: 'OK', measuredValue: '1' }]),
      );

      expect(offenePunkte(katalog, fertig)).toHaveLength(0);
      expect(fehlendeMesswerte(katalog, fertig)).toHaveLength(0);
    });
  });
});
