import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  addDays,
  calculateInterest,
  daysOverdue as daysOverdueOf,
  DEFAULT_BASE_RATE,
  DUNNING_DEFAULTS,
  INTEREST_POINTS,
  interestRate,
  round,
} from '@garagentor/shared';
import { CustomerType, DunningLevel, DunningStatus, InvoiceStatus, Prisma } from '@prisma/client';
import { paginate } from '../common/dto/pagination.dto';
import { PrismaService } from '../prisma/prisma.service';
import type { DunningQueryDto } from './dto/dunning.dto';
import { openAmountOf, OPEN_STATUSES } from './invoice-status';

/** Eine Stufe der Mahnkaskade. */
interface DunningStage {
  level: DunningLevel;
  /** Ab wie vielen Tagen Verzug die Stufe greift. */
  daysOverdue: number;
  fee: number;
  /**
   * Ob auf dieser Stufe Verzugszinsen erhoben werden. Der Satz selbst ergibt
   * sich aus dem Basiszinssatz und der Kundenart, nicht aus der Stufe.
   */
  zinsen: boolean;
  /** Neue Zahlungsfrist in Tagen. */
  graceDays: number;
}

/** Zinsvorgaben aus den Einstellungen. */
interface InterestConfig {
  baseRatePercent: number;
  validFrom: string;
  points: { VERBRAUCHER: number; UNTERNEHMEN: number };
}

const LEVEL_ORDER: DunningLevel[] = [
  DunningLevel.ZAHLUNGSERINNERUNG,
  DunningLevel.MAHNUNG_1,
  DunningLevel.MAHNUNG_2,
  DunningLevel.LETZTE_MAHNUNG,
  DunningLevel.INKASSO,
];

