/**
 * Woher die Liste der zu prüfenden Wertpapiere kommt.
 *
 * „Der komplette Aktienmarkt" heißt in der Praxis: das amtliche Verzeichnis
 * der US-Börsen (rund 13.000 Einträge), bereinigt um alles, was keine Aktie
 * ist. Das Verzeichnis liegt öffentlich bei NASDAQ Trader und wird täglich
 * neu erzeugt.
 *
 * Für Deutschland gibt es kein vergleichbares freies Verzeichnis. Deshalb
 * steht hier eine gepflegte Liste der vier Auswahlindizes – das ist praktisch
 * alles, was in Frankfurt genug Umsatz für einen planbaren Ein- und Ausstieg
 * hat.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const VERZEICHNISSE = {
  nasdaq: 'https://www.nasdaqtrader.com/dynamic/SymDir/nasdaqlisted.txt',
  uebrige: 'https://www.nasdaqtrader.com/dynamic/SymDir/otherlisted.txt',
};

/**
 * Wertpapiere, die zwar an einer Aktienbörse gehandelt werden, aber keine
 * Aktien sind. Sie gehören aus zwei Gründen heraus:
 *
 *   Fonds und Zertifikate bilden bloß einen Index oder Rohstoff ab – der
 *   „Fund" wäre in der Rangliste ein Doppelgänger seiner eigenen Bestandteile.
 *
 *   Optionsscheine, Bezugsrechte und Anteilsbündel aus Börsenmänteln bewegen
 *   sich um ein Vielfaches stärker als die Aktie dahinter. Sie stünden bei
 *   jeder Impuls-Kennzahl ganz oben und wären das Gegenteil dessen, was
 *   gesucht ist: nicht schnell, sondern nur laut.
 */
const NICHT_AKTIE =
  /\b(warrant|right|unit|preferred|depositary shares|debenture|note|bond|trust|etn|etf|fund|index|when[- ]issued|subordinated)\b/i;
const AKTIE = /\b(common stock|ordinary share|common share|american depositary share|class [a-z])\b/i;

/**
 * Wertpapiere des deutschen Marktes mit ausreichend Umsatz: DAX, MDAX, TecDAX
 * und SDAX. Symbole in der Schreibweise von Yahoo (Xetra-Kürzel plus `.DE`).
 *
 * Unbekannte Symbole – etwa nach einer Umbenennung – kosten nichts: Der Abruf
 * bekommt einen 404 und das Papier fällt still aus dem Lauf.
 */
const DEUTSCHLAND = `
1COV ADS AFX AIR ALV AOF ARL B4B BAS BAYN BC8 BEI BFSA BIO3 BMW BNR BOSS BVB
CBK COK COP CON DBK DB1 DEQ DEZ DHL DLG DMP DRW3 DTE DTG DUE DWNI ECV EOAN
ENR EVD EVK EVT FIE FNTN FPE3 FRA FRE G1A G24 GBF GFT GLJ GMM GXI HAG HBH
HEI HEN3 HFG HLE HNR1 HOT HYQ IFX INH JEN JUN3 KBX KCO KGX KRN KSB3 LEG LHA
LIN LPK LXS MBG MOR MRK MTX MUV2 NDA NEM NOEJ O2D P911 PAH3 PBB PFV PNE PSM
QIA R3NK RAA RHM RRTL RWE SAP SAX SBS SDF SFQ SGL SHA SHL SIE SIX2 SOW SRT3
STM SY1 SZG SZU TEG TIMA TKA TLX TTK UN01 UTDI VBK VNA VOS VOW3 WAC WAF WCH
YSN ZAL
`
  .trim()
  .split(/\s+/)
  .map((kuerzel) => `${kuerzel}.DE`);

/**
 * Vergleichsmaßstab je Markt. Gegen ihn wird die relative Stärke gemessen:
 * Eine Aktie, die 20 % steigt, während der Markt 25 % steigt, ist keine gute
 * Aktie – sie ist eine schlechte, die vom Rückenwind getragen wurde.
 */
export const MASSSTAB = {
  usa: '^GSPC',
  deutschland: '^GDAXI',
  welt: '^GSPC',
  eigene: '^GSPC',
};

/* Verzeichnis der US-Börsen ---------------------------------------------- */

