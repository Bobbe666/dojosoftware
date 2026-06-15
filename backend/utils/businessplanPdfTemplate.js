/**
 * Businessplan PDF Template
 * =========================
 * Erzeugt einen klassischen Businessplan als druckbares HTML (Puppeteer → PDF),
 * Abschnitte (klassische Finanzplanungs-Systematik):
 *   Deckblatt · Zusammenfassung · Gründerprofil · Markt · Angebot · Marketing · SWOT
 *   · Investitions-/Finanzierungsplan · Rentabilitätsvorschau · 3-Jahres-Plan
 *   · Liquiditätsplan · Ziele & Meilensteine.
 */

module.exports = function generateBusinessplanPdfHTML(data) {
  const { plan, dojoInfo, texte = {}, positionen = {}, ziele = [], auswertung = {} } = data;
  const inv = positionen.investitionen || [];
  const fin = positionen.finanzierung || [];
  const ums = positionen.umsatz || [];
  const r = auswertung.rentabilitaet || {};
  const drei = auswertung.dreiJahresPlan || [];
  const liq = auswertung.liquiditaet || [];
  const mb = auswertung.mittelbilanz || {};

  const eur = (n) => new Intl.NumberFormat('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(Math.round(Number(n) || 0)) + ' €';
  const eur2 = (n) => new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(n) || 0) + ' €';
  const fmtDate = (d) => new Date(d).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const heute = fmtDate(new Date());
  const firmenname = plan.firmenname || dojoInfo?.dojoname || 'Unternehmen';
  const inhaber = dojoInfo?.inhaber || '';
  const adresse = [dojoInfo?.strasse, [dojoInfo?.plz, dojoInfo?.ort].filter(Boolean).join(' ')].filter(Boolean).join(', ');

  const textBlock = (val, ph) => {
    const v = (val || '').trim();
    if (!v) return `<p class="muted">${esc(ph)}</p>`;
    return v.split(/\n{2,}/).map(p => `<p>${esc(p).replace(/\n/g, '<br>')}</p>`).join('');
  };

  const INV_KAT = { grundstuecke: 'Grundstücke', gebaeude: 'Gebäude', maschinen: 'Maschinen/Geräte', einrichtung: 'Geschäfts-/Ladeneinrichtung', fahrzeuge: 'Fahrzeuge', warenausstattung: 'Warenerstausstattung', sonstiges: 'Sonstiges' };
  const FIN_ART = { eigenkapital: 'Eigenkapital', sacheinlage: 'Sacheinlagen', foerdermittel: 'Fördermittel', darlehen: 'Darlehen', beteiligung: 'Beteiligungen', betriebsmittelkredit: 'Betriebsmittelkredit', kontokorrent: 'Kontokorrent-Kredit' };
  const ZIEL_STATUS = { offen: 'Offen', laeuft: 'In Arbeit', erreicht: 'Erreicht', verfehlt: 'Verfehlt' };

  const rowsOrEmpty = (rows, cols, emptyText) =>
    rows.length ? rows : `<tr><td colspan="${cols}" class="muted">${emptyText}</td></tr>`;

  const invRows = inv.length ? inv.map(i => `<tr><td>${esc(INV_KAT[i.kategorie] || i.kategorie)}</td><td>${esc(i.bezeichnung)}</td><td class="r">${i.nutzungsdauer_jahre > 0 ? i.nutzungsdauer_jahre + ' J.' : '–'}</td><td class="r">${eur(i.betrag)}</td></tr>`).join('')
    : '<tr><td colspan="4" class="muted">Keine Investitionen erfasst.</td></tr>';

  const finRows = fin.length ? fin.map(f => `<tr><td>${esc(FIN_ART[f.art] || f.art)}</td><td>${esc(f.bezeichnung)}</td><td class="r">${f.zinssatz_prozent > 0 ? Number(f.zinssatz_prozent) + ' %' : '–'}</td><td class="r">${eur(f.betrag)}</td></tr>`).join('')
    : '<tr><td colspan="4" class="muted">Keine Finanzierung erfasst.</td></tr>';

  const umsRows = ums.length ? ums.map(u => `<tr><td>${esc(u.bezeichnung)}</td><td class="r">${Number(u.menge_monatlich)}</td><td class="r">${eur2(u.preis_einheit)}</td><td class="r">${eur(Number(u.menge_monatlich) * Number(u.preis_einheit))}</td></tr>`).join('')
    : '<tr><td colspan="4" class="muted">Keine Umsatzpositionen erfasst.</td></tr>';

  // Rentabilitäts-Waterfall (Jahr 1)
  const renta = [
    ['Umsatzerlöse', r.umsatzerloese], ['– Erlösschmälerung', -r.erloesschmaelerung, true],
    ['= Gesamtleistung', r.gesamtleistung, false, true],
    ['– Material/Wareneinsatz', -r.material, true], ['– Fremdleistungen', -r.fremdleistungen, true],
    ['= Rohertrag', r.rohertrag, false, true],
    ['+ sonstige betriebliche Erträge', r.sonstigeErtraege],
    ['= betrieblicher Rohertrag', r.betrieblicherRohertrag, false, true],
    ['– Personalaufwand', -r.personalaufwand, true], ['– Raumkosten', -r.raumkosten, true],
    ['– Versicherungen/Beiträge', -r.versicherungen, true], ['– Kfz-Kosten', -r.kfzKosten, true],
    ['– Werbe-/Reisekosten', -r.werbekosten, true], ['– Kosten der Warenabgabe', -r.kostenWarenabgabe, true],
    ['– Reparatur/Instandhaltung', -r.reparaturkosten, true],
    ['– sonstige Steuern', -r.sonstigeSteuern, true], ['– sonstige Aufwendungen', -r.sonstigeAufwendungen, true],
    ['– Abschreibungen (AfA)', -r.abschreibungen, true],
    ['+ Zinserträge', r.zinsertraege], ['– Zinsaufwendungen', -r.zinsaufwendungen, true],
    ['+ sonstige neutrale Erträge', r.neutraleErtraege], ['– sonstige neutrale Aufwendungen', -r.neutraleAufwendungen, true],
    ['= Ergebnis vor Steuern', r.ergebnisVorSteuern, false, true],
    ['– Ergebnisabhängige Steuern', -r.steuern, true],
    ['= Betriebsergebnis (Jahresüberschuss)', r.betriebsergebnis, false, true],
    ['+ Abschreibungen', r.abschreibungen],
    ['= Cash-flow', r.cashflow, false, true],
    ['– Privatentnahmen', -r.privatentnahmen, true], ['+ Privateinlagen', r.privateinlagen],
    ['– Tilgung', -r.tilgung, true],
    ['= Liquiditätsergebnis', r.liquiditaetsergebnis, false, true],
  ].map(([label, val, neg, bold]) => `<tr class="${bold ? 'sum' : ''}"><td>${esc(label)}</td><td class="r ${(Number(val) || 0) < 0 ? 'neg' : ''}">${eur(val)}</td></tr>`).join('');

  const dreiCols = drei.map(d => `<th class="r">${d.jahr}</th>`).join('');
  const dreiRow = (label, key, bold) => `<tr class="${bold ? 'sum' : ''}"><td>${esc(label)}</td>${drei.map(d => `<td class="r ${(Number(d[key]) || 0) < 0 ? 'neg' : ''}">${eur(d[key])}</td>`).join('')}</tr>`;

  const liqRows = liq.map(m => `<tr><td>${esc(m.label)}</td><td class="r">${eur(m.einzahlungen)}</td><td class="r">${eur(m.auszahlungen)}</td><td class="r ${m.ueberschuss < 0 ? 'neg' : ''}">${eur(m.ueberschuss)}</td><td class="r ${m.saldo < 0 ? 'neg' : ''}">${eur(m.saldo)}</td></tr>`).join('');

  const zielRows = ziele.length ? ziele.map(z => `<tr><td>${esc(z.titel)}</td><td>${esc(z.kpi_name || '–')}</td><td class="r">${z.zielwert != null ? new Intl.NumberFormat('de-DE').format(z.zielwert) : '–'} ${esc(z.einheit || '')}</td><td>${esc(ZIEL_STATUS[z.status] || z.status)}</td></tr>`).join('')
    : '<tr><td colspan="4" class="muted">Keine Ziele definiert.</td></tr>';

  return `<!DOCTYPE html><html lang="de"><head><meta charset="utf-8"><style>
  * { box-sizing: border-box; }
  body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #1a1a2e; font-size: 11.5px; line-height: 1.5; margin: 0; }
  h1 { font-size: 30px; margin: 0 0 6px; color: #e0701a; }
  h2 { font-size: 16px; margin: 24px 0 9px; padding-bottom: 5px; border-bottom: 2px solid #e0701a; }
  h3 { font-size: 12.5px; margin: 14px 0 5px; color: #555; }
  p { margin: 0 0 7px; }
  .muted { color: #999; font-style: italic; }
  .cover { padding: 70px 0 40px; }
  .cover .sub { font-size: 15px; color: #555; margin-top: 4px; }
  .meta { margin-top: 28px; font-size: 12.5px; }
  .meta div { margin-bottom: 3px; }
  .kpis { display: flex; gap: 9px; margin: 12px 0; flex-wrap: wrap; }
  .kpi { flex: 1; min-width: 110px; border: 1px solid #eee; border-radius: 8px; padding: 9px 11px; background: #fafafa; }
  .kpi .label { font-size: 9.5px; text-transform: uppercase; color: #888; letter-spacing: .04em; }
  .kpi .value { font-size: 16px; font-weight: 700; margin-top: 3px; }
  .kpi .value.pos { color: #1a8a3a; } .kpi .value.neg { color: #c0392b; }
  table { width: 100%; border-collapse: collapse; margin: 7px 0; }
  th, td { padding: 5px 8px; border-bottom: 1px solid #eee; text-align: left; }
  th { background: #f5f5f7; font-size: 9.5px; text-transform: uppercase; letter-spacing: .03em; color: #666; }
  td.r, th.r { text-align: right; }
  td.neg { color: #c0392b; }
  tr.sum td { font-weight: 700; border-top: 1px solid #ccc; background: #fafafa; }
  tfoot td { font-weight: 700; border-top: 2px solid #ccc; }
  .balance { padding: 8px 12px; border-radius: 8px; margin-top: 6px; font-weight: 600; }
  .balance.ok { background: #eafaf0; color: #1a8a3a; } .balance.warn { background: #fdecea; color: #c0392b; }
  .page-break { page-break-before: always; }
  .footer { margin-top: 26px; font-size: 9.5px; color: #aaa; text-align: center; }
  .two { display: flex; gap: 16px; } .two > div { flex: 1; }
  </style></head><body>

  <div class="cover">
    <div style="font-size:12px;color:#888;letter-spacing:.1em;text-transform:uppercase;">Businessplan ${esc(plan.planungsjahr)}</div>
    <h1>${esc(plan.titel || 'Businessplan')}</h1>
    <div class="sub">${esc(firmenname)}${plan.rechtsform ? ' · ' + esc(plan.rechtsform) : ''}</div>
    <div class="meta">
      ${inhaber ? `<div><strong>Inhaber:</strong> ${esc(inhaber)}</div>` : ''}
      ${adresse ? `<div><strong>Anschrift:</strong> ${esc(adresse)}</div>` : ''}
      <div><strong>Planungsjahr:</strong> ${esc(plan.planungsjahr)}</div>
      <div><strong>Erstellt am:</strong> ${heute}</div>
    </div>
  </div>

  <h2>1. Zusammenfassung</h2>
  ${textBlock(texte.zusammenfassung, 'Kurze Zusammenfassung des Vorhabens, der Ziele und der wichtigsten Eckdaten.')}
  <div class="kpis">
    <div class="kpi"><div class="label">Umsatz / Jahr</div><div class="value">${eur(r.umsatzerloese)}</div></div>
    <div class="kpi"><div class="label">Betriebsergebnis / Jahr</div><div class="value ${(r.betriebsergebnis || 0) < 0 ? 'neg' : 'pos'}">${eur(r.betriebsergebnis)}</div></div>
    <div class="kpi"><div class="label">Cash-flow / Jahr</div><div class="value ${(r.cashflow || 0) < 0 ? 'neg' : 'pos'}">${eur(r.cashflow)}</div></div>
    <div class="kpi"><div class="label">EK-Quote</div><div class="value">${mb.eigenkapitalquote || 0} %</div></div>
  </div>

  <h2>2. Gründer & Unternehmen</h2>
  ${textBlock(texte.gruenderprofil, 'Qualifikation, Erfahrung und Motivation der Gründer; Rechtsform und Standort.')}

  <h2>3. Markt & Wettbewerb</h2>
  ${textBlock(texte.markt, 'Marktbeschreibung, Zielgruppe, Wettbewerbsumfeld und Standortvorteile.')}

  <h2>4. Angebot & Leistungen</h2>
  ${textBlock(texte.angebot, 'Kurse, Mitgliedschaften und Zusatzleistungen sowie Alleinstellungsmerkmale.')}

  <h2>5. Marketing & Vertrieb</h2>
  ${textBlock(texte.marketing, 'Wie werden neue Mitglieder gewonnen und bestehende gebunden?')}

  ${texte.swot ? `<h2>6. Chancen & Risiken (SWOT)</h2>${textBlock(texte.swot, '')}` : ''}

  <div class="page-break"></div>
  <h2>7. Investitions- & Finanzierungsplan</h2>
  <div class="two">
    <div>
      <h3>Mittelverwendung</h3>
      <table><thead><tr><th>Kategorie</th><th>Position</th><th class="r">ND</th><th class="r">Betrag</th></tr></thead>
      <tbody>${invRows}${(Number(mb.betriebsmittel) || 0) > 0 ? `<tr><td>Betriebsmittel</td><td>Betriebsmittelbedarf (Working Capital)</td><td class="r">–</td><td class="r">${eur(mb.betriebsmittel)}</td></tr>` : ''}</tbody>
      <tfoot><tr><td colspan="3">Gesamt</td><td class="r">${eur(mb.mittelverwendung)}</td></tr></tfoot></table>
    </div>
    <div>
      <h3>Mittelherkunft (Finanzierung)</h3>
      <table><thead><tr><th>Art</th><th>Position</th><th class="r">Zins</th><th class="r">Betrag</th></tr></thead>
      <tbody>${finRows}</tbody>
      <tfoot><tr><td colspan="3">Gesamt</td><td class="r">${eur(mb.mittelherkunft)}</td></tr></tfoot></table>
    </div>
  </div>
  <div class="balance ${Math.abs(mb.differenz || 0) < 1 ? 'ok' : 'warn'}">
    ${Math.abs(mb.differenz || 0) < 1
      ? `✓ Mittelverwendung und Mittelherkunft sind ausgeglichen. Eigenkapitalquote: ${mb.eigenkapitalquote || 0} %.`
      : `⚠ Differenz zwischen Mittelherkunft und -verwendung: ${eur(mb.differenz)} (${(mb.differenz || 0) > 0 ? 'Überdeckung' : 'Unterdeckung'}).`}
  </div>

  <h3>Umsatzplanung (monatlich)</h3>
  <table><thead><tr><th>Produkt / Leistung</th><th class="r">Menge/Mon.</th><th class="r">Preis/Einheit</th><th class="r">Umsatz/Mon.</th></tr></thead>
  <tbody>${umsRows}</tbody>
  <tfoot><tr><td colspan="3">Gesamtumsatz / Monat</td><td class="r">${eur(auswertung.kennzahlen?.umsatzMonat)}</td></tr></tfoot></table>

  <div class="page-break"></div>
  <h2>8. Rentabilitätsvorschau ${esc(plan.planungsjahr)}</h2>
  <table><tbody>${renta}</tbody></table>

  <h2>9. 3-Jahres-Planung</h2>
  <table><thead><tr><th>Position</th>${dreiCols}</tr></thead><tbody>
    ${dreiRow('Umsatzerlöse', 'umsatzerloese')}
    ${dreiRow('Rohertrag', 'rohertrag')}
    ${dreiRow('Abschreibungen', 'abschreibungen')}
    ${dreiRow('Ergebnis vor Steuern', 'ergebnisVorSteuern', true)}
    ${dreiRow('Betriebsergebnis', 'betriebsergebnis', true)}
    ${dreiRow('Cash-flow', 'cashflow', true)}
  </tbody></table>

  <h2>10. Liquiditätsplan ${esc(plan.planungsjahr)}</h2>
  <table><thead><tr><th>Monat</th><th class="r">Einzahlungen</th><th class="r">Auszahlungen</th><th class="r">Über-/Fehlbetr.</th><th class="r">Saldo</th></tr></thead>
  <tbody>${liqRows}</tbody></table>
  <p class="muted">Tiefster Liquiditätsstand: ${eur(auswertung.kennzahlen?.tiefsterSaldo)}${auswertung.kennzahlen?.breakEvenMonat ? ` · positiver Saldo ab Monat ${auswertung.kennzahlen.breakEvenMonat}` : ''}.</p>

  <div class="page-break"></div>
  <h2>11. Ziele & Meilensteine ${esc(plan.planungsjahr)}</h2>
  ${textBlock(texte.ziele, '')}
  <table><thead><tr><th>Ziel</th><th>KPI</th><th class="r">Zielwert</th><th>Status</th></tr></thead><tbody>${zielRows}</tbody></table>

  <div class="footer">${esc(firmenname)} · Businessplan ${esc(plan.planungsjahr)} · Erstellt am ${heute} · Erzeugt mit Dojosoftware</div>
  </body></html>`;
};
