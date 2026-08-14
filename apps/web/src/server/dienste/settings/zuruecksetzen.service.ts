import { EntityType } from '@prisma/client';
import type { Prisma } from '@prisma/client';
import { BadRequestException, Logger } from '@/server/nest-ersatz';
import { prisma } from '@/server/prisma';
import { entfernen } from '@/server/ablage';
import {
  BESTAETIGUNG,
  bestandsRueckstellung,
  GELOESCHTE_ARTEN,
  NUMMERNKREISE,
} from './zuruecksetzen.regeln';

/**
 * Betriebsdaten zurücksetzen – der Übergang von der Erprobung zum Ernstfall.
 *
 * Wer eine Branchensoftware einführt, legt zuerst ein paar erfundene Kunden an
 * und probiert an ihnen alles durch: Angebot, Auftrag, Rechnung, Prüfung,
 * Servicebericht. Kommt der Tag, an dem die ersten echten Daten hineinsollen,
 * muß das Probematerial weg – und zwar restlos. Ein übriggebliebener
 * Musterkunde taucht später in der Umsatzauswertung auf, eine Probeprüfung in
 * der Fälligkeitsliste, eine Probe-Rechnungsnummer im DATEV-Export.
 *
 * Von Hand ist das nicht zu schaffen: Ein Kunde läßt sich nicht löschen,
 * solange eine Rechnung an ihm hängt, und die Rechnung nicht, solange sie
 * gebucht ist. Deshalb dieser Weg – einmal, mit Ansage, in der richtigen
 * Reihenfolge.
 *
 * Drei Eigenschaften machen ihn vertretbar:
 *
 * Er zeigt vorher, was er tut. Die Vorschau zählt jede betroffene Zeile,
 * damit niemand raten muß.
 *
 * Er läuft in einer Transaktion. Bricht etwas ab, ist nichts halb gelöscht.
 *
 * Er trennt sauber zwischen Vorgängen und Stammdaten des Betriebs. Artikel,
 * Lieferanten, Bestellungen, Mitarbeiter, Zugänge und Einstellungen bleiben
 * unangetastet – sonst wäre der Betrieb nach dem Zurücksetzen nicht
 * arbeitsfähig, sondern leer.
 */

/** Was gelöscht wird, gruppiert wie in der Anwendung. */
export interface Umfang {
  kunden: number;
  ansprechpartner: number;
  adressen: number;
  objekte: number;
  anlagen: number;
  pruefungen: number;
  pruefpunkte: number;
  maengel: number;
  serviceberichte: number;
  wartungsvertraege: number;
  angebote: number;
  auftraege: number;
  rechnungen: number;
  zahlungen: number;
  mahnungen: number;
  termine: number;
  projekte: number;
  zeiten: number;
  lagerbewegungen: number;
  dokumente: number;
  postausgang: number;
  protokoll: number;
}

/** Was stehen bleibt. */
export interface Bestand {
  artikel: number;
  lieferanten: number;
  bestellungen: number;
  mitarbeiter: number;
  zugaenge: number;
  einstellungen: number;
}

export interface Vorschau {
  loeschen: Umfang;
  bleiben: Bestand;
  /** Termine und Projekte ohne Kundenbezug – die bleiben stehen. */
  unberuehrt: { termine: number; projekte: number };
  /** Artikel, deren Bestand zurückgebucht wird. */
  bestandskorrekturen: number;
  bestaetigungswort: string;
}

export interface Bericht {
  geloescht: Umfang;
  dateien: { entfernt: number; fehlgeschlagen: number };
  bestandskorrekturen: number;
  /** Lagerbuchungen, deren Wirkung sich nicht umkehren ließ. */
  ungerechneteBuchungen: number;
  nummernkreise: string[];
}

/** Auswahl der Zeilen, die nur teilweise betroffen sind. */
interface Auswahl {
  projekte: string[];
  termine: Prisma.AppointmentWhereInput;
  zeiten: Prisma.TimeEntryWhereInput;
  bewegungen: Prisma.StockMovementWhereInput;
  dokumente: Prisma.DocumentWhereInput;
  postausgang: Prisma.MailLogWhereInput;
  protokoll: Prisma.AuditLogWhereInput;
}

export class ZuruecksetzenService {
  private readonly logger = new Logger(ZuruecksetzenService.name);

