import { createConnection } from 'node:net';

/**
 * Klopft an einem Port an, nur um zu sehen, ob jemand annimmt.
 *
 * Diese Prüfung beantwortet eine Frage, die sonst zwischen allen Stühlen
 * hängt: Liegt es am Netz oder an der Datenbank? Eine Abfrage, die nicht
 * zurückkommt, sagt das nicht – sie sieht in beiden Fällen gleich aus. Hier
 * dagegen ist der Unterschied klar zu sehen:
 *
 *   „offen"              Die Gegenstelle nimmt Verbindungen an. Was danach
 *                        schiefgeht, liegt hinter dem Port – Anmeldung,
 *                        Datenbank, Pooler.
 *   „Zeitüberschreitung" Die Pakete verschwinden. So verhält sich ein
 *                        gesperrter Port oder eine falsche Adresse; niemand
 *                        schickt auch nur eine Absage.
 *   „abgelehnt"          Der Rechner ist da, aber auf diesem Port hört
 *                        niemand. Meist die falsche Portnummer.
 *
 * Es wird nichts gesendet und nichts gelesen, nur verbunden und wieder
 * aufgelegt. Zugangsdaten braucht das nicht.
 */
export function netzpruefung(
  rechner: string,
  port: number,
  geduldMs = 5000,
): Promise<{ ergebnis: string; dauerMs: number }> {
  const start = Date.now();

  return new Promise((erfuellen) => {
    const verbindung = createConnection({ host: rechner, port });
    const fertig = (ergebnis: string) => {
      verbindung.destroy();
      erfuellen({ ergebnis, dauerMs: Date.now() - start });
    };

    verbindung.setTimeout(geduldMs);
    verbindung.once('connect', () => fertig('offen – es nimmt jemand an'));
    verbindung.once('timeout', () =>
      fertig('Zeitüberschreitung – die Pakete verschwinden, typisch für einen gesperrten Port'),
    );
    verbindung.once('error', (fehler: NodeJS.ErrnoException) =>
      fertig(
        fehler.code === 'ECONNREFUSED'
          ? 'abgelehnt – der Port ist erreichbar, aber niemand hört darauf'
          : `Fehler: ${fehler.code ?? fehler.message}`,
      ),
    );
  });
}
