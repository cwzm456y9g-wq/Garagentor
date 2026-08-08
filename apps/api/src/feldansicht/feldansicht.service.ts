import { Injectable } from '@nestjs/common';
import { AppointmentStatus, ServiceReportStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Tagesansicht für den Einsatz vor Ort.
 *
 * Die übrigen Seiten sind zum Verwalten gebaut: lange Listen, viele Spalten,
 * Filter. Auf dem Telefon in der Einfahrt zählt etwas anderes – was heute
 * ansteht, was davon noch offen ist und wie es weitergeht. Deshalb sammelt
 * dieser Dienst genau das in einem Aufruf, statt die Feldansicht ein halbes
 * Dutzend Listen abklappern zu lassen.
 */

function tagesBeginn(datum: Date): Date {
  const anfang = new Date(datum);
  anfang.setHours(0, 0, 0, 0);
  return anfang;
}

function tagesEnde(datum: Date): Date {
  const ende = new Date(datum);
  ende.setHours(23, 59, 59, 999);
  return ende;
}

@Injectable()
export class FeldansichtService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Der Tag einer Person. Ohne verknüpften Mitarbeiterdatensatz – etwa beim
   * reinen Büro-Konto – bleiben die persönlichen Listen leer, statt den Tag
   * des ganzen Betriebs auszugeben.
   */
  async meinTag(userId: string, datum?: string) {
    const tag = datum ? new Date(datum) : new Date();
    const von = tagesBeginn(tag);
    const bis = tagesEnde(tag);

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { employeeId: true },
    });
    const employeeId = user?.employeeId ?? null;

    if (!employeeId) {
      return {
        datum: von,
        mitarbeiter: null,
        termine: [],
        offeneProtokolle: [],
        offeneBerichte: [],
        stundenHeute: 0,
        dringendeMaengel: [],
      };
    }

    const [mitarbeiter, termine, offeneProtokolle, offeneBerichte, zeiten, dringendeMaengel] =
      await Promise.all([
        this.prisma.employee.findUnique({
          where: { id: employeeId },
          select: { id: true, firstName: true, lastName: true },
        }),

        this.prisma.appointment.findMany({
          where: {
            start: { lte: bis },
            end: { gte: von },
            status: { not: AppointmentStatus.ABGESAGT },
            assignees: { some: { id: employeeId } },
          },
          include: {
            customer: { select: { id: true, companyName: true, firstName: true, lastName: true } },
            site: { select: { name: true, street: true, zip: true, city: true } },
            order: { select: { id: true, orderNumber: true, subject: true } },
          },
          orderBy: { start: 'asc' },
        }),

        // Angefangene Protokolle bleiben offen, bis sie unterschrieben sind –
        // sie gehören auf den Tag, an dem sie fertig werden sollen.
        this.prisma.inspection.findMany({
          where: { completedAt: null, inspectorId: employeeId },
          include: {
            door: {
              select: {
                id: true,
                doorNumber: true,
                location: true,
                customer: { select: { companyName: true, firstName: true, lastName: true } },
              },
            },
            _count: {
              select: {
                checks: true,
                // Gefiltert gezählt: so steht der Fortschritt in der Liste,
                // ohne dass die Feldansicht jedes Protokoll einzeln laden muss.
                defects: true,
              },
            },
            checks: { where: { result: 'NICHT_GEPRUEFT' }, select: { id: true } },
          },
          orderBy: { date: 'asc' },
          take: 20,
        }),

        this.prisma.serviceReport.findMany({
          where: { status: ServiceReportStatus.ENTWURF, technicianId: employeeId },
          include: {
            door: { select: { id: true, doorNumber: true, location: true } },
            order: { select: { id: true, orderNumber: true, subject: true } },
          },
          orderBy: { date: 'asc' },
          take: 20,
        }),

        this.prisma.timeEntry.findMany({
          where: { employeeId, date: { gte: von, lte: bis } },
          select: { hours: true },
        }),

        // Gefahr im Verzug heißt: die Anlage steht still, bis der Mangel
        // behoben ist. Das gehört jedem Monteur vor Augen, nicht nur dem, der
        // ihn aufgenommen hat.
        this.prisma.defect.findMany({
          where: { status: { in: ['OFFEN', 'IN_BEARBEITUNG'] }, severity: 'GEFAHR_IM_VERZUG' },
          include: {
            door: {
              select: {
                id: true,
                doorNumber: true,
                location: true,
                customer: { select: { companyName: true, firstName: true, lastName: true } },
              },
            },
          },
          orderBy: { createdAt: 'asc' },
          take: 10,
        }),
      ]);

    return {
      datum: von,
      mitarbeiter,
      termine,
      offeneProtokolle: offeneProtokolle.map(({ checks, ...protokoll }) => ({
        ...protokoll,
        // Der Fortschritt spart den Aufruf der Detailseite, nur um zu sehen,
        // wie viel noch fehlt.
        offenePunkte: checks.length,
      })),
      offeneBerichte,
      stundenHeute:
        Math.round(zeiten.reduce((summe, eintrag) => summe + eintrag.hours.toNumber(), 0) * 100) /
        100,
      dringendeMaengel,
    };
  }
}