function zeilenAuswerten(text, spalten) {
  const zeilen = text.split('\n');
  const kopf = zeilen[0].split('|');
  const index = Object.fromEntries(Object.entries(spalten).map(([k, v]) => [k, kopf.indexOf(v)]));

  const gefunden = [];
  for (const zeile of zeilen.slice(1)) {
    if (!zeile || zeile.startsWith('File Creation Time')) continue;
    const felder = zeile.split('|');
    const symbol = felder[index.symbol]?.trim();
    const name = felder[index.name]?.trim();
    if (!symbol || !name) continue;
    if (felder[index.testwert]?.trim() === 'Y') continue;
    if (felder[index.fonds]?.trim() === 'Y') continue;
    if (NICHT_AKTIE.test(name)) continue;
    if (!AKTIE.test(name)) continue;
    // Vorzugsaktien und Anleihen tragen ein Dollarzeichen im Kürzel.
    if (symbol.includes('$')) continue;
    // Punkte trennen bei NASDAQ Trader die Gattung ab (`BRK.B`), Yahoo nutzt
    // dafür den Bindestrich. Mehr als eine Gattungsstufe ist nie eine Aktie.
    if ((symbol.match(/\./g) ?? []).length > 1) continue;
    if (/\.(U|W|R|P[A-Z]?)$/i.test(symbol)) continue;
    gefunden.push({ symbol: symbol.replace(/\./g, '-'), name });
  }
  return gefunden;
}

async function verzeichnisHolen(adresse, zwischenablage) {
  const dateiname = join(zwischenablage, `verzeichnis-${adresse.split('/').pop()}`);
  try {
    const inhalt = JSON.parse(await readFile(`${dateiname}.json`, 'utf8'));
    if (Date.now() - new Date(inhalt.abgerufen).getTime() < 20 * 3600000) return inhalt.text;
  } catch {
    // Kein brauchbarer Zwischenspeicher – dann eben frisch.
  }
  const antwort = await fetch(adresse, { signal: AbortSignal.timeout(30000) });
  if (!antwort.ok) throw new Error(`Verzeichnis nicht erreichbar: HTTP ${antwort.status}`);
  const text = await antwort.text();
  await mkdir(zwischenablage, { recursive: true });
  await writeFile(`${dateiname}.json`, JSON.stringify({ abgerufen: new Date().toISOString(), text }));
  return text;
}

/* Öffentlich ------------------------------------------------------------- */

/**
 * Stellt die Liste der zu prüfenden Wertpapiere zusammen.
 *
 * `markt` ist `usa`, `deutschland`, `welt` oder `eigene`; im letzten Fall
 * zählen nur `symbole` und `datei`.
 */
export async function universumLaden({ markt, symbole = [], datei = null, zwischenablage }) {
  const gesammelt = new Map();
  const aufnehmen = (symbol, name) => {
    const sauber = symbol.trim().toUpperCase();
    if (sauber && !gesammelt.has(sauber)) gesammelt.set(sauber, { symbol: sauber, name: name ?? sauber });
  };

  if (markt === 'usa' || markt === 'welt') {
    const [nasdaq, uebrige] = await Promise.all([
      verzeichnisHolen(VERZEICHNISSE.nasdaq, zwischenablage),
      verzeichnisHolen(VERZEICHNISSE.uebrige, zwischenablage),
    ]);
    for (const eintrag of zeilenAuswerten(nasdaq, {
      symbol: 'Symbol',
      name: 'Security Name',
      fonds: 'ETF',
      testwert: 'Test Issue',
    })) {
      aufnehmen(eintrag.symbol, eintrag.name);
    }
    for (const eintrag of zeilenAuswerten(uebrige, {
      symbol: 'ACT Symbol',
      name: 'Security Name',
      fonds: 'ETF',
      testwert: 'Test Issue',
    })) {
      aufnehmen(eintrag.symbol, eintrag.name);
    }
  }

  if (markt === 'deutschland' || markt === 'welt') {
    for (const symbol of DEUTSCHLAND) aufnehmen(symbol);
  }

  if (datei) {
    const inhalt = await readFile(datei, 'utf8');
    for (const zeile of inhalt.split('\n')) {
      const nackt = zeile.split(/[#;,]/)[0].trim();
      if (nackt) aufnehmen(nackt);
    }
  }

  for (const symbol of symbole) aufnehmen(symbol);

  return [...gesammelt.values()];
}
