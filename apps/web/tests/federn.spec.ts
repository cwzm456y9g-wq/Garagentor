import {
  auslegen,
  baulaenge,
  beurteilen,
  biegespannung,
  drahtAusMessung,
  E_MODUL,
  federrate,
  haltemoment,
  hubUmdrehungen,
  mittelAusAussen,
  mittelAusInnen,
  moment,
  REIHEN_VORGABE,
  spannungsbeiwert,
  tragfaehigkeit,
  TROMMELN_VORGABE,
  werkstattlisten,
  wickelverhaeltnis,
  windungenAusLaenge,
  zugfestigkeit,
  type Feder,
} from '@/lib/federn';

/**
 * Der Federrechner.
 *
 * Eine falsch bestimmte Torsionsfeder ist nicht nur Ärger, sondern gefährlich:
 * Sie steht unter erheblicher Spannung, und eine zu kleine bricht früh. Die
 * Rechnung gehört deshalb bis in die Randfälle geprüft.
 */
describe('Torsionsfedern', () => {
  /** Eine übliche Sektionaltorfeder: 5 mm Draht, 67 mm außen, 70 Windungen. */
  const beispiel: Feder = { drahtMm: 5, mittelMm: 62, windungen: 70 };

  describe('Maße ineinander umrechnen', () => {
    it('rechnet vom Innendurchmesser auf die Mitte', () => {
      expect(mittelAusInnen(57, 5)).toBe(62);
    });

    it('rechnet vom Außendurchmesser auf die Mitte', () => {
      expect(mittelAusAussen(67, 5)).toBe(62);
    });

    it('nimmt die Drahtstärke aus einer Sammelmessung', () => {
      // 20 Windungen zusammengeschoben, 100 mm gemessen.
      expect(drahtAusMessung(100, 20)).toBe(5);
    });

    it('zählt die Windungen aus der Baulänge', () => {
      expect(windungenAusLaenge(350, 5)).toBe(70);
    });

    it('kommt von der Windungszahl wieder zur Baulänge', () => {
      expect(baulaenge(beispiel)).toBe(350);
    });

    it('nennt das Wickelverhältnis', () => {
      expect(wickelverhaeltnis(beispiel)).toBeCloseTo(12.4, 3);
    });
  });

  describe('Federrate', () => {
    it('rechnet die übliche Sektionaltorfeder', () => {
      // π · 206000 · 5⁴ / (32 · 62 · 70) = 2912 Nmm je Umdrehung
      expect(federrate(beispiel)).toBeCloseTo(2.912, 2);
    });

    it('geht mit der vierten Potenz der Drahtstärke', () => {
      // Der Grund, warum beim Ausmessen alles an der Drahtstärke hängt: ein
      // Draht doppelter Stärke ist sechzehnmal so steif.
      const duenn = federrate({ drahtMm: 4, mittelMm: 62, windungen: 70 });
      const dick = federrate({ drahtMm: 8, mittelMm: 62, windungen: 70 });

      expect(dick / duenn).toBeCloseTo(16, 6);
    });

    it('fällt umgekehrt mit der Windungszahl', () => {
      const kurz = federrate({ ...beispiel, windungen: 35 });

      expect(kurz / federrate(beispiel)).toBeCloseTo(2, 6);
    });

    it('fällt umgekehrt mit dem Windungsdurchmesser', () => {
      const eng = federrate({ ...beispiel, mittelMm: 31 });

      expect(eng / federrate(beispiel)).toBeCloseTo(2, 6);
    });

    it('rechnet das Moment linear zur Aufdrehung', () => {
      expect(moment(beispiel, 7.5)).toBeCloseTo(federrate(beispiel) * 7.5, 9);
      expect(moment(beispiel, 0)).toBe(0);
    });
  });

  describe('Biegespannung', () => {
    it('stimmt mit der Rechnung über das Moment überein', () => {
      // Zwei voneinander unabhängige Wege zur selben Zahl: einmal über die
      // Krümmungsänderung im Draht (E·d·Δn/(Dm·n)), einmal über das Moment und
      // das Widerstandsmoment (32·M/(π·d³)). Weichen sie ab, ist eine der
      // beiden Formeln falsch abgeschrieben.
      const umdrehungen = 7.5;
      const ueberMoment =
        (32 * moment(beispiel, umdrehungen) * 1000) / (Math.PI * beispiel.drahtMm ** 3);

      expect(biegespannung(beispiel, umdrehungen).roh).toBeCloseTo(ueberMoment, 6);
    });

    it('hängt nicht vom Moment ab, sondern von der Aufdrehung', () => {
      // Die für die Auslegung entscheidende Einsicht: Eine längere Feder mit
      // mehr Windungen leistet dasselbe Moment bei geringerer Spannung.
      const kurz: Feder = { drahtMm: 5, mittelMm: 62, windungen: 70 };
      const lang: Feder = { drahtMm: 5, mittelMm: 62, windungen: 140 };

      expect(biegespannung(lang, 7.5).roh).toBeCloseTo(biegespannung(kurz, 7.5).roh / 2, 6);
    });

    it('liegt bei der Beispielfeder im Bereich echter Torfedern', () => {
      // 206000 · 5 · 7,5 / (62 · 70) = 1780 N/mm². Torfedern arbeiten dicht an
      // der Zugfestigkeit – deshalb sind sie Verschleißteile.
      expect(biegespannung(beispiel, 7.5).roh).toBeCloseTo(1780, 0);
    });

    it('erhöht die Spannung um den Beiwert der Innenfaser', () => {
      const { roh, korrigiert, beiwert } = biegespannung(beispiel, 7.5);

      expect(beiwert).toBeGreaterThan(1);
      expect(korrigiert).toBeCloseTo(roh * beiwert, 9);
    });

    it('wächst linear mit der Aufdrehung', () => {
      expect(biegespannung(beispiel, 15).roh).toBeCloseTo(biegespannung(beispiel, 7.5).roh * 2, 6);
    });

    describe('Spannungsbeiwert', () => {
      it('liegt bei üblichen Torfedern zwischen 6 und 10 Prozent', () => {
        expect(spannungsbeiwert(12.4)).toBeCloseTo(1.064, 3);
        expect(spannungsbeiwert(8)).toBeGreaterThan(1.09);
        expect(spannungsbeiwert(8)).toBeLessThan(1.11);
      });

      it('geht bei sehr weiter Wicklung gegen eins', () => {
        // Je flacher der Draht gekrümmt ist, desto weniger unterscheidet sich
        // die Innenfaser vom geraden Balken.
        expect(spannungsbeiwert(1000)).toBeCloseTo(1, 2);
      });

      it('wird bei enger Wicklung deutlich größer', () => {
        expect(spannungsbeiwert(4)).toBeGreaterThan(spannungsbeiwert(12));
      });
    });
  });

  describe('Zugfestigkeit', () => {
    it('nennt den Tabellenwert an der Stützstelle', () => {
      expect(zugfestigkeit(5, 'DH')).toBe(1730);
    });

    it('rechnet zwischen den Stützstellen linear', () => {
      // Zwischen 5,0 mm (1730) und 6,0 mm (1670) liegt 5,5 mm bei 1700.
      expect(zugfestigkeit(5.5, 'DH')).toBe(1700);
    });

    it('fällt mit zunehmender Drahtstärke', () => {
      // Dünner gezogener Draht ist fester – deshalb trägt eine dicke Feder je
      // Quadratmillimeter weniger.
      expect(zugfestigkeit(3, 'DH')).toBeGreaterThan(zugfestigkeit(8, 'DH'));
    });

    it('bleibt außerhalb der Tabelle beim Randwert', () => {
      expect(zugfestigkeit(0.5, 'DH')).toBe(zugfestigkeit(1, 'DH'));
      expect(zugfestigkeit(20, 'DH')).toBe(zugfestigkeit(10, 'DH'));
    });

    it('unterscheidet die Güten', () => {
      expect(zugfestigkeit(5, 'VDSiCr')).toBeGreaterThan(zugfestigkeit(5, 'VDC'));
    });
  });

  describe('Beurteilung', () => {
    it('meldet reichlich Reserve unterhalb der zulässigen Spannung', () => {
      const urteil = beurteilen(1000, 1730);

      expect(urteil.ton).toBe('gut');
      expect(urteil.ausnutzung).toBeCloseTo(57.8, 1);
    });

    it('meldet den üblichen Bereich von Torfedern als knapp', () => {
      // 1780 von 1730 – über der statisch zulässigen Spannung, unter der
      // Zugfestigkeit. Genau dort liegen die meisten eingebauten Federn.
      const urteil = beurteilen(1600, 1730);

      expect(urteil.ton).toBe('knapp');
      expect(urteil.satz).toMatch(/Verschleißteile/);
    });

    it('rät bei knapper Feder zur größeren, nicht zur stärkeren', () => {
      // Ein dickerer Draht bei gleicher Windungszahl macht die Feder steifer,
      // aber nicht haltbarer – der Rat muß in die richtige Richtung zeigen.
      expect(beurteilen(1600, 1730).satz).toMatch(/längere Feder|größerer Windungsdurchmesser/);
    });

    it('warnt oberhalb der Zugfestigkeit', () => {
      const urteil = beurteilen(1900, 1730);

      expect(urteil.ton).toBe('kritisch');
      expect(urteil.ausnutzung).toBeGreaterThan(100);
    });

    it('zieht die Grenze bei genau 70 Prozent', () => {
      expect(beurteilen(700, 1000).ton).toBe('gut');
      expect(beurteilen(701, 1000).ton).toBe('knapp');
    });
  });

  describe('Die Torseite', () => {
    it('rechnet das Haltemoment aus Gewicht und Trommelradius', () => {
      // 100 kg an einer Trommel mit 46 mm Radius: 100 · 9,81 · 0,046 = 45,1 Nm
      expect(haltemoment(100, 46)).toBeCloseTo(45.13, 2);
    });

    it('zählt die Umdrehungen über den Torweg', () => {
      // 2500 mm Torhöhe, 46 mm Radius: Umfang 289 mm, also 8,65 Umdrehungen.
      expect(hubUmdrehungen(2500, 46)).toBeCloseTo(8.65, 2);
    });

    it('braucht bei größerer Trommel weniger Umdrehungen, aber mehr Moment', () => {
      expect(hubUmdrehungen(2500, 60)).toBeLessThan(hubUmdrehungen(2500, 46));
      expect(haltemoment(100, 60)).toBeGreaterThan(haltemoment(100, 46));
    });

    it('kehrt die Rechnung zur Tragfähigkeit sauber um', () => {
      const kg = tragfaehigkeit(beispiel, 7.5, 46, 2);

      expect(haltemoment(kg, 46)).toBeCloseTo(moment(beispiel, 7.5) * 2, 6);
    });

    it('trägt mit zwei Federn das Doppelte', () => {
      expect(tragfaehigkeit(beispiel, 7.5, 46, 2)).toBeCloseTo(
        tragfaehigkeit(beispiel, 7.5, 46, 1) * 2,
        6,
      );
    });

    it('nennt für die Beispielfeder ein glaubhaftes Torgewicht', () => {
      // Zwei dieser Federn bei 7,5 Umdrehungen an einer 46-mm-Trommel: rund
      // 97 kg – ein übliches Sektionaltor.
      expect(tragfaehigkeit(beispiel, 7.5, 46, 2)).toBeCloseTo(96.8, 1);
    });
  });

  describe('Auslegen', () => {
    const vorgabe = {
      gewichtKg: 120,
      hoeheMm: 2500,
      trommelRadiusMm: 46,
      anzahlFedern: 2,
      innenMm: 57,
      reserveUmdrehungen: 0.75,
      guete: 'DH' as const,
    };

    it('schlägt zu jeder handelsüblichen Drahtstärke eine Feder vor', () => {
      const vorschlaege = auslegen(vorgabe);

      expect(vorschlaege).toHaveLength(15);
      expect(vorschlaege.map((v) => v.drahtMm)).toContain(5);
    });

    it('trägt mit jedem Vorschlag ungefähr das vorgegebene Gewicht', () => {
      // Das ist die eigentliche Probe: Die Rundung auf ganze Windungen darf
      // das Ergebnis nicht nennenswert verschieben.
      for (const vorschlag of auslegen(vorgabe)) {
        expect(vorschlag.traegtKg).toBeGreaterThan(vorgabe.gewichtKg * 0.94);
        expect(vorschlag.traegtKg).toBeLessThan(vorgabe.gewichtKg * 1.06);
      }
    });

    it('rechnet mit ganzen Windungen – so wird gewickelt', () => {
      for (const vorschlag of auslegen(vorgabe)) {
        expect(Number.isInteger(vorschlag.windungen)).toBe(true);
      }
    });

    it('läßt Moment und Rate zum gerundeten Vorschlag passen', () => {
      for (const vorschlag of auslegen(vorgabe)) {
        expect(vorschlag.momentNm).toBeCloseTo(vorschlag.rateNm * vorschlag.spannUmdrehungen, 9);
        expect(vorschlag.baulaengeMm).toBeCloseTo(vorschlag.windungen * vorschlag.drahtMm, 9);
      }
    });

    it('braucht bei dickerem Draht mehr Windungen und mehr Platz', () => {
      const vorschlaege = auslegen(vorgabe);
      const duenn = vorschlaege.find((v) => v.drahtMm === 4)!;
      const dick = vorschlaege.find((v) => v.drahtMm === 7)!;

      expect(dick.windungen).toBeGreaterThan(duenn.windungen);
      expect(dick.baulaengeMm).toBeGreaterThan(duenn.baulaengeMm);
    });

    it('senkt mit dickerem Draht die Spannung – der Weg zu mehr Zyklen', () => {
      // Genau das ist der Rat, den die Beurteilung gibt. Wenn die Rechnung ihn
      // nicht stützt, ist der Rat falsch.
      const vorschlaege = auslegen(vorgabe);
      const duenn = vorschlaege.find((v) => v.drahtMm === 4)!;
      const dick = vorschlaege.find((v) => v.drahtMm === 7)!;

      expect(dick.spannungNmm2).toBeLessThan(duenn.spannungNmm2);
    });

    it('rechnet die Reserve auf die Hubumdrehungen', () => {
      const [erster] = auslegen(vorgabe);

      expect(erster.spannUmdrehungen).toBeCloseTo(hubUmdrehungen(2500, 46) + 0.75, 9);
    });

    it('merkt an, was nicht mehr auf die Welle paßt', () => {
      const eng = auslegen({ ...vorgabe, maxLaengeMm: 400 });

      expect(eng.filter((v) => v.passtAufWelle).length).toBeGreaterThan(0);
      expect(eng.filter((v) => !v.passtAufWelle).length).toBeGreaterThan(0);
      for (const vorschlag of eng) {
        expect(vorschlag.passtAufWelle).toBe(vorschlag.baulaengeMm <= 400);
      }
    });

    it('gilt ohne Längenangabe als überall passend', () => {
      for (const vorschlag of auslegen(vorgabe)) {
        expect(vorschlag.passtAufWelle).toBe(true);
      }
    });

    it('braucht bei mehr Federn je Feder weniger Windungen', () => {
      const einzeln = auslegen({ ...vorgabe, anzahlFedern: 1 });
      const doppelt = auslegen({ ...vorgabe, anzahlFedern: 2 });
      const draht = (liste: typeof einzeln) => liste.find((v) => v.drahtMm === 5)!;

      expect(draht(doppelt).windungen).toBeGreaterThan(draht(einzeln).windungen);
    });

    it('setzt beim Elastizitätsmodul den Wert für Federstahl an', () => {
      expect(E_MODUL).toBe(206_000);
    });

    it('rechnet nur die Stärken, die die gewählte Reihe führt', () => {
      const eng = auslegen({ ...vorgabe, drahtstaerken: [5, 6, 7] });

      expect(eng.map((v) => v.drahtMm)).toEqual([5, 6, 7]);
    });

    it('bringt eine unsortierte Stärkenliste in Ordnung', () => {
      const eng = auslegen({ ...vorgabe, drahtstaerken: [7, 5, 6] });

      expect(eng.map((v) => v.drahtMm)).toEqual([5, 6, 7]);
    });

    it('nimmt bei leerer Stärkenliste wieder alle handelsüblichen', () => {
      expect(auslegen({ ...vorgabe, drahtstaerken: [] })).toHaveLength(15);
    });

    it('rechnet eine geführte Sonderstärke mit', () => {
      // Die Reihe des Lieferanten muß nicht auf die eigene Liste passen.
      const [einziger] = auslegen({ ...vorgabe, drahtstaerken: [5.6] });

      expect(einziger.drahtMm).toBe(5.6);
      expect(einziger.traegtKg).toBeGreaterThan(vorgabe.gewichtKg * 0.94);
    });
  });
});

