import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import {
  Search, Plus, X, Phone, Mail, Globe, MapPin, Building2,
  ChevronRight, ChevronDown, Clock, CheckCircle, AlertTriangle,
  Edit2, Trash2, MessageSquare, RefreshCw, Filter, Calendar,
  User, ExternalLink, FileText, Target, TrendingUp
} from 'lucide-react';
import '../styles/VerbandKontakte.css';

const BUNDESLAENDER = [
  'Baden-Württemberg','Bayern','Berlin','Brandenburg','Bremen',
  'Hamburg','Hessen','Mecklenburg-Vorpommern','Niedersachsen',
  'Nordrhein-Westfalen','Rheinland-Pfalz','Saarland','Sachsen',
  'Sachsen-Anhalt','Schleswig-Holstein','Thüringen'
];

const STATUS_CONFIG = {
  neu:           { label: 'Neu',           color: '#6366f1', bg: 'rgba(99,102,241,0.15)' },
  kontaktiert:   { label: 'Kontaktiert',   color: '#f59e0b', bg: 'rgba(245,158,11,0.15)' },
  interessiert:  { label: 'Interessiert',  color: '#22c55e', bg: 'rgba(34,197,94,0.15)'  },
  mitglied:      { label: 'Mitglied',      color: '#10b981', bg: 'rgba(16,185,129,0.2)'  },
  kein_interesse:{ label: 'Kein Interesse',color: '#ef4444', bg: 'rgba(239,68,68,0.15)'  },
  archiviert:    { label: 'Archiviert',    color: '#6b7280', bg: 'rgba(107,114,128,0.15)' },
};

const TYP_CONFIG = {
  anruf:    { label: 'Telefonanruf',    icon: '📞' },
  email:    { label: 'E-Mail',          icon: '✉️'  },
  brief:    { label: 'Brief / Post',    icon: '📬' },
  treffen:  { label: 'Persönl. Treffen',icon: '🤝' },
  online:   { label: 'Online-Meeting',  icon: '💻' },
  messe:    { label: 'Messe / Event',   icon: '🏟️' },
  sonstiges:{ label: 'Sonstiges',       icon: '📋' },
};

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.neu;
  return (
    <span className="vk-badge" style={{ color: cfg.color, background: cfg.bg }}>
      {cfg.label}
    </span>
  );
}

