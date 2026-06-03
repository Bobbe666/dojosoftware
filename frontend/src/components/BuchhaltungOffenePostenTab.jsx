import React from 'react';
import { Download, Plus, X, AlertCircle, RefreshCw, BarChart3 } from 'lucide-react';

// Ausgelagert aus BuchhaltungTab.jsx (Offene-Posten / Mahnwesen-Tab).
const BuchhaltungOffenePostenTab = ({
  loading, success, offenePosten, offenePostenLoading,
  showMahnungForm, setShowMahnungForm, mahnungForm, setMahnungForm,
  offeneRechnungen, altersliste, alterslisteLoading, showAltersliste, setShowAltersliste,
  mahnungPdfLoading,
  saveMahnung, mahnungVersandt, mahnungBezahlt, loadAltersliste, downloadMahnungPdf, formatCurrency
}) => {
  return (
          <div className="offene-posten-content">
            <div className="section-header">
              <h3><AlertCircle size={18} /> Offene Posten &amp; Mahnwesen</h3>
              <div className="header-actions" style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-secondary" onClick={() => { setShowAltersliste(true); loadAltersliste(); }}>
                  <BarChart3 size={14} /> Altersliste
                </button>
                <button className="btn-primary" onClick={() => setShowMahnungForm(true)}>
                  <Plus size={14} /> Mahnung erstellen
                </button>
              </div>
            </div>

            {offenePostenLoading ? (
              <div className="loading-state">Lade...</div>
            ) : (
              <>
                <h4 className="section-subtitle">Offene Rechnungen</h4>
                {offenePosten.offeneRechnungen.length === 0 ? (
                  <div className="empty-hint">Keine offenen Rechnungen</div>
                ) : (
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Rechnungsnr.</th>
                        <th>Schuldner</th>
                        <th className="right">Betrag</th>
                        <th>Fällig</th>
                        <th className="right">Überfällig</th>
                        <th>Mahnstufe</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {offenePosten.offeneRechnungen.map(r => (
                        <tr key={r.rechnung_id} className={r.tage_ueberfaellig > 30 ? 'row-danger' : r.tage_ueberfaellig > 0 ? 'row-warning' : ''}>
                          <td>{r.rechnungsnummer}</td>
                          <td>{r.vorname} {r.nachname}</td>
                          <td className="right">{parseFloat(r.betrag).toLocaleString('de-DE', { minimumFractionDigits: 2 })} €</td>
                          <td>{r.faelligkeitsdatum ? new Date(r.faelligkeitsdatum).toLocaleDateString('de-DE') : '—'}</td>
                          <td className="right">{r.tage_ueberfaellig > 0 ? <span className="text-danger">{r.tage_ueberfaellig} Tage</span> : '—'}</td>
                          <td>
                            {r.mahnstufe === 0 ? <span className="badge badge-neutral">Keine</span>
                              : r.mahnstufe === 1 ? <span className="badge badge-warning">Erinnerung</span>
                              : r.mahnstufe === 2 ? <span className="badge badge-danger">1. Mahnung</span>
                              : <span className="badge badge-danger">2. Mahnung</span>}
                          </td>
                          <td>
                            <button className="btn-sm btn-warning" onClick={() => {
                              setMahnungForm(f => ({
                                ...f,
                                rechnung_id: String(r.rechnung_id),
                                schuldner_name: `${r.vorname} ${r.nachname}`,
                                offener_betrag: String(r.betrag),
                                faelligkeitsdatum: new Date().toISOString().split('T')[0],
                                mahnstufe: String(Math.min(r.mahnstufe + 1, 3))
                              }));
                              setShowMahnungForm(true);
                            }}>Mahnen</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                <h4 className="section-subtitle" style={{ marginTop: '1.5rem' }}>Offene Mahnungen</h4>
                {offenePosten.mahnungen.length === 0 ? (
                  <div className="empty-hint">Keine offenen Mahnungen</div>
                ) : (
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Schuldner</th>
                        <th>Stufe</th>
                        <th className="right">Betrag</th>
                        <th className="right">Mahngebühr</th>
                        <th>Erstellt</th>
                        <th>Versandt</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {offenePosten.mahnungen.map(m => (
                        <tr key={m.mahnung_id}>
                          <td>{m.schuldner_name}</td>
                          <td>
                            {m.mahnstufe === 1 ? <span className="badge badge-neutral">Erinnerung</span>
                              : m.mahnstufe === 2 ? <span className="badge badge-warning">1. Mahnung</span>
                              : <span className="badge badge-danger">2. Mahnung</span>}
                          </td>
                          <td className="right">{parseFloat(m.offener_betrag).toLocaleString('de-DE', { minimumFractionDigits: 2 })} €</td>
                          <td className="right">{parseFloat(m.mahngebuehr) > 0 ? `${parseFloat(m.mahngebuehr).toLocaleString('de-DE', { minimumFractionDigits: 2 })} €` : '—'}</td>
                          <td>{new Date(m.erstellt_am).toLocaleDateString('de-DE')}</td>
                          <td>{m.versandt_am ? new Date(m.versandt_am).toLocaleDateString('de-DE') : <span className="text-muted">Nicht versandt</span>}</td>
                          <td className="action-cell">
                            {!m.versandt_am && (
                              <button className="btn-sm" onClick={() => mahnungVersandt(m.mahnung_id)}>Versandt</button>
                            )}
                            <button className="btn-sm btn-success" onClick={() => mahnungBezahlt(m.mahnung_id)}>Bezahlt</button>
                            <button
                              className="btn-sm"
                              onClick={() => downloadMahnungPdf(m.mahnung_id)}
                              disabled={mahnungPdfLoading[m.mahnung_id]}
                              title="Als PDF herunterladen"
                            >
                              <Download size={12} /> {mahnungPdfLoading[m.mahnung_id] ? '...' : 'PDF'}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </>
            )}

            {/* Altersliste Modal */}
            {showAltersliste && (
              <div className="modal-overlay" onClick={() => setShowAltersliste(false)}>
                <div className="modal" style={{ maxWidth: 800, width: '90%' }} onClick={e => e.stopPropagation()}>
                  <div className="modal-header">
                    <h3><BarChart3 size={18} /> Debitorenaltersliste</h3>
                    <button className="close-btn" onClick={() => setShowAltersliste(false)}><X size={20} /></button>
                  </div>
                  <div className="modal-body">
                    {alterslisteLoading ? (
                      <div className="loading-state">Lade Altersliste...</div>
                    ) : !altersliste ? (
                      <div className="empty-hint">Keine Daten verfügbar.</div>
                    ) : (
                      <>
                        {/* Bucket Cards */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 24 }}>
                          {[
                            { key: 'aktuell', label: 'Aktuell', color: '#10b981', borderColor: '#10b981' },
                            { key: '1_30', label: '1–30 Tage', color: '#f59e0b', borderColor: '#f59e0b' },
                            { key: '31_60', label: '31–60 Tage', color: '#f97316', borderColor: '#f97316' },
                            { key: '61_90', label: '61–90 Tage', color: '#ef4444', borderColor: '#ef4444' },
                            { key: '90plus', label: '90+ Tage', color: '#dc2626', borderColor: '#dc2626' },
                          ].map(bucket => {
                            const b = altersliste.buckets?.[bucket.key] || {};
                            return (
                              <div key={bucket.key} style={{ background: 'var(--bg-card)', border: `2px solid ${bucket.borderColor}`, borderRadius: 10, padding: '14px 16px', textAlign: 'center' }}>
                                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>{bucket.label}</div>
                                <div style={{ fontSize: 20, fontWeight: 700, color: bucket.color, fontFamily: 'monospace' }}>{formatCurrency(b.summe || 0)}</div>
                                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{b.anzahl || 0} Rechnungen</div>
                              </div>
                            );
                          })}
                        </div>

                        {/* Detail Table */}
                        {(altersliste.rechnungen || []).length > 0 && (
                          <div style={{ overflowX: 'auto' }}>
                            <table className="data-table">
                              <thead>
                                <tr>
                                  <th>Rechnungsnr.</th>
                                  <th>Schuldner</th>
                                  <th>Fälligkeit</th>
                                  <th className="right">Tage überfällig</th>
                                  <th>Bucket</th>
                                  <th className="right">Betrag</th>
                                </tr>
                              </thead>
                              <tbody>
                                {(altersliste.rechnungen || []).map((r, i) => {
                                  const tage = r.tage_ueberfaellig || 0;
                                  const bucketLabel = tage <= 0 ? 'Aktuell' : tage <= 30 ? '1–30 Tage' : tage <= 60 ? '31–60 Tage' : tage <= 90 ? '61–90 Tage' : '90+ Tage';
                                  const bucketColor = tage <= 0 ? '#10b981' : tage <= 30 ? '#f59e0b' : tage <= 60 ? '#f97316' : tage <= 90 ? '#ef4444' : '#dc2626';
                                  return (
                                    <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,.04)' }}>
                                      <td>{r.rechnungsnummer}</td>
                                      <td>{r.schuldner || `${r.vorname || ''} ${r.nachname || ''}`.trim()}</td>
                                      <td>{r.faelligkeitsdatum ? new Date(r.faelligkeitsdatum).toLocaleDateString('de-DE') : '—'}</td>
                                      <td className="right" style={{ color: tage > 0 ? '#ef4444' : 'var(--text-muted)' }}>{tage > 0 ? `${tage} Tage` : '—'}</td>
                                      <td><span style={{ background: bucketColor + '22', color: bucketColor, borderRadius: 4, padding: '2px 8px', fontSize: 12 }}>{bucketLabel}</span></td>
                                      <td className="right" style={{ fontFamily: 'monospace', fontWeight: 600 }}>{formatCurrency(r.betrag || r.offener_betrag)}</td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                  <div className="modal-footer">
                    <button className="btn-secondary" onClick={() => setShowAltersliste(false)}>Schließen</button>
                    <button className="btn btn-secondary" onClick={loadAltersliste} disabled={alterslisteLoading}>
                      <RefreshCw size={14} /> Aktualisieren
                    </button>
                  </div>
                </div>
              </div>
            )}

            {showMahnungForm && (
              <div className="modal-overlay" onClick={() => setShowMahnungForm(false)}>
                <div className="modal" onClick={e => e.stopPropagation()}>
                  <div className="modal-header">
                    <h3>Mahnung erstellen</h3>
                    <button className="close-btn" onClick={() => setShowMahnungForm(false)}><X size={20} /></button>
                  </div>
                  <div className="modal-body">
                    <div className="form-row">
                      <div className="form-group">
                        <label>Schuldner *</label>
                        <input value={mahnungForm.schuldner_name}
                          onChange={e => setMahnungForm(f => ({ ...f, schuldner_name: e.target.value }))}
                          placeholder="Name des Schuldners" />
                      </div>
                      <div className="form-group">
                        <label>Offener Betrag (€) *</label>
                        <input type="number" step="0.01" value={mahnungForm.offener_betrag}
                          onChange={e => setMahnungForm(f => ({ ...f, offener_betrag: e.target.value }))} />
                      </div>
                    </div>
                    <div className="form-row">
                      <div className="form-group">
                        <label>Mahnstufe</label>
                        <select value={mahnungForm.mahnstufe}
                          onChange={e => setMahnungForm(f => ({ ...f, mahnstufe: e.target.value }))}>
                          <option value="1">Zahlungserinnerung</option>
                          <option value="2">1. Mahnung</option>
                          <option value="3">2. Mahnung</option>
                        </select>
                      </div>
                      <div className="form-group">
                        <label>Fälligkeitsdatum *</label>
                        <input type="date" value={mahnungForm.faelligkeitsdatum}
                          onChange={e => setMahnungForm(f => ({ ...f, faelligkeitsdatum: e.target.value }))} />
                      </div>
                    </div>
                    <div className="form-row">
                      <div className="form-group">
                        <label>Rechnungs-ID</label>
                        <input value={mahnungForm.rechnung_id}
                          onChange={e => setMahnungForm(f => ({ ...f, rechnung_id: e.target.value }))}
                          placeholder="Optional" />
                      </div>
                      <div className="form-group">
                        <label>Mahngebühr (€)</label>
                        <input type="number" step="0.01" value={mahnungForm.mahngebuehr}
                          onChange={e => setMahnungForm(f => ({ ...f, mahngebuehr: e.target.value }))} />
                      </div>
                    </div>
                    <div className="form-group">
                      <label>Mahntext</label>
                      <textarea value={mahnungForm.mahntext} rows="3"
                        onChange={e => setMahnungForm(f => ({ ...f, mahntext: e.target.value }))}
                        placeholder="Optionaler Mahntext..." />
                    </div>
                  </div>
                  <div className="modal-footer">
                    <button className="btn-secondary" onClick={() => setShowMahnungForm(false)}>Abbrechen</button>
                    <button className="btn-primary" onClick={saveMahnung}
                      disabled={loading || !mahnungForm.schuldner_name || !mahnungForm.offener_betrag || !mahnungForm.faelligkeitsdatum}>
                      {loading ? 'Speichern...' : 'Mahnung erstellen'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
  );
};

export default BuchhaltungOffenePostenTab;
