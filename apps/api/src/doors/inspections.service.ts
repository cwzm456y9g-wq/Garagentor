import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  addDays,
  addMonths,
  checkCatalogFor,
  INSPECTION_INTERVAL_MONTHS,
  type InspectionCheckDefinition,
  type Paginated,
} from '@garagentor/shared';
import {
  CheckResult,
  DefectSeverity,
  DefectStatus,
  InspectionResult,
  InspectionType,
  Prisma,
} from '@prisma/client';
import { paginate } from '../common/dto/pagination.dto';
import { NumberRangeService } from '../common/numbering/number-range.service';
import { PrismaService } from '../prisma/prisma.service';
import { DoorsService } from './doors.service';
import type {
  CompleteInspectionDto,
  CreateDefectDto,
  DefectQueryDto,
  InspectionQueryDto,
  RecordChecksDto,
  ResolveDefectDto,
  StartInspectionDto,
} from './dto/inspection.dto';

/** Frist zur Mängelbehebung je Schweregrad in Tagen. */
const DEFECT_DEADLINE_DAYS: Record<DefectSeverity, number> = {
  GEFAHR_IM_VERZUG: 0,
  ERHEBLICH: 14,
  GERING: 60,
  HINWEIS: 180,
};

@Injectable()
export class InspectionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly numbers: NumberRangeService,
    private readonly doors: DoorsService,
  ) {}

  async findAll(query: InspectionQueryDto): Promise<Paginated<unknown>> {
    const where: Prisma.InspectionWhereInput = {
      ...(query.doorId ? { doorId: query.doorId } : {}),
      ...(query.customerId ? { door: { customerId: query.customerId } } : {}),
      ...(query.type ? { type: query.type } : {}),
      ...(query.openOnly ? { completedAt: null } : {}),
      ...(query.from || query.to
        ? {
            date: {
              ...(query.from ? { gte: new Date(query.from) } : {}),
              ...(query.to ? { lte: new Date(query.to) } : {}),
            },
          }
        : {}),
      ...(query.search
        ? {
            OR: [
              { inspectionNumber: { contains: query.search, mode: 'insensitive' } },
              { inspectorName: { contains: query.search, mode: 'insensitive' } },
              { door: { doorNumber: { contains: query.search, mode: 'insensitive' } } },
              { door: { location: { contains: query.search, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.inspection.findMany({
        where,
        include: {
          door: {
            select: {
              id: true,
              doorNumber: true,
              location: true,
              type: true,
              customer: { select: { id: true, companyName: true, lastName: true } },
            },
          },
          _count: { select: { defects: true } },
        },
        orderBy: { date: 'desc' },
        skip: query.skip,
        take: query.take,
      }),
      this.prisma.inspection.count({ where }),
    ]);

    return paginate(items, total, query);
  }

  async findOne(id: string) {
    const inspection = await this.prisma.inspection.findUnique({
      where: { id },
      include: {
        door: { include: { customer: true, site: true } },
        inspector: { select: { id: true, firstName: true, lastName: true } },
        checks: { orderBy: { position: 'asc' } },
        defects: true,
      },
    });
    if (!inspection) {
      throw new NotFoundException('Das Prüfprotokoll wurde nicht gefunden.');
    }
    return inspection;
  }

  /**
   * Legt ein Prüfprotokoll an und füllt es mit den Prüfpunkten des Katalogs
   * nach ASR A1.7. Bei handbetätigten Anlagen entfallen die Punkte, die nur
   * für kraftbetätigte Tore gelten (Antrieb, Schutzeinrichtungen, Kraftmessung).
   */
  async start(doorId: string, dto: StartInspectionDto) {
    const door = await this.prisma.door.findUnique({ where: { id: doorId } });
    if (!door) {
      throw new NotFoundException('Die Toranlage wurde nicht gefunden.');
    }

    const open = await this.prisma.inspection.findFirst({
      where: { doorId, completedAt: null },
    });
    if (open) {
      throw new ConflictException(
        `Für diese Anlage ist bereits das Protokoll ${open.inspectionNumber} in Bearbeitung.`,
      );
    }

    const inspector = await this.resolveInspector(dto.inspectorId, dto.inspectorName);
    const catalog = checkCatalogFor(door.operationMode);

    return this.prisma.$transaction(async (tx) => {
      const inspectionNumber = await this.numbers.next('INSPECTION', tx);
      return tx.inspection.create({
        data: {
          inspectionNumber,
          doorId,
          orderId: dto.orderId ?? null,
          type: dto.type ?? InspectionType.WIEDERKEHRENDE_PRUEFUNG,
          date: dto.date ? new Date(dto.date) : new Date(),
          inspectorId: dto.inspectorId ?? null,
          inspectorName: inspector,
          checks: { create: catalog.map(toCheckRow) },
        },
        include: { checks: { orderBy: { position: 'asc' } }, door: true },
      });
    });
  }

  /** Trägt Ergebnisse einzelner Prüfpunkte nach; mehrfaches Speichern ist möglich. */
  async recordChecks(id: string, dto: RecordChecksDto) {
    const inspection = await this.requireOpen(id);

    const existing = await this.prisma.inspectionCheck.findMany({
      where: { inspectionId: id },
    });
    const byKey = new Map(existing.map((check) => [check.key, check]));

    const unknown = dto.checks.filter((check) => !byKey.has(check.key));
    if (unknown.length > 0) {
      throw new BadRequestException(
        `Unbekannte Prüfpunkte: ${unknown.map((check) => check.key).join(', ')}`,
      );
    }

    await this.prisma.$transaction(
      dto.checks.map((check) => {
        const stored = byKey.get(check.key)!;
        const limit = stored.limitValue?.toNumber();

        // Ein Messwert über dem Grenzwert ist unabhängig von der Eingabe ein
        // Mangel – etwa eine Schließkraft über 400 N nach DIN EN 12453.
        const exceedsLimit =
          limit !== undefined && check.measuredValue !== undefined && check.measuredValue > limit;

        return this.prisma.inspectionCheck.update({
          where: { id: stored.id },
          data: {
            result: exceedsLimit ? CheckResult.MANGEL : check.result,
            measuredValue: check.measuredValue ?? null,
            comment: exceedsLimit
              ? `Grenzwert ${limit} ${stored.unit ?? ''} überschritten. ${check.comment ?? ''}`.trim()
              : (check.comment ?? null),
          },
        });
      }),
    );

    return this.findOne(inspection.id);
  }

  /**
   * Schließt das Protokoll ab: leitet das Gesamtergebnis aus den Prüfpunkten
   * ab, legt zu jedem beanstandeten Punkt einen Mangel an, schreibt die
   * nächste Prüffrist fort und setzt bei erheblichen Mängeln den Status der
   * Anlage herab.
   */
  async complete(id: string, dto: CompleteInspectionDto) {
    const inspection = await this.requireOpen(id);

    const checks = await this.prisma.inspectionCheck.findMany({
      where: { inspectionId: id },
      orderBy: { position: 'asc' },
    });

    const untested = checks.filter((check) => check.result === CheckResult.NICHT_GEPRUEFT);
    if (untested.length > 0) {
      throw new BadRequestException(
        `Das Protokoll ist unvollständig: ${untested.length} Prüfpunkt(e) ohne Ergebnis.`,
      );
    }

    const failed = checks.filter((check) => check.result === CheckResult.MANGEL);
    const { result, severity } = this.evaluate(failed, checks);

    const intervalMonths = dto.intervalMonths ?? (await this.inspectionInterval());
    const date = inspection.date;
    // Nach nicht bestandener Prüfung ist die Nachprüfung kurzfristig fällig,
    // nicht erst nach dem regulären Intervall.
    const nextDueDate =
      result === InspectionResult.NICHT_BESTANDEN
        ? addDays(new Date(), DEFECT_DEADLINE_DAYS.ERHEBLICH)
        : addMonths(date, intervalMonths);

    return this.prisma.$transaction(async (tx) => {
      const completed = await tx.inspection.update({
        where: { id },
        data: {
          result,
          nextDueDate,
          summary: dto.summary ?? this.defaultSummary(result, failed.length),
          recommendation: dto.recommendation ?? null,
          signatureInspector: dto.signatureInspector ?? null,
          signatureCustomer: dto.signatureCustomer ?? null,
          signedByName: dto.signedByName ?? null,
          completedAt: new Date(),
        },
      });

      // Zu jedem beanstandeten Prüfpunkt entsteht ein nachverfolgbarer Mangel.
      if (failed.length > 0) {
        await tx.defect.createMany({
          data: failed.map((check) => ({
            doorId: inspection.doorId,
            inspectionId: id,
            severity: this.severityFor(check.key, severity),
            title: check.label,
            description: check.comment ?? `Beanstandung bei Prüfpunkt "${check.label}".`,
            checkKey: check.key,
            dueDate: addDays(
              new Date(),
              DEFECT_DEADLINE_DAYS[this.severityFor(check.key, severity)],
            ),
          })),
        });
      }

      await tx.door.update({
        where: { id: inspection.doorId },
        data: {
          nextInspectionDue: nextDueDate,
          ...(result === InspectionResult.NICHT_BESTANDEN
            ? { status: 'AUSSER_BETRIEB' as const }
            : result === InspectionResult.ERHEBLICHE_MAENGEL
              ? { status: 'EINGESCHRAENKT' as const }
              : {}),
        },
      });

      return completed;
    });
  }

  /* Mängel ------------------------------------------------------------- */

  async findDefects(query: DefectQueryDto): Promise<Paginated<unknown>> {
    const where: Prisma.DefectWhereInput = {
      ...(query.doorId ? { doorId: query.doorId } : {}),
      ...(query.customerId ? { door: { customerId: query.customerId } } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.severity ? { severity: query.severity } : {}),
      ...(query.overdueOnly
        ? { status: { not: DefectStatus.BEHOBEN }, dueDate: { lt: new Date() } }
        : {}),
      ...(query.search ? { title: { contains: query.search, mode: 'insensitive' } } : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.defect.findMany({
        where,
        include: {
          door: {
            select: {
              id: true,
              doorNumber: true,
              location: true,
              customer: { select: { id: true, companyName: true, lastName: true } },
            },
          },
          inspection: { select: { id: true, inspectionNumber: true, date: true } },
        },
        orderBy: [{ severity: 'desc' }, { dueDate: 'asc' }],
        skip: query.skip,
        take: query.take,
      }),
      this.prisma.defect.count({ where }),
    ]);

    return paginate(items, total, query);
  }

  async createDefect(doorId: string, dto: CreateDefectDto) {
    await this.doors.assertExists(doorId);
    const severity = dto.severity ?? DefectSeverity.GERING;

    return this.prisma.defect.create({
      data: {
        doorId,
        severity,
        title: dto.title,
        description: dto.description ?? null,
        checkKey: dto.checkKey ?? null,
        dueDate: dto.dueDate
          ? new Date(dto.dueDate)
          : addDays(new Date(), DEFECT_DEADLINE_DAYS[severity]),
      },
    });
  }

  async resolveDefect(id: string, dto: ResolveDefectDto) {
    const defect = await this.prisma.defect.findUnique({ where: { id } });
    if (!defect) {
      throw new NotFoundException('Der Mangel wurde nicht gefunden.');
    }

    return this.prisma.$transaction(async (tx) => {
      const resolved = await tx.defect.update({
        where: { id },
        data: {
          status: DefectStatus.BEHOBEN,
          resolvedAt: new Date(),
          resolvedNote: dto.resolvedNote ?? null,
        },
      });

      // Sind alle Mängel behoben, ist die Anlage wieder uneingeschränkt nutzbar.
      const remaining = await tx.defect.count({
        where: {
          doorId: defect.doorId,
          status: { notIn: [DefectStatus.BEHOBEN, DefectStatus.AKZEPTIERT] },
        },
      });
      if (remaining === 0) {
        await tx.door.updateMany({
          where: { id: defect.doorId, status: { in: ['EINGESCHRAENKT', 'AUSSER_BETRIEB'] } },
          data: { status: 'IN_BETRIEB' },
        });
      }

      return resolved;
    });
  }

  async updateDefectStatus(id: string, status: DefectStatus) {
    const defect = await this.prisma.defect.findUnique({ where: { id } });
    if (!defect) {
      throw new NotFoundException('Der Mangel wurde nicht gefunden.');
    }
    return this.prisma.defect.update({ where: { id }, data: { status } });
  }

  /* Interna ------------------------------------------------------------ */

  private async requireOpen(id: string) {
    const inspection = await this.prisma.inspection.findUnique({ where: { id } });
    if (!inspection) {
      throw new NotFoundException('Das Prüfprotokoll wurde nicht gefunden.');
    }
    if (inspection.completedAt) {
      throw new ConflictException(
        'Das Protokoll ist abgeschlossen und kann nicht mehr geändert werden.',
      );
    }
    return inspection;
  }

  /**
   * Die prüfende Person muss als Sachkundiger hinterlegt sein, wenn sie aus
   * dem Mitarbeiterstamm stammt (ASR A1.7 Abs. 10, DGUV Information 208-022).
   */
  private async resolveInspector(inspectorId?: string, inspectorName?: string): Promise<string> {
    if (!inspectorId) {
      if (!inspectorName) {
        throw new BadRequestException(
          'Es muss eine prüfende Person angegeben werden – als Mitarbeiter oder als Name.',
        );
      }
      return inspectorName;
    }

    const employee = await this.prisma.employee.findUnique({
      where: { id: inspectorId },
      include: {
        qualifications: {
          where: {
            qualifiesForInspection: true,
            OR: [{ expiresAt: null }, { expiresAt: { gte: new Date() } }],
          },
        },
      },
    });
    if (!employee) {
      throw new NotFoundException('Der angegebene Mitarbeiter wurde nicht gefunden.');
    }

    const required = await this.requireQualifiedInspector();
    if (required && employee.qualifications.length === 0) {
      throw new BadRequestException(
        `${employee.firstName} ${employee.lastName} besitzt keine gültige Sachkunde ` +
          'für die Prüfung kraftbetätigter Tore.',
      );
    }

    return inspectorName ?? `${employee.firstName} ${employee.lastName}`;
  }

  /** Gesamtergebnis aus den beanstandeten Prüfpunkten. */
  private evaluate(
    failed: Array<{ key: string }>,
    all: Array<{ result: CheckResult }>,
  ): { result: InspectionResult; severity: DefectSeverity } {
    if (failed.length === 0) {
      const hasNotes = all.some((check) => check.result === CheckResult.NICHT_ZUTREFFEND);
      return {
        result: hasNotes ? InspectionResult.BESTANDEN_MIT_HINWEISEN : InspectionResult.BESTANDEN,
        severity: DefectSeverity.HINWEIS,
      };
    }

    // Beanstandete Schutzeinrichtungen und überschrittene Kraftgrenzwerte
    // sind sicherheitsrelevant und führen zur Stilllegung der Anlage.
    const critical = failed.some(
      (check) =>
        check.key.startsWith('SCHUTZ_') ||
        check.key.startsWith('SICH_') ||
        check.key.startsWith('MESS_') ||
        check.key === 'ANTRIEB_NOTENTRIEGELUNG',
    );

    if (critical) {
      return {
        result: InspectionResult.NICHT_BESTANDEN,
        severity: DefectSeverity.GEFAHR_IM_VERZUG,
      };
    }
    if (failed.length > 3) {
      return { result: InspectionResult.ERHEBLICHE_MAENGEL, severity: DefectSeverity.ERHEBLICH };
    }
    return { result: InspectionResult.GERINGE_MAENGEL, severity: DefectSeverity.GERING };
  }

  /** Sicherheitsrelevante Prüfpunkte erben den höchsten Schweregrad. */
  private severityFor(key: string, base: DefectSeverity): DefectSeverity {
    const critical =
      key.startsWith('SCHUTZ_') ||
      key.startsWith('SICH_') ||
      key.startsWith('MESS_') ||
      key === 'ANTRIEB_NOTENTRIEGELUNG';
    return critical ? DefectSeverity.GEFAHR_IM_VERZUG : base;
  }

  private defaultSummary(result: InspectionResult, defectCount: number): string {
    switch (result) {
      case InspectionResult.BESTANDEN:
        return 'Die Anlage wurde ohne Beanstandung geprüft.';
      case InspectionResult.BESTANDEN_MIT_HINWEISEN:
        return 'Die Anlage wurde geprüft; einzelne Prüfpunkte waren nicht zutreffend.';
      case InspectionResult.NICHT_BESTANDEN:
        return (
          `Sicherheitsrelevante Beanstandung an ${defectCount} Prüfpunkt(en). ` +
          'Die Anlage ist bis zur Instandsetzung außer Betrieb zu nehmen.'
        );
      default:
        return `Die Prüfung ergab ${defectCount} Mangel bzw. Mängel.`;
    }
  }

  private async settings(): Promise<{
    intervalMonths?: number;
    requireQualifiedInspector?: boolean;
  }> {
    const setting = await this.prisma.setting.findUnique({ where: { key: 'pruefung' } });
    return (
      (setting?.value as { intervalMonths?: number; requireQualifiedInspector?: boolean }) ?? {}
    );
  }

  private async inspectionInterval(): Promise<number> {
    return (await this.settings()).intervalMonths ?? INSPECTION_INTERVAL_MONTHS;
  }

  private async requireQualifiedInspector(): Promise<boolean> {
    return (await this.settings()).requireQualifiedInspector ?? true;
  }
}

/** Wandelt einen Katalogeintrag in eine Protokollzeile. */
function toCheckRow(check: InspectionCheckDefinition, index: number) {
  return {
    position: index + 1,
    key: check.key,
    group: check.group,
    label: check.label,
    reference: check.reference,
    result: CheckResult.NICHT_GEPRUEFT,
    unit: check.measurement?.unit ?? null,
    limitValue: check.measurement?.limit ?? null,
  };
}
