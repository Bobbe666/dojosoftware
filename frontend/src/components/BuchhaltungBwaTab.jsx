import React from 'react';
import { RefreshCw, BarChart3 } from 'lucide-react';

// Ausgelagert aus BuchhaltungTab.jsx (BWA-Tab, read-only).
const BuchhaltungBwaTab = ({ loading, bwaData, bwaLoading, bwaJahr, setBwaJahr, jahre, loadBwa, formatCurrency }) => {
  return (
          <div className="bwa-content">
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
              <div style={{ overflowX: 'auto' }}>
                <table className="data-table" style={{ minWidth: 900 }}>
                  <thead>
                    <tr>
                      <th>Monat</th>
                      <th className="right">Umsatz</th>
                      <th className="right">Rohertrag</th>
                      <th className="right">Personal</th>
                      <th className="right">Raum</th>
                      <th className="right">AfA</th>
                      <th className="right">Sonstige</th>
                      <th className="right">EBIT</th>
                      <th className="right">Vorjahr EBIT</th>
                      <th className="right">Abweichung</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(bwaData.monate || []).map((m, i) => {
                      const monatNamen = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
                      const ebit = parseFloat(m.ebit || 0);
                      const vorjahrEbit = parseFloat(m.vorjahr_ebit || 0);
                      const abweichung = ebit - vorjahrEbit;
                      return (
                        <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,.04)', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,.02)' }}>
                          <td style={{ fontWeight: 500 }}>{monatNamen[i] || m.monat}</td>
                          <td className="right" style={{ fontFamily: 'monospace' }}>{formatCurrency(m.umsatz)}</td>
                          <td className="right" style={{ fontFamily: 'monospace' }}>{formatCurrency(m.rohertrag)}</td>
                          <td className="right" style={{ fontFamily: 'monospace', color: '#ef4444' }}>{formatCurrency(m.personal)}</td>
                          <td className="right" style={{ fontFamily: 'monospace', color: '#ef4444' }}>{formatCurrency(m.raum)}</td>
                          <td className="right" style={{ fontFamily: 'monospace', color: '#ef4444' }}>{formatCurrency(m.afa)}</td>
                          <td className="right" style={{ fontFamily: 'monospace', color: '#ef4444' }}>{formatCurrency(m.sonstige)}</td>
                          <td className="right" style={{ fontFamily: 'monospace', fontWeight: 700, color: ebit >= 0 ? '#10b981' : '#ef4444' }}>{formatCurrency(ebit)}</td>
                          <td className="right" style={{ fontFamily: 'monospace', color: 'var(--text-muted)' }}>{formatCurrency(vorjahrEbit)}</td>
                          <td className="right" style={{ fontFamily: 'monospace', color: abweichung >= 0 ? '#10b981' : '#ef4444' }}>
                            {abweichung >= 0 ? '+' : ''}{formatCurrency(abweichung)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  {bwaData.jahressumme && (
                    <tfoot>
                      <tr style={{ borderTop: '2px solid rgba(255,255,255,.12)', background: 'rgba(255,255,255,.05)', fontWeight: 700 }}>
                        <td>Jahressumme</td>
                        <td className="right" style={{ fontFamily: 'monospace' }}>{formatCurrency(bwaData.jahressumme.umsatz)}</td>
                        <td className="right" style={{ fontFamily: 'monospace' }}>{formatCurrency(bwaData.jahressumme.rohertrag)}</td>
                        <td className="right" style={{ fontFamily: 'monospace', color: '#ef4444' }}>{formatCurrency(bwaData.jahressumme.personal)}</td>
                        <td className="right" style={{ fontFamily: 'monospace', color: '#ef4444' }}>{formatCurrency(bwaData.jahressumme.raum)}</td>
                        <td className="right" style={{ fontFamily: 'monospace', color: '#ef4444' }}>{formatCurrency(bwaData.jahressumme.afa)}</td>
                        <td className="right" style={{ fontFamily: 'monospace', color: '#ef4444' }}>{formatCurrency(bwaData.jahressumme.sonstige)}</td>
                        <td className="right" style={{ fontFamily: 'monospace', color: parseFloat(bwaData.jahressumme.ebit || 0) >= 0 ? '#10b981' : '#ef4444' }}>{formatCurrency(bwaData.jahressumme.ebit)}</td>
                        <td className="right" style={{ fontFamily: 'monospace', color: 'var(--text-muted)' }}>{formatCurrency(bwaData.jahressumme.vorjahr_ebit)}</td>
                        <td className="right" style={{ fontFamily: 'monospace', color: (parseFloat(bwaData.jahressumme.ebit || 0) - parseFloat(bwaData.jahressumme.vorjahr_ebit || 0)) >= 0 ? '#10b981' : '#ef4444' }}>
                          {(() => { const diff = parseFloat(bwaData.jahressumme.ebit || 0) - parseFloat(bwaData.jahressumme.vorjahr_ebit || 0); return (diff >= 0 ? '+' : '') + formatCurrency(diff); })()}
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