@Injectable()
export class DunningService {
  private readonly logger = new Logger(DunningService.name);

  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: DunningQueryDto) {
    const where: Prisma.DunningWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.search
        ? { invoice: { invoiceNumber: { contains: query.search, mode: 'insensitive' } } }
        : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.dunning.findMany({
        where,
        include: {
          invoice: {
            select: {
              id: true,
              invoiceNumber: true,
              grossTotal: true,
              paidAmount: true,
              dueDate: true,
              customer: {
                select: { id: true, customerNumber: true, companyName: true, lastName: true },
              },
            },
          },
        },
        orderBy: { date: 'desc' },
        skip: query.skip,
        take: query.take,
      }),
      this.prisma.dunning.count({ where }),
    ]);

    return paginate(items, total, query);
  }

  /**
   * Ermittelt alle Rechnungen, für die die nächste Mahnstufe fällig wäre,
   * ohne etwas zu speichern. Dient der Vorschau des Mahnlaufs.
   */
  async preview(reference = new Date()) {
    const stages = await this.stages();
    const interest = await this.interestConfig();

    const invoices = await this.prisma.invoice.findMany({
      where: { status: { in: OPEN_STATUSES }, dueDate: { lt: reference } },
      include: {
        customer: {
          select: {
            id: true,
            customerNumber: true,
            companyName: true,
            firstName: true,
            lastName: true,
            // Entscheidet über die Zinspunkte nach § 288 BGB.
            type: true,
          },
        },
        dunnings: { orderBy: { date: 'desc' } },
      },
      orderBy: { dueDate: 'asc' },
    });

    const candidates = [];
    for (const invoice of invoices) {
      const open = openAmountOf(invoice);
      if (open <= 0) continue;

      const stage = this.nextStage(stages, invoice.dunningLevel, invoice.dueDate, reference);
      if (!stage) continue;

      // Solange die Frist der letzten Mahnung läuft, wird nicht erneut gemahnt.
      const last = invoice.dunnings.find((dunning) => dunning.status !== DunningStatus.ABGEBROCHEN);
      if (last && last.dueDate > reference) continue;

      candidates.push(this.buildDunning(invoice, open, stage, reference, interest));
    }

    return candidates;
  }

  /** Legt für alle fälligen Rechnungen die nächste Mahnung als Entwurf an. */
  async run(reference = new Date()) {
    const candidates = await this.preview(reference);
    const created = [];

    for (const candidate of candidates) {
      try {
        const dunning = await this.prisma.$transaction(async (tx) => {
          const record = await tx.dunning.create({
            data: {
              invoiceId: candidate.invoiceId,
              level: candidate.level,
              date: reference,
              dueDate: candidate.dueDate,
              openAmount: candidate.openAmount,
              fee: candidate.fee,
              interest: candidate.interest,
              interestPercent: candidate.interestPercent,
              totalAmount: candidate.totalAmount,
              daysOverdue: candidate.daysOverdue,
            },
          });

          await tx.invoice.update({
            where: { id: candidate.invoiceId },
            data: { dunningLevel: candidate.level, status: InvoiceStatus.UEBERFAELLIG },
          });

          return record;
        });
        created.push(dunning);
      } catch (error) {
        // Eine Stufe pro Rechnung ist eindeutig; ein Doppellauf am selben Tag
        // soll den übrigen Lauf nicht abbrechen.
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
          this.logger.warn(
            `Mahnstufe ${candidate.level} für Rechnung ${candidate.invoiceNumber} existiert bereits.`,
          );
          continue;
        }
        throw error;
      }
    }

    this.logger.log(`Mahnlauf abgeschlossen: ${created.length} Mahnungen angelegt`);
    return { created: created.length, dunnings: created };
  }

  /** Legt eine Mahnung für eine einzelne Rechnung an, unabhängig vom Lauf. */
  async createForInvoice(invoiceId: string, level?: DunningLevel) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: { customer: true, dunnings: true },
    });
    if (!invoice) {
      throw new NotFoundException('Die Rechnung wurde nicht gefunden.');
    }
    if (!OPEN_STATUSES.includes(invoice.status)) {
      throw new ConflictException('Nur offene Rechnungen können gemahnt werden.');
    }

    // Über openAmountOf, damit ein verrechneter Abschlag abgezogen bleibt.
    const open = openAmountOf(invoice);
    if (open <= 0) {
      throw new ConflictException('Die Rechnung weist keinen offenen Betrag auf.');
    }

    const stages = await this.stages();
    const now = new Date();
    const stage = level
      ? (stages.find((item) => item.level === level) ?? {
          level,
          daysOverdue: 0,
          fee: 0,
          zinsen: true,
          graceDays: 7,
        })
      : this.nextStage(stages, invoice.dunningLevel, invoice.dueDate, now);

    if (!stage) {
      throw new ConflictException('Für diese Rechnung ist derzeit keine Mahnstufe fällig.');
    }

    const interest = await this.interestConfig();
    const candidate = this.buildDunning(invoice, open, stage, now, interest);

    return this.prisma.$transaction(async (tx) => {
      const dunning = await tx.dunning.create({
        data: {
          invoiceId,
          level: candidate.level,
          date: now,
          dueDate: candidate.dueDate,
          openAmount: candidate.openAmount,
          fee: candidate.fee,
          interest: candidate.interest,
          interestPercent: candidate.interestPercent,
          totalAmount: candidate.totalAmount,
          daysOverdue: candidate.daysOverdue,
        },
      });

      await tx.invoice.update({
        where: { id: invoiceId },
        data: { dunningLevel: candidate.level, status: InvoiceStatus.UEBERFAELLIG },
      });

      return dunning;
    });
  }

  async send(id: string) {
    const dunning = await this.prisma.dunning.findUnique({ where: { id } });
    if (!dunning) {
      throw new NotFoundException('Die Mahnung wurde nicht gefunden.');
    }
    if (dunning.status !== DunningStatus.ENTWURF) {
      throw new ConflictException('Die Mahnung wurde bereits versendet.');
    }

    return this.prisma.dunning.update({
      where: { id },
      data: { status: DunningStatus.VERSENDET, sentAt: new Date() },
    });
  }

  async cancel(id: string) {
    const dunning = await this.prisma.dunning.findUnique({ where: { id } });
    if (!dunning) {
      throw new NotFoundException('Die Mahnung wurde nicht gefunden.');
    }
    return this.prisma.dunning.update({
      where: { id },
      data: { status: DunningStatus.ABGEBROCHEN },
    });
  }

  /** Mahnstufen aus den Einstellungen, sonst die Vorgaben aus @garagentor/shared. */
  private async stages(): Promise<DunningStage[]> {
    const configured = (await this.dunningSetting())?.stufen;

    const stages = configured?.length
      ? // Ältere Einstellungen führten je Stufe einen festen Zinssatz. Daraus
        // ergibt sich, ob überhaupt Zinsen anfallen; die Höhe kommt jetzt aus
        // dem Basiszinssatz.
        configured.map((stufe) => ({
          ...stufe,
          zinsen: stufe.zinsen ?? (stufe.interestPercent ?? 0) > 0,
        }))
      : (DUNNING_DEFAULTS as unknown as DunningStage[]);
    return [...stages].sort((a, b) => a.daysOverdue - b.daysOverdue);
  }

  private async dunningSetting(): Promise<{
    stufen?: Array<DunningStage & { interestPercent?: number }>;
    basiszinssatz?: number;
    basiszinssatzGueltigAb?: string;
    zinspunkteVerbraucher?: number;
    zinspunkteUnternehmen?: number;
  } | null> {
    const setting = await this.prisma.setting.findUnique({ where: { key: 'mahnwesen' } });
    return (setting?.value as Awaited<ReturnType<DunningService['dunningSetting']>>) ?? null;
  }

  /** Basiszinssatz und Zinspunkte aus den Einstellungen. */
  private async interestConfig(): Promise<InterestConfig> {
    const setting = await this.dunningSetting();
    return {
      baseRatePercent: setting?.basiszinssatz ?? DEFAULT_BASE_RATE.percent,
      validFrom: setting?.basiszinssatzGueltigAb ?? DEFAULT_BASE_RATE.validFrom,
      points: {
        VERBRAUCHER: setting?.zinspunkteVerbraucher ?? INTEREST_POINTS.VERBRAUCHER,
        UNTERNEHMEN: setting?.zinspunkteUnternehmen ?? INTEREST_POINTS.UNTERNEHMEN,
      },
    };
  }

  /** Nächste Stufe nach der bereits erreichten, sofern der Verzug ausreicht. */
  private nextStage(
    stages: DunningStage[],
    currentLevel: DunningLevel | null,
    dueDate: Date,
    reference: Date,
  ): DunningStage | null {
    const overdue = daysOverdueOf(dueDate, reference);
    const currentIndex = currentLevel ? LEVEL_ORDER.indexOf(currentLevel) : -1;

    // Die höchste erreichbare Stufe, die der Verzugsdauer entspricht.
    let candidate: DunningStage | null = null;
    for (const stage of stages) {
      if (overdue < stage.daysOverdue) break;
      if (LEVEL_ORDER.indexOf(stage.level) <= currentIndex) continue;
      candidate = stage;
      break;
    }
    return candidate;
  }

  private buildDunning(
    invoice: {
      id: string;
      invoiceNumber: string;
      dueDate: Date;
      customer?: { type?: CustomerType | null } | null;
    },
    openAmount: number,
    stage: DunningStage,
    reference: Date,
    interest: InterestConfig,
  ) {
    const overdue = daysOverdueOf(invoice.dueDate, reference);

    // Nach § 288 BGB gelten neun Prozentpunkte nur bei Entgeltforderungen ohne
    // Verbraucherbeteiligung; Privatkunden schulden fünf. Öffentliche
    // Auftraggeber und Hausverwaltungen sind keine Verbraucher.
    const istVerbraucher = invoice.customer?.type === CustomerType.PRIVAT;
    const zinssatz = stage.zinsen
      ? interestRate(interest.baseRatePercent, istVerbraucher, interest.points)
      : 0;
    const zinsen = calculateInterest(openAmount, zinssatz, overdue);

    return {
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      customer: invoice.customer,
      level: stage.level,
      openAmount,
      fee: stage.fee,
      // Der angewandte Satz wird mitgeschrieben: der Basiszinssatz ändert sich
      // halbjährlich, die Mahnung muss ihren Satz später noch belegen können.
      interestPercent: zinssatz,
      interest: zinsen,
      totalAmount: round(openAmount + stage.fee + zinsen),
      daysOverdue: overdue,
      dueDate: addDays(reference, stage.graceDays),
    };
  }
}
