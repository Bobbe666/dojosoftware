import React from 'react';
import openApiBlob from '../utils/openApiBlob';
import { Download, ChevronDown, ChevronRight } from 'lucide-react';

// Ausgelagert aus BuchhaltungTab.jsx (GuV-Tab, read-only).
const BuchhaltungGuvTab = ({
  selectedOrg, selectedJahr, selectedQuartal, loading,
  guvDetails, guvSkrData, skrKontorahmen, setSkrKontorahmen,
  guvAnsicht, setGuvAnsicht,
  expandedSkrKonten, setExpandedSkrKonten,
  expandedGuvDetails, setExpandedGuvDetails,
  expandedKategorien, setExpandedKategorien,
  fetchGuvSkrData, formatCurrency
}) => {
  return (
          <div className="guv-content">
            <div className="section-header">
              <h3>Gewinn- und Verlustrechnung {selectedJahr}</h3>
              <div className="header-actions">
                <button
                  className="btn btn-secondary"
                  onClick={() => openApiBlob(`/api/buchhaltung/guv/export?organisation=${selectedOrg}&jahr=${selectedJahr}&format=csv&quartal=${selectedQuartal}`, { download: true, filename: `guv-${selectedJahr}.csv` })}
                >
                  <Download size={16} />
                  CSV
                </button>
              </div>
            </div>

            {/* Ansichts-Toggle */}
            <div className="guv-view-toggle">
              <span className="guv-toggle-label">Ansicht:</span>
              <div className="guv-skr-toggle">
                <button
                  className={`guv-skr-btn${guvAnsicht === 'standard' ? ' active' : ''}`}
                  onClick={() => setGuvAnsicht('standard')}
                >Standard</button>
                <button
                  className={`guv-skr-btn${guvAnsicht === 'skr' && skrKontorahmen === 'SKR03' ? ' active' : ''}`}
                  onClick={() => { setGuvAnsicht('skr'); setSkrKontorahmen('SKR03'); fetchGuvSkrData('SKR03'); }}
                >SKR 03</button>
                <button
                  className={`guv-skr-btn${guvAnsicht === 'skr' && skrKontorahmen === 'SKR04' ? ' active' : ''}`}
                  onClick={() => { setGuvAnsicht('skr'); setSkrKontorahmen('SKR04'); fetchGuvSkrData('SKR04'); }}
                >SKR 04</button>
              </div>
            </div>

            {loading && <div className="loading">Lade GuV-Daten...</div>}

            {/* ---- STANDARD-ANSICHT ---- */}
            {guvAnsicht === 'standard' && guvDetails && (
              <div className="guv-details">
                <table className="guv-table">
                  <thead>
                    <tr>
                      <th>Position</th>
                      <th className="right">Betrag</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="section-header-row">
                      <td colSpan="2"><strong>1. Umsatzerlöse</strong></td>
                    </tr>
                    <tr
                      className="bt-cursor-pointer"
                      onClick={() => setExpandedKategorien(prev => ({ ...prev, 'guv_umsatz': !prev['guv_umsatz'] }))}
                    >
                      <td className="bt-pl-2">
                        {expandedKategorien['guv_umsatz'] ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        {' '}Umsatzerlöse
                      </td>
                      <td className="right">{formatCurrency(guvDetails.umsatzerloese.gesamt)}</td>
                    </tr>
                    {expandedKategorien['guv_umsatz'] && guvDetails.umsatzerloese.details.map((detail, idx) => (
                      <React.Fragment key={idx}>
                        <tr
                          className={`detail-row${detail.einzelbuchungen?.length > 0 ? ' bt-cursor-pointer' : ''}`}
                          onClick={detail.einzelbuchungen?.length > 0 ? () => setExpandedGuvDetails(prev => ({ ...prev, [`umsatz_${idx}`]: !prev[`umsatz_${idx}`] })) : undefined}
                        >
                          <td className="bt-pl-4">
                            <span className="bt-flex-icon">
                              {detail.einzelbuchungen?.length > 0 && (expandedGuvDetails[`umsatz_${idx}`] ? <ChevronDown size={12} /> : <ChevronRight size={12} />)}
                              {detail.quelle}
                            </span>
                          </td>
                          <td className="right">{formatCurrency(detail.betrag)}</td>
                        </tr>
                        {expandedGuvDetails[`umsatz_${idx}`] && detail.einzelbuchungen?.map((buch, bIdx) => (
                          <tr key={bIdx} className="einzelbuchung-row">
                            <td className="bt-cell-sub bt-pl-6">{new Date(buch.datum).toLocaleDateString('de-DE')} — {buch.beschreibung}</td>
                            <td className="right bt-cell-sub-right">{formatCurrency(buch.betrag)}</td>
                          </tr>
                        ))}
                      </React.Fragment>
                    ))}

                    <tr className="section-header-row">
                      <td colSpan="2"><strong>2. Materialaufwand</strong></td>
                    </tr>
                    <tr
                      className={guvDetails.materialaufwand.details.length > 0 ? 'bt-cursor-pointer' : ''}
                      onClick={() => setExpandedKategorien(prev => ({ ...prev, 'guv_material': !prev['guv_material'] }))}
                    >
                      <td className="bt-pl-2">
                        {guvDetails.materialaufwand.details.length > 0 && (expandedKategorien['guv_material'] ? <ChevronDown size={14} /> : <ChevronRight size={14} />)}
                        {' '}Materialaufwand
                      </td>
                      <td className="right negative">-{formatCurrency(guvDetails.materialaufwand.gesamt)}</td>
                    </tr>
                    {expandedKategorien['guv_material'] && guvDetails.materialaufwand.details.map((detail, idx) => (
                      <React.Fragment key={idx}>
                        <tr className={`detail-row${detail.einzelbuchungen?.length > 0 ? ' bt-cursor-pointer' : ''}`}
                          onClick={detail.einzelbuchungen?.length > 0 ? () => setExpandedGuvDetails(prev => ({ ...prev, [`material_${idx}`]: !prev[`material_${idx}`] })) : undefined}>
                          <td className="bt-pl-4"><span className="bt-flex-icon">{detail.einzelbuchungen?.length > 0 && (expandedGuvDetails[`material_${idx}`] ? <ChevronDown size={12} /> : <ChevronRight size={12} />)}{detail.quelle}</span></td>
                          <td className="right negative">-{formatCurrency(detail.betrag)}</td>
                        </tr>
                        {expandedGuvDetails[`material_${idx}`] && detail.einzelbuchungen?.map((buch, bIdx) => (
                          <tr key={bIdx} className="einzelbuchung-row"><td className="bt-cell-sub bt-pl-6">{new Date(buch.datum).toLocaleDateString('de-DE')} — {buch.beschreibung}</td><td className="right bt-cell-sub-right">-{formatCurrency(buch.betrag)}</td></tr>
                        ))}
                      </React.Fragment>
                    ))}

                    <tr className="section-header-row">
                      <td colSpan="2"><strong>3. Personalaufwand</strong></td>
                    </tr>
                    <tr className={guvDetails.personalaufwand.details.length > 0 ? 'bt-cursor-pointer' : ''} onClick={() => setExpandedKategorien(prev => ({ ...prev, 'guv_personal': !prev['guv_personal'] }))}>
                      <td className="bt-pl-2">{guvDetails.personalaufwand.details.length > 0 && (expandedKategorien['guv_personal'] ? <ChevronDown size={14} /> : <ChevronRight size={14} />)}{' '}Personalaufwand</td>
                      <td className="right negative">-{formatCurrency(guvDetails.personalaufwand.gesamt)}</td>
                    </tr>
                    {expandedKategorien['guv_personal'] && guvDetails.personalaufwand.details.map((detail, idx) => (
                      <React.Fragment key={idx}>
                        <tr className={`detail-row${detail.einzelbuchungen?.length > 0 ? ' bt-cursor-pointer' : ''}`} onClick={detail.einzelbuchungen?.length > 0 ? () => setExpandedGuvDetails(prev => ({ ...prev, [`personal_${idx}`]: !prev[`personal_${idx}`] })) : undefined}>
                          <td className="bt-pl-4"><span className="bt-flex-icon">{detail.einzelbuchungen?.length > 0 && (expandedGuvDetails[`personal_${idx}`] ? <ChevronDown size={12} /> : <ChevronRight size={12} />)}{detail.quelle}</span></td>
                          <td className="right negative">-{formatCurrency(detail.betrag)}</td>
                        </tr>
                        {expandedGuvDetails[`personal_${idx}`] && detail.einzelbuchungen?.map((buch, bIdx) => (
                          <tr key={bIdx} className="einzelbuchung-row"><td className="bt-cell-sub bt-pl-6">{new Date(buch.datum).toLocaleDateString('de-DE')} — {buch.beschreibung}</td><td className="right bt-cell-sub-right">-{formatCurrency(buch.betrag)}</td></tr>
                        ))}
                      </React.Fragment>
                    ))}

                    <tr className="section-header-row"><td colSpan="2"><strong>4. Abschreibungen</strong></td></tr>
                    <tr><td className="bt-pl-2">Abschreibungen auf Sachanlagen</td><td className="right negative">-{formatCurrency(guvDetails.abschreibungen.gesamt)}</td></tr>

                    <tr className="section-header-row"><td colSpan="2"><strong>5. Sonstige betriebliche Aufwendungen</strong></td></tr>
                    <tr className={guvDetails.sonstige_aufwendungen.details.length > 0 ? 'bt-cursor-pointer' : ''} onClick={() => setExpandedKategorien(prev => ({ ...prev, 'guv_sonstige': !prev['guv_sonstige'] }))}>
                      <td className="bt-pl-2">{guvDetails.sonstige_aufwendungen.details.length > 0 && (expandedKategorien['guv_sonstige'] ? <ChevronDown size={14} /> : <ChevronRight size={14} />)}{' '}Sonstige Aufwendungen</td>
                      <td className="right negative">-{formatCurrency(guvDetails.sonstige_aufwendungen.gesamt)}</td>
                    </tr>
                    {expandedKategorien['guv_sonstige'] && guvDetails.sonstige_aufwendungen.details.map((detail, idx) => (
                      <React.Fragment key={idx}>
                        <tr className={`detail-row${detail.einzelbuchungen?.length > 0 ? ' bt-cursor-pointer' : ''}`} onClick={detail.einzelbuchungen?.length > 0 ? () => setExpandedGuvDetails(prev => ({ ...prev, [`sonstige_${idx}`]: !prev[`sonstige_${idx}`] })) : undefined}>
                          <td className="bt-pl-4"><span className="bt-flex-icon">{detail.einzelbuchungen?.length > 0 && (expandedGuvDetails[`sonstige_${idx}`] ? <ChevronDown size={12} /> : <ChevronRight size={12} />)}{detail.kategorie} ({detail.quelle})</span></td>
                          <td className="right negative">-{formatCurrency(detail.betrag)}</td>
                        </tr>
                        {expandedGuvDetails[`sonstige_${idx}`] && detail.einzelbuchungen?.map((buch, bIdx) => (
                          <tr key={bIdx} className="einzelbuchung-row"><td className="bt-cell-sub bt-pl-6">{new Date(buch.datum).toLocaleDateString('de-DE')} — {buch.beschreibung}</td><td className="right bt-cell-sub-right">-{formatCurrency(buch.betrag)}</td></tr>
                        ))}
                      </React.Fragment>
                    ))}

                    {/* HGB §275 Zwischensummen */}
                    <tr className="subtotal-row">
                      <td><strong>= Betriebsergebnis (EBIT)</strong></td>
                      <td className={`right ${(guvDetails.ebit ?? guvDetails.jahresueberschuss) >= 0 ? 'positive' : 'negative'}`}>
                        <strong>{formatCurrency(guvDetails.ebit ?? guvDetails.jahresueberschuss)}</strong>
                      </td>
                    </tr>
                    {(guvDetails.ebt !== undefined && guvDetails.ebt !== guvDetails.ebit) && (
                      <tr className="subtotal-row">
                        <td><strong>= Ergebnis vor Steuern (EBT)</strong></td>
                        <td className={`right ${guvDetails.ebt >= 0 ? 'positive' : 'negative'}`}>
                          <strong>{formatCurrency(guvDetails.ebt)}</strong>
                        </td>
                      </tr>
                    )}
                    <tr className="total-row">
                      <td><strong>Jahresüberschuss / Jahresfehlbetrag</strong></td>
                      <td className={`right ${guvDetails.jahresueberschuss >= 0 ? 'positive' : 'negative'}`}>
                        <strong>{formatCurrency(guvDetails.jahresueberschuss)}</strong>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}

            {/* ---- SKR-ANSICHT ---- */}
            {guvAnsicht === 'skr' && guvSkrData && (
              <div className="guv-skr-container">
                {guvSkrData.kleinunternehmer && (
                  <div className="skr-hinweis">
                    Kleinunternehmer §19 UStG — Umsätze werden als steuerfreie Erlöse ausgewiesen
                  </div>
                )}
                <table className="guv-table skr-table">
                  <thead>
                    <tr>
                      <th className="skr-konto-col">Konto</th>
                      <th>Bezeichnung</th>
                      <th className="right">Betrag</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* EINNAHMEN */}
                    <tr className="section-header-row">
                      <td colSpan="3"><strong>BETRIEBSEINNAHMEN</strong></td>
                    </tr>
                    {guvSkrData.einnahmen.map((konto, idx) => (
                      <React.Fragment key={konto.nr}>
                        <tr
                          className={konto.buchungen?.length > 0 ? 'bt-cursor-pointer' : ''}
                          onClick={() => konto.buchungen?.length > 0 && setExpandedSkrKonten(prev => ({ ...prev, [konto.nr]: !prev[konto.nr] }))}
                        >
                          <td className="skr-konto-nr">
                            {konto.buchungen?.length > 0 && (expandedSkrKonten[konto.nr] ? <ChevronDown size={12} /> : <ChevronRight size={12} />)}
                            {' '}<span className="skr-badge">{konto.nr}</span>
                          </td>
                          <td>{konto.name}</td>
                          <td className="right positive">{formatCurrency(konto.betrag)}</td>
                        </tr>
                        {expandedSkrKonten[konto.nr] && konto.buchungen?.map((buch, bIdx) => (
                          <tr key={bIdx} className="einzelbuchung-row">
                            <td></td>
                            <td className="bt-cell-sub">{new Date(buch.datum).toLocaleDateString('de-DE')} — {buch.beschreibung}</td>
                            <td className="right bt-cell-sub-right">{formatCurrency(buch.betrag)}</td>
                          </tr>
                        ))}
                      </React.Fragment>
                    ))}
                    <tr className="subtotal-row">
                      <td colSpan="2"><strong>Summe Betriebseinnahmen</strong></td>
                      <td className="right positive"><strong>{formatCurrency(guvSkrData.summe_einnahmen)}</strong></td>
                    </tr>

                    {/* AUSGABEN */}
                    <tr className="section-header-row">
                      <td colSpan="3"><strong>BETRIEBSAUSGABEN</strong></td>
                    </tr>
                    {guvSkrData.ausgaben.map((konto, idx) => (
                      <React.Fragment key={konto.nr}>
                        <tr
                          className={konto.buchungen?.length > 0 ? 'bt-cursor-pointer' : ''}
                          onClick={() => konto.buchungen?.length > 0 && setExpandedSkrKonten(prev => ({ ...prev, [`a_${konto.nr}`]: !prev[`a_${konto.nr}`] }))}
                        >
                          <td className="skr-konto-nr">
                            {konto.buchungen?.length > 0 && (expandedSkrKonten[`a_${konto.nr}`] ? <ChevronDown size={12} /> : <ChevronRight size={12} />)}
                            {' '}<span className="skr-badge">{konto.nr}</span>
                          </td>
                          <td>{konto.name}</td>
                          <td className="right negative">-{formatCurrency(konto.betrag)}</td>
                        </tr>
                        {expandedSkrKonten[`a_${konto.nr}`] && konto.buchungen?.map((buch, bIdx) => (
                          <tr key={bIdx} className="einzelbuchung-row">
                            <td></td>
                            <td className="bt-cell-sub">{new Date(buch.datum).toLocaleDateString('de-DE')} — {buch.beschreibung}</td>
                            <td className="right bt-cell-sub-right negative">-{formatCurrency(buch.betrag)}</td>
                          </tr>
                        ))}
                      </React.Fragment>
                    ))}
                    <tr className="subtotal-row">
                      <td colSpan="2"><strong>Summe Betriebsausgaben</strong></td>
                      <td className="right negative"><strong>-{formatCurrency(guvSkrData.summe_ausgaben)}</strong></td>
                    </tr>

                    {/* ERGEBNIS */}
                    <tr className="total-row">
                      <td colSpan="2"><strong>Gewinn / Verlust {guvSkrData.jahr}</strong></td>
                      <td className={`right ${guvSkrData.ergebnis >= 0 ? 'positive' : 'negative'}`}>
                        <strong>{formatCurrency(guvSkrData.ergebnis)}</strong>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}

            {guvAnsicht === 'skr' && !guvSkrData && !loading && (
              <div className="empty-state">Keine Daten für {selectedJahr}</div>
            )}
          </div>
  );
};

export default BuchhaltungGuvTab;
