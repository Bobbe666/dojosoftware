import React from 'react';
import openApiBlob from '../utils/openApiBlob';
import { FileText, Edit, X, TrendingUp, TrendingDown, ChevronDown, ChevronRight, Euro, Check } from 'lucide-react';

// Ausgelagert aus BuchhaltungTab.jsx (EÜR-Übersicht / Dashboard).
const BuchhaltungEuerTab = ({
  dashboardData, euerData, belege, kategorien, success,
  expandedKategorien, setExpandedKategorien,
  editingBuchung, setEditingBuchung, editingBuchungKat, setEditingBuchungKat,
  saveBuchungKategorie, ladeBeitraegeDetail, ladeVerkaufDetail, formatCurrency, getKategorieName
}) => {
  return (
          <div className="euer-content">
            {/* Dashboard Cards */}
            {dashboardData && (
              <div className="dashboard-cards">
                <div className="dash-card einnahmen">
                  <div className="card-icon">
                    <TrendingUp size={24} />
                  </div>
                  <div className="card-content">
                    <span className="card-label">Einnahmen</span>
                    <span className="card-value">{formatCurrency(dashboardData.einnahmen?.gesamt)}</span>
                  </div>
                </div>

                <div className="dash-card ausgaben">
                  <div className="card-icon">
                    <TrendingDown size={24} />
                  </div>
                  <div className="card-content">
                    <span className="card-label">Ausgaben</span>
                    <span className="card-value">{formatCurrency(dashboardData.ausgaben?.gesamt)}</span>
                  </div>
                </div>

                <div className={`dash-card gewinn ${dashboardData.gewinnVerlust >= 0 ? 'positiv' : 'negativ'}`}>
                  <div className="card-icon">
                    <Euro size={24} />
                  </div>
                  <div className="card-content">
                    <span className="card-label">Gewinn/Verlust</span>
                    <span className="card-value">{formatCurrency(dashboardData.gewinnVerlust)}</span>
                  </div>
                </div>
              </div>
            )}

            {/* EÜR Details */}
            {euerData && (
              <div className="euer-details">
                <div className="euer-section">
                  <h3>
                    <TrendingUp size={18} />
                    Einnahmen
                  </h3>
                  <table className="euer-table">
                    <thead>
                      <tr>
                        <th>Kategorie</th>
                        <th>Quelle</th>
                        <th className="right">Betrag</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(euerData.einnahmen?.nachKategorie || {}).map(([kat, data]) => (
                        <React.Fragment key={kat}>
                          <tr
                            className="kategorie-row clickable bt-cursor-pointer"
                            onClick={() => setExpandedKategorien(prev => ({ ...prev, [`ein_${kat}`]: !prev[`ein_${kat}`] }))}
                          >
                            <td colSpan="2">
                              <span className="u-flex-row-sm">
                                {expandedKategorien[`ein_${kat}`] ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                <strong>{getKategorieName(kat)}</strong>
                              </span>
                            </td>
                            <td className="right"><strong>{formatCurrency(data.summe)}</strong></td>
                          </tr>
                          {expandedKategorien[`ein_${kat}`] && data.details?.map((detail, idx) => (
                            <React.Fragment key={`${kat}-${idx}`}>
                              <tr
                                className={`detail-row${detail.einzelbuchungen?.length > 0 ? ' clickable' : ''}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setExpandedKategorien(prev => ({ ...prev, [`ein_${kat}_${idx}`]: !prev[`ein_${kat}_${idx}`] }));
                                }}
                              >
                                <td colSpan="2">
                                  <span className="detail-row-indent">
                                    {detail.einzelbuchungen?.length > 0 && (
                                      expandedKategorien[`ein_${kat}_${idx}`] ? <ChevronDown size={12} /> : <ChevronRight size={12} />
                                    )}
                                    {detail.quelle} ({detail.anzahl}x)
                                  </span>
                                </td>
                                <td className="right">{formatCurrency(detail.summe)}</td>
                              </tr>
                              {expandedKategorien[`ein_${kat}_${idx}`] && detail.einzelbuchungen?.map((buchung, bIdx) => {
                                const buchKey = `ein_${kat}_${idx}_${bIdx}`;
                                const isEditing = editingBuchung?.key === buchKey;
                                const canEdit = (buchung.quelle === 'Beleg' || buchung.quelle === 'Bank') && buchung.referenz_id;
                                return (
                                  <tr
                                    key={buchKey}
                                    className={`einzelbuchung-row${buchung.drilldown ? ' clickable bt-cursor-pointer' : ''}`}
                                    onClick={buchung.drilldown && !isEditing ? () => {
                                      if (buchung.drilldown.typ === 'beitraege') ladeBeitraegeDetail(buchung.drilldown.monat, buchung.drilldown.jahr, buchung.beschreibung, buchung.drilldown.organisation);
                                      else if (buchung.drilldown.typ === 'verkauf') ladeVerkaufDetail(buchung.drilldown.verkauf_id, buchung.beschreibung);
                                    } : undefined}
                                    title={buchung.drilldown ? 'Klicken für Details' : undefined}
                                  >
                                    <td colSpan="2">
                                      <span className="einzelbuchung-indent">
                                        {buchung.drilldown && <ChevronRight size={11} />}
                                        {new Date(buchung.datum).toLocaleDateString('de-DE')} – {buchung.beschreibung || 'Keine Beschreibung'}
                                      </span>
                                      {isEditing && (
                                        <span className="buchung-edit-inline" onClick={e => e.stopPropagation()}>
                                          <select
                                            className="input-small"
                                            value={editingBuchungKat}
                                            onChange={e => setEditingBuchungKat(e.target.value)}
                                          >
                                            <option value="">Kategorie wählen…</option>
                                            {kategorien.map(k => (
                                              <option key={k.id} value={k.id}>{k.name}</option>
                                            ))}
                                          </select>
                                          <button className="btn-icon-xs btn-success" onClick={saveBuchungKategorie} title="Speichern"><Check size={12} /></button>
                                          <button className="btn-icon-xs" onClick={() => setEditingBuchung(null)} title="Abbrechen"><X size={12} /></button>
                                        </span>
                                      )}
                                    </td>
                                    <td className="right">
                                      {canEdit && !isEditing && (
                                        <button
                                          className="btn-icon-xs btn-ghost"
                                          title="Kategorie ändern"
                                          onClick={e => { e.stopPropagation(); setEditingBuchung({ key: buchKey, quelle: buchung.quelle, referenz_id: buchung.referenz_id }); setEditingBuchungKat(kat); }}
                                        >
                                          <Edit size={12} />
                                        </button>
                                      )}
                                      {formatCurrency(buchung.betrag)}
                                    </td>
                                  </tr>
                                );
                              })}
                            </React.Fragment>
                          ))}
                        </React.Fragment>
                      ))}
                      <tr className="total-row">
                        <td colSpan="2"><strong>Summe Einnahmen</strong></td>
                        <td className="right"><strong>{formatCurrency(euerData.einnahmen?.gesamt)}</strong></td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div className="euer-section">
                  <h3>
                    <TrendingDown size={18} />
                    Ausgaben
                  </h3>
                  <table className="euer-table">
                    <thead>
                      <tr>
                        <th>Kategorie</th>
                        <th>Quelle</th>
                        <th className="right">Betrag</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(euerData.ausgaben?.nachKategorie || {}).map(([kat, data]) => (
                        <React.Fragment key={kat}>
                          <tr
                            className="kategorie-row clickable bt-cursor-pointer"
                            onClick={() => setExpandedKategorien(prev => ({ ...prev, [`aus_${kat}`]: !prev[`aus_${kat}`] }))}
                          >
                            <td colSpan="2">
                              <span className="u-flex-row-sm">
                                {expandedKategorien[`aus_${kat}`] ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                <strong>{getKategorieName(kat)}</strong>
                              </span>
                            </td>
                            <td className="right"><strong>{formatCurrency(data.summe)}</strong></td>
                          </tr>
                          {expandedKategorien[`aus_${kat}`] && data.details?.map((detail, idx) => (
                            <React.Fragment key={`${kat}-${idx}`}>
                              <tr
                                className={`detail-row${detail.einzelbuchungen?.length > 0 ? ' clickable' : ''}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setExpandedKategorien(prev => ({ ...prev, [`aus_${kat}_${idx}`]: !prev[`aus_${kat}_${idx}`] }));
                                }}
                              >
                                <td colSpan="2">
                                  <span className="detail-row-indent">
                                    {detail.einzelbuchungen?.length > 0 && (
                                      expandedKategorien[`aus_${kat}_${idx}`] ? <ChevronDown size={12} /> : <ChevronRight size={12} />
                                    )}
                                    {detail.quelle} ({detail.anzahl}x)
                                  </span>
                                </td>
                                <td className="right">{formatCurrency(detail.summe)}</td>
                              </tr>
                              {expandedKategorien[`aus_${kat}_${idx}`] && detail.einzelbuchungen?.map((buchung, bIdx) => {
                                const buchKey = `aus_${kat}_${idx}_${bIdx}`;
                                const isEditing = editingBuchung?.key === buchKey;
                                const canEdit = (buchung.quelle === 'Beleg' || buchung.quelle === 'Bank') && buchung.referenz_id;
                                return (
                                  <tr key={buchKey} className="einzelbuchung-row">
                                    <td colSpan="2">
                                      <span className="einzelbuchung-indent">
                                        {new Date(buchung.datum).toLocaleDateString('de-DE')} – {buchung.beschreibung || 'Keine Beschreibung'}
                                      </span>
                                      {isEditing && (
                                        <span className="buchung-edit-inline" onClick={e => e.stopPropagation()}>
                                          <select
                                            className="input-small"
                                            value={editingBuchungKat}
                                            onChange={e => setEditingBuchungKat(e.target.value)}
                                          >
                                            <option value="">Kategorie wählen…</option>
                                            {kategorien.map(k => (
                                              <option key={k.id} value={k.id}>{k.name}</option>
                                            ))}
                                          </select>
                                          <button className="btn-icon-xs btn-success" onClick={saveBuchungKategorie} title="Speichern"><Check size={12} /></button>
                                          <button className="btn-icon-xs" onClick={() => setEditingBuchung(null)} title="Abbrechen"><X size={12} /></button>
                                        </span>
                                      )}
                                    </td>
                                    <td className="right" style={{ whiteSpace: 'nowrap' }}>
                                      {buchung.datei_name && (
                                        <button
                                          className="btn-beleg-anzeigen"
                                          title={`Beleg anzeigen: ${buchung.datei_name}`}
                                          onClick={e => { e.stopPropagation(); openApiBlob(`/buchhaltung/belege/${buchung.referenz_id}/datei`); }}
                                        >
                                          <FileText size={13} /> Beleg
                                        </button>
                                      )}
                                      {canEdit && !isEditing && (
                                        <button
                                          className="btn-kategorie-edit"
                                          title="Kategorie ändern"
                                          onClick={e => { e.stopPropagation(); setEditingBuchung({ key: buchKey, quelle: buchung.quelle, referenz_id: buchung.referenz_id }); setEditingBuchungKat(kat); }}
                                        >
                                          <Edit size={13} /> Kat.
                                        </button>
                                      )}
                                      {formatCurrency(buchung.betrag)}
                                    </td>
                                  </tr>
                                );
                              })}
                            </React.Fragment>
                          ))}
                        </React.Fragment>
                      ))}
                      <tr className="total-row">
                        <td colSpan="2"><strong>Summe Ausgaben</strong></td>
                        <td className="right"><strong>{formatCurrency(euerData.ausgaben?.gesamt)}</strong></td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Ergebnis */}
                <div className={`euer-ergebnis ${euerData.gewinnVerlust >= 0 ? 'positiv' : 'negativ'}`}>
                  <span>Ergebnis (Gewinn/Verlust):</span>
                  <span className="ergebnis-wert">{formatCurrency(euerData.gewinnVerlust)}</span>
                </div>
              </div>
            )}
          </div>
  );
};

export default BuchhaltungEuerTab;