  /**
   * Welche der nur teilweise betroffenen Zeilen mitgehen.
   *
   * Kunden, Angebote, Aufträge, Rechnungen, Anlagen, Prüfungen und
   * Serviceberichte werden vollständig geleert – dort braucht es keine
   * Auswahl. Bei den übrigen Tabellen entscheidet die Verknüpfung, und die
   * Bedingungen stehen deshalb hier an einer Stelle: Vorschau und Ausführung
   * benutzen dieselben, sonst zählte die Vorschau etwas anderes, als die
   * Ausführung löscht.
   */
  private async auswahl(): Promise<Auswahl> {
    const projekte = (
      await prisma.project.findMany({
        where: { OR: [{ customerId: { not: null } }, { siteId: { not: null } }] },
        select: { id: true },
      })
    ).map((zeile) => zeile.id);

    // Eine Materialbuchung trägt die Berichtsnummer als Verweis, nicht die
    // Kennung – nur darüber ist sie ihrem Servicebericht zuzuordnen.
    const berichtsnummern = (
      await prisma.serviceReport.findMany({ select: { reportNumber: true } })
    ).map((zeile) => zeile.reportNumber);

    return {
      projekte,
      termine: {
        OR: [
          { customerId: { not: null } },
          { siteId: { not: null } },
          { orderId: { not: null } },
        ],
      },
      zeiten: { OR: [{ orderId: { not: null } }, { projectId: { in: projekte } }] },
      bewegungen: {
        // Wareneingänge aus Lieferantenbestellungen bleiben: Die Bestellungen
        // bleiben ja auch.
        purchaseOrderId: null,
        OR: [{ orderId: { not: null } }, { reference: { in: berichtsnummern } }],
      },
      dokumente: {
        OR: [
          { entityType: { in: [...GELOESCHTE_ARTEN] as EntityType[] } },
          { entityType: EntityType.PROJECT, entityId: { in: projekte } },
        ],
      },
      postausgang: {
        OR: [
          { entityType: { in: [...GELOESCHTE_ARTEN] as EntityType[] } },
          { entityType: EntityType.PROJECT, entityId: { in: projekte } },
        ],
      },
      // Im Änderungsprotokoll stehen Belegänderungen und Einstellungen. Die
      // Einstellungen bleiben, also bleibt auch ihre Spur.
      protokoll: { entityType: { in: [...GELOESCHTE_ARTEN] } },
    };
  }

  /** Zählt, was ein Zurücksetzen anfassen würde. Ändert nichts. */
  async vorschau(): Promise<Vorschau> {
    const auswahl = await this.auswahl();
    const loeschen = await this.zaehlen(auswahl);

    const [
      artikel,
      lieferanten,
      bestellungen,
      mitarbeiter,
      zugaenge,
      einstellungen,
      freieTermine,
      freieProjekte,
    ] = await Promise.all([
      prisma.article.count(),
      prisma.supplier.count(),
      prisma.purchaseOrder.count(),
      prisma.employee.count(),
      prisma.user.count(),
      prisma.setting.count(),
      prisma.appointment.count({ where: { NOT: auswahl.termine } }),
      prisma.project.count({ where: { id: { notIn: auswahl.projekte } } }),
    ]);

    const { deltas } = bestandsRueckstellung(await this.bewegungen(auswahl));

    return {
      loeschen,
      bleiben: { artikel, lieferanten, bestellungen, mitarbeiter, zugaenge, einstellungen },
      unberuehrt: { termine: freieTermine, projekte: freieProjekte },
      bestandskorrekturen: deltas.size,
      bestaetigungswort: BESTAETIGUNG,
    };
  }

  private async bewegungen(auswahl: Auswahl) {
    const zeilen = await prisma.stockMovement.findMany({
      where: auswahl.bewegungen,
      select: { articleId: true, type: true, quantity: true },
    });

    return zeilen.map((zeile) => ({
      articleId: zeile.articleId,
      type: zeile.type as string,
      quantity: zeile.quantity.toNumber(),
    }));
  }

  private async zaehlen(auswahl: Auswahl): Promise<Umfang> {
    const [
      kunden,
      ansprechpartner,
      adressen,
      objekte,
      anlagen,
      pruefungen,
      pruefpunkte,
      maengel,
      serviceberichte,
      wartungsvertraege,
      angebote,
      auftraege,
      rechnungen,
      zahlungen,
      mahnungen,
      termine,
      projekte,
      zeiten,
      lagerbewegungen,
      dokumente,
      postausgang,
      protokoll,
    ] = await Promise.all([
      prisma.customer.count(),
      prisma.contact.count(),
      prisma.address.count(),
      prisma.site.count(),
      prisma.door.count(),
      prisma.inspection.count(),
      prisma.inspectionCheck.count(),
      prisma.defect.count(),
      prisma.serviceReport.count(),
      prisma.maintenanceContract.count(),
      prisma.quote.count(),
      prisma.order.count(),
      prisma.invoice.count(),
      prisma.payment.count(),
      prisma.dunning.count(),
      prisma.appointment.count({ where: auswahl.termine }),
      prisma.project.count({ where: { id: { in: auswahl.projekte } } }),
      prisma.timeEntry.count({ where: auswahl.zeiten }),
      prisma.stockMovement.count({ where: auswahl.bewegungen }),
      prisma.document.count({ where: auswahl.dokumente }),
      prisma.mailLog.count({ where: auswahl.postausgang }),
      prisma.auditLog.count({ where: auswahl.protokoll }),
    ]);

    return {
      kunden,
      ansprechpartner,
      adressen,
      objekte,
      anlagen,
      pruefungen,
      pruefpunkte,
      maengel,
      serviceberichte,
      wartungsvertraege,
      angebote,
      auftraege,
      rechnungen,
      zahlungen,
      mahnungen,
      termine,
      projekte,
      zeiten,
      lagerbewegungen,
      dokumente,
      postausgang,
      protokoll,
    };
  }

