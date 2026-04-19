import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { useDojoContext } from '../context/DojoContext.jsx';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Search, UserPlus, Edit2, Trash2, X } from 'lucide-react';
import "../styles/themes.css";
import "../styles/components.css";
import "../styles/InteressentenListe.css";

const STATUS_OPTIONS = [
  { value: 'neu',                      label: 'Neu' },
  { value: 'kontaktiert',              label: 'Kontaktiert' },
  { value: 'probetraining_vereinbart', label: 'Probetraining vereinbart' },
  { value: 'probetraining_absolviert', label: 'Probetraining absolviert' },
  { value: 'angebot_gesendet',         label: 'Angebot gesendet' },
  { value: 'interessiert',             label: 'Interessiert' },
  { value: 'nicht_interessiert',       label: 'Nicht interessiert' },
  { value: 'konvertiert',              label: 'Konvertiert' },
];

const STATUS_COLORS = {
  neu:                      '#3b82f6',
  kontaktiert:              '#8b5cf6',
  probetraining_vereinbart: '#f59e0b',
  probetraining_absolviert: '#10b981',
  angebot_gesendet:         '#06b6d4',
  interessiert:             '#84cc16',
  nicht_interessiert:       '#6b7280',
  konvertiert:              '#22c55e',
};

const EMPTY_FORM = {
  vorname: '', nachname: '', email: '', telefon: '', telefon_mobil: '',
  strasse: '', hausnummer: '', plz: '', ort: '',
  geburtsdatum: '', interessiert_an: '', erfahrung: '', gewuenschter_tarif: '',
  erstkontakt_quelle: '', letzter_kontakt_datum: '', naechster_kontakt_datum: '',
  status: 'neu', prioritaet: 'mittel', notizen: '',
  probetraining_datum: '', probetraining_absolviert: false, probetraining_feedback: '',
  newsletter_angemeldet: false,
};

