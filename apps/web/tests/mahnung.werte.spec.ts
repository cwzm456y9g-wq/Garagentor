import { DUNNING_TEXTS } from '@garagentor/shared';
import { DunningLevel } from '@prisma/client';
import { mahntext } from '@/server/dienste/pdf/mahnung.werte';

describe('Mahntexte', () => {
  it('kennt jede Mahnstufe', () => {
    // Eine neue Stufe ohne Text fiele stillschweigend auf die erste Mahnung
    // zurück – der Kunde bekäme dann den falschen Ton zu lesen.
    for (const level of Object.values(DunningLevel)) {
      expect(DUNNING_TEXTS[level]).toBeDefined();
    }
  });

  it('setzt die Frist in den Schlusssatz ein', () => {
    const text = mahntext('MAHNUNG_1', '15.08.2026');

    expect(text.schluss).toContain('15.08.2026');
    expect(text.schluss).not.toContain('{frist}');
  });

  it('benennt die Stufe im Klartext', () => {
    expect(mahntext('ZAHLUNGSERINNERUNG', '01.01.2026').bezeichnung).toBe('Zahlungserinnerung');
    expect(mahntext('LETZTE_MAHNUNG', '01.01.2026').bezeichnung).toBe('Letzte Mahnung');
  });

  it('steigert den Ton von Stufe zu Stufe', () => {
    // Die Zahlungserinnerung unterstellt ein Versehen, die letzte Mahnung
    // kündigt konkrete Schritte an.
    expect(mahntext('ZAHLUNGSERINNERUNG', '01.01.2026').anschreiben).toContain('gegenstandslos');
    expect(mahntext('LETZTE_MAHNUNG', '01.01.2026').anschreiben).toContain('gerichtliche');
  });

  it('bricht bei einer unbekannten Stufe nicht ab', () => {
    const text = mahntext('GIBT_ES_NICHT', '01.01.2026');

    expect(text.bezeichnung).toBe('Mahnung');
    expect(text.anschreiben.length).toBeGreaterThan(0);
    expect(text.schluss).toContain('01.01.2026');
  });
});
