import {
  absenceStatusLabels,
  appointmentStatusLabels,
  defectSeverityLabels,
  defectStatusLabels,
  doorStatusLabels,
  inspectionResultLabels,
  invoiceStatusLabels,
  maintenanceContractStatusLabels,
  orderStatusLabels,
  projectStatusLabels,
  purchaseOrderStatusLabels,
  quoteStatusLabels,
} from '@garagentor/shared';
import type { BadgeTone } from '@/components/ui';

/** Ordnet jedem Status eine Farbe und die deutsche Bezeichnung zu. */
export interface StatusDisplay {
  label: string;
  tone: BadgeTone;
}

function build<T extends string>(
  labels: Record<T, string>,
  tones: Partial<Record<T, BadgeTone>>,
): (value: T | null | undefined) => StatusDisplay {
  return (value) => {
    if (!value) return { label: '–', tone: 'neutral' };
    return { label: labels[value] ?? value, tone: tones[value] ?? 'neutral' };
  };
}

export const quoteStatus = build(quoteStatusLabels, {
  ENTWURF: 'neutral',
  VERSENDET: 'info',
  ANGENOMMEN: 'success',
  ABGELEHNT: 'danger',
  ABGELAUFEN: 'warning',
  STORNIERT: 'danger',
});

export const orderStatus = build(orderStatusLabels, {
  ANGELEGT: 'neutral',
  EINGEPLANT: 'info',
  IN_ARBEIT: 'info',
  WARTET_AUF_MATERIAL: 'warning',
  ABGESCHLOSSEN: 'success',
  ABGERECHNET: 'success',
  STORNIERT: 'danger',
});

export const invoiceStatus = build(invoiceStatusLabels, {
  ENTWURF: 'neutral',
  OFFEN: 'info',
  TEILBEZAHLT: 'warning',
  BEZAHLT: 'success',
  UEBERFAELLIG: 'danger',
  STORNIERT: 'danger',
});

export const doorStatus = build(doorStatusLabels, {
  IN_BETRIEB: 'success',
  EINGESCHRAENKT: 'warning',
  AUSSER_BETRIEB: 'danger',
  STILLGELEGT: 'neutral',
});

export const inspectionResult = build(inspectionResultLabels, {
  BESTANDEN: 'success',
  BESTANDEN_MIT_HINWEISEN: 'success',
  GERINGE_MAENGEL: 'warning',
  ERHEBLICHE_MAENGEL: 'danger',
  NICHT_BESTANDEN: 'danger',
});

export const defectSeverity = build(defectSeverityLabels, {
  HINWEIS: 'neutral',
  GERING: 'info',
  ERHEBLICH: 'warning',
  GEFAHR_IM_VERZUG: 'danger',
});

export const defectStatus = build(defectStatusLabels, {
  OFFEN: 'danger',
  IN_BEARBEITUNG: 'warning',
  BEHOBEN: 'success',
  AKZEPTIERT: 'neutral',
});

export const appointmentStatus = build(appointmentStatusLabels, {
  GEPLANT: 'neutral',
  BESTAETIGT: 'info',
  UNTERWEGS: 'warning',
  ERLEDIGT: 'success',
  ABGESAGT: 'danger',
});

export const projectStatus = build(projectStatusLabels, {
  PLANUNG: 'neutral',
  LAUFEND: 'info',
  PAUSIERT: 'warning',
  ABGESCHLOSSEN: 'success',
  ABGEBROCHEN: 'danger',
});

export const purchaseOrderStatus = build(purchaseOrderStatusLabels, {
  ENTWURF: 'neutral',
  BESTELLT: 'info',
  TEILGELIEFERT: 'warning',
  GELIEFERT: 'success',
  STORNIERT: 'danger',
});

export const contractStatus = build(maintenanceContractStatusLabels, {
  AKTIV: 'success',
  PAUSIERT: 'warning',
  GEKUENDIGT: 'danger',
  ABGELAUFEN: 'neutral',
});

export const absenceStatus = build(absenceStatusLabels, {
  BEANTRAGT: 'warning',
  GENEHMIGT: 'success',
  ABGELEHNT: 'danger',
  STORNIERT: 'neutral',
});

/** Farbe für eine Prüffrist, abhängig von den verbleibenden Tagen. */
export function inspectionDueTone(daysUntilDue: number | null, overdue: boolean): BadgeTone {
  if (overdue) return 'danger';
  if (daysUntilDue === null) return 'neutral';
  if (daysUntilDue <= 14) return 'warning';
  return 'success';
}
