/**
 * Der HTML-Bericht – eine einzelne Datei ohne Verweise nach außen.
 *
 * Ohne äußere Verweise, weil der Bericht per E-Mail weitergereicht, in einen
 * Anhang gepackt oder Monate später wieder geöffnet wird. Ein Stilblatt von
 * einem fremden Server wäre dann verschwunden und die Tabelle unlesbar.
 */
import { begruendung, grossbetrag, prozent, schreibenMitOrdner, zahl } from './ausgabe.mjs';

const schuetzen = (text) =>
  String(text ?? '').replace(
    /[&<>"']/g,
    (zeichen) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[zeichen],
  );

const GRUPPENNAMEN = {
  impuls: 'Impuls',
  trend: 'Trendgüte',
  tempo: 'Tempo',
  staerke: 'Rel. Stärke',
  struktur: 'Struktur',
  umsatz: 'Umsatz',
  stabilitaet: 'Stabilität',
};

function balken(punkte) {
  const breite = Math.max(0, Math.min(100, punkte));
  const ton = punkte >= 70 ? 'gut' : punkte >= 45 ? 'mittel' : 'schwach';
  return `<span class="balken ${ton}"><span style="width:${breite.toFixed(0)}%"></span></span>`;
}

function karte(eintrag, i) {
  const p = eintrag.plan;
  const g = eintrag.geschaeftszahlen;
  const gruppen = Object.entries(eintrag.gruppen)
    .map(
      ([name, punkte]) =>
        `<div><span>${schuetzen(GRUPPENNAMEN[name] ?? name)}</span>${balken(punkte)}<b>${Math.round(punkte)}</b></div>`,
    )
    .join('');

  // Als Raster statt als Tabelle: Die Karten stehen je nach Fensterbreite in
  // einer bis vier Spalten, und eine vierspaltige Tabelle mit unumbrechbaren
  // Zahlen läuft in der schmalsten Anordnung über den Rand hinaus.
  const felder = p
    ? [
        ['Einstieg', `${zahl(p.einstieg)} ${schuetzen(eintrag.waehrung)}`, ''],
        ['Stopp', `${zahl(p.stopp)} (${prozent(-p.stoppAbstand)})`, 'rot'],
        ['Ziel (2:1)', zahl(p.ziel1), 'gruen'],
        ['Trendziel', zahl(p.ziel2), 'gruen'],
        ['Stückzahl', zahl(p.stueck, 0), ''],
        ['Einsatz', `${grossbetrag(p.einsatz)} ${schuetzen(eintrag.waehrung)}`, ''],
        ['Risiko', grossbetrag(p.risikobetrag), ''],
        ['Ziel in', p.tageBisZiel1 == null ? '–' : `${p.tageBisZiel1} Tagen`, ''],
      ]
    : [];
  const plan = felder.length
    ? `<div class="plan">${felder
        .map(([bezeichnung, wert, ton]) => `<div><span>${bezeichnung}</span><b class="${ton}">${wert}</b></div>`)
        .join('')}</div>`
    : '';

  return `<article class="karte">
      <header>
        <span class="rang">${i + 1}</span>
        <div>
          <h3>${schuetzen(eintrag.symbol)}</h3>
          <p class="meta">${schuetzen(eintrag.name)}${g?.branche ? ` · ${schuetzen(g.branche)}` : ''}</p>
        </div>
        <span class="punkte">${zahl(eintrag.punkte, 1)}</span>
      </header>
      <p class="grund">${schuetzen(begruendung(eintrag))}</p>
      <div class="gruppen">${gruppen}</div>
      ${plan}
    </article>`;
}

function zeile(eintrag, i) {
  const k = eintrag.kennzahlen;
  const p = eintrag.plan;
  const ton = (wert) => (wert >= 0 ? 'gruen' : 'rot');
  return `<tr>
      <td class="r">${i + 1}</td>
      <td><b>${schuetzen(eintrag.symbol)}</b></td>
      <td class="name" title="${schuetzen(eintrag.name)}">${schuetzen(eintrag.name)}</td>
      <td class="r stark">${zahl(eintrag.punkte, 1)}</td>
      <td class="r">${zahl(k.anzeigekurs)}</td>
      <td class="r ${ton(k.r21)}">${prozent(k.r21)}</td>
      <td class="r ${ton(k.r63)}">${prozent(k.r63)}</td>
      <td class="r ${ton(k.r252)}">${prozent(k.r252)}</td>
      <td class="r">${zahl(k.tagesdrift, 2)}</td>
      <td class="r">${zahl(k.jahresschwankung, 0)}</td>
      <td class="r rot">${zahl(k.ruecksetzer, 0)}</td>
      <td class="r">${zahl(p?.stopp)}</td>
      <td class="r">${zahl(p?.ziel1)}</td>
      <td class="r">${p?.tageBisZiel1 ?? '–'}</td>
    </tr>`;
}

const STIL = `
  :root {
    color-scheme: light dark;
    --grund: #ffffff; --flaeche: #f6f7f9; --linie: #e2e5ea;
    --text: #14181f; --matt: #5d6675;
    --gruen: #12794f; --rot: #b3261e; --akzent: #1f4fd8;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --grund: #0f1216; --flaeche: #171b21; --linie: #262c35;
      --text: #e7eaef; --matt: #97a1b0;
      --gruen: #3fbd85; --rot: #f2776c; --akzent: #7aa2ff;
    }
  }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--grund); color: var(--text);
         font: 15px/1.55 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
  .rahmen { max-width: 1220px; margin: 0 auto; padding: 32px 20px 80px; }
  h1 { font-size: 26px; margin: 0 0 4px; letter-spacing: -0.01em; }
  h2 { font-size: 18px; margin: 44px 0 14px; }
  .kopf-meta { color: var(--matt); margin: 0 0 24px; font-size: 14px; }
  .kennwerte { display: grid; gap: 12px; margin: 24px 0;
               grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); }
  .kennwert { background: var(--flaeche); border: 1px solid var(--linie);
              border-radius: 10px; padding: 14px 16px; }
  .kennwert b { display: block; font-size: 22px; font-variant-numeric: tabular-nums; }
  .kennwert span { color: var(--matt); font-size: 12px; text-transform: uppercase;
                   letter-spacing: .04em; }
  table { width: 100%; border-collapse: collapse; font-size: 13.5px;
          font-variant-numeric: tabular-nums; }
  .scroll { overflow-x: auto; border: 1px solid var(--linie); border-radius: 10px; }
  th, td { padding: 8px 10px; border-bottom: 1px solid var(--linie);
           text-align: left; white-space: nowrap; }
  thead th { background: var(--flaeche); position: sticky; top: 0; font-size: 12px;
             text-transform: uppercase; letter-spacing: .03em; color: var(--matt); }
  tbody tr:last-child td { border-bottom: none; }
  tbody tr:hover { background: var(--flaeche); }
  td.r, th.r { text-align: right; }
  td.name { max-width: 240px; overflow: hidden; text-overflow: ellipsis; }
  .gruen { color: var(--gruen); } .rot { color: var(--rot); } .stark { font-weight: 650; }
  .karten { display: grid; gap: 14px; grid-template-columns: repeat(auto-fill, minmax(345px, 1fr)); }
  .karte { background: var(--flaeche); border: 1px solid var(--linie);
           border-radius: 12px; padding: 16px; }
  .karte header { display: flex; gap: 12px; align-items: flex-start; }
  .karte h3 { margin: 0; font-size: 16px; }
  .karte .meta { margin: 2px 0 0; color: var(--matt); font-size: 12.5px;
                 max-width: 210px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .rang { background: var(--akzent); color: #fff; border-radius: 7px; min-width: 26px;
          height: 26px; display: grid; place-items: center; font-size: 13px; font-weight: 650; }
  .punkte { margin-left: auto; font-size: 22px; font-weight: 680;
            font-variant-numeric: tabular-nums; }
  .grund { color: var(--matt); font-size: 13px; margin: 10px 0 12px; }
  .gruppen div { display: grid; grid-template-columns: 84px 1fr 28px; gap: 8px;
                 align-items: center; font-size: 12px; color: var(--matt); margin-bottom: 4px; }
  .gruppen b { text-align: right; color: var(--text); font-variant-numeric: tabular-nums; }
  .balken { display: block; height: 6px; background: var(--linie);
            border-radius: 3px; overflow: hidden; }
  .balken span { display: block; height: 100%; border-radius: 3px; background: var(--akzent); }
  .balken.gut span { background: var(--gruen); }
  .balken.schwach span { background: var(--matt); }
  .plan { margin-top: 14px; padding-top: 12px; border-top: 1px solid var(--linie);
          display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px 14px;
          font-size: 12.5px; }
  .plan div { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; }
  .plan span { color: var(--matt); }
  .plan b { font-weight: 640; font-variant-numeric: tabular-nums; text-align: right; }
  .hinweis { margin-top: 44px; padding: 16px 18px; border: 1px solid var(--linie);
             border-left: 3px solid var(--rot); border-radius: 8px; background: var(--flaeche);
             color: var(--matt); font-size: 13px; }
  .hinweis b { color: var(--text); }
  @media print { body { background: #fff; } .karte, .kennwert { break-inside: avoid; } }
`;

/** Schreibt den vollständigen Bericht nach `pfad`. */
export async function alsHtml(pfad, bericht) {
  const { treffer, lauf } = bericht;

  const html = `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Aktien-Scanner – ${schuetzen(lauf.datum)}</title>
<style>${STIL}</style>
</head>
<body>
<div class="rahmen">
  <h1>Aktien-Scanner</h1>
  <p class="kopf-meta">
    Lauf vom ${schuetzen(lauf.zeitpunkt)} · Markt <b>${schuetzen(lauf.markt)}</b> ·
    Profil <b>${schuetzen(lauf.profil)}</b> · Kursstand ${schuetzen(lauf.datum)}
  </p>

  <div class="kennwerte">
    <div class="kennwert"><span>Geprüft</span><b>${zahl(lauf.geprueft, 0)}</b></div>
    <div class="kennwert"><span>Nach Filter</span><b>${zahl(lauf.bewertet, 0)}</b></div>
    <div class="kennwert"><span>Ausgewählt</span><b>${zahl(treffer.length, 0)}</b></div>
    <div class="kennwert"><span>Ø Punkte</span><b>${zahl(lauf.durchschnittPunkte, 1)}</b></div>
    <div class="kennwert"><span>Dauer</span><b>${zahl(lauf.dauerSekunden, 0)} s</b></div>
  </div>

  <h2>Die Auswahl im Einzelnen</h2>
  <div class="karten">${treffer.slice(0, 12).map(karte).join('')}</div>

  <h2>Vollständige Rangliste</h2>
  <div class="scroll">
    <table>
      <thead><tr>
        <th class="r">#</th><th>Symbol</th><th>Name</th><th class="r">Punkte</th>
        <th class="r">Kurs</th><th class="r">1 Mon.</th><th class="r">3 Mon.</th>
        <th class="r">12 Mon.</th><th class="r">% / Tag</th><th class="r">Schwank.</th>
        <th class="r">Rücks.</th><th class="r">Stopp</th><th class="r">Ziel</th><th class="r">Tage</th>
      </tr></thead>
      <tbody>${treffer.map(zeile).join('')}</tbody>
    </table>
  </div>

  <div class="hinweis">
    <b>Keine Anlageberatung.</b> Dieser Bericht ist die Auswertung öffentlich zugänglicher
    Kursdaten nach festen, im Quelltext nachlesbaren Regeln. Er sagt, welche Papiere sich zuletzt
    am stärksten und stetigsten bewegt haben – nicht, welche das morgen tun werden.
    Kursentwicklungen der Vergangenheit sind kein verlässlicher Hinweis auf die Zukunft, und bei
    Einzelaktien ist ein Totalverlust möglich. Zahlen können durch Datenfehler beim Anbieter
    verfälscht sein. Prüfe jede Position selbst – insbesondere anstehende Geschäftszahlen und die
    Nachrichtenlage, von denen dieses Werkzeug nichts weiß.
  </div>
</div>
</body>
</html>
`;
  await schreibenMitOrdner(pfad, html);
}
