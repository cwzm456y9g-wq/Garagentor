'use client';

import { useEffect, useState } from 'react';
import { Button, Card, ErrorState, Field, Input, Spinner, Textarea } from '@/components/ui';
import { api } from '@/lib/api-client';
import { useAction } from '@/lib/hooks';

/**
 * Belegversand per Mail.
 *
 * Das Anschreiben kommt aus der Vorlage, ist vor dem Absenden aber noch
 * änderbar: kein Vorlagentext passt auf jeden Vorgang, und eine Mail, die man
 * nicht mehr anfassen kann, wird nicht verschickt, sondern umgangen.
 */

export type MailBelegart =
  'ANGEBOT' | 'RECHNUNG' | 'MAHNUNG' | 'SERVICEBERICHT' | 'PRUEFBESCHEINIGUNG' | 'PRUEFPROTOKOLL';

/** Ein weiterer Beleg, der im selben Umschlag mitgehen kann. */
interface Beilage {
  art: MailBelegart;
  id: string;
  bezeichnung: string;
  zusatz: string;
  datum: string;
}

interface Vorschau {
  an: string;
  betreff: string;
  text: string;
  anhang: string;
  empfaengerFehlt: boolean;
  beilagen: Beilage[];
}

interface MailStatus {
  eingerichtet: boolean;
  absender: string | null;
}

export interface MailDialogProps {
  art: MailBelegart;
  id: string;
  /**
   * Wird beim Schließen aufgerufen, mit dem Hinweis, ob etwas hinausging.
   *
   * Erst beim Schließen und nicht gleich beim Absenden: die Belegseite lädt
   * daraufhin neu und zeigt währenddessen ihren Ladezustand – das Fenster samt
   * Bestätigung wäre dann verschwunden, bevor jemand sie lesen konnte.
   */
  onClose: (gesendet: boolean) => void;
}

