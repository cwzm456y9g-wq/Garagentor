import {
  ASR_A17_CHECK_CATALOG,
  checkCatalogFor,
  CLOSING_FORCE_LIMITS,
  INSPECTION_INTERVAL_MONTHS,
  addMonths,
} from '@garagentor/shared';
import { OperationMode } from '@prisma/client';

describe('Prüfkatalog nach ASR A1.7', () => {
  it('enthält eindeutige Prüfpunktschlüssel', () => {
    const keys = ASR_A17_CHECK_CATALOG.map((check) => check.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('verweist bei jedem Prüfpunkt auf ein Regelwerk', () => {
    for (const check of ASR_A17_CHECK_CATALOG) {
      expect(check.reference).toBeTruthy();
      expect(check.group).toBeTruthy();
      expect(check.label).toBeTruthy();
    }
  });

  it('lässt bei handbetätigten Anlagen die Antriebs- und Schutzpunkte aus', () => {
    const manual = checkCatalogFor(OperationMode.HANDBETAETIGT);
    const powered = checkCatalogFor(OperationMode.KRAFTBETAETIGT);

    expect(manual.length).toBeLessThan(powered.length);
    expect(manual.some((check) => check.poweredOnly)).toBe(false);
    // Bauliche Prüfpunkte gelten unabhängig von der Betriebsart.
    expect(manual.map((check) => check.key)).toContain('BAU_TORBLATT');
    expect(manual.map((check) => check.key)).toContain('SICH_ABSTURZ');
    // Die Kraftmessung ist nur bei kraftbetätigten Anlagen zu erbringen.
    expect(manual.map((check) => check.key)).not.toContain('MESS_KRAFT_DYNAMISCH');
  });

  it('prüft kraftbetätigte Anlagen mit dem vollständigen Katalog', () => {
    expect(checkCatalogFor(OperationMode.KRAFTBETAETIGT)).toHaveLength(
      ASR_A17_CHECK_CATALOG.length,
    );
  });

  it('führt die Grenzwerte der Kraftmessung nach DIN EN 12453 mit', () => {
    const dynamic = ASR_A17_CHECK_CATALOG.find((check) => check.key === 'MESS_KRAFT_DYNAMISCH');
    const remaining = ASR_A17_CHECK_CATALOG.find((check) => check.key === 'MESS_KRAFT_REST');

    expect(dynamic?.measurement).toEqual({ unit: 'N', limit: 400 });
    expect(remaining?.measurement).toEqual({ unit: 'N', limit: 150 });
    expect(CLOSING_FORCE_LIMITS.maxDynamicForceN).toBe(400);
    expect(CLOSING_FORCE_LIMITS.maxRemainingForceN).toBe(150);
    expect(CLOSING_FORCE_LIMITS.maxDynamicDurationMs).toBe(750);
  });

  it('deckt die in ASR A1.7 geforderten Prüfbereiche ab', () => {
    const groups = new Set(ASR_A17_CHECK_CATALOG.map((check) => check.group));

    for (const expected of [
      'Dokumentation',
      'Bauteile',
      'Gewichtsausgleich',
      'Sicherungen',
      'Quetsch- und Scherstellen',
      'Antrieb',
      'Schutzeinrichtungen',
      'Kraftmessung',
      'Elektrik',
      'Umfeld',
      'Funktion',
    ]) {
      expect(groups).toContain(expected);
    }
  });
});

describe('Prüffrist', () => {
  it('beträgt zwölf Monate (ASR A1.7 Abs. 10)', () => {
    expect(INSPECTION_INTERVAL_MONTHS).toBe(12);
  });

  it('rechnet Monatsenden korrekt fort', () => {
    // 31.01. plus ein Monat ergibt den 28.02., nicht den 03.03.
    expect(addMonths(new Date(2026, 0, 31), 1)).toEqual(new Date(2026, 1, 28));
    expect(addMonths(new Date(2026, 2, 15), 12)).toEqual(new Date(2027, 2, 15));
    // Schaltjahr.
    expect(addMonths(new Date(2028, 0, 31), 1)).toEqual(new Date(2028, 1, 29));
  });
});
