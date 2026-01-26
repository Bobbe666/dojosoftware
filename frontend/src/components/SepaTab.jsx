import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { CreditCard, Plus, Download, CheckCircle, XCircle, Clock, FileText, Users, Euro } from 'lucide-react';

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
      aktiv: { bg: 'rgba(16,185,129,0.2)', color: '#10b981' },
      pausiert: { bg: 'rgba(251,191,36,0.2)', color: '#fbbf24' },
      widerrufen: { bg: 'rgba(239,68,68,0.2)', color: '#ef4444' },
      erstellt: { bg: 'rgba(59,130,246,0.2)', color: '#3b82f6' },
      exportiert: { bg: 'rgba(16,185,129,0.2)', color: '#10b981' },
      eingereicht: { bg: 'rgba(139,92,246,0.2)', color: '#8b5cf6' },
      ausgefuehrt: { bg: 'rgba(16,185,129,0.3)', color: '#10b981' }
    };
    const s = styles[status] || { bg: 'rgba(156,163,175,0.2)', color: '#9ca3af' };
    return (
      <span style={{ padding: '0.25rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', background: s.bg, color: s.color }}>
        {status}
      </span>
    );
  };

  if (loading) return <div style={{ padding: '2rem', textAlign: 'center' }}>Lade SEPA-Daten...</div>;

  return (
    <div className="sepa-tab">
      {/* Header mit Statistiken */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '2rem' }}>
        <div style={{ background: 'var(--bg-secondary)', padding: '1.25rem', borderRadius: '12px', border: '1px solid var(--border-default)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ background: 'rgba(16,185,129,0.2)', padding: '0.75rem', borderRadius: '8px' }}>
              <Users size={20} color="#10b981" />
            </div>
            <div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Aktive Mandate</div>
              <div style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--primary)' }}>{mandate.filter(m => m.status === 'aktiv').length}</div>
            </div>
          </div>
        </div>
        <div style={{ background: 'var(--bg-secondary)', padding: '1.25rem', borderRadius: '12px', border: '1px solid var(--border-default)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ background: 'rgba(251,191,36,0.2)', padding: '0.75rem', borderRadius: '8px' }}>
              <Clock size={20} color="#fbbf24" />
            </div>
            <div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Ohne Mandat</div>
              <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#fbbf24' }}>{dojosOhneMandat.length}</div>
            </div>
          </div>
        </div>
        <div style={{ background: 'var(--bg-secondary)', padding: '1.25rem', borderRadius: '12px', border: '1px solid var(--border-default)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ background: 'rgba(59,130,246,0.2)', padding: '0.75rem', borderRadius: '8px' }}>
              <FileText size={20} color="#3b82f6" />
            </div>
            <div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Batches</div>
              <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#3b82f6' }}>{batches.length}</div>
            </div>
          </div>
        </div>
        <div style={{ background: 'var(--bg-secondary)', padding: '1.25rem', borderRadius: '12px', border: '1px solid var(--border-default)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ background: 'rgba(16,185,129,0.2)', padding: '0.75rem', borderRadius: '8px' }}>
              <Euro size={20} color="#10b981" />
            </div>
            <div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>MRR (SEPA)</div>
              <div style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--primary)' }}>
                {mandate.filter(m => m.status === 'aktiv').reduce((sum, m) => sum + parseFloat(m.monthly_price || 0), 0).toFixed(0)} EUR
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Aktionen */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem' }}>
        <button onClick={() => setShowNewMandatModal(true)} style={{
          display: 'flex', alignItems: 'center', gap: '0.5rem',
          padding: '0.75rem 1.25rem', background: 'var(--primary)', color: '#000',
          border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer'
        }}>
          <Plus size={18} /> Neues Mandat
        </button>
        <button onClick={() => setShowNewBatchModal(true)} style={{
          display: 'flex', alignItems: 'center', gap: '0.5rem',
          padding: '0.75rem 1.25rem', background: 'rgba(59,130,246,0.2)', color: '#3b82f6',
          border: '1px solid #3b82f6', borderRadius: '8px', fontWeight: '600', cursor: 'pointer'
        }}>
          <FileText size={18} /> Lastschrift-Batch erstellen
        </button>
      </div>

      {/* Mandate Liste */}
      <div style={{ marginBottom: '2rem' }}>
        <h3 style={{ marginBottom: '1rem', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <CreditCard size={20} /> SEPA-Mandate
        </h3>
        <div style={{ background: 'var(--bg-secondary)', borderRadius: '12px', border: '1px solid var(--border-default)', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-default)' }}>
                <th style={{ padding: '0.75rem', textAlign: 'left', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Dojo</th>
                <th style={{ padding: '0.75rem', textAlign: 'left', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Kontoinhaber</th>
                <th style={{ padding: '0.75rem', textAlign: 'left', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>IBAN</th>
                <th style={{ padding: '0.75rem', textAlign: 'left', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Plan</th>
                <th style={{ padding: '0.75rem', textAlign: 'right', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Betrag</th>
                <th style={{ padding: '0.75rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Status</th>
                <th style={{ padding: '0.75rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Aktion</th>
              </tr>
            </thead>
            <tbody>
              {mandate.length === 0 ? (
                <tr><td colSpan="7" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>Keine Mandate vorhanden</td></tr>
              ) : mandate.map(m => (
                <tr key={m.id} style={{ borderBottom: '1px solid var(--border-default)' }}>
                  <td style={{ padding: '0.75rem', color: 'var(--text-primary)' }}>{m.dojoname}</td>
                  <td style={{ padding: '0.75rem', color: 'var(--text-primary)' }}>{m.kontoinhaber}</td>
                  <td style={{ padding: '0.75rem', color: 'var(--text-secondary)', fontFamily: 'monospace', fontSize: '0.85rem' }}>{m.iban}</td>
                  <td style={{ padding: '0.75rem', color: 'var(--text-secondary)' }}>{m.plan_type}</td>
                  <td style={{ padding: '0.75rem', textAlign: 'right', color: 'var(--primary)', fontWeight: '600' }}>{parseFloat(m.monthly_price || 0).toFixed(2)} EUR</td>
                  <td style={{ padding: '0.75rem', textAlign: 'center' }}>{getStatusBadge(m.status)}</td>
                  <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                    {m.status === 'aktiv' ? (
                      <button onClick={() => handleUpdateMandatStatus(m.id, 'pausiert')} style={{ background: 'rgba(251,191,36,0.2)', color: '#fbbf24', border: 'none', padding: '0.25rem 0.5rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem' }}>
                        Pausieren
                      </button>
                    ) : m.status === 'pausiert' ? (
                      <button onClick={() => handleUpdateMandatStatus(m.id, 'aktiv')} style={{ background: 'rgba(16,185,129,0.2)', color: '#10b981', border: 'none', padding: '0.25rem 0.5rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem' }}>
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
        <h3 style={{ marginBottom: '1rem', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <FileText size={20} /> Lastschrift-Batches
        </h3>
        <div style={{ background: 'var(--bg-secondary)', borderRadius: '12px', border: '1px solid var(--border-default)', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-default)' }}>
                <th style={{ padding: '0.75rem', textAlign: 'left', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Referenz</th>
                <th style={{ padding: '0.75rem', textAlign: 'left', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Erstellt</th>
                <th style={{ padding: '0.75rem', textAlign: 'left', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Ausfuehrung</th>
                <th style={{ padding: '0.75rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Transaktionen</th>
                <th style={{ padding: '0.75rem', textAlign: 'right', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Betrag</th>
                <th style={{ padding: '0.75rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Status</th>
                <th style={{ padding: '0.75rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>XML</th>
              </tr>
            </thead>
            <tbody>
              {batches.length === 0 ? (
                <tr><td colSpan="7" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>Keine Batches vorhanden</td></tr>
              ) : batches.map(b => (
                <tr key={b.id} style={{ borderBottom: '1px solid var(--border-default)' }}>
                  <td style={{ padding: '0.75rem', color: 'var(--text-primary)', fontFamily: 'monospace', fontSize: '0.85rem' }}>{b.batch_referenz}</td>
                  <td style={{ padding: '0.75rem', color: 'var(--text-secondary)' }}>{new Date(b.erstelldatum).toLocaleDateString('de-DE')}</td>
                  <td style={{ padding: '0.75rem', color: 'var(--text-primary)' }}>{new Date(b.ausfuehrungsdatum).toLocaleDateString('de-DE')}</td>
                  <td style={{ padding: '0.75rem', textAlign: 'center', color: 'var(--text-primary)' }}>{b.anzahl_transaktionen}</td>
                  <td style={{ padding: '0.75rem', textAlign: 'right', color: 'var(--primary)', fontWeight: '600' }}>{parseFloat(b.gesamtbetrag).toFixed(2)} EUR</td>
                  <td style={{ padding: '0.75rem', textAlign: 'center' }}>{getStatusBadge(b.status)}</td>
                  <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                    <button onClick={() => handleDownloadXml(b.id)} style={{ background: 'rgba(16,185,129,0.2)', color: '#10b981', border: 'none', padding: '0.4rem 0.75rem', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem', margin: '0 auto' }}>
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
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }} onClick={() => setShowNewMandatModal(false)}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--bg-primary)', borderRadius: '16px', width: '90%', maxWidth: '500px', border: '1px solid var(--border-default)' }}>
            <div style={{ padding: '1.25rem', borderBottom: '1px solid var(--border-default)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, color: 'var(--primary)' }}>Neues SEPA-Mandat</h3>
              <button onClick={() => setShowNewMandatModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-primary)', fontSize: '1.5rem', cursor: 'pointer' }}>x</button>
            </div>
            <div style={{ padding: '1.5rem' }}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Dojo auswaehlen *</label>
                <select value={selectedDojo?.id || ''} onChange={e => setSelectedDojo(dojosOhneMandat.find(d => d.id === parseInt(e.target.value)))} style={{ width: '100%', padding: '0.75rem', background: 'var(--bg-secondary)', border: '1px solid var(--border-default)', borderRadius: '8px', color: 'var(--text-primary)' }}>
                  <option value="">-- Dojo waehlen --</option>
                  {dojosOhneMandat.map(d => (
                    <option key={d.id} value={d.id}>{d.dojoname} ({d.plan_type} - {d.monthly_price} EUR)</option>
                  ))}
                </select>
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Kontoinhaber *</label>
                <input type="text" value={newMandat.kontoinhaber} onChange={e => setNewMandat({...newMandat, kontoinhaber: e.target.value})} style={{ width: '100%', padding: '0.75rem', background: 'var(--bg-secondary)', border: '1px solid var(--border-default)', borderRadius: '8px', color: 'var(--text-primary)' }} />
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>IBAN *</label>
                <input type="text" value={newMandat.iban} onChange={e => setNewMandat({...newMandat, iban: e.target.value})} placeholder="DE89 3704 0044 0532 0130 00" style={{ width: '100%', padding: '0.75rem', background: 'var(--bg-secondary)', border: '1px solid var(--border-default)', borderRadius: '8px', color: 'var(--text-primary)', fontFamily: 'monospace' }} />
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>BIC</label>
                <input type="text" value={newMandat.bic} onChange={e => setNewMandat({...newMandat, bic: e.target.value})} style={{ width: '100%', padding: '0.75rem', background: 'var(--bg-secondary)', border: '1px solid var(--border-default)', borderRadius: '8px', color: 'var(--text-primary)' }} />
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Mandatsdatum</label>
                <input type="date" value={newMandat.mandats_datum} onChange={e => setNewMandat({...newMandat, mandats_datum: e.target.value})} style={{ width: '100%', padding: '0.75rem', background: 'var(--bg-secondary)', border: '1px solid var(--border-default)', borderRadius: '8px', color: 'var(--text-primary)' }} />
              </div>
            </div>
            <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid var(--border-default)', display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
              <button onClick={() => setShowNewMandatModal(false)} style={{ padding: '0.75rem 1.5rem', background: 'var(--bg-secondary)', border: '1px solid var(--border-default)', borderRadius: '8px', color: 'var(--text-primary)', cursor: 'pointer' }}>Abbrechen</button>
              <button onClick={handleCreateMandat} style={{ padding: '0.75rem 1.5rem', background: 'var(--primary)', border: 'none', borderRadius: '8px', color: '#000', fontWeight: '600', cursor: 'pointer' }}>Mandat erstellen</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Neuer Batch */}
      {showNewBatchModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }} onClick={() => setShowNewBatchModal(false)}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--bg-primary)', borderRadius: '16px', width: '90%', maxWidth: '450px', border: '1px solid var(--border-default)' }}>
            <div style={{ padding: '1.25rem', borderBottom: '1px solid var(--border-default)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, color: 'var(--primary)' }}>Lastschrift-Batch erstellen</h3>
              <button onClick={() => setShowNewBatchModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-primary)', fontSize: '1.5rem', cursor: 'pointer' }}>x</button>
            </div>
            <div style={{ padding: '1.5rem' }}>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                Es werden alle aktiven Mandate mit laufenden Subscriptions einbezogen.
              </p>
              <p style={{ color: 'var(--text-primary)', marginBottom: '1.5rem' }}>
                <strong>{mandate.filter(m => m.status === 'aktiv').length}</strong> Mandate aktiv
              </p>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Gewuenschtes Einzugsdatum *</label>
                <input type="date" value={batchDate} onChange={e => setBatchDate(e.target.value)} min={new Date(Date.now() + 5*24*60*60*1000).toISOString().split('T')[0]} style={{ width: '100%', padding: '0.75rem', background: 'var(--bg-secondary)', border: '1px solid var(--border-default)', borderRadius: '8px', color: 'var(--text-primary)' }} />
                <small style={{ color: 'var(--text-secondary)' }}>Mind. 5 Werktage in der Zukunft</small>
              </div>
            </div>
            <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid var(--border-default)', display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
              <button onClick={() => setShowNewBatchModal(false)} style={{ padding: '0.75rem 1.5rem', background: 'var(--bg-secondary)', border: '1px solid var(--border-default)', borderRadius: '8px', color: 'var(--text-primary)', cursor: 'pointer' }}>Abbrechen</button>
              <button onClick={handleCreateBatch} style={{ padding: '0.75rem 1.5rem', background: '#3b82f6', border: 'none', borderRadius: '8px', color: '#fff', fontWeight: '600', cursor: 'pointer' }}>Batch erstellen</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SepaTab;