describe('Trommeln und Federreihen des Betriebs', () => {
  it('nimmt hinterlegte Listen an', () => {
    const listen = werkstattlisten({
      trommeln: [{ name: 'Halle 2', radiusMm: 52 }],
      reihen: [{ name: 'Reihe A', innenMm: 67, drahtstaerken: [5, 6] }],
    });

    expect(listen.trommeln).toEqual([{ name: 'Halle 2', radiusMm: 52 }]);
    expect(listen.reihen[0].drahtstaerken).toEqual([5, 6]);
  });

  it('fällt ohne Einstellung auf die Vorgaben zurück', () => {
    // Wer den Rechner zum ersten Mal öffnet, soll etwas zur Auswahl haben.
    expect(werkstattlisten(null).trommeln).toEqual(TROMMELN_VORGABE);
    expect(werkstattlisten(undefined).reihen).toEqual(REIHEN_VORGABE);
  });

  it('fällt auch bei Unsinn auf die Vorgaben zurück', () => {
    // Die Einstellung ist freies JSON. Eine leere Auswahl am Tor wäre
    // schlimmer als eine mit Vorgaben.
    expect(werkstattlisten('kaputt').trommeln).toEqual(TROMMELN_VORGABE);
    expect(werkstattlisten({ trommeln: 'nein' }).trommeln).toEqual(TROMMELN_VORGABE);
  });

  it('wirft einzelne unbrauchbare Einträge weg, behält die guten', () => {
    const listen = werkstattlisten({
      trommeln: [
        { name: 'gut', radiusMm: 46 },
        { name: '', radiusMm: 46 },
        { name: 'ohne Radius' },
        { name: 'Radius null', radiusMm: 0 },
        null,
      ],
      reihen: [],
    });

    expect(listen.trommeln).toEqual([{ name: 'gut', radiusMm: 46 }]);
  });

  it('sortiert die Drahtstärken und wirft unbrauchbare heraus', () => {
    const listen = werkstattlisten({
      trommeln: [],
      reihen: [{ name: 'Reihe', innenMm: 67, drahtstaerken: [6, 'x', -1, 5, 0] }],
    });

    expect(listen.reihen[0].drahtstaerken).toEqual([5, 6]);
  });

  it('nimmt eine Reihe ohne Stärkenangabe an', () => {
    const listen = werkstattlisten({
      trommeln: [],
      reihen: [{ name: 'Reihe', innenMm: 67 }],
    });

    expect(listen.reihen[0].drahtstaerken).toEqual([]);
  });

  it('räumt Leerzeichen aus den Bezeichnungen', () => {
    const listen = werkstattlisten({
      trommeln: [{ name: '  Halle 2  ', radiusMm: 52 }],
      reihen: [],
    });

    expect(listen.trommeln[0].name).toBe('Halle 2');
  });
});
