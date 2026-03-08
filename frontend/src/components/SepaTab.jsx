import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { CreditCard, Plus, Download, CheckCircle, XCircle, Clock, FileText, Users, Euro } from 'lucide-react';
import '../styles/SepaTab.css';

const SepaTab = ({ token }) => {
  const [mandate, setMandate] = useState([]);
  const [batches, setBatches] = useState([]);
  const [dojosOhneMandat, setDojosOhneMandat] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNewMandatModal, setShowNewMandatModal] = useState(false);
  const [showNewBatchModal, setShowNewBatchModal] = useState(false);
  const [selectedDojo, setSelectedDojo] = useState(null);
  const [newMandat, setNewMandat] = useState({ kontoinhaber: '', iban: '', bic: '', mandats_datum: new Date().toISOString().split('T')[0] });
  const [batchDate, setBatchDate] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [mandateRes, batchesRes, dojosRes] = await Promise.all([
        axios.get('/admin/sepa/mandate', { headers: { Authorization: `Bearer ${token}` } }),
        axios.get('/admin/sepa/batches', { headers: { Authorization: `Bearer ${token}` } }),
        axios.get('/admin/sepa/dojos-without-mandate', { headers: { Authorization: `Bearer ${token}` } })
      ]);
      setMandate(mandateRes.data.mandate || []);
      setBatches(batchesRes.data.batches || []);
      setDojosOhneMandat(dojosRes.data.dojos || []);
    } catch (error) {
      console.error('Fehler beim Laden:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateMandat = async () => {
    if (!selectedDojo || !newMandat.kontoinhaber || !newMandat.iban) {
      alert('Bitte alle Pflichtfelder ausfuellen');
      return;
    }
    try {
      await axios.post('/admin/sepa/mandate', {
        dojo_id: selectedDojo.id,
        ...newMandat
      }, { headers: { Authorization: `Bearer ${token}` } });
      alert('SEPA-Mandat erfolgreich erstellt');
      setShowNewMandatModal(false);
      setNewMandat({ kontoinhaber: '', iban: '', bic: '', mandats_datum: new Date().toISOString().split('T')[0] });
      setSelectedDojo(null);
      loadData();
    } catch (error) {
      alert('Fehler: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleCreateBatch = async () => {
    if (!batchDate) {
      alert('Bitte Ausfuehrungsdatum waehlen');
      return;
    }
    try {
      const response = await axios.post('/admin/sepa/batch/create', {
        ausfuehrungsdatum: batchDate
      }, { headers: { Authorization: `Bearer ${token}` } });
      alert(`Batch erstellt: ${response.data.anzahl} Lastschriften, Gesamt: ${response.data.gesamtbetrag.toFixed(2)} EUR`);
      setShowNewBatchModal(false);
      loadData();
    } catch (error) {
      alert('Fehler: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleDownloadXml = async (batchId) => {
    try {
      const response = await axios.get(`/admin/sepa/batch/${batchId}/xml`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `SEPA-Lastschrift-${batchId}.xml`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      loadData();
    } catch (error) {
      alert('Fehler beim Download');
    }
  };

  const handleUpdateMandatStatus = async (id, status) => {
    try {
      await axios.put(`/admin/sepa/mandate/${id}`, { status }, { headers: { Authorization: `Bearer ${token}` } });
      loadData();
    } catch (error) {
      alert('Fehler beim Aktualisieren');
    }
  };

  const getStatusBadge = (status) => {
    const styles = {
      aktiv: { bg: 'rgba(16,185,129,0.2)', color: 'var(--success)' },
      pausiert: { bg: 'rgba(251,191,36,0.2)', color: 'var(--color-gold-400)' },
      widerrufen: { bg: 'rgba(239,68,68,0.2)', color: 'var(--error)' },
      erstellt: { bg: 'rgba(59,130,246,0.2)', color: 'var(--info)' },
      exportiert: { bg: 'rgba(16,185,129,0.2)', color: 'var(--success)' },
      eingereicht: { bg: 'rgba(139,92,246,0.2)', color: '#8b5cf6' },
      ausgefuehrt: { bg: 'rgba(16,185,129,0.3)', color: 'var(--success)' }
    };
    const s = styles[status] || { bg: 'rgba(156,163,175,0.2)', color: 'var(--text-muted)' };
    return (
      <span className="st-status-badge" style={{ '--badge-bg': s.bg, '--badge-color': s.color }}>
        {status}
      </span>
    );
  };

  if (loading) return <div className="st-td-empty-wide">Lade SEPA-Daten...</div>;

  return (
    <div className="sepa-tab">
      {/* Header mit Statistiken */}
      <div className="st-stats-grid">
        <div className="st-card">
          <div className="u-flex-row-md">
            <div className="st-badge-success">
              <Users size={20} color="#10b981" />
            </div>
            <div>
              <div className="u-text-secondary-sm">Aktive Mandate</div>
              <div className="st-stat-large">{mandate.filter(m => m.status === 'aktiv').length}</div>
            </div>
          </div>
        </div>
        <div className="st-card">
          <div className="u-flex-row-md">
            <div className="st-badge-warning">
              <Clock size={20} color="#fbbf24" />
            </div>
            <div>
              <div className="u-text-secondary-sm">Ohne Mandat</div>
              <div className="st-stat-gold">{dojosOhneMandat.length}</div>
            </div>
          </div>
        </div>
        <div className="st-card">
          <div className="u-flex-row-md">
            <div className="st-badge-info">
              <FileText size={20} color="#3b82f6" />
            </div>
            <div>
              <div className="u-text-secondary-sm">Batches</div>
              <div className="st-stat-info">{batches.length}</div>
            </div>
          </div>
        </div>
        <div className="st-card">
          <div className="u-flex-row-md">
            <div className="st-badge-success">
              <Euro size={20} color="#10b981" />
            </div>
            <div>
              <div className="u-text-secondary-sm">MRR (SEPA)</div>
              <div className="st-stat-large">
                {mandate.filter(m => m.status === 'aktiv').reduce((sum, m) => sum + parseFloat(m.monthly_price || 0), 0).toFixed(0)} EUR
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Aktionen */}
      <div className="st-actions-bar">
        <button onClick={() => setShowNewMandatModal(true)} className="st-btn-primary">
          <Plus size={18} /> Neues Mandat
        </button>
        <button onClick={() => setShowNewBatchModal(true)} className="st-btn-blue">
          <FileText size={18} /> Lastschrift-Batch erstellen
        </button>
      </div>

      {/* Mandate Liste */}
      <div className="st-section-mb">
        <h3 className="st-section-heading">
          <CreditCard size={20} /> SEPA-Mandate
        </h3>
        <div className="st-card-flush">
          <table className="st-table">
            <thead>
              <tr className="st-border-bottom">
                <th className="u-td-secondary">Dojo</th>
                <th className="u-td-secondary">Kontoinhaber</th>
                <th className="u-td-secondary">IBAN</th>
                <th className="u-td-secondary">Plan</th>
                <th className="st-td-right-muted">Betrag</th>
                <th className="st-td-center-muted">Status</th>
                <th className="st-td-center-muted">Aktion</th>
              </tr>
            </thead>
            <tbody>
              {mandate.length === 0 ? (
                <tr><td colSpan="7" className="st-td-empty">Keine Mandate vorhanden</td></tr>
              ) : mandate.map(m => (
                <tr key={m.id} className="st-border-bottom">
                  <td className="st-td-primary">{m.dojoname}</td>
                  <td className="st-td-primary">{m.kontoinhaber}</td>
                  <td className="st-td-mono-secondary">{m.iban}</td>
                  <td className="st-td-secondary">{m.plan_type}</td>
                  <td className="st-td-right-primary">{parseFloat(m.monthly_price || 0).toFixed(2)} EUR</td>
                  <td className="st-td-center">{getStatusBadge(m.status)}</td>
                  <td className="st-td-center">
                    {m.status === 'aktiv' ? (
                      <button onClick={() => handleUpdateMandatStatus(m.id, 'pausiert')} className="st-btn-pause">
                        Pausieren
                      </button>
                    ) : m.status === 'pausiert' ? (
                      <button onClick={() => handleUpdateMandatStatus(m.id, 'aktiv')} className="st-btn-activate">
                        Aktivieren
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Batches Liste */}
      <div>
        <h3 className="st-section-heading">
          <FileText size={20} /> Lastschrift-Batches
        </h3>
        <div className="st-card-flush">
          <table className="st-table">
            <thead>
              <tr className="st-border-bottom">
                <th className="u-td-secondary">Referenz</th>
                <th className="u-td-secondary">Erstellt</th>
                <th className="u-td-secondary">Ausfuehrung</th>
                <th className="st-td-center-muted">Transaktionen</th>
                <th className="st-td-right-muted">Betrag</th>
                <th className="st-td-center-muted">Status</th>
                <th className="st-td-center-muted">XML</th>
              </tr>
            </thead>
            <tbody>
              {batches.length === 0 ? (
                <tr><td colSpan="7" className="st-td-empty">Keine Batches vorhanden</td></tr>
              ) : batches.map(b => (
                <tr key={b.id} className="st-border-bottom">
                  <td className="st-td-mono-primary">{b.batch_referenz}</td>
                  <td className="st-td-secondary">{new Date(b.erstelldatum).toLocaleDateString('de-DE')}</td>
                  <td className="st-td-primary">{new Date(b.ausfuehrungsdatum).toLocaleDateString('de-DE')}</td>
                  <td className="st-td-center-primary">{b.anzahl_transaktionen}</td>
                  <td className="st-td-right-primary">{parseFloat(b.gesamtbetrag).toFixed(2)} EUR</td>
                  <td className="st-td-center">{getStatusBadge(b.status)}</td>
                  <td className="st-td-center">
                    <button onClick={() => handleDownloadXml(b.id)} className="st-btn-download">
                      <Download size={14} /> XML
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Neues Mandat */}
      {showNewMandatModal && (
        <div className="st-modal-overlay" onClick={() => setShowNewMandatModal(false)}>
          <div onClick={e => e.stopPropagation()} className="st-modal-box">
            <div className="st-modal-header">
              <h3 className="st-heading-primary">Neues SEPA-Mandat</h3>
              <button onClick={() => setShowNewMandatModal(false)} className="st-btn-icon">x</button>
            </div>
            <div className="st-inner">
              <div className="st-mb-1">
                <label className="u-form-label-secondary">Dojo auswaehlen *</label>
                <select value={selectedDojo?.id || ''} onChange={e => setSelectedDojo(dojosOhneMandat.find(d => d.id === parseInt(e.target.value)))} className="st-input">
                  <option value="">-- Dojo waehlen --</option>
                  {dojosOhneMandat.map(d => (
                    <option key={d.id} value={d.id}>{d.dojoname} ({d.plan_type} - {d.monthly_price} EUR)</option>
                  ))}
                </select>
              </div>
              <div className="st-mb-1">
                <label className="u-form-label-secondary">Kontoinhaber *</label>
                <input type="text" value={newMandat.kontoinhaber} onChange={e => setNewMandat({...newMandat, kontoinhaber: e.target.value})} className="st-input" />
              </div>
              <div className="st-mb-1">
                <label className="u-form-label-secondary">IBAN *</label>
                <input type="text" value={newMandat.iban} onChange={e => setNewMandat({...newMandat, iban: e.target.value})} placeholder="DE89 3704 0044 0532 0130 00" className="st-input-mono" />
              </div>
              <div className="st-mb-1">
                <label className="u-form-label-secondary">BIC</label>
                <input type="text" value={newMandat.bic} onChange={e => setNewMandat({...newMandat, bic: e.target.value})} className="st-input" />
              </div>
              <div className="st-mb-1">
                <label className="u-form-label-secondary">Mandatsdatum</label>
                <input type="date" value={newMandat.mandats_datum} onChange={e => setNewMandat({...newMandat, mandats_datum: e.target.value})} className="st-input" />
              </div>
            </div>
            <div className="st-modal-footer">
              <button onClick={() => setShowNewMandatModal(false)} className="st-btn-secondary">Abbrechen</button>
              <button onClick={handleCreateMandat} className="st-btn-confirm-primary">Mandat erstellen</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Neuer Batch */}
      {showNewBatchModal && (
        <div className="st-modal-overlay" onClick={() => setShowNewBatchModal(false)}>
          <div onClick={e => e.stopPropagation()} className="st-modal-box-sm">
            <div className="st-modal-header">
              <h3 className="st-heading-primary">Lastschrift-Batch erstellen</h3>
              <button onClick={() => setShowNewBatchModal(false)} className="st-btn-icon">x</button>
            </div>
            <div className="st-inner">
              <p className="st-modal-intro">
                Es werden alle aktiven Mandate mit laufenden Subscriptions einbezogen.
              </p>
              <p className="st-modal-count">
                <strong>{mandate.filter(m => m.status === 'aktiv').length}</strong> Mandate aktiv
              </p>
              <div>
                <label className="u-form-label-secondary">Gewuenschtes Einzugsdatum *</label>
                <input type="date" value={batchDate} onChange={e => setBatchDate(e.target.value)} min={new Date(Date.now() + 5*24*60*60*1000).toISOString().split('T')[0]} className="st-input" />
                <small className="u-text-secondary">Mind. 5 Werktage in der Zukunft</small>
              </div>
            </div>
            <div className="st-modal-footer">
              <button onClick={() => setShowNewBatchModal(false)} className="st-btn-secondary">Abbrechen</button>
              <button onClick={handleCreateBatch} className="st-btn-confirm-blue">Batch erstellen</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SepaTab;