  /**
   * Setzt zurück.
   *
   * Die Reihenfolge ist nicht beliebig. Ein Kunde ist gegen das Löschen
   * gesperrt, solange ein Angebot, ein Auftrag oder eine Rechnung auf ihn
   * zeigt – deshalb gehen die Belege zuerst und die Kunden zuletzt. Was am
   * Kunden hängt und keine eigene Sperre hat (Adressen, Ansprechpartner,
   * Objekte, Anlagen, Wartungsverträge), räumt die Datenbank selbst mit ab.
   */
  async ausfuehren(dto: { bestaetigung: string; nummernkreise: boolean }): Promise<Bericht> {
    if (dto.bestaetigung !== BESTAETIGUNG) {
      throw new BadRequestException(
        `Zum Zurücksetzen muß „${BESTAETIGUNG}“ eingetippt werden – Wort für Wort.`,
      );
    }

    const auswahl = await this.auswahl();
    const geloescht = await this.zaehlen(auswahl);

    // Vor der Transaktion lesen: Die Pfade der Dateien werden nachher
    // gebraucht, wenn die Zeilen längst weg sind.
    const dateien = (
      await prisma.document.findMany({
        where: auswahl.dokumente,
        select: { storagePath: true },
      })
    ).map((zeile) => zeile.storagePath);

    const { deltas, ungerechnet } = bestandsRueckstellung(await this.bewegungen(auswahl));

    const jahr = new Date().getFullYear();

    await prisma.$transaction(
      async (tx) => {
        await tx.document.deleteMany({ where: auswahl.dokumente });
        await tx.mailLog.deleteMany({ where: auswahl.postausgang });
        await tx.auditLog.deleteMany({ where: auswahl.protokoll });

        // Erst den Bestand zurückbuchen, dann die Buchungen entfernen – sonst
        // wüßte niemand mehr, um wieviel.
        for (const [articleId, delta] of deltas) {
          await tx.article.update({
            where: { id: articleId },
            data: { stock: { increment: delta } },
          });
        }
        await tx.stockMovement.deleteMany({ where: auswahl.bewegungen });

        await tx.timeEntry.deleteMany({ where: auswahl.zeiten });
        await tx.appointment.deleteMany({ where: auswahl.termine });

        // Rechnungen nehmen Positionen, Zahlungen und Mahnungen mit.
        await tx.invoice.deleteMany({});
        await tx.serviceReport.deleteMany({});
        await tx.order.deleteMany({});
        await tx.quote.deleteMany({});
        await tx.project.deleteMany({ where: { id: { in: auswahl.projekte } } });

        // Anlagen nehmen Prüfungen, Prüfpunkte und Mängel mit; Kunden nehmen
        // Adressen, Ansprechpartner, Objekte, Anlagen und Wartungsverträge mit.
        await tx.door.deleteMany({});
        await tx.customer.deleteMany({});

        if (dto.nummernkreise) {
          await tx.numberRange.updateMany({
            where: { entity: { in: [...NUMMERNKREISE] } },
            data: { nextNumber: 1, currentYear: jahr },
          });
        }
      },
      // Ein Zurücksetzen ist ein einmaliger Vorgang, kein Tagesgeschäft. Die
      // voreingestellten fünf Sekunden reichen dafür nicht.
      { timeout: 120_000, maxWait: 20_000 },
    );

    const entfernt = await this.dateienEntfernen(dateien);

    this.logger.warn(
      `Betriebsdaten zurückgesetzt: ${geloescht.kunden} Kunden, ${geloescht.rechnungen} Rechnungen, ` +
        `${geloescht.anlagen} Anlagen, ${geloescht.pruefungen} Prüfungen.`,
    );

    return {
      geloescht,
      dateien: entfernt,
      bestandskorrekturen: deltas.size,
      ungerechneteBuchungen: ungerechnet,
      nummernkreise: dto.nummernkreise ? [...NUMMERNKREISE] : [],
    };
  }

  /**
   * Räumt die Dateien aus der Ablage.
   *
   * Nach der Transaktion und mit Nachsicht: Maßgeblich ist die Datenbank. Eine
   * Datei, die sich nicht löschen läßt – weil die Ablage gerade nicht
   * erreichbar ist –, darf das Zurücksetzen nicht rückgängig machen. Sie wird
   * gezählt und gemeldet.
   */
  private async dateienEntfernen(pfade: string[]) {
    let entfernt = 0;
    let fehlgeschlagen = 0;

    for (const pfad of pfade) {
      try {
        await entfernen(pfad);
        entfernt += 1;
      } catch (fehler) {
        fehlgeschlagen += 1;
        this.logger.warn(`Datei ${pfad} konnte nicht entfernt werden: ${fehler}`);
      }
    }

    return { entfernt, fehlgeschlagen };
  }
}

export const zuruecksetzen = new ZuruecksetzenService();
