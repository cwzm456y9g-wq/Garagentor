import type { Geraetekontext } from './dienste/anmeldedienst';

/**
 * Woher die Anfrage kam. Wird am Refresh-Token vermerkt, damit sich in der
 * Sitzungsübersicht erkennen lässt, welches Gerät noch angemeldet ist.
 *
 * Hinter Hostingers Proxy trägt die Verbindung die Adresse des Proxys, nicht
 * die des Kunden – deshalb zuerst `x-forwarded-for`, und davon der erste
 * Eintrag: die weiteren stammen von Zwischenstationen.
 */
export function geraetekontext(anfrage: Request): Geraetekontext {
  const weitergereicht = anfrage.headers.get('x-forwarded-for');
  const adresse = weitergereicht?.split(',')[0]?.trim() || undefined;

  return {
    userAgent: anfrage.headers.get('user-agent') ?? undefined,
    ipAddress: adresse,
  };
}