// ── Formular für Kontakt anlegen / bearbeiten ─────────────────────────────────
function KontaktForm({ initial, onSave, onClose }) {
  const empty = {
    name: '', adresse: '', plz: '', ort: '', bundesland: '', land: 'Deutschland',
    kontakt_person: '', email: '', telefon: '', website: '',
    kampfkunst: '', status: 'neu', notizen: '',
    naechste_aktion_datum: '', naechste_aktion: ''
  };
  const [form, setForm] = useState(initial ? { ...initial } : { ...empty });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const set = (field, val) => setForm(f => ({ ...f, [field]: val }));

  const handleSave = async () => {
    if (!form.name.trim()) { setErr('Name ist Pflichtfeld'); return; }
    setSaving(true);
    setErr('');
    try {
      if (initial?.id) {
        await axios.put(`/verband-kontakte/${initial.id}`, form);
      } else {
        const r = await axios.post('/verband-kontakte', form);
        form.id = r.data.id;
      }
      onSave(form);
    } catch (e) {
      setErr(e.response?.data?.error || 'Fehler beim Speichern');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="vk-modal-overlay" onClick={onClose}>
      <div className="vk-modal" onClick={e => e.stopPropagation()}>
        <div className="vk-modal-header">
          <h3>{initial?.id ? 'Kontakt bearbeiten' : 'Neuen Kontakt anlegen'}</h3>
          <button className="vk-icon-btn" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="vk-modal-body">
          {err && <div className="vk-error-banner"><AlertTriangle size={16} />{err}</div>}

          <div className="vk-form-section">
            <h4>Schule / Verein</h4>
            <div className="vk-form-row">
              <div className="vk-form-group vk-full">
                <label>Name der Schule / des Vereins *</label>
                <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="z.B. Taekwondo Club Berlin e.V." />
              </div>
            </div>
            <div className="vk-form-row">
              <div className="vk-form-group vk-full">
                <label>Straße & Hausnummer</label>
                <input value={form.adresse} onChange={e => set('adresse', e.target.value)} placeholder="Musterstraße 12" />
              </div>
            </div>
            <div className="vk-form-row">
              <div className="vk-form-group vk-small">
                <label>PLZ</label>
                <input value={form.plz} onChange={e => set('plz', e.target.value)} placeholder="10115" maxLength={10} />
              </div>
              <div className="vk-form-group">
                <label>Ort</label>
                <input value={form.ort} onChange={e => set('ort', e.target.value)} placeholder="Berlin" />
              </div>
              <div className="vk-form-group">
                <label>Bundesland</label>
                <select value={form.bundesland} onChange={e => set('bundesland', e.target.value)}>
                  <option value="">– wählen –</option>
                  {BUNDESLAENDER.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
            </div>
            <div className="vk-form-row">
              <div className="vk-form-group">
                <label>Kampfkunst</label>
                <input value={form.kampfkunst} onChange={e => set('kampfkunst', e.target.value)} placeholder="z.B. Taekwondo, Karate, Judo …" />
              </div>
              <div className="vk-form-group">
                <label>Website</label>
                <input value={form.website} onChange={e => set('website', e.target.value)} placeholder="https://..." />
              </div>
            </div>
          </div>

          <div className="vk-form-section">
            <h4>Ansprechpartner</h4>
            <div className="vk-form-row">
              <div className="vk-form-group">
                <label>Name</label>
                <input value={form.kontakt_person} onChange={e => set('kontakt_person', e.target.value)} placeholder="Max Mustermann" />
              </div>
              <div className="vk-form-group">
                <label>E-Mail</label>
                <input type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="info@schule.de" />
              </div>
              <div className="vk-form-group">
                <label>Telefon</label>
                <input value={form.telefon} onChange={e => set('telefon', e.target.value)} placeholder="+49 30 12345678" />
              </div>
            </div>
          </div>

          <div className="vk-form-section">
            <h4>Status & Follow-up</h4>
            <div className="vk-form-row">
              <div className="vk-form-group">
                <label>Status</label>
                <select value={form.status} onChange={e => set('status', e.target.value)}>
                  {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                    <option key={k} value={k}>{v.label}</option>
                  ))}
                </select>
              </div>
              <div className="vk-form-group">
                <label>Nächste Aktion</label>
                <input value={form.naechste_aktion} onChange={e => set('naechste_aktion', e.target.value)} placeholder="z.B. Angebot nachfassen" />
              </div>
              <div className="vk-form-group">
                <label>Fällig am</label>
                <input type="date" value={form.naechste_aktion_datum || ''} onChange={e => set('naechste_aktion_datum', e.target.value)} />
              </div>
            </div>
            <div className="vk-form-row">
              <div className="vk-form-group vk-full">
                <label>Notizen</label>
                <textarea rows={3} value={form.notizen} onChange={e => set('notizen', e.target.value)} placeholder="Interne Notizen …" />
              </div>
            </div>
          </div>
        </div>

        <div className="vk-modal-footer">
          <button className="vk-btn-secondary" onClick={onClose}>Abbrechen</button>
          <button className="vk-btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Speichern…' : 'Speichern'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Formular: neue Aktivität ──────────────────────────────────────────────────
function AktivitaetForm({ kontaktId, onSave, onClose }) {
  const today = new Date().toISOString().slice(0, 16);
  const [form, setForm] = useState({
    typ: 'email', datum: today, betreff: '', notizen: '', ergebnis: '',
    naechste_aktion: '', naechste_aktion_datum: ''
  });
  const [saving, setSaving] = useState(false);

  const set = (field, val) => setForm(f => ({ ...f, [field]: val }));

  const handleSave = async () => {
    setSaving(true);
    try {
      await axios.post(`/verband-kontakte/${kontaktId}/aktivitaeten`, form);
      onSave();
    } catch (e) {
      alert('Fehler beim Speichern');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="vk-modal-overlay" onClick={onClose}>
      <div className="vk-modal vk-modal-sm" onClick={e => e.stopPropagation()}>
        <div className="vk-modal-header">
          <h3>Kontaktaufnahme erfassen</h3>
          <button className="vk-icon-btn" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="vk-modal-body">
          <div className="vk-form-row">
            <div className="vk-form-group">
              <label>Art</label>
              <select value={form.typ} onChange={e => set('typ', e.target.value)}>
                {Object.entries(TYP_CONFIG).map(([k, v]) => (
                  <option key={k} value={k}>{v.icon} {v.label}</option>
                ))}
              </select>
            </div>
            <div className="vk-form-group">
              <label>Datum & Uhrzeit</label>
              <input type="datetime-local" value={form.datum} onChange={e => set('datum', e.target.value)} />
            </div>
          </div>
          <div className="vk-form-row">
            <div className="vk-form-group vk-full">
              <label>Betreff / Thema</label>
              <input value={form.betreff} onChange={e => set('betreff', e.target.value)} placeholder="z.B. Erstanfrage TDA-Mitgliedschaft" />
            </div>
          </div>
          <div className="vk-form-row">
            <div className="vk-form-group vk-full">
              <label>Notizen / Gesprächsinhalt</label>
              <textarea rows={3} value={form.notizen} onChange={e => set('notizen', e.target.value)} placeholder="Was wurde besprochen?" />
            </div>
          </div>
          <div className="vk-form-row">
            <div className="vk-form-group vk-full">
              <label>Ergebnis</label>
              <input value={form.ergebnis} onChange={e => set('ergebnis', e.target.value)} placeholder="z.B. Interesse bekundet, wartet auf Unterlagen" />
            </div>
          </div>
          <div className="vk-form-row">
            <div className="vk-form-group">
              <label>Nächste Aktion</label>
              <input value={form.naechste_aktion} onChange={e => set('naechste_aktion', e.target.value)} placeholder="z.B. Angebot senden" />
            </div>
            <div className="vk-form-group">
              <label>Fällig am</label>
              <input type="date" value={form.naechste_aktion_datum} onChange={e => set('naechste_aktion_datum', e.target.value)} />
            </div>
          </div>
        </div>
        <div className="vk-modal-footer">
          <button className="vk-btn-secondary" onClick={onClose}>Abbrechen</button>
          <button className="vk-btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Speichern…' : 'Speichern'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Detail-Panel (Slide-in) ────────────────────────────────────────────────────
function KontaktDetail({ kontaktId, onClose, onUpdate }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showAktForm, setShowAktForm] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await axios.get(`/verband-kontakte/${kontaktId}`);
      setData(r.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [kontaktId]);

  useEffect(() => { load(); }, [load]);

  const handleDeleteAkt = async (aktId) => {
    if (!window.confirm('Eintrag löschen?')) return;
    await axios.delete(`/verband-kontakte/${kontaktId}/aktivitaeten/${aktId}`);
    load();
  };

  const handleStatusChange = async (newStatus) => {
    await axios.put(`/verband-kontakte/${kontaktId}`, { ...data.kontakt, status: newStatus });
    load();
    onUpdate();
  };

  if (loading) {
    return (
      <div className="vk-detail-panel">
        <div className="vk-detail-loading">Lädt…</div>
      </div>
    );
  }
  if (!data) return null;

  const { kontakt, aktivitaeten } = data;
  const cfg = STATUS_CONFIG[kontakt.status] || STATUS_CONFIG.neu;

  return (
    <div className="vk-detail-panel">
      <div className="vk-detail-header">
        <div className="vk-detail-title">
          <Building2 size={20} />
          <h3>{kontakt.name}</h3>
        </div>
        <div className="vk-detail-header-actions">
          <button className="vk-icon-btn" title="Bearbeiten" onClick={() => setShowEditForm(true)}>
            <Edit2 size={16} />
          </button>
          <button className="vk-icon-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Status-Switcher */}
      <div className="vk-status-switcher">
        {Object.entries(STATUS_CONFIG).map(([k, v]) => (
          <button
            key={k}
            className={`vk-status-btn ${kontakt.status === k ? 'active' : ''}`}
            style={kontakt.status === k ? { color: v.color, borderColor: v.color, background: v.bg } : {}}
            onClick={() => handleStatusChange(k)}
          >
            {v.label}
          </button>
        ))}
      </div>

      {/* Info-Block */}
      <div className="vk-detail-info">
        {(kontakt.adresse || kontakt.ort) && (
          <div className="vk-info-row">
            <MapPin size={14} />
            <span>{[kontakt.adresse, kontakt.plz, kontakt.ort, kontakt.bundesland].filter(Boolean).join(', ')}</span>
          </div>
        )}
        {kontakt.kampfkunst && (
          <div className="vk-info-row">
            <Target size={14} />
            <span>{kontakt.kampfkunst}</span>
          </div>
        )}
        {kontakt.kontakt_person && (
          <div className="vk-info-row">
            <User size={14} />
            <span>{kontakt.kontakt_person}</span>
          </div>
        )}
        {kontakt.email && (
          <div className="vk-info-row">
            <Mail size={14} />
            <a href={`mailto:${kontakt.email}`}>{kontakt.email}</a>
          </div>
        )}
        {kontakt.telefon && (
          <div className="vk-info-row">
            <Phone size={14} />
            <a href={`tel:${kontakt.telefon}`}>{kontakt.telefon}</a>
          </div>
        )}
        {kontakt.website && (
          <div className="vk-info-row">
            <Globe size={14} />
            <a href={kontakt.website} target="_blank" rel="noopener noreferrer">
              {kontakt.website} <ExternalLink size={12} />
            </a>
          </div>
        )}
      </div>

      {/* Follow-up */}
      {(kontakt.naechste_aktion || kontakt.naechste_aktion_datum) && (
        <div className={`vk-followup-banner ${new Date(kontakt.naechste_aktion_datum) <= new Date() ? 'faellig' : ''}`}>
          <Clock size={14} />
          <div>
            <strong>{kontakt.naechste_aktion || 'Aktion geplant'}</strong>
            {kontakt.naechste_aktion_datum && (
              <span> — {new Date(kontakt.naechste_aktion_datum).toLocaleDateString('de-DE')}</span>
            )}
          </div>
        </div>
      )}

      {/* Notizen */}
      {kontakt.notizen && (
        <div className="vk-detail-notizen">
          <FileText size={14} />
          <p>{kontakt.notizen}</p>
        </div>
      )}

      {/* Kontakthistorie */}
      <div className="vk-aktivitaeten">
        <div className="vk-aktivitaeten-header">
          <h4><MessageSquare size={16} /> Kontakthistorie ({aktivitaeten.length})</h4>
          <button className="vk-btn-sm-primary" onClick={() => setShowAktForm(true)}>
            <Plus size={14} /> Eintrag
          </button>
        </div>

        {aktivitaeten.length === 0 ? (
          <div className="vk-empty-small">
            <MessageSquare size={24} />
            <p>Noch keine Kontaktaufnahmen</p>
          </div>
        ) : (
          <div className="vk-akt-list">
            {aktivitaeten.map(a => (
              <div key={a.id} className="vk-akt-item">
                <div className="vk-akt-icon">
                  {TYP_CONFIG[a.typ]?.icon || '📋'}
                </div>
                <div className="vk-akt-content">
                  <div className="vk-akt-top">
                    <span className="vk-akt-typ">{TYP_CONFIG[a.typ]?.label || a.typ}</span>
                    <span className="vk-akt-datum">
                      {new Date(a.datum).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                    </span>
                    <button className="vk-icon-btn vk-icon-btn-sm" onClick={() => handleDeleteAkt(a.id)}>
                      <Trash2 size={12} />
                    </button>
                  </div>
                  {a.betreff && <div className="vk-akt-betreff">{a.betreff}</div>}
                  {a.notizen && <div className="vk-akt-notizen">{a.notizen}</div>}
                  {a.ergebnis && <div className="vk-akt-ergebnis">→ {a.ergebnis}</div>}
                  {(a.naechste_aktion || a.naechste_aktion_datum) && (
                    <div className="vk-akt-followup">
                      <Clock size={12} />
                      {a.naechste_aktion}
                      {a.naechste_aktion_datum && ` (${new Date(a.naechste_aktion_datum).toLocaleDateString('de-DE')})`}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showAktForm && (
        <AktivitaetForm
          kontaktId={kontaktId}
          onSave={() => { load(); setShowAktForm(false); onUpdate(); }}
          onClose={() => setShowAktForm(false)}
        />
      )}

      {showEditForm && (
        <KontaktForm
          initial={kontakt}
          onSave={() => { load(); setShowEditForm(false); onUpdate(); }}
          onClose={() => setShowEditForm(false)}
        />
      )}
    </div>
  );
}

// ── Hauptkomponente ───────────────────────────────────────────────────────────
export default function VerbandKontakte() {
  const [kontakte, setKontakte] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterBundesland, setFilterBundesland] = useState('');
  const [filterFaellig, setFilterFaellig] = useState(false);
  const [showNewForm, setShowNewForm] = useState(false);
  const [selectedId, setSelectedId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (filterStatus) params.status = filterStatus;
      if (filterBundesland) params.bundesland = filterBundesland;
      if (search) params.search = search;
      if (filterFaellig) params.faellig = 'true';

      const [listRes, statsRes] = await Promise.all([
        axios.get('/verband-kontakte', { params }),
        axios.get('/verband-kontakte/stats')
      ]);
      setKontakte(listRes.data.kontakte || []);
      setStats(statsRes.data.stats || {});
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [filterStatus, filterBundesland, search, filterFaellig]);

  useEffect(() => {
    const t = setTimeout(load, search ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, search]);

  const handleDelete = async (id, e) => {
    e.stopPropagation();
    if (!window.confirm('Kontakt wirklich löschen?')) return;
    await axios.delete(`/verband-kontakte/${id}`);
    if (selectedId === id) setSelectedId(null);
    load();
  };

  return (
    <div className="vk-container">
      {/* Stats-Leiste */}
      <div className="vk-stats-bar">
        {[
          { key: '', label: 'Alle', count: stats.gesamt },
          { key: 'neu', label: 'Neu', count: stats.neu },
          { key: 'kontaktiert', label: 'Kontaktiert', count: stats.kontaktiert },
          { key: 'interessiert', label: 'Interessiert', count: stats.interessiert },
          { key: 'mitglied', label: 'Mitglied', count: stats.mitglied },
        ].map(s => (
          <button
            key={s.key}
            className={`vk-stat-chip ${filterStatus === s.key ? 'active' : ''}`}
            onClick={() => setFilterStatus(s.key)}
          >
            <span className="vk-stat-num">{s.count ?? 0}</span>
            <span className="vk-stat-lbl">{s.label}</span>
          </button>
        ))}
        {(stats.faellig > 0) && (
          <button
            className={`vk-stat-chip faellig ${filterFaellig ? 'active' : ''}`}
            onClick={() => setFilterFaellig(f => !f)}
          >
            <span className="vk-stat-num">{stats.faellig}</span>
            <span className="vk-stat-lbl">Fällig</span>
          </button>
        )}
      </div>

      {/* Toolbar */}
      <div className="vk-toolbar">
        <div className="vk-search-wrap">
          <Search size={16} className="vk-search-icon" />
          <input
            className="vk-search"
            placeholder="Name, Ort, Ansprechpartner, E-Mail …"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && <button className="vk-clear-btn" onClick={() => setSearch('')}><X size={14} /></button>}
        </div>

        <select className="vk-select" value={filterBundesland} onChange={e => setFilterBundesland(e.target.value)}>
          <option value="">Alle Bundesländer</option>
          {BUNDESLAENDER.map(b => <option key={b} value={b}>{b}</option>)}
        </select>

        <button className="vk-btn-icon" onClick={load} title="Aktualisieren">
          <RefreshCw size={16} />
        </button>

        <button className="vk-btn-primary" onClick={() => setShowNewForm(true)}>
          <Plus size={16} /> Kontakt anlegen
        </button>
      </div>

      {/* Inhalt */}
      <div className={`vk-main ${selectedId ? 'vk-split' : ''}`}>
        {/* Liste */}
        <div className="vk-list-wrap">
          {loading ? (
            <div className="vk-loading">Lädt…</div>
          ) : kontakte.length === 0 ? (
            <div className="vk-empty">
              <Building2 size={48} />
              <h4>Keine Kontakte gefunden</h4>
              <p>Lege den ersten Kontakt an, um Schulen und Vereine zu verwalten.</p>
              <button className="vk-btn-primary" onClick={() => setShowNewForm(true)}>
                <Plus size={16} /> Ersten Kontakt anlegen
              </button>
            </div>
          ) : (
            <div className="vk-list">
              {kontakte.map(k => {
                const cfg = STATUS_CONFIG[k.status] || STATUS_CONFIG.neu;
                const isFaellig = k.naechste_aktion_datum && new Date(k.naechste_aktion_datum) <= new Date();
                return (
                  <div
                    key={k.id}
                    className={`vk-item ${selectedId === k.id ? 'selected' : ''} ${isFaellig ? 'faellig' : ''}`}
                    onClick={() => setSelectedId(selectedId === k.id ? null : k.id)}
                  >
                    <div className="vk-item-left">
                      <div className="vk-item-icon" style={{ background: cfg.bg, color: cfg.color }}>
                        <Building2 size={18} />
                      </div>
                    </div>
                    <div className="vk-item-body">
                      <div className="vk-item-top">
                        <span className="vk-item-name">{k.name}</span>
                        <StatusBadge status={k.status} />
                      </div>
                      <div className="vk-item-meta">
                        {k.ort && <span><MapPin size={12} />{k.bundesland ? `${k.ort}, ${k.bundesland}` : k.ort}</span>}
                        {k.kampfkunst && <span><Target size={12} />{k.kampfkunst}</span>}
                        {k.kontakt_person && <span><User size={12} />{k.kontakt_person}</span>}
                        {k.aktivitaeten_count > 0 && (
                          <span><MessageSquare size={12} />{k.aktivitaeten_count} Eintr.</span>
                        )}
                      </div>
                      {isFaellig && k.naechste_aktion && (
                        <div className="vk-item-faellig">
                          <Clock size={11} /> {k.naechste_aktion}
                          {k.naechste_aktion_datum && ` — ${new Date(k.naechste_aktion_datum).toLocaleDateString('de-DE')}`}
                        </div>
                      )}
                    </div>
                    <div className="vk-item-actions">
                      {k.email && (
                        <a href={`mailto:${k.email}`} className="vk-icon-btn" onClick={e => e.stopPropagation()} title="E-Mail senden">
                          <Mail size={15} />
                        </a>
                      )}
                      {k.telefon && (
                        <a href={`tel:${k.telefon}`} className="vk-icon-btn" onClick={e => e.stopPropagation()} title="Anrufen">
                          <Phone size={15} />
                        </a>
                      )}
                      <button className="vk-icon-btn vk-icon-btn-danger" onClick={e => handleDelete(k.id, e)} title="Löschen">
                        <Trash2 size={15} />
                      </button>
                      <ChevronRight size={16} className={`vk-item-chevron ${selectedId === k.id ? 'rotated' : ''}`} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Detail-Panel */}
        {selectedId && (
          <KontaktDetail
            kontaktId={selectedId}
            onClose={() => setSelectedId(null)}
            onUpdate={load}
          />
        )}
      </div>

      {/* Modals */}
      {showNewForm && (
        <KontaktForm
          onSave={() => { load(); setShowNewForm(false); }}
          onClose={() => setShowNewForm(false)}
        />
      )}
    </div>
  );
}
