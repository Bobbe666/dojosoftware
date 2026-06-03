import React from 'react';
import openApiBlob from '../utils/openApiBlob';
import { Download, Edit, AlertCircle, CheckCircle } from 'lucide-react';

// Ausgelagert aus BuchhaltungTab.jsx (Bilanz-Tab).
const BuchhaltungBilanzTab = ({
  selectedOrg, selectedJahr, loading, success,
  bilanzData, editingGewinnvortrag, setEditingGewinnvortrag,
  showBilanzStammdatenModal, setShowBilanzStammdatenModal,
  saveGewinnvortrag, formatCurrency
}) => {
  return (
          <div className="bilanz-content">
            <div className="section-header">
              <h3>Bilanz zum 31.12.{selectedJahr}</h3>
              <div className="header-actions">
                <button
                  className="btn btn-primary"
                  onClick={() => setShowBilanzStammdatenModal(true)}
                >
                  <Edit size={16} />
                  Stammdaten bearbeiten
                </button>
                <button
                  className="btn btn-secondary"
                  onClick={() => openApiBlob(`/api/buchhaltung/bilanz/export?organisation=${selectedOrg}&jahr=${selectedJahr}&format=csv`, { download: true, filename: `bilanz-${selectedJahr}.csv` })}
                >
                  <Download size={16} />
                  CSV Export
                </button>
              </div>
            </div>

            {loading && <div className="loading">Lade Bilanz-Daten...</div>}

            {!bilanzData && !loading && (
              <div className="message info">
                <AlertCircle size={16} />
                Keine Bilanz-Daten vorhanden. Bitte Stammdaten eingeben.
              </div>
            )}

            {bilanzData && (
              <div className="bilanz-layout">
                {!bilanzData.stammdaten_vorhanden && (
                  <div className="message warning" style={{ marginBottom: '1rem' }}>
                    <AlertCircle size={16} />
                    Stammdaten fehlen noch. Bitte über "Stammdaten bearbeiten" die Eröffnungswerte eingeben.
                  </div>
                )}
                <div className="bilanz-columns">
                  {/* AKTIVA (Left) */}
                  <div className="bilanz-column">
                    <h4>AKTIVA</h4>
                    <table className="bilanz-table">
                      <tbody>
                        {/* A. Anlagevermögen */}
                        <tr className="section-header-row">
                          <td colSpan="2"><strong>A. Anlagevermögen</strong></td>
                        </tr>
                        <tr>
                          <td className="bt-pl-2">I. Immaterielle Vermögensgegenstände</td>
                          <td className="right">{formatCurrency(bilanzData.aktiva.anlagevermoegen.immat_vermoegensgegenstaende)}</td>
                        </tr>
                        <tr>
                          <td className="bt-pl-2">II. Sachanlagen{bilanzData.aktiva.anlagevermoegen.sachanlagen_quelle === 'auto' && <span style={{ marginLeft: 6, fontSize: 11, opacity: 0.6 }}>(auto)</span>}</td>
                          <td className="right">{formatCurrency(bilanzData.aktiva.anlagevermoegen.sachanlagen)}</td>
                        </tr>
                        <tr>
                          <td className="bt-pl-2">III. Finanzanlagen</td>
                          <td className="right">{formatCurrency(bilanzData.aktiva.anlagevermoegen.finanzanlagen)}</td>
                        </tr>
                        <tr className="subtotal-row">
                          <td className="bt-pl-1"><strong>Summe Anlagevermögen</strong></td>
                          <td className="right"><strong>{formatCurrency(bilanzData.aktiva.anlagevermoegen.gesamt)}</strong></td>
                        </tr>

                        {/* B. Umlaufvermögen */}
                        <tr className="section-header-row">
                          <td colSpan="2"><strong>B. Umlaufvermögen</strong></td>
                        </tr>
                        <tr>
                          <td className="bt-pl-2">I. Vorräte</td>
                          <td className="right">{formatCurrency(bilanzData.aktiva.umlaufvermoegen.vorraete)}</td>
                        </tr>
                        <tr>
                          <td className="bt-pl-2">II. Forderungen aus Lieferungen und Leistungen</td>
                          <td className="right">{formatCurrency(bilanzData.aktiva.umlaufvermoegen.forderungen_ll)}</td>
                        </tr>
                        <tr>
                          <td className="bt-pl-3">Sonstige Forderungen</td>
                          <td className="right">{formatCurrency(bilanzData.aktiva.umlaufvermoegen.sonstige_forderungen)}</td>
                        </tr>
                        <tr>
                          <td className="bt-pl-2">III. Kassenbestand, Bankguthaben</td>
                          <td className="right">{formatCurrency(bilanzData.aktiva.umlaufvermoegen.bank_guthaben + bilanzData.aktiva.umlaufvermoegen.kassenbestand)}</td>
                        </tr>
                        <tr className="detail-row">
                          <td className="bt-pl-3">davon Bankguthaben</td>
                          <td className="right">{formatCurrency(bilanzData.aktiva.umlaufvermoegen.bank_guthaben)}</td>
                        </tr>
                        <tr className="detail-row">
                          <td className="bt-pl-3">davon Kassenbestand</td>
                          <td className="right">{formatCurrency(bilanzData.aktiva.umlaufvermoegen.kassenbestand)}</td>
                        </tr>
                        <tr className="subtotal-row">
                          <td className="bt-pl-1"><strong>Summe Umlaufvermögen</strong></td>
                          <td className="right"><strong>{formatCurrency(bilanzData.aktiva.umlaufvermoegen.gesamt)}</strong></td>
                        </tr>

                        {/* C. Rechnungsabgrenzungsposten */}
                        {bilanzData.aktiva.rechnungsabgrenzung > 0 && (
                          <tr>
                            <td><strong>C. Aktive Rechnungsabgrenzungsposten</strong></td>
                            <td className="right">{formatCurrency(bilanzData.aktiva.rechnungsabgrenzung)}</td>
                          </tr>
                        )}

                        <tr className="total-row">
                          <td><strong>SUMME AKTIVA</strong></td>
                          <td className="right"><strong>{formatCurrency(bilanzData.aktiva.gesamt)}</strong></td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* PASSIVA (Right) */}
                  <div className="bilanz-column">
                    <h4>PASSIVA</h4>
                    <table className="bilanz-table">
                      <tbody>
                        {/* A. Eigenkapital */}
                        <tr className="section-header-row">
                          <td colSpan="2"><strong>A. Eigenkapital</strong></td>
                        </tr>
                        <tr>
                          <td className="bt-pl-2">I. Kapital / Anfangsbestand</td>
                          <td className="right">{formatCurrency(bilanzData.passiva.eigenkapital.anfangsbestand)}</td>
                        </tr>
                        <tr>
                          <td className="bt-pl-2">
                            II. Gewinnvortrag aus Vorjahren
                          </td>
                          <td className="right">
                            {editingGewinnvortrag ? (
                              <input
                                type="number"
                                step="0.01"
                                autoFocus
                                className="inline-number-input"
                                defaultValue={bilanzData.passiva.eigenkapital.gewinnvortrag}
                                onBlur={(e) => saveGewinnvortrag(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') saveGewinnvortrag(e.target.value);
                                  if (e.key === 'Escape') setEditingGewinnvortrag(false);
                                }}
                              />
                            ) : (
                              <span
                                className="inline-edit-value"
                                onClick={() => setEditingGewinnvortrag(true)}
                                title="Klicken zum Bearbeiten"
                              >
                                {formatCurrency(bilanzData.passiva.eigenkapital.gewinnvortrag)}
                                <Edit size={11} className="inline-edit-icon" />
                              </span>
                            )}
                          </td>
                        </tr>
                        <tr>
                          <td className="bt-pl-2">III. Jahresüberschuss / -fehlbetrag</td>
                          <td className={`right ${bilanzData.passiva.eigenkapital.jahresueberschuss < 0 ? 'bt-negative' : ''}`}>
                            {formatCurrency(bilanzData.passiva.eigenkapital.jahresueberschuss)}
                          </td>
                        </tr>
                        <tr className="subtotal-row">
                          <td className="bt-pl-1"><strong>Summe Eigenkapital</strong></td>
                          <td className="right"><strong>{formatCurrency(bilanzData.passiva.eigenkapital.gesamt)}</strong></td>
                        </tr>

                        {/* B. Rückstellungen */}
                        <tr className="section-header-row">
                          <td colSpan="2"><strong>B. Rückstellungen</strong></td>
                        </tr>
                        <tr>
                          <td className="bt-pl-2">Steuerrückstellungen</td>
                          <td className="right">{formatCurrency(bilanzData.passiva.rueckstellungen.steuerrueckstellungen)}</td>
                        </tr>
                        <tr>
                          <td className="bt-pl-2">Sonstige Rückstellungen</td>
                          <td className="right">{formatCurrency(bilanzData.passiva.rueckstellungen.sonstige_rueckstellungen)}</td>
                        </tr>
                        <tr className="subtotal-row">
                          <td className="bt-pl-1"><strong>Summe Rückstellungen</strong></td>
                          <td className="right"><strong>{formatCurrency(bilanzData.passiva.rueckstellungen.gesamt)}</strong></td>
                        </tr>

                        {/* C. Verbindlichkeiten */}
                        <tr className="section-header-row">
                          <td colSpan="2"><strong>C. Verbindlichkeiten</strong></td>
                        </tr>
                        <tr>
                          <td className="bt-pl-2">Verbindlichkeiten ggü. Kreditinstituten</td>
                          <td className="right">{formatCurrency(bilanzData.passiva.verbindlichkeiten.darlehen)}</td>
                        </tr>
                        <tr>
                          <td className="bt-pl-2">Verbindlichkeiten aus Lieferungen und Leistungen</td>
                          <td className="right">{formatCurrency(bilanzData.passiva.verbindlichkeiten.verbindlichkeiten_lieferanten)}</td>
                        </tr>
                        <tr>
                          <td className="bt-pl-2">Sonstige Verbindlichkeiten</td>
                          <td className="right">{formatCurrency(bilanzData.passiva.verbindlichkeiten.sonstige_verbindlichkeiten)}</td>
                        </tr>
                        {bilanzData.passiva.verbindlichkeiten.ust_schulden > 0 && (
                          <tr>
                            <td className="bt-pl-2">Verbindlichkeiten ggü. Finanzamt (USt){bilanzData.passiva.verbindlichkeiten.ust_schulden_manuell ? '' : <span style={{ marginLeft: 6, fontSize: 11, opacity: 0.6 }}>(auto)</span>}</td>
                            <td className="right">{formatCurrency(bilanzData.passiva.verbindlichkeiten.ust_schulden)}</td>
                          </tr>
                        )}
                        <tr className="subtotal-row">
                          <td className="bt-pl-1"><strong>Summe Verbindlichkeiten</strong></td>
                          <td className="right"><strong>{formatCurrency(bilanzData.passiva.verbindlichkeiten.gesamt)}</strong></td>
                        </tr>

                        {/* D. Rechnungsabgrenzungsposten */}
                        {bilanzData.passiva.rechnungsabgrenzung > 0 && (
                          <tr>
                            <td><strong>D. Passive Rechnungsabgrenzungsposten</strong></td>
                            <td className="right">{formatCurrency(bilanzData.passiva.rechnungsabgrenzung)}</td>
                          </tr>
                        )}

                        <tr className="total-row">
                          <td><strong>SUMME PASSIVA</strong></td>
                          <td className="right"><strong>{formatCurrency(bilanzData.passiva.gesamt)}</strong></td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Differenz-Anzeige */}
                <div className={`bilanz-check ${bilanzData.bilanz_ausgeglichen ? 'ausgeglichen' : 'nicht-ausgeglichen'}`}>
                  {bilanzData.bilanz_ausgeglichen ? (
                    <span className="message success">
                      <CheckCircle size={16} />
                      Bilanz ist ausgeglichen.
                    </span>
                  ) : (
                    <span className="message warning">
                      <AlertCircle size={16} />
                      Differenz: {formatCurrency(Math.abs(bilanzData.aktiva.gesamt - bilanzData.passiva.gesamt))} — Aktiva und Passiva stimmen nicht überein. Bitte Stammdaten prüfen.
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
  );
};

export default BuchhaltungBilanzTab;
