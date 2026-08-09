import type { PrismaClient } from '@prisma/client';
import { prisma } from '@/server/prisma';
import { Logger } from '@/server/nest-ersatz';
import { type Prisma } from '@prisma/client';

import { aktuelleBenutzerId as currentUserId } from '@/server/kontext';

/** Kennung des betroffenen Datensatzes im Protokoll. */
export interface AuditTarget {
  entityType: string;
  entityId: string;
  /** Fachliche Bezeichnung, damit das Protokoll ohne Nachschlagen lesbar ist. */
  label?: string;
}

/** Prisma-Client oder Transaktion – das Protokoll gehört in dieselbe Buchung. */
type Db = PrismaClient | Prisma.TransactionClient;

/**
 * Schreibt fest, wer wann welchen Beleg verändert hat. Für die
 * Nachvollziehbarkeit nach GoBD ist nicht der Inhalt entscheidend, sondern dass
 * ein Zustandswechsel überhaupt zurückverfolgbar ist.
 */
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  /**
   * Hält einen Vorgang fest. Der Aufruf gehört in die Transaktion des Vorgangs,
   * damit kein Protokolleintrag ohne die zugehörige Änderung übrig bleibt.
   *
   * Schlägt das Schreiben fehl, wird der Vorgang selbst nicht abgebrochen: eine
   * ausgestellte Rechnung darf nicht daran scheitern, dass die Nebenbuchung
   * klemmt. Der Fehlschlag landet im Protokoll der Anwendung.
   */
  async record(
    db: Db | null,
    action: string,
    target: AuditTarget,
    changes?: Record<string, unknown>,
  ): Promise<void> {
    try {
      // Ohne Transaktion – etwa bei einem Vorgang, der nur aus einer Buchung
      // besteht – wird direkt geschrieben.
      await (db ?? prisma).auditLog.create({
        data: {
          userId: currentUserId() ?? null,
          action,
          entityType: target.entityType,
          entityId: target.entityId,
          changes: {
            ...(target.label ? { bezeichnung: target.label } : {}),
            ...(changes ?? {}),
          } as Prisma.InputJsonValue,
        },
      });
    } catch (error) {
      this.logger.error(
        `Änderungsprotokoll für ${target.entityType} ${target.entityId} (${action}) fehlgeschlagen: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
}

export const audit = new AuditService();
