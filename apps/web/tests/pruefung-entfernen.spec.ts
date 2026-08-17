import { DefectStatus } from '@prisma/client';

const prismaMock = {
  inspection: { findUnique: jest.fn(), delete: jest.fn() },
  defect: { findUnique: jest.fn(), delete: jest.fn() },
};

jest.mock('@/server/prisma', () => ({ prisma: prismaMock }));

import { inspectionsService } from '@/server/dienste/doors/inspections.service';

/**
 * Löschen von Prüfprotokollen und Mängeln.
 *
 * Beides fehlte bisher ganz: Ein an der falschen Anlage begonnenes Protokoll
 * und ein versehentlich angelegter Mangel blieben für immer stehen. Beim
 * Nachrüsten ist die Grenze wichtiger als die Möglichkeit – was Nachweis ist,
 * darf nicht verschwinden.
 */
beforeEach(() => jest.clearAllMocks());

describe('Prüfprotokoll entfernen', () => {
  it('entfernt ein angefangenes Protokoll', () => {
    prismaMock.inspection.findUnique.mockResolvedValue({
      id: 'pr1',
      inspectionNumber: 'PR-2026-0007',
      completedAt: null,
    });

    return inspectionsService.remove('pr1').then((ergebnis) => {
      expect(ergebnis).toEqual({ deleted: true, id: 'pr1' });
      expect(prismaMock.inspection.delete).toHaveBeenCalledWith({ where: { id: 'pr1' } });
    });
  });

  it('weist ein abgeschlossenes Protokoll ab', async () => {
    // Der wichtigste Fall: Ein abgeschlossenes Protokoll ist der Nachweis, daß
    // geprüft wurde. Genau danach wird im Schadensfall gefragt.
    prismaMock.inspection.findUnique.mockResolvedValue({
      id: 'pr1',
      inspectionNumber: 'PR-2026-0003',
      completedAt: new Date(),
    });

    await expect(inspectionsService.remove('pr1')).rejects.toMatchObject({ status: 409 });
    expect(prismaMock.inspection.delete).not.toHaveBeenCalled();
  });

  it('nennt die Protokollnummer in der Absage', async () => {
    prismaMock.inspection.findUnique.mockResolvedValue({
      id: 'pr1',
      inspectionNumber: 'PR-2026-0003',
      completedAt: new Date(),
    });

    await expect(inspectionsService.remove('pr1')).rejects.toThrow(/PR-2026-0003/);
  });

  it('meldet ein unbekanntes Protokoll als nicht gefunden', async () => {
    prismaMock.inspection.findUnique.mockResolvedValue(null);

    await expect(inspectionsService.remove('weg')).rejects.toMatchObject({ status: 404 });
  });
});

describe('Mangel entfernen', () => {
  const offen = {
    id: 'm1',
    status: DefectStatus.OFFEN,
    title: 'Versehentlich angelegt',
    inspection: null,
  };

  it('entfernt einen offenen Mangel ohne Protokollbezug', async () => {
    prismaMock.defect.findUnique.mockResolvedValue(offen);

    expect(await inspectionsService.removeDefect('m1')).toEqual({ deleted: true, id: 'm1' });
  });

  it('behält einen behobenen Mangel', async () => {
    // Er dokumentiert eine Instandsetzung und gehört zur Anlagenhistorie.
    prismaMock.defect.findUnique.mockResolvedValue({ ...offen, status: DefectStatus.BEHOBEN });

    await expect(inspectionsService.removeDefect('m1')).rejects.toMatchObject({ status: 409 });
    expect(prismaMock.defect.delete).not.toHaveBeenCalled();
  });

  it('behält auch einen akzeptierten Mangel', async () => {
    prismaMock.defect.findUnique.mockResolvedValue({ ...offen, status: DefectStatus.AKZEPTIERT });

    await expect(inspectionsService.removeDefect('m1')).rejects.toMatchObject({ status: 409 });
  });

  it('löst keinen Mangel aus einem abgeschlossenen Protokoll heraus', async () => {
    // Er gehört zum Befund dieses Protokolls – sonst stimmte der Nachweis
    // nicht mehr mit der Mängelliste überein.
    prismaMock.defect.findUnique.mockResolvedValue({
      ...offen,
      inspection: { inspectionNumber: 'PR-2026-0003', completedAt: new Date() },
    });

    await expect(inspectionsService.removeDefect('m1')).rejects.toThrow(/PR-2026-0003/);
  });

  it('läßt einen Mangel aus einem noch offenen Protokoll zu', async () => {
    // Solange das Protokoll ein Zwischenstand ist, ist es auch der Mangel.
    prismaMock.defect.findUnique.mockResolvedValue({
      ...offen,
      inspection: { inspectionNumber: 'PR-2026-0009', completedAt: null },
    });

    expect(await inspectionsService.removeDefect('m1')).toEqual({ deleted: true, id: 'm1' });
  });

  it('meldet einen unbekannten Mangel als nicht gefunden', async () => {
    prismaMock.defect.findUnique.mockResolvedValue(null);

    await expect(inspectionsService.removeDefect('weg')).rejects.toMatchObject({ status: 404 });
  });
});