export function MailDialog({ art, id, onClose }: MailDialogProps) {
  const [entwurf, setEntwurf] = useState<Vorschau | null>(null);
  const [kopie, setKopie] = useState('');
  // Bewusst leer vorbelegt: Was einem Kunden zugeht, hakt ein Mensch an.
  const [gewaehlt, setGewaehlt] = useState<string[]>([]);
  const [ladefehler, setLadefehler] = useState<string | null>(null);
  const [status, setStatus] = useState<MailStatus | null>(null);
  const [gesendet, setGesendet] = useState(false);

  const senden = useAction((body: Record<string, unknown>) => api.post('/mail/senden', body));

  useEffect(() => {
    let abgebrochen = false;

    void (async () => {
      try {
        const [vorschau, mailStatus] = await Promise.all([
          api.post<Vorschau>('/mail/vorschau', { art, id }),
          api.get<MailStatus>('/mail/status'),
        ]);
        if (abgebrochen) return;
        setEntwurf(vorschau);
        setStatus(mailStatus);
      } catch {
        if (!abgebrochen) setLadefehler('Das Anschreiben konnte nicht vorbereitet werden.');
      }
    })();

    return () => {
      abgebrochen = true;
    };
  }, [art, id]);

  function aendern(patch: Partial<Vorschau>) {
    setEntwurf((current) => (current ? { ...current, ...patch } : current));
  }

  async function abschicken() {
    if (!entwurf) return;

    const ergebnis = await senden.run({
      art,
      id,
      an: entwurf.an,
      kopie: kopie || undefined,
      betreff: entwurf.betreff,
      text: entwurf.text,
      zusatz: entwurf.beilagen
        .filter((beilage) => gewaehlt.includes(beilage.id))
        .map((beilage) => ({ art: beilage.art, id: beilage.id })),
    });

    if (ergebnis) setGesendet(true);
  }

  return (
    // Der dunkle Grund fängt Klicks neben dem Fenster ab und schließt es.
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 sm:p-8"
      role="dialog"
      aria-modal="true"
      aria-label="Beleg per Mail versenden"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose(gesendet);
      }}
    >
      <div className="w-full max-w-2xl">
        <Card
          title="Per Mail versenden"
          actions={
            <Button variant="ghost" size="sm" onClick={() => onClose(gesendet)}>
              Schließen
            </Button>
          }
        >
          {ladefehler ? (
            <ErrorState message={ladefehler} />
          ) : !entwurf ? (
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Spinner className="h-4 w-4" /> Anschreiben wird vorbereitet …
            </div>
          ) : gesendet ? (
            <div className="space-y-4">
              <p className="meldung-erfolg">
                Die Mail ist an {entwurf.an} hinausgegangen. Der Versand steht im Versandprotokoll.
              </p>
              <div className="flex justify-end">
                <Button onClick={() => onClose(true)}>Fertig</Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {status && !status.eingerichtet && (
                <p className="meldung-hinweis">
                  Der Postausgang ist noch nicht eingerichtet. Die Zugangsdaten des Mailservers
                  gehören als MAIL_HOST, MAIL_USER, MAIL_PASSWORD und MAIL_FROM in die Umgebung des
                  Servers – nicht in diese Anwendung.
                </p>
              )}

              {entwurf.empfaengerFehlt && (
                <p className="meldung-hinweis">
                  Beim Kunden ist keine E-Mail-Adresse hinterlegt. Bitte hier eintragen und im
                  Kundenstamm nachtragen.
                </p>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="An" htmlFor="mail-an" required>
                  <Input
                    id="mail-an"
                    type="email"
                    value={entwurf.an}
                    onChange={(event) => aendern({ an: event.target.value })}
                    placeholder="kunde@beispiel.de"
                  />
                </Field>
                <Field label="Kopie an" htmlFor="mail-kopie" hint="Mehrere durch Komma getrennt.">
                  <Input
                    id="mail-kopie"
                    value={kopie}
                    onChange={(event) => setKopie(event.target.value)}
                  />
                </Field>
              </div>

              <Field label="Betreff" htmlFor="mail-betreff" required>
                <Input
                  id="mail-betreff"
                  value={entwurf.betreff}
                  onChange={(event) => aendern({ betreff: event.target.value })}
                />
              </Field>

              <Field label="Text" htmlFor="mail-text" required>
                <Textarea
                  id="mail-text"
                  rows={12}
                  value={entwurf.text}
                  onChange={(event) => aendern({ text: event.target.value })}
                />
              </Field>

              {entwurf.beilagen.length > 0 && (
                <fieldset className="rounded-md border border-slate-200 p-3">
                  <legend className="px-1 text-sm font-medium text-slate-700">
                    Weitere Belege beilegen
                  </legend>
                  <p className="mb-2 text-xs text-slate-500">
                    Gehört zum selben Vorgang. Das Prüfprotokoll nach ASR A1.7 braucht der Kunde für
                    seine Unterlagen – zusammen mit der Rechnung in einem Umschlag erspart es ihm
                    das Nachfragen.
                  </p>
                  <div className="space-y-1.5">
                    {entwurf.beilagen.map((beilage) => (
                      <label
                        key={beilage.id}
                        className="flex items-start gap-2 text-sm text-slate-700"
                      >
                        <input
                          type="checkbox"
                          className="mt-0.5 rounded border-slate-300"
                          checked={gewaehlt.includes(beilage.id)}
                          onChange={(event) =>
                            setGewaehlt((bisher) =>
                              event.target.checked
                                ? [...bisher, beilage.id]
                                : bisher.filter((eintrag) => eintrag !== beilage.id),
                            )
                          }
                        />
                        <span>
                          {beilage.bezeichnung}
                          {beilage.zusatz && (
                            <span className="block text-xs text-slate-500">{beilage.zusatz}</span>
                          )}
                        </span>
                      </label>
                    ))}
                  </div>
                </fieldset>
              )}

              <p className="text-xs text-slate-500">
                Anhang: {entwurf.anhang}
                {gewaehlt.length > 0 && ` und ${gewaehlt.length} weitere`} – wird beim Versand aus
                dem aktuellen Stand der Belege erzeugt.
              </p>

              {senden.error && <ErrorState message={senden.error} />}

              <div className="flex justify-end gap-2">
                <Button variant="secondary" onClick={() => onClose(false)}>
                  Abbrechen
                </Button>
                <Button
                  loading={senden.loading}
                  disabled={!entwurf.an.trim() || !entwurf.betreff.trim()}
                  onClick={() => void abschicken()}
                >
                  Absenden
                </Button>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

/** Knopf samt Fenster; spart auf jeder Belegseite denselben Zustand. */
export function MailButton({
  art,
  id,
  onSent,
  label = 'Per Mail',
  variante = 'secondary',
}: {
  art: MailBelegart;
  id: string;
  onSent?: () => void;
  label?: string;
  /** „ghost“ für den Weg, der nicht der übliche ist – etwa das vollständige Protokoll. */
  variante?: 'primary' | 'secondary' | 'ghost';
}) {
  const [offen, setOffen] = useState(false);

  return (
    <>
      <Button variant={variante} onClick={() => setOffen(true)}>
        {label}
      </Button>
      {offen && (
        <MailDialog
          art={art}
          id={id}
          onClose={(gesendet) => {
            setOffen(false);
            if (gesendet) onSent?.();
          }}
        />
      )}
    </>
  );
}
