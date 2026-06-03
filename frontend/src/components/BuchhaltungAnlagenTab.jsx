import React from 'react';
import { FileText, Plus, Edit, Trash2, X, Building2 } from 'lucide-react';

const BuchhaltungAnlagenTab = ({
  selectedJahr, loading, anlagen, anlagenLoading,
  showAnlageForm, setShowAnlageForm, editingAnlage, setEditingAnlage,
  anlageAfa, setAnlageAfa, anlageForm, setAnlageForm,
  saveAnlage, deleteAnlage, loadAfaSchedule
}) => {
  return (
          <div className="anlagen-content">
            <div className="anlagen-header">
              <h3><Building2 size={18} /> Anlagevermögen &amp; AfA-Plan</h3>
              <button className="btn-primary" onClick={() => {
                setEditingAnlage(null);
                setAnlageForm({ bezeichnung: '', beschreibung: '', anlage_kategorie: 'kfz',
                  kaufdatum: new Date().toISOString().split('T')[0],
                  anschaffungskosten: '', restwert: '0', nutzungsdauer: '6',
                  lieferant: '', rechnungsnummer: '' });
                setShowAnlageForm(true);
              }}>
                <Plus size={14} /> Anlage erfassen
              </button>
            </div>

            <div className="anlagen-info-box">
              <span>💡</span>
              <span>Anlagegüter &gt; 800 € netto werden linear über die Nutzungsdauer abgeschrieben.
              Die Kaufzahlungen als Beleg mit Kategorie <strong>„Anlagevermögen (Kauf / Rate)"</strong> erfassen —
              die AfA erscheint automatisch in der EÜR unter Abschreibungen.</span>
            </div>

            {showAnlageForm && (
              <div className="anlage-form-card">
                <h4>{editingAnlage ? '✏️ Anlage bearbeiten' : '➕ Neue Anlage erfassen'}</h4>
                <div className="anlage-form-grid">
                  <div className="form-group">
                    <label>Bezeichnung *</label>
                    <input value={anlageForm.bezeichnung}
                      onChange={e => setAnlageForm(p => ({ ...p, bezeichnung: e.target.value }))}
                      placeholder="z.B. Anhänger Turnierequipment" />
                  </div>
                  <div className="form-group">
                    <label>Kategorie *</label>
                    <select value={anlageForm.anlage_kategorie}
                      onChange={e => {
                        const preset = NUTZUNGSDAUER_PRESETS[e.target.value];
                        setAnlageForm(p => ({
                          ...p, anlage_kategorie: e.target.value,
                          nutzungsdauer: preset ? String(preset.jahre) : p.nutzungsdauer
                        }));
                      }}>
                      {Object.entries(NUTZUNGSDAUER_PRESETS).map(([k, v]) => (
                        <option key={k} value={k}>{v.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Kaufdatum *</label>
                    <input type="date" value={anlageForm.kaufdatum}
                      onChange={e => setAnlageForm(p => ({ ...p, kaufdatum: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label>Anschaffungskosten (€) *</label>
                    <input type="number" step="0.01" value={anlageForm.anschaffungskosten}
                      onChange={e => setAnlageForm(p => ({ ...p, anschaffungskosten: e.target.value }))}
                      placeholder="2500.00" />
                  </div>
                  <div className="form-group">
                    <label>Nutzungsdauer (Jahre) *</label>
                    <input type="number" min="1" max="50" value={anlageForm.nutzungsdauer}
                      onChange={e => setAnlageForm(p => ({ ...p, nutzungsdauer: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label>Restwert (€)</label>
                    <input type="number" step="0.01" value={anlageForm.restwert}
                      onChange={e => setAnlageForm(p => ({ ...p, restwert: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label>Lieferant</label>
                    <input value={anlageForm.lieferant}
                      onChange={e => setAnlageForm(p => ({ ...p, lieferant: e.target.value }))}
                      placeholder="Händlername" />
                  </div>
                  <div className="form-group">
                    <label>Rechnungsnummer</label>
                    <input value={anlageForm.rechnungsnummer}
                      onChange={e => setAnlageForm(p => ({ ...p, rechnungsnummer: e.target.value }))}
                      placeholder="RE-2025-001" />
                  </div>
                </div>
                <div className="anlage-form-actions">
                  <button className="btn-primary" onClick={saveAnlage} disabled={loading || !anlageForm.bezeichnung || !anlageForm.anschaffungskosten}>
                    {loading ? 'Speichern...' : 'Speichern & AfA berechnen'}
                  </button>
                  <button className="btn-secondary" onClick={() => setShowAnlageForm(false)}>Abbrechen</button>
                </div>
              </div>
            )}

            {anlagenLoading ? (
              <div className="loading-state">Lade Anlagen...</div>
            ) : (
              <div className="anlagen-table-wrap">
                <table className="data-table anlagen-table">
                  <thead>
                    <tr>
                      <th>Bezeichnung</th>
                      <th>Kaufdatum</th>
                      <th className="right">AK (€)</th>
                      <th>ND</th>
                      <th className="right">AfA {selectedJahr} (€)</th>
                      <th className="right">Buchwert {selectedJahr} (€)</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {anlagen.length === 0 ? (
                      <tr><td colSpan="7" className="empty-cell">Noch keine Anlagen erfasst</td></tr>
                    ) : anlagen.map(a => (
                      <tr key={a.anlage_id} className={!a.aktiv ? 'row-inactive' : ''}>
                        <td>
                          <div className="anlage-name">{a.bezeichnung}</div>
                          {a.lieferant && <div className="anlage-meta">{a.lieferant}</div>}
                        </td>
                        <td>{new Date(a.kaufdatum).toLocaleDateString('de-DE')}</td>
                        <td className="right">{parseFloat(a.anschaffungskosten).toLocaleString('de-DE', { minimumFractionDigits: 2 })} €</td>
                        <td>{a.nutzungsdauer}J</td>
                        <td className="right text-danger">
                          {a.afa_aktuelles_jahr ? `−${parseFloat(a.afa_aktuelles_jahr).toLocaleString('de-DE', { minimumFractionDigits: 2 })} €` : '—'}
                        </td>
                        <td className="right">
                          {a.buchwert_aktuell ? `${parseFloat(a.buchwert_aktuell).toLocaleString('de-DE', { minimumFractionDigits: 2 })} €` : '—'}
                        </td>
                        <td className="anlage-actions">
                          <button title="AfA-Plan anzeigen" onClick={() => setAnlageAfa(null) || loadAfaSchedule(a)} className="btn-icon">
                            <FileText size={14} />
                          </button>
                          <button title="Bearbeiten" className="btn-icon" onClick={() => {
                            setEditingAnlage(a);
                            setAnlageForm({
                              bezeichnung: a.bezeichnung, beschreibung: a.beschreibung || '',
                              anlage_kategorie: a.anlage_kategorie,
                              kaufdatum: a.kaufdatum?.split('T')[0] || '',
                              anschaffungskosten: a.anschaffungskosten,
                              restwert: a.restwert, nutzungsdauer: a.nutzungsdauer,
                              lieferant: a.lieferant || '', rechnungsnummer: a.rechnungsnummer || ''
                            });
                            setShowAnlageForm(true);
                          }}><Edit size={14} /></button>
                          {a.aktiv === 1 && (
                            <button title="Ausscheiden" className="btn-icon btn-danger-icon" onClick={() => deleteAnlage(a.anlage_id)}>
                              <Trash2 size={14} />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {anlageAfa && (
              <div className="afa-schedule-card">
                <div className="afa-schedule-header">
                  <h4>📋 AfA-Plan: {anlageAfa.anlage.bezeichnung}</h4>
                  <button className="btn-icon" onClick={() => setAnlageAfa(null)}><X size={16} /></button>
                </div>
                <table className="data-table afa-table">
                  <thead>
                    <tr>
                      <th>Jahr</th>
                      <th className="right">Buchwert Anfang</th>
                      <th className="right">AfA</th>
                      <th className="right">Buchwert Ende</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {anlageAfa.positionen.map(p => {
                      const isAktuell = p.afa_jahr === selectedJahr;
                      const isPast    = p.afa_jahr < new Date().getFullYear();
                      return (
                        <tr key={p.afa_jahr} className={isAktuell ? 'row-highlight' : isPast ? 'row-past' : ''}>
                          <td><strong>{p.afa_jahr}</strong>{isAktuell && <span className="badge-aktuell"> ← aktuell</span>}</td>
                          <td className="right">{parseFloat(p.buchwert_beginn).toLocaleString('de-DE', { minimumFractionDigits: 2 })} €</td>
                          <td className="right text-danger">−{parseFloat(p.afa_betrag).toLocaleString('de-DE', { minimumFractionDigits: 2 })} €</td>
                          <td className="right">{parseFloat(p.buchwert_ende).toLocaleString('de-DE', { minimumFractionDigits: 2 })} €</td>
                          <td className="afa-note">
                            {p.ist_erstes_jahr ? 'Erstes Jahr (anteilig)' : ''}
                            {p.ist_letztes_jahr ? 'Letztes Jahr' : ''}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
  );
};
export default BuchhaltungAnlagenTab;
