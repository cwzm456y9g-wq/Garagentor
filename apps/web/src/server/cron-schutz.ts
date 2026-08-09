import { timingSafeEqual } from 'node:crypto';
import { konfiguration } from './konfiguration';
import { HttpFehler, verboten } from './fehler';

/**
 * Weist den nächtlichen Aufruf aus.
 *
 * Die Jobs liefen bisher im Prozess. Auf geteiltem Webhosting geht das nicht:
 * Hostinger startet die Node-Anwendung bei Bedarf und lässt sie zwischendurch
 * ruhen – ein Zeitplan im Prozess feuert dann schlicht nicht. Stattdessen ruft
 * der Cron von hPanel diese Endpunkte auf.
 *
 * Damit sind sie von außen erreichbar und brauchen ein Geheimnis. Der
 * Vergleich läuft zeitkonstant, damit sich der erwartete Wert nicht Zeichen für
 * Zeichen erraten lässt.
 */
export function pruefeCronGeheimnis(anfrage: Request): void {
  const erwartet = konfiguration().cronGeheimnis;

  if (!erwartet) {
    throw new HttpFehler(
      503,
      'Die nächtlichen Läufe sind nicht eingerichtet. Es fehlt CRON_SECRET in ' +
        'der Umgebung des Servers.',
    );
  }

  const kopf = anfrage.headers.get('authorization') ?? '';
  const gegeben = kopf.startsWith('Bearer ') ? kopf.slice(7) : '';

  const a = Buffer.from(gegeben);
  const b = Buffer.from(erwartet);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw verboten('Der Aufruf konnte nicht ausgewiesen werden.');
  }
}
