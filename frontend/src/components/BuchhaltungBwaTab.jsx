import React from 'react';
import { RefreshCw, BarChart3 } from 'lucide-react';

// Ausgelagert aus BuchhaltungTab.jsx (BWA-Tab, read-only).
const BuchhaltungBwaTab = ({ loading, bwaData, bwaLoading, bwaJahr, setBwaJahr, jahre, loadBwa, formatCurrency }) => {
  const num = (v) => parseFloat(v || 0);
  const mono = { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontVariantNumeric: 'tabular-nums' };
  const cost = (v) => ({ ...mono, color: num(v) === 0 ? 'rgba(255,255,255,.25)' : '#f87171' });
  const pos = (v) => ({ ...mono, color: num(v) === 0 ? 'rgba(255,255,255,.30)' : 'var(--text-primary, #fff)' });

  return (
          <div className="bwa-content">
            <style>{`
              .bwa-wrap{border:1px solid rgba(255,255,255,.08);border-radius:14px;overflow:auto;background:rgba(255,255,255,.015)}
              .bwa-tbl{width:100%;border-collapse:separate;border-spacing:0;font-size:13.5px;min-width:880px}
              .bwa-tbl thead th{position:sticky;top:0;z-index:1;background:#16171d;text-transform:uppercase;font-size:10.5px;letter-spacing:.08em;font-weight:600;color:rgba(255,255,255,.5);padding:13px 20px;border-bottom:1px solid rgba(255,255,255,.1);white-space:nowrap}
              .bwa-tbl th.r,.bwa-tbl td.r{text-align:right}
              .bwa-tbl tbody td{padding:11px 20px;white-space:nowrap;border-bottom:1px solid rgba(255,255,255,.045)}
              .bwa-tbl tbody tr:nth-child(even) td{background:rgba(255,255,255,.018)}
              .bwa-tbl tbody tr:hover td{background:rgba(96,165,250,.07)}
              .bwa-tbl .ebitcol{box-shadow:inset 1px 0 0 rgba(255,255,255,.08),inset -1px 0 0 rgba(255,255,255,.08);background:rgba(255,255,255,.022)}
              .bwa-tbl tfoot td{padding:14px 20px;border-top:2px solid rgba(255,255,255,.14);background:rgba(255,255,255,.045);font-weight:700;white-space:nowrap}
            `}</style>
            <div className="section-header">
              <h3><BarChart3 size={18} /> Betriebswirtschaftliche Auswertung (BWA) {bwaJahr}</h3>
              <div className="header-actions" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <select
                  value={bwaJahr}
                  onChange={e => setBwaJahr(parseInt(e.target.value))}
                  style={{ background: 'var(--bg-secondary, rgba(255,255,255,.07))', color: 'var(--text-primary)', border: '1px solid rgba(255,255,255,.12)', borderRadius: 7, padding: '7px 12px', fontSize: 13 }}
                >
                  {jahre.map(j => <option key={j} value={j}>{j}</option>)}
                </select>
                <button className="btn btn-primary" onClick={loadBwa} disabled={bwaLoading}>
                  <RefreshCw size={15} /> {bwaLoading ? 'Lade...' : 'Aktualisieren'}
                </button>
              </div>
            </div>

            {bwaLoading ? (
              <div className="loading-state">Lade BWA...</div>
            ) : !bwaData ? (
              <div className="empty-hint">Keine BWA-Daten verfügbar. Bitte zuerst laden.</div>
            ) : (
              <div className="bwa-wrap">
                <table className="bwa-tbl">
                  <thead>
                    <tr>
                      <th>Monat</th>
                      <th className="r">Umsatz</th>
                      <th className="r">Rohertrag</th>
                      <th className="r">Personal</th>
                      <th className="r">Raum</th>
                      <th className="r">AfA</th>
                      <th className="r">Sonstige</th>
                      <th className="r ebitcol">EBIT</th>
                      <th className="r">Vorjahr</th>
                      <th className="r">Δ Vorjahr</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(bwaData.monate || []).map((m, i) => {
                      const monatNamen = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
                      const ebit = num(m.ebit);
                      const vorjahrEbit = num(m.vorjahr_ebit);
                      const abw = ebit - vorjahrEbit;
                      return (
                        <tr key={i}>
                          <td style={{ fontWeight: 600, color: 'var(--text-primary, #fff)' }}>{monatNamen[i] || m.monat}</td>
                          <td className="r" style={pos(m.umsatz)}>{formatCurrency(m.umsatz)}</td>
                          <td className="r" style={pos(m.rohertrag)}>{formatCurrency(m.rohertrag)}</td>
                          <td className="r" style={cost(m.personal)}>{formatCurrency(m.personal)}</td>
                          <td className="r" style={cost(m.raum)}>{formatCurrency(m.raum)}</td>
                          <td className="r" style={cost(m.afa)}>{formatCurrency(m.afa)}</td>
                          <td className="r" style={cost(m.sonstige)}>{formatCurrency(m.sonstige)}</td>
                          <td className="r ebitcol" style={{ ...mono, fontWeight: 700, color: ebit > 0 ? '#34d399' : ebit < 0 ? '#f87171' : 'rgba(255,255,255,.4)' }}>{formatCurrency(ebit)}</td>
                          <td className="r" style={{ ...mono, color: 'rgba(255,255,255,.4)' }}>{formatCurrency(vorjahrEbit)}</td>
                          <td className="r" style={{ ...mono, color: abw > 0 ? '#34d399' : abw < 0 ? '#f87171' : 'rgba(255,255,255,.3)' }}>
                            {abw === 0 ? '–' : `${abw > 0 ? '▲ +' : '▼ '}${formatCurrency(abw)}`}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  {bwaData.jahressumme && (
                    <tfoot>
                      <tr>
                        <td>Jahressumme</td>
                        <td className="r" style={mono}>{formatCurrency(bwaData.jahressumme.umsatz)}</td>
                        <td className="r" style={mono}>{formatCurrency(bwaData.jahressumme.rohertrag)}</td>
                        <td className="r" style={cost(bwaData.jahressumme.personal)}>{formatCurrency(bwaData.jahressumme.personal)}</td>
                        <td className="r" style={cost(bwaData.jahressumme.raum)}>{formatCurrency(bwaData.jahressumme.raum)}</td>
                        <td className="r" style={cost(bwaData.jahressumme.afa)}>{formatCurrency(bwaData.jahressumme.afa)}</td>
                        <td className="r" style={cost(bwaData.jahressumme.sonstige)}>{formatCurrency(bwaData.jahressumme.sonstige)}</td>
                        <td className="r ebitcol" style={{ ...mono, color: num(bwaData.jahressumme.ebit) >= 0 ? '#34d399' : '#f87171' }}>{formatCurrency(bwaData.jahressumme.ebit)}</td>
                        <td className="r" style={{ ...mono, color: 'rgba(255,255,255,.4)' }}>{formatCurrency(bwaData.jahressumme.vorjahr_ebit)}</td>
                        <td className="r" style={{ ...mono, color: (num(bwaData.jahressumme.ebit) - num(bwaData.jahressumme.vorjahr_ebit)) >= 0 ? '#34d399' : '#f87171' }}>
                          {(() => { const diff = num(bwaData.jahressumme.ebit) - num(bwaData.jahressumme.vorjahr_ebit); return (diff >= 0 ? '+' : '') + formatCurrency(diff); })()}
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            )}
          </div>
  );
};

export default BuchhaltungBwaTab;
