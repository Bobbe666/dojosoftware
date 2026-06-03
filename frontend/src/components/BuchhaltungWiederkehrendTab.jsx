import React from 'react';
import { Plus, Edit, Trash2, X, RefreshCw } from 'lucide-react';

const BuchhaltungWiederkehrendTab = ({
  selectedOrg, kategorien, loading, success,
  wiederkehrend, wiederkehrendLoading,
  showWiederkehrendForm, setShowWiederkehrendForm,
  editingTemplate, setEditingTemplate, templateForm, setTemplateForm,
  ausfuehrenRunning, saveTemplate, deleteTemplate, templateAusfuehren
}) => {
  return (
          <div className="wiederkehrend-content">
            <div className="section-header">
              <h3><RefreshCw size={18} /> Wiederkehrende Buchungen</h3>
              <div className="header-actions">
                <button className="btn-secondary" onClick={alleFaelligeAusfuehren} disabled={ausfuehrenRunning}>
                  {ausfuehrenRunning ? 'Läuft...' : '▶ Alle Fälligen ausführen'}
                </button>
                <button className="btn-primary" onClick={() => {
                  setEditingTemplate(null);
                  setTemplateForm({ organisation_name: selectedOrg !== 'alle' ? selectedOrg : 'Kampfkunstschule Schreiner',
                    bezeichnung: '', buchungsart: 'ausgabe', betrag_netto: '', mwst_satz: '19',
                    kategorie: 'sonstige_kosten', beschreibung: '', lieferant_kunde: '',
                    intervall: 'monatlich', naechste_faelligkeit: new Date().toISOString().split('T')[0],
                    auto_ausfuehren: false });
                  setShowWiederkehrendForm(true);
                }}>
                  <Plus size={14} /> Neues Template
                </button>
              </div>
            </div>

            <div className="anlagen-info-box">
              <span>💡</span>
              <span>Templates mit <strong>„Auto-Ausführen"</strong> werden bei jedem Klick auf „Alle Fälligen ausführen" automatisch als Beleg gebucht.</span>
            </div>

            {wiederkehrendLoading ? (
              <div className="loading-state">Lade...</div>
            ) : wiederkehrend.length === 0 ? (
              <div className="empty-hint">Noch keine wiederkehrenden Buchungen angelegt</div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Bezeichnung</th>
                    <th>Art</th>
                    <th className="right">Betrag (Netto)</th>
                    <th>Intervall</th>
                    <th>Nächste Fälligkeit</th>
                    <th>Auto</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {wiederkehrend.map(t => {
                    const faellig = new Date(t.naechste_faelligkeit) <= new Date();
                    return (
                      <tr key={t.template_id} className={!t.aktiv ? 'row-inactive' : faellig ? 'row-warning' : ''}>
                        <td>
                          <div className="anlage-name">{t.bezeichnung}</div>
                          {t.lieferant_kunde && <div className="anlage-meta">{t.lieferant_kunde}</div>}
                        </td>
                        <td>{t.buchungsart === 'ausgabe' ? <span className="badge badge-danger">Ausgabe</span> : <span className="badge badge-success">Einnahme</span>}</td>
                        <td className="right">{parseFloat(t.betrag_netto).toLocaleString('de-DE', { minimumFractionDigits: 2 })} €</td>
                        <td>{t.intervall}</td>
                        <td className={faellig ? 'text-danger' : ''}>{new Date(t.naechste_faelligkeit).toLocaleDateString('de-DE')}</td>
                        <td>{t.auto_ausfuehren ? '✓' : '—'}</td>
                        <td className="anlage-actions">
                          <button className="btn-sm btn-success" title="Jetzt ausführen" onClick={() => templateAusfuehren(t.template_id)} disabled={ausfuehrenRunning}>▶</button>
                          <button className="btn-icon" title="Bearbeiten" onClick={() => {
                            setEditingTemplate(t);
                            setTemplateForm({
                              organisation_name: t.organisation_name,
                              bezeichnung: t.bezeichnung, buchungsart: t.buchungsart,
                              betrag_netto: t.betrag_netto, mwst_satz: t.mwst_satz,
                              kategorie: t.kategorie, beschreibung: t.beschreibung || '',
                              lieferant_kunde: t.lieferant_kunde || '',
                              intervall: t.intervall,
                              naechste_faelligkeit: t.naechste_faelligkeit?.split('T')[0] || '',
                              auto_ausfuehren: !!t.auto_ausfuehren
                            });
                            setShowWiederkehrendForm(true);
                          }}><Edit size={14} /></button>
                          <button className="btn-icon btn-danger-icon" title="Löschen" onClick={() => deleteTemplate(t.template_id)}>
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}

            {showWiederkehrendForm && (
              <div className="modal-overlay" onClick={() => setShowWiederkehrendForm(false)}>
                <div className="modal" onClick={e => e.stopPropagation()}>
                  <div className="modal-header">
                    <h3>{editingTemplate ? 'Template bearbeiten' : 'Neue wiederkehrende Buchung'}</h3>
                    <button className="close-btn" onClick={() => setShowWiederkehrendForm(false)}><X size={20} /></button>
                  </div>
                  <div className="modal-body">
                    <div className="form-row">
                      <div className="form-group">
                        <label>Bezeichnung *</label>
                        <input value={templateForm.bezeichnung}
                          onChange={e => setTemplateForm(f => ({ ...f, bezeichnung: e.target.value }))}
                          placeholder="z.B. Miete Halle, Versicherung" />
                      </div>
                      <div className="form-group">
                        <label>Buchungsart</label>
                        <select value={templateForm.buchungsart}
                          onChange={e => setTemplateForm(f => ({ ...f, buchungsart: e.target.value }))}>
                          <option value="ausgabe">Ausgabe</option>
                          <option value="einnahme">Einnahme</option>
                        </select>
                      </div>
                    </div>
                    <div className="form-row">
                      <div className="form-group">
                        <label>Betrag Netto (€) *</label>
                        <input type="number" step="0.01" value={templateForm.betrag_netto}
                          onChange={e => setTemplateForm(f => ({ ...f, betrag_netto: e.target.value }))} />
                      </div>
                      <div className="form-group">
                        <label>MwSt (%)</label>
                        <select value={templateForm.mwst_satz}
                          onChange={e => setTemplateForm(f => ({ ...f, mwst_satz: e.target.value }))}>
                          <option value="19">19%</option>
                          <option value="7">7%</option>
                          <option value="0">0%</option>
                        </select>
                      </div>
                    </div>
                    <div className="form-row">
                      <div className="form-group">
                        <label>Kategorie *</label>
                        <select value={templateForm.kategorie}
                          onChange={e => setTemplateForm(f => ({ ...f, kategorie: e.target.value }))}>
                          {kategorien.filter(k => k.typ === templateForm.buchungsart).map(k => (
                            <option key={k.id} value={k.id}>{k.name}</option>
                          ))}
                        </select>
                      </div>
                      <div className="form-group">
                        <label>Intervall</label>
                        <select value={templateForm.intervall}
                          onChange={e => setTemplateForm(f => ({ ...f, intervall: e.target.value }))}>
                          <option value="wöchentlich">Wöchentlich</option>
                          <option value="monatlich">Monatlich</option>
                          <option value="vierteljährlich">Vierteljährlich</option>
                          <option value="halbjährlich">Halbjährlich</option>
                          <option value="jährlich">Jährlich</option>
                        </select>
                      </div>
                    </div>
                    <div className="form-row">
                      <div className="form-group">
                        <label>Lieferant / Kunde</label>
                        <input value={templateForm.lieferant_kunde}
                          onChange={e => setTemplateForm(f => ({ ...f, lieferant_kunde: e.target.value }))}
                          placeholder="Optional" />
                      </div>
                      <div className="form-group">
                        <label>Nächste Fälligkeit *</label>
                        <input type="date" value={templateForm.naechste_faelligkeit}
                          onChange={e => setTemplateForm(f => ({ ...f, naechste_faelligkeit: e.target.value }))} />
                      </div>
                    </div>
                    <div className="form-group">
                      <label>Beschreibung (wird in Beleg übernommen)</label>
                      <textarea value={templateForm.beschreibung} rows="2"
                        onChange={e => setTemplateForm(f => ({ ...f, beschreibung: e.target.value }))} />
                    </div>
                    <label className="checkbox-label">
                      <input type="checkbox" checked={templateForm.auto_ausfuehren}
                        onChange={e => setTemplateForm(f => ({ ...f, auto_ausfuehren: e.target.checked }))} />
                      Auto-Ausführen (wird bei „Alle Fälligen" automatisch gebucht)
                    </label>
                  </div>
                  <div className="modal-footer">
                    <button className="btn-secondary" onClick={() => setShowWiederkehrendForm(false)}>Abbrechen</button>
                    <button className="btn-primary" onClick={saveTemplate}
                      disabled={loading || !templateForm.bezeichnung || !templateForm.betrag_netto}>
                      {loading ? 'Speichern...' : 'Speichern'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
  );
};
export default BuchhaltungWiederkehrendTab;
