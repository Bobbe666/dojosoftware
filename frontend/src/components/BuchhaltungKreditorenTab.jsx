import React from 'react';
import { FileText, Plus, Edit, Trash2, X } from 'lucide-react';

const BuchhaltungKreditorenTab = ({
  selectedOrg, loading, kreditoren, kreditorenLoading,
  showKreditorForm, setShowKreditorForm, editingKreditor, setEditingKreditor,
  kreditorForm, setKreditorForm, saveKreditor, deleteKreditor
}) => {
  return (
          <div className="kreditoren-content">
            <div className="section-header">
              <h3><FileText size={18} /> Kreditoren / Lieferantenakte</h3>
              <button className="btn-primary" onClick={() => {
                setEditingKreditor(null);
                setKreditorForm({ organisation_name: selectedOrg !== 'alle' ? selectedOrg : 'Kampfkunstschule Schreiner',
                  name: '', kurzname: '', adresse: '', email: '', telefon: '',
                  ust_id: '', zahlungsziel_tage: '14', iban: '', bic: '', notizen: '' });
                setShowKreditorForm(true);
              }}>
                <Plus size={14} /> Neuer Kreditor
              </button>
            </div>

            {kreditorenLoading ? (
              <div className="loading-state">Lade...</div>
            ) : kreditoren.length === 0 ? (
              <div className="empty-hint">Noch keine Kreditoren angelegt. Kreditoren erscheinen als Vorschläge im Belegerfassungs-Formular.</div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Kurzname</th>
                    <th>E-Mail</th>
                    <th>Telefon</th>
                    <th>Zahlungsziel</th>
                    <th>IBAN</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {kreditoren.map(k => (
                    <tr key={k.kreditor_id}>
                      <td>
                        <div className="anlage-name">{k.name}</div>
                        {k.ust_id && <div className="anlage-meta">USt-ID: {k.ust_id}</div>}
                      </td>
                      <td>{k.kurzname || '—'}</td>
                      <td>{k.email || '—'}</td>
                      <td>{k.telefon || '—'}</td>
                      <td>{k.zahlungsziel_tage} Tage</td>
                      <td>{k.iban ? `${k.iban.substring(0, 8)}...` : '—'}</td>
                      <td className="anlage-actions">
                        <button className="btn-icon" title="Bearbeiten" onClick={() => {
                          setEditingKreditor(k);
                          setKreditorForm({
                            organisation_name: k.organisation_name,
                            name: k.name, kurzname: k.kurzname || '',
                            adresse: k.adresse || '', email: k.email || '',
                            telefon: k.telefon || '', ust_id: k.ust_id || '',
                            zahlungsziel_tage: String(k.zahlungsziel_tage || 14),
                            iban: k.iban || '', bic: k.bic || '', notizen: k.notizen || ''
                          });
                          setShowKreditorForm(true);
                        }}><Edit size={14} /></button>
                        <button className="btn-icon btn-danger-icon" title="Löschen" onClick={() => deleteKreditor(k.kreditor_id)}>
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {showKreditorForm && (
              <div className="modal-overlay" onClick={() => setShowKreditorForm(false)}>
                <div className="modal" onClick={e => e.stopPropagation()}>
                  <div className="modal-header">
                    <h3>{editingKreditor ? 'Kreditor bearbeiten' : 'Neuer Kreditor'}</h3>
                    <button className="close-btn" onClick={() => setShowKreditorForm(false)}><X size={20} /></button>
                  </div>
                  <div className="modal-body">
                    <div className="form-row">
                      <div className="form-group">
                        <label>Name *</label>
                        <input value={kreditorForm.name}
                          onChange={e => setKreditorForm(f => ({ ...f, name: e.target.value }))}
                          placeholder="Firmenname" />
                      </div>
                      <div className="form-group">
                        <label>Kurzname</label>
                        <input value={kreditorForm.kurzname}
                          onChange={e => setKreditorForm(f => ({ ...f, kurzname: e.target.value }))}
                          placeholder="z.B. Stadtwerke" />
                      </div>
                    </div>
                    <div className="form-group">
                      <label>Adresse</label>
                      <textarea value={kreditorForm.adresse} rows="2"
                        onChange={e => setKreditorForm(f => ({ ...f, adresse: e.target.value }))} />
                    </div>
                    <div className="form-row">
                      <div className="form-group">
                        <label>E-Mail</label>
                        <input type="email" value={kreditorForm.email}
                          onChange={e => setKreditorForm(f => ({ ...f, email: e.target.value }))} />
                      </div>
                      <div className="form-group">
                        <label>Telefon</label>
                        <input value={kreditorForm.telefon}
                          onChange={e => setKreditorForm(f => ({ ...f, telefon: e.target.value }))} />
                      </div>
                    </div>
                    <div className="form-row">
                      <div className="form-group">
                        <label>USt-ID</label>
                        <input value={kreditorForm.ust_id}
                          onChange={e => setKreditorForm(f => ({ ...f, ust_id: e.target.value }))}
                          placeholder="DE123456789" />
                      </div>
                      <div className="form-group">
                        <label>Zahlungsziel (Tage)</label>
                        <input type="number" min="0" value={kreditorForm.zahlungsziel_tage}
                          onChange={e => setKreditorForm(f => ({ ...f, zahlungsziel_tage: e.target.value }))} />
                      </div>
                    </div>
                    <div className="form-row">
                      <div className="form-group">
                        <label>IBAN</label>
                        <input value={kreditorForm.iban}
                          onChange={e => setKreditorForm(f => ({ ...f, iban: e.target.value }))}
                          placeholder="DE89 3704 0044 ..." />
                      </div>
                      <div className="form-group">
                        <label>BIC</label>
                        <input value={kreditorForm.bic}
                          onChange={e => setKreditorForm(f => ({ ...f, bic: e.target.value }))} />
                      </div>
                    </div>
                    <div className="form-group">
                      <label>Notizen</label>
                      <textarea value={kreditorForm.notizen} rows="2"
                        onChange={e => setKreditorForm(f => ({ ...f, notizen: e.target.value }))} />
                    </div>
                  </div>
                  <div className="modal-footer">
                    <button className="btn-secondary" onClick={() => setShowKreditorForm(false)}>Abbrechen</button>
                    <button className="btn-primary" onClick={saveKreditor}
                      disabled={loading || !kreditorForm.name}>
                      {loading ? 'Speichern...' : 'Speichern'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
  );
};
export default BuchhaltungKreditorenTab;