const InteressentenListe = () => {
  const { getDojoFilterParam, activeDojo } = useDojoContext();
  const [interessenten, setInteressenten]   = useState([]);
  const [loading, setLoading]               = useState(true);
  const [error, setError]                   = useState('');
  const [success, setSuccess]               = useState('');
  const [searchInput, setSearchInput]       = useState('');
  const [searchTerm, setSearchTerm]         = useState('');
  const [filterStatus, setFilterStatus]     = useState('');
  const [editModal, setEditModal]           = useState({ open: false, data: null, isNew: false });
  const [saving, setSaving]                 = useState(false);
  const [pagination, setPagination]         = useState({ page: 1, limit: 50, total: 0, totalPages: 0 });
  const navigate = useNavigate();

  const showError   = (msg) => { setError(msg);   setTimeout(() => setError(''), 4000); };
  const showSuccess = (msg) => { setSuccess(msg); setTimeout(() => setSuccess(''), 3000); };

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => { setSearchTerm(searchInput); setPagination(p => ({ ...p, page: 1 })); }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => { setPagination(p => ({ ...p, page: 1 })); }, [filterStatus]);

  const loadInteressenten = useCallback(async () => {
    try {
      setLoading(true);
      const dojoFilterParam = getDojoFilterParam();
      const params = new URLSearchParams();
      if (dojoFilterParam) { const [k, v] = dojoFilterParam.split('='); params.append(k, v); }
      params.append('page', pagination.page);
      params.append('limit', pagination.limit);
      if (searchTerm)   params.append('search', searchTerm);
      if (filterStatus) params.append('status', filterStatus);

      const response = await axios.get(`/interessenten?${params.toString()}`);
      if (response.data.data) {
        setInteressenten(response.data.data);
        setPagination(p => ({ ...p, ...response.data.pagination }));
      } else {
        setInteressenten(response.data);
        setPagination(p => ({ ...p, total: response.data.length, totalPages: 1 }));
      }
    } catch (err) {
      showError('Fehler beim Laden der Interessenten');
    } finally {
      setLoading(false);
    }
  }, [getDojoFilterParam, pagination.page, pagination.limit, searchTerm, filterStatus]);

  useEffect(() => { loadInteressenten(); }, [loadInteressenten]);

  const openEdit = (interessent) => {
    const d = { ...interessent };
    // Datumsfelder normalisieren
    ['geburtsdatum', 'erstkontakt_datum', 'letzter_kontakt_datum', 'naechster_kontakt_datum', 'probetraining_datum'].forEach(f => {
      if (d[f]) d[f] = d[f].split('T')[0];
    });
    setEditModal({ open: true, data: d, isNew: false });
  };

  const openNew = () => {
    const dojoId = activeDojo?.id || null;
    setEditModal({ open: true, data: { ...EMPTY_FORM, dojo_id: dojoId }, isNew: true });
  };

  const closeModal = () => setEditModal({ open: false, data: null, isNew: false });

  const handleFormChange = (field, value) => {
    setEditModal(m => ({ ...m, data: { ...m.data, [field]: value } }));
  };

  const handleSave = async () => {
    const { data, isNew } = editModal;
    if (!data.vorname?.trim() || !data.nachname?.trim()) {
      showError('Vor- und Nachname sind Pflichtfelder');
      return;
    }
    try {
      setSaving(true);
      if (isNew) {
        await axios.post('/interessenten', data);
        showSuccess('Interessent erfolgreich angelegt');
      } else {
        await axios.put(`/interessenten/${data.id}`, data);
        showSuccess('Interessent erfolgreich aktualisiert');
      }
      closeModal();
      loadInteressenten();
    } catch (err) {
      showError(err.response?.data?.error || 'Fehler beim Speichern');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`${name} archivieren?`)) return;
    try {
      await axios.delete(`/interessenten/${id}`);
      showSuccess('Interessent archiviert');
      loadInteressenten();
    } catch (err) {
      showError(err.response?.data?.error || 'Fehler beim Archivieren');
    }
  };

  const goToPage = (page) => {
    if (page >= 1 && page <= pagination.totalPages)
      setPagination(p => ({ ...p, page }));
  };

  // ── Pagination ──────────────────────────────────────────────────────────────
  const PaginationControls = () => {
    if (pagination.totalPages <= 1) return null;
    const max = 5;
    let start = Math.max(1, pagination.page - Math.floor(max / 2));
    let end   = Math.min(pagination.totalPages, start + max - 1);
    if (end - start + 1 < max) start = Math.max(1, end - max + 1);
    const pages = [];
    for (let i = start; i <= end; i++) pages.push(i);
    return (
      <div className="il-pagination-controls">
        <button onClick={() => goToPage(1)}                      disabled={pagination.page === 1}                  className="pagination-btn" title="Erste Seite"><ChevronsLeft size={18}/></button>
        <button onClick={() => goToPage(pagination.page - 1)}   disabled={pagination.page === 1}                  className="pagination-btn" title="Zurück"><ChevronLeft size={18}/></button>
        {start > 1 && <span className="u-text-muted">…</span>}
        {pages.map(p => <button key={p} onClick={() => goToPage(p)} className={`pagination-btn${pagination.page === p ? ' active' : ''}`}>{p}</button>)}
        {end < pagination.totalPages && <span className="u-text-muted">…</span>}
        <button onClick={() => goToPage(pagination.page + 1)}   disabled={pagination.page === pagination.totalPages} className="pagination-btn" title="Weiter"><ChevronRight size={18}/></button>
        <button onClick={() => goToPage(pagination.totalPages)} disabled={pagination.page === pagination.totalPages} className="pagination-btn" title="Letzte Seite"><ChevronsRight size={18}/></button>
      </div>
    );
  };

  // ── Input-Helfer ─────────────────────────────────────────────────────────────
  const field = (label, key, type = 'text', opts = {}) => (
    <div className="il-edit-field" style={opts.full ? { gridColumn: '1/-1' } : {}}>
      <label className="il-edit-label">{label}</label>
      {type === 'textarea' ? (
        <textarea
          className="il-edit-input"
          value={editModal.data?.[key] || ''}
          onChange={e => handleFormChange(key, e.target.value)}
          rows={3}
        />
      ) : type === 'select' ? (
        <select
          className="il-edit-input"
          value={editModal.data?.[key] || ''}
          onChange={e => handleFormChange(key, e.target.value)}
        >
          {opts.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      ) : type === 'checkbox' ? (
        <label className="il-edit-checkbox">
          <input
            type="checkbox"
            checked={!!editModal.data?.[key]}
            onChange={e => handleFormChange(key, e.target.checked)}
          />
          <span>{opts.checkLabel || label}</span>
        </label>
      ) : (
        <input
          type={type}
          className="il-edit-input"
          value={editModal.data?.[key] || ''}
          onChange={e => handleFormChange(key, e.target.value)}
        />
      )}
    </div>
  );

  if (error && !editModal.open) return <div className="dashboard-container"><div className="error">{error}</div></div>;

  return (
    <div className="dashboard-container">
      <div className="il-page-header">
        <h1 className="il-page-title"><UserPlus size={28}/>Interessenten</h1>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="primary-button" onClick={openNew}>+ Neu</button>
          <button className="secondary-button" onClick={() => navigate('/dashboard/mitglieder')}>Zurück</button>
        </div>
      </div>

      {success && <div className="il-alert il-alert--success">{success}</div>}
      {error   && <div className="il-alert il-alert--error">{error}</div>}

      <div className="il-filter-row">
        <div className="il-search-wrap">
          <Search size={18} className="il-search-icon"/>
          <input
            type="text"
            placeholder="Suchen nach Name, Email..."
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            className="il-search-input"
          />
        </div>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="il-filter-select">
          <option value="">Alle Status</option>
          {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <div className="il-count-badge">
          {loading ? '…' : `${pagination.total} Interessenten`}
          {pagination.totalPages > 1 && ` | Seite ${pagination.page}/${pagination.totalPages}`}
        </div>
      </div>

      {loading ? (
        <div className="il-loading">Lade Interessenten…</div>
      ) : (
        <>
          <div className="il-card-grid">
            {interessenten.length > 0 ? interessenten.map(i => (
              <div
                key={i.id}
                className="stat-card il-card-base"
                style={{ '--status-color': STATUS_COLORS[i.status] || '#6b7280' }}
              >
                <div className="il-card-header">
                  <h3 className="il-card-name">{i.nachname}, {i.vorname}</h3>
                  <span className="il-status-badge">{STATUS_OPTIONS.find(o => o.value === i.status)?.label || i.status}</span>
                </div>
                <div className="il-card-info">
                  {i.email    && <p className="il-m-02"><strong>Email:</strong> {i.email}</p>}
                  {i.telefon  && <p className="il-m-02"><strong>Telefon:</strong> {i.telefon}</p>}
                  {i.erstkontakt_datum && <p className="il-m-02"><strong>Erstkontakt:</strong> {new Date(i.erstkontakt_datum).toLocaleDateString('de-DE')}</p>}
                  {i.naechster_kontakt_datum && <p className="il-m-02"><strong>Nächster Kontakt:</strong> {new Date(i.naechster_kontakt_datum).toLocaleDateString('de-DE')}</p>}
                  {i.interessiert_an && <p className="il-m-02"><strong>Interesse:</strong> {i.interessiert_an}</p>}
                  {i.prioritaet && <p className="il-m-02"><strong>Priorität:</strong> {i.prioritaet}</p>}
                  {i.notizen && <p className="il-m-02" style={{fontStyle:'italic',color:'#94a3b8'}}>{i.notizen.slice(0, 80)}{i.notizen.length > 80 ? '…' : ''}</p>}
                </div>
                <div className="il-card-actions">
                  <button className="il-btn-edit" onClick={() => openEdit(i)} title="Bearbeiten">
                    <Edit2 size={14}/> Bearbeiten
                  </button>
                  <button className="il-btn-delete" onClick={() => handleDelete(i.id, `${i.vorname} ${i.nachname}`)} title="Archivieren">
                    <Trash2 size={14}/>
                  </button>
                </div>
              </div>
            )) : (
              <div className="stat-card il-empty-card">
                <h3>Keine Interessenten gefunden</h3>
                <p className="u-text-secondary">
                  {searchTerm || filterStatus ? 'Keine Treffer.' : 'Noch keine Interessenten erfasst.'}
                </p>
              </div>
            )}
          </div>
          <PaginationControls/>
        </>
      )}

      {/* ── Edit / Neu Modal ── */}
      {editModal.open && editModal.data && (
        <div className="il-modal-overlay" onClick={closeModal}>
          <div className="il-modal" onClick={e => e.stopPropagation()}>
            <div className="il-modal-header">
              <h2>{editModal.isNew ? 'Neuer Interessent' : `${editModal.data.vorname} ${editModal.data.nachname} bearbeiten`}</h2>
              <button className="il-modal-close" onClick={closeModal}><X size={20}/></button>
            </div>

            {error && <div className="il-alert il-alert--error" style={{margin:'0 0 12px'}}>{error}</div>}

            <div className="il-modal-body">
              <div className="il-edit-section-title">Person</div>
              <div className="il-edit-grid">
                {field('Vorname *', 'vorname')}
                {field('Nachname *', 'nachname')}
                {field('Geburtsdatum', 'geburtsdatum', 'date')}
                {field('Email', 'email', 'email')}
                {field('Telefon', 'telefon')}
                {field('Mobil', 'telefon_mobil')}
              </div>

              <div className="il-edit-section-title">Adresse</div>
              <div className="il-edit-grid">
                {field('Straße', 'strasse')}
                {field('Nr.', 'hausnummer')}
                {field('PLZ', 'plz')}
                {field('Ort', 'ort')}
              </div>

              <div className="il-edit-section-title">Interesse & Status</div>
              <div className="il-edit-grid">
                {field('Interessiert an', 'interessiert_an', 'text', { full: true })}
                {field('Erfahrung', 'erfahrung')}
                {field('Gewünschter Tarif', 'gewuenschter_tarif')}
                {field('Status', 'status', 'select', { options: STATUS_OPTIONS })}
                {field('Priorität', 'prioritaet', 'select', { options: [
                  { value: 'niedrig', label: 'Niedrig' },
                  { value: 'mittel',  label: 'Mittel' },
                  { value: 'hoch',    label: 'Hoch' },
                ]})}
                {field('Quelle', 'erstkontakt_quelle')}
              </div>

              <div className="il-edit-section-title">Kontakt & Termine</div>
              <div className="il-edit-grid">
                {field('Letzter Kontakt', 'letzter_kontakt_datum', 'date')}
                {field('Nächster Kontakt', 'naechster_kontakt_datum', 'date')}
                {field('Probetraining', 'probetraining_datum', 'date')}
                {field('Probetraining absolviert', 'probetraining_absolviert', 'checkbox', { checkLabel: 'Ja' })}
              </div>

              {editModal.data.probetraining_absolviert && (
                <div className="il-edit-grid">
                  {field('Probetraining Feedback', 'probetraining_feedback', 'textarea', { full: true })}
                </div>
              )}

              <div className="il-edit-section-title">Notizen</div>
              <div className="il-edit-grid">
                {field('Notizen', 'notizen', 'textarea', { full: true })}
                {field('Newsletter angemeldet', 'newsletter_angemeldet', 'checkbox', { checkLabel: 'Ja' })}
              </div>
            </div>

            <div className="il-modal-footer">
              <button className="secondary-button" onClick={closeModal} disabled={saving}>Abbrechen</button>
              <button className="primary-button" onClick={handleSave} disabled={saving}>
                {saving ? 'Speichert…' : (editModal.isNew ? 'Anlegen' : 'Speichern')}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .pagination-btn { display:flex;align-items:center;justify-content:center;min-width:36px;height:36px;padding:0 .5rem;background:rgba(31,41,55,.6);border:1px solid rgba(255,255,255,.2);border-radius:6px;color:rgba(255,255,255,.8);cursor:pointer;transition:all .2s;font-weight:500; }
        .pagination-btn:hover:not(:disabled) { background:rgba(59,130,246,.3);border-color:rgba(59,130,246,.5); }
        .pagination-btn:disabled { opacity:.4;cursor:not-allowed; }
        .pagination-btn.active { background:linear-gradient(135deg,#3B82F6,#1D4ED8);border-color:transparent;color:#fff; }
        .il-alert { padding:10px 14px;border-radius:8px;margin-bottom:12px;font-size:.875rem;font-weight:500; }
        .il-alert--success { background:rgba(34,197,94,.15);border:1px solid rgba(34,197,94,.4);color:#86efac; }
        .il-alert--error   { background:rgba(220,38,38,.15); border:1px solid rgba(220,38,38,.4); color:#fca5a5; }
        .il-card-actions { display:flex;gap:8px;margin-top:12px;padding-top:10px;border-top:1px solid rgba(255,255,255,.07); }
        .il-btn-edit { display:flex;align-items:center;gap:5px;flex:1;padding:7px 12px;background:rgba(99,102,241,.15);border:1px solid rgba(99,102,241,.3);border-radius:7px;color:#a5b4fc;font-size:.8rem;font-weight:600;cursor:pointer;transition:all .2s; }
        .il-btn-edit:hover { background:rgba(99,102,241,.3); }
        .il-btn-delete { display:flex;align-items:center;justify-content:center;padding:7px 10px;background:rgba(239,68,68,.1);border:1px solid rgba(239,68,68,.25);border-radius:7px;color:#f87171;cursor:pointer;transition:all .2s; }
        .il-btn-delete:hover { background:rgba(239,68,68,.25); }
        .il-modal-overlay { position:fixed;inset:0;background:rgba(0,0,0,.75);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px; }
        .il-modal { background:#1e1e35;border:1px solid rgba(255,255,255,.1);border-radius:14px;width:100%;max-width:680px;max-height:90vh;display:flex;flex-direction:column;box-shadow:0 20px 60px rgba(0,0,0,.7); }
        .il-modal-header { display:flex;justify-content:space-between;align-items:center;padding:16px 20px;border-bottom:1px solid rgba(255,255,255,.08); }
        .il-modal-header h2 { font-size:1rem;font-weight:700;color:#e2e8f0;margin:0; }
        .il-modal-close { background:rgba(255,255,255,.1);border:none;color:#fff;border-radius:50%;width:28px;height:28px;display:flex;align-items:center;justify-content:center;cursor:pointer; }
        .il-modal-body { padding:16px 20px;overflow-y:auto;flex:1; }
        .il-modal-footer { padding:12px 20px 16px;border-top:1px solid rgba(255,255,255,.08);display:flex;justify-content:flex-end;gap:10px; }
        .il-edit-section-title { font-size:.7rem;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#64748b;margin:14px 0 8px; }
        .il-edit-section-title:first-child { margin-top:0; }
        .il-edit-grid { display:grid;grid-template-columns:1fr 1fr;gap:10px; }
        .il-edit-field { display:flex;flex-direction:column;gap:4px; }
        .il-edit-label { font-size:.75rem;color:#94a3b8;font-weight:500; }
        .il-edit-input { background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);border-radius:7px;padding:8px 10px;color:#e2e8f0;font-size:.875rem;outline:none;transition:border-color .2s;width:100%;box-sizing:border-box; }
        .il-edit-input:focus { border-color:#6366f1; }
        textarea.il-edit-input { resize:vertical; }
        .il-edit-checkbox { display:flex;align-items:center;gap:8px;cursor:pointer;font-size:.875rem;color:#e2e8f0;padding:8px 0; }
        .il-edit-checkbox input { width:16px;height:16px;accent-color:#6366f1;cursor:pointer; }
        @media(max-width:500px){ .il-edit-grid{grid-template-columns:1fr;} }
      `}</style>
    </div>
  );
};

export default InteressentenListe;
