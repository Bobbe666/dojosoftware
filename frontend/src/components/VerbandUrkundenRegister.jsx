/**
 * VerbandUrkundenRegister.jsx
 * ============================
 * Urkundenregister für TDA International
 * - Prüfungsurkunden, DAN-Urkunden, Trainer-/Kampfrichter-Lizenzen etc.
 * - Vollständige CRUD-Operationen
 * - Suche & Filter
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import {
  Scroll, Plus, Search, Filter, Edit3, Trash2, X,
  ChevronLeft, ChevronRight, Award, Shield, Star,
  UserCheck, BookOpen, CheckCircle, AlertCircle,
  RefreshCw, Download, Calendar, User, MapPin, Printer, Eye
} from 'lucide-react';
import { druckeBoB, druckeKickboxSchuelergrad, druckeAikidoSchuelergrad } from './UrkundeDrucken';
import '../styles/VerbandUrkundenRegister.css';

// ============================================================================
// Konfiguration
// ============================================================================

const ARTEN = {
  pruefungsurkunde:    { label: 'Prüfungsurkunde',        icon: BookOpen,   color: '#3b82f6', img: null },
  dan_urkunde:         { label: 'DAN-Urkunde',             icon: Award,      color: '#d4af37', img: null },
  ehren_dan:           { label: 'Ehren-DAN',               icon: Star,       color: '#a855f7', img: null },
  board_of_black_belts:      { label: 'Board of Black Belts',    icon: Star,       color: '#c0392b', img: '/assets/urkunde_bobb.jpg' },
  kickboxen_schuelergrad:    { label: 'Kickboxen Schülergrad',  icon: Award,      color: '#e11d48', img: '/assets/urkunde_kickboxen.jpg' },
  aikido_schuelergrad:       { label: 'Aikido Schülergrad',     icon: Award,      color: '#0ea5e9', img: '/assets/urkunde_aikido.jpg' },
  trainer_lizenz:      { label: 'Trainer-Lizenz',          icon: UserCheck,  color: '#10b981', img: null },
  kampfrichter_lizenz: { label: 'Kampfrichter-Lizenz',     icon: Shield,     color: '#f97316', img: null },
  meister_urkunde:     { label: 'Meister-Urkunde',         icon: Award,      color: '#ef4444', img: null },
  sonstiges:           { label: 'Sonstiges',               icon: Scroll,     color: '#6b7280' },
};

const GRADE = [
  '', '10. Kyu', '9. Kyu', '8. Kyu', '7. Kyu', '6. Kyu',
  '5. Kyu', '4. Kyu', '3. Kyu', '2. Kyu', '1. Kyu',
  '1. Dan', '2. Dan', '3. Dan', '4. Dan', '5. Dan',
  '6. Dan', '7. Dan', '8. Dan', '9. Dan', '10. Dan',
  'Sonstiges'
];

const LEER_FORM = {
  urkundennummer: '',
  art: 'pruefungsurkunde',
  vorname: '', nachname: '',
  geburtsdatum: '',
  email: '', telefon: '',
  strasse: '', plz: '', ort: '', land: 'Deutschland',
  grad: '', disziplin: '',
  ausstellungsdatum: new Date().toISOString().split('T')[0],
  ausgestellt_von: '',
  pruefer: [''],
  dojo_schule: '',
  notizen: '',
  mitglied_id: null,
  dojo_id: null,
};

// ============================================================================
// Haupt-Komponente
// ============================================================================
export default function VerbandUrkundenRegister() {
  const { token } = useAuth();
  const headers = { Authorization: `Bearer ${token}` };

  // Daten
  const [urkunden, setUrkunden]     = useState([]);
  const [stats, setStats]           = useState({});
  const [total, setTotal]           = useState(0);
  const [loading, setLoading]       = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);

  // Paginierung & Filter
  const [search, setSearch]         = useState('');
  const [filterArt, setFilterArt]   = useState('');
  const [filterJahr, setFilterJahr] = useState('');
  const [page, setPage]             = useState(0);
  const PAGE_SIZE = 50;

  // Modal
  const [showModal, setShowModal]   = useState(false);
  const [editEntry, setEditEntry]   = useState(null);
  const [form, setForm]             = useState(LEER_FORM);
  const [saving, setSaving]         = useState(false);

  // Meldungen
  const [msg, setMsg]               = useState({ type: '', text: '' });

  // Stile + Graduierungen (aus Stilverwaltung)
  const [stile, setStile]           = useState([]);
  const [stilGrads, setStilGrads]   = useState({}); // { stilId: [{graduierung_id, name, reihenfolge, farbe_hex}] }
  const [modalStilId, setModalStilId] = useState('');
  const loadingStilIds              = useRef(new Set());

  // Vorschau
  const [previewEntry, setPreviewEntry] = useState(null);

  // Tabs
  const [activeTab, setActiveTab] = useState('register');
  const [personenUrkunden, setPersonenUrkunden] = useState([]);
  const [personenLoading, setPersonenLoading] = useState(false);
  const [personenSearch, setPersonenSearch] = useState('');
  const [personenModal, setPersonenModal] = useState(null); // { nachname, vorname, dojo_schule, urkunden[] }

  // Mitgliedersuche im Modal
  const [mitgliedSearch, setMitgliedSearch]     = useState('');
  const [modalDojoId, setModalDojoId]           = useState('');
  const [allDojos, setAllDojos]                 = useState([]);
  const [dojoMitglieder, setDojoMitglieder]     = useState([]);
  const [mitgliedLoading, setMitgliedLoading]   = useState(false);

  // =========================================================================
  // Daten laden
  // =========================================================================
  const loadStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const { data } = await axios.get('/verband-urkunden/stats', { headers });
      if (data.success) setStats(data.stats || {});
    } catch {}
    finally { setStatsLoading(false); }
  }, [token]);

  const loadUrkunden = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
        ...(search    && { search }),
        ...(filterArt && { art: filterArt }),
        ...(filterJahr && { jahr: filterJahr }),
      };
      const { data } = await axios.get('/verband-urkunden', { headers, params });
      if (data.success) {
        setUrkunden(data.urkunden || []);
        setTotal(data.total || 0);
      }
    } catch {}
    finally { setLoading(false); }
  }, [token, search, filterArt, filterJahr, page]);

  const loadPersonenUrkunden = useCallback(async () => {
    setPersonenLoading(true);
    try {
      const { data } = await axios.get('/verband-urkunden', { headers, params: { limit: 9999, offset: 0 } });
      if (data.success) setPersonenUrkunden(data.urkunden || []);
    } catch {}
    finally { setPersonenLoading(false); }
  }, [token]);

  useEffect(() => {
    if (activeTab === 'personen') loadPersonenUrkunden();
  }, [activeTab, loadPersonenUrkunden]);

  const loadStile = useCallback(async () => {
    try {
      const { data } = await axios.get('/stile?aktiv=true', { headers });
      setStile(Array.isArray(data) ? data : []);
    } catch {}
  }, [token]);

  const loadStilGrads = useCallback(async (stilId) => {
    const key = String(stilId);
    if (!key || loadingStilIds.current.has(key) || stilGrads[key]) return;
    loadingStilIds.current.add(key);
    try {
      const { data } = await axios.get(`/stile/${key}/graduierungen`, { headers });
      setStilGrads(prev => ({ ...prev, [key]: Array.isArray(data) ? data : [] }));
    } catch {
      loadingStilIds.current.delete(key);
    }
  }, [token, stilGrads]);

  useEffect(() => { loadStats(); }, [loadStats]);
  useEffect(() => { loadStile(); }, [loadStile]);
  useEffect(() => { setPage(0); }, [search, filterArt, filterJahr]);
  useEffect(() => { loadUrkunden(); }, [loadUrkunden]);

  // =========================================================================
  // Hilfs-Funktionen
  // =========================================================================
  const showMsg = (type, text) => {
    setMsg({ type, text });
    setTimeout(() => setMsg({ type: '', text: '' }), 4000);
  };

  const openCreate = async () => {
    setEditEntry(null);
    setModalStilId('');
    setMitgliedSearch('');
    setDojoMitglieder([]);
    setModalDojoId('');
    const base = { ...LEER_FORM };
    // Auto-Nummer vorschlagen (YYYYMMDD-XXXXX)
    try {
      const { data } = await axios.get('/verband-urkunden/naechste-nummer', { headers });
      if (data.success) base.urkundennummer = data.nummer;
    } catch {}
    setForm(base);
    setShowModal(true);
  };

  const openEdit = (u) => {
    setEditEntry(u);
    // pruefer kann als JSON-String oder Array vom Backend kommen
    let pruefer = [''];
    if (u.pruefer) {
      const parsed = typeof u.pruefer === 'string' ? JSON.parse(u.pruefer) : u.pruefer;
      pruefer = Array.isArray(parsed) && parsed.length ? parsed : [''];
    }
    setMitgliedSearch(u.mitglied_id ? `${u.vorname} ${u.nachname}` : '');
    setMitgliedResults([]);
    setModalDojoId(u.dojo_id ? String(u.dojo_id) : '');
    setForm({
      urkundennummer: u.urkundennummer || '',
      art:            u.art,
      vorname:        u.vorname,
      nachname:       u.nachname,
      geburtsdatum:   u.geburtsdatum?.split('T')[0] || '',
      email:          u.email || '',
      telefon:        u.telefon || '',
      strasse:        u.strasse || '',
      plz:            u.plz || '',
      ort:            u.ort || '',
      land:           u.land || 'Deutschland',
      grad:           u.grad || '',
      disziplin:      u.disziplin || '',
      ausstellungsdatum: u.ausstellungsdatum?.split('T')[0] || '',
      ausgestellt_von: u.ausgestellt_von || '',
      pruefer,
      dojo_schule:    u.dojo_schule || '',
      notizen:        u.notizen || '',
      mitglied_id:    u.mitglied_id || null,
      dojo_id:        u.dojo_id || null,
    });
    // Passenden Stil vorauswählen anhand Disziplin
    const matchedStil = stile.find(s => s.name.toLowerCase() === (u.disziplin || '').toLowerCase());
    if (matchedStil) {
      setModalStilId(String(matchedStil.stil_id));
      loadStilGrads(matchedStil.stil_id);
    } else {
      setModalStilId('');
    }
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditEntry(null);
    setModalStilId('');
    setMitgliedSearch('');
    setDojoMitglieder([]);
    setModalDojoId('');
  };

  // Dojos laden (einmalig beim Mount)
  useEffect(() => {
    axios.get('/dojos', { headers })
      .then(({ data }) => setAllDojos(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, [token]);

  // Mitglieder für gewähltes Dojo laden
  const loadDojoMitglieder = useCallback(async (dojoId) => {
    if (!dojoId) { setDojoMitglieder([]); return; }
    setMitgliedLoading(true);
    try {
      const { data } = await axios.get('/mitglieder', { headers, params: { dojo_id: dojoId } });
      setDojoMitglieder(Array.isArray(data) ? data : []);
    } catch {
      setDojoMitglieder([]);
    } finally {
      setMitgliedLoading(false);
    }
  }, [token]);

  // Client-seitige Filterung
  const mitgliedResults = (() => {
    const term = mitgliedSearch.trim().toLowerCase();
    if (term.length < 2 || form.mitglied_id) return [];
    return dojoMitglieder.filter(m =>
      m.nachname?.toLowerCase().includes(term) ||
      m.vorname?.toLowerCase().includes(term)
    ).slice(0, 10);
  })();

  const handleMitgliedSelect = (m) => {
    const strasse = [m.adresse, m.hausnummer].filter(Boolean).join(' ');
    setForm(f => ({
      ...f,
      vorname:      m.vorname || f.vorname,
      nachname:     m.nachname || f.nachname,
      geburtsdatum: m.geburtsdatum?.split('T')[0] || f.geburtsdatum,
      email:        m.email || f.email,
      telefon:      m.telefon_mobil || m.telefon || f.telefon,
      strasse:      strasse || f.strasse,
      plz:          m.plz || f.plz,
      ort:          m.ort || f.ort,
      land:         m.land || f.land || 'Deutschland',
      mitglied_id:  m.mitglied_id,
      dojo_id:      m.dojo_id || parseInt(modalDojoId) || null,
    }));
    setMitgliedSearch(`${m.vorname} ${m.nachname}`);
  };

  const handleStilChange = (stilId) => {
    setModalStilId(stilId);
    if (stilId) {
      const stil = stile.find(s => String(s.stil_id) === stilId);
      if (stil) setForm(f => ({ ...f, disziplin: stil.name, grad: '' }));
      loadStilGrads(stilId);
    }
  };

  const handleArtChange = (art) => {
    const update = { art };
    if (art === 'kickboxen_schuelergrad') {
      update.disziplin = 'Kickboxen';
      const kickStil = stile.find(s => s.name.toLowerCase().includes('kickbox'));
      if (kickStil) {
        setModalStilId(String(kickStil.stil_id));
        loadStilGrads(kickStil.stil_id);
      }
    }
    if (art === 'aikido_schuelergrad') {
      update.disziplin = 'Aikido';
      const aikidoStil = stile.find(s => s.name.toLowerCase().includes('aikido'));
      if (aikidoStil) {
        setModalStilId(String(aikidoStil.stil_id));
        loadStilGrads(aikidoStil.stil_id);
      }
    }
    setForm(f => ({ ...f, ...update }));
  };

  const handleSave = async () => {
    if (!form.vorname.trim() || !form.nachname.trim()) {
      showMsg('error', 'Vorname und Nachname sind Pflichtfelder');
      return;
    }
    if (!form.ausstellungsdatum) {
      showMsg('error', 'Ausstellungsdatum ist ein Pflichtfeld');
      return;
    }
    setSaving(true);
    try {
      if (editEntry) {
        const { data } = await axios.put(`/verband-urkunden/${editEntry.id}`, form, { headers });
        if (!data.success) throw new Error(data.message);
        showMsg('success', 'Eintrag aktualisiert');
      } else {
        const { data } = await axios.post('/verband-urkunden', form, { headers });
        if (!data.success) throw new Error(data.message);
        showMsg('success', 'Urkunde eingetragen');
      }
      closeModal();
      loadUrkunden();
      loadStats();
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Fehler beim Speichern';
      showMsg('error', msg);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id, name) => {
    if (!confirm(`Eintrag für ${name} wirklich löschen?`)) return;
    try {
      await axios.delete(`/verband-urkunden/${id}`, { headers });
      showMsg('success', 'Eintrag gelöscht');
      loadUrkunden();
      loadStats();
    } catch {
      showMsg('error', 'Fehler beim Löschen');
    }
  };

  // =========================================================================
  // Export (einfaches CSV)
  // =========================================================================
  const handleExport = () => {
    const cols = ['Nummer', 'Art', 'Nachname', 'Vorname', 'Geburtsdatum', 'Grad',
                  'Disziplin', 'Ausstellungsdatum', 'Aussteller', 'Schule/Dojo',
                  'Straße', 'PLZ', 'Ort', 'Land', 'E-Mail', 'Telefon', 'Notizen'];
    const rows = urkunden.map(u => [
      u.urkundennummer || '', ARTEN[u.art]?.label || u.art,
      u.nachname, u.vorname,
      u.geburtsdatum ? new Date(u.geburtsdatum).toLocaleDateString('de-DE') : '',
      u.grad || '', u.disziplin || '',
      u.ausstellungsdatum ? new Date(u.ausstellungsdatum).toLocaleDateString('de-DE') : '',
      u.ausgestellt_von || '', u.dojo_schule || '',
      u.strasse || '', u.plz || '', u.ort || '', u.land || '',
      u.email || '', u.telefon || '', u.notizen || ''
    ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(';'));

    const csv = [cols.join(';'), ...rows].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `urkundenregister_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // =========================================================================
  // Render Hilfsfunktionen
  // =========================================================================
  const ArtBadge = ({ art }) => {
    const cfg = ARTEN[art] || ARTEN.sonstiges;
    const Icon = cfg.icon;
    return (
      <span className="ur-art-badge" style={{ '--art-color': cfg.color }}>
        <Icon size={12} /> {cfg.label}
      </span>
    );
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  // =========================================================================
  // Render
  // =========================================================================
  return (
    <div className="ur-root">

      {/* Header */}
      <div className="ur-header">
        <div className="ur-header-left">
          <Scroll size={22} className="ur-header-icon" />
          <div>
            <h2 className="ur-title">Urkundenregister</h2>
            <p className="ur-subtitle">Prüfungs- & DAN-Urkunden, Trainer- und Kampfrichterlizenzen</p>
          </div>
        </div>
        <div className="ur-header-actions">
          <button className="ur-btn-export" onClick={handleExport} title="CSV-Export">
            <Download size={15} /> Export
          </button>
          <button className="ur-btn-refresh" onClick={() => { loadUrkunden(); loadStats(); }} title="Aktualisieren">
            <RefreshCw size={15} />
          </button>
          <button className="ur-btn-create" onClick={openCreate}>
            <Plus size={16} /> Neue Eintragung
          </button>
        </div>
      </div>

      {/* Meldung */}
      {msg.text && (
        <div className={`ur-msg ur-msg--${msg.type}`}>
          {msg.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
          {msg.text}
        </div>
      )}

      {/* Stats */}
      <div className="ur-stats">
        {[
          { key: 'gesamt',                 label: 'Gesamt',             color: 'var(--primary)' },
          { key: 'pruefungsurkunden',       label: 'Prüfungsurkunden',   color: '#3b82f6' },
          { key: 'dan_urkunden',            label: 'DAN-Urkunden',       color: '#d4af37' },
          { key: 'board_of_black_belts',    label: 'Board of Black Belts', color: '#c0392b' },
          { key: 'trainer_lizenzen',        label: 'Trainer',            color: '#10b981' },
          { key: 'kampfrichter_lizenzen',   label: 'Kampfrichter',       color: '#f97316' },
          { key: 'dieses_jahr',             label: 'Dieses Jahr',        color: '#a855f7' },
        ].map(s => (
          <div key={s.key} className="ur-stat-item">
            <span className="ur-stat-number" style={{ color: s.color }}>
              {statsLoading ? '…' : (stats[s.key] || 0)}
            </span>
            <span className="ur-stat-label">{s.label}</span>
          </div>
        ))}
      </div>

      {/* Tab-Bar */}
      <div style={{ display: 'flex', gap: '4px', padding: '0 0 12px 0', borderBottom: '1px solid rgba(255,255,255,0.08)', marginBottom: '16px' }}>
        {[
          { key: 'register', label: 'Register', icon: <Scroll size={14} /> },
          { key: 'personen', label: 'Nach Person', icon: <User size={14} /> },
        ].map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '7px 16px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 600,
              border: activeTab === t.key ? '1px solid rgba(99,102,241,0.5)' : '1px solid rgba(255,255,255,0.08)',
              background: activeTab === t.key ? 'rgba(99,102,241,0.18)' : 'rgba(255,255,255,0.04)',
              color: activeTab === t.key ? '#a5b4fc' : '#94a3b8',
              transition: 'all 0.15s',
            }}>
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      {/* ── TAB: REGISTER ── */}
      {activeTab === 'register' && <>

      {/* Filter-Leiste */}
      <div className="ur-filter-bar">
        <div className="ur-search-wrap">
          <Search size={15} className="ur-search-icon" />
          <input
            type="text"
            className="ur-search-input"
            placeholder="Name, Urkundennummer, Ort, Grad …"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && (
            <button className="ur-search-clear" onClick={() => setSearch('')}>
              <X size={14} />
            </button>
          )}
        </div>

        <select
          className="ur-filter-select"
          value={filterArt}
          onChange={e => setFilterArt(e.target.value)}
        >
          <option value="">Alle Arten</option>
          {Object.entries(ARTEN).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>

        <select
          className="ur-filter-select"
          value={filterJahr}
          onChange={e => setFilterJahr(e.target.value)}
        >
          <option value="">Alle Jahre</option>
          {Array.from({ length: 30 }, (_, i) => new Date().getFullYear() - i).map(y => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>

      {/* Tabelle */}
      <div className="ur-table-wrap">
        {loading ? (
          <div className="ur-loading">
            <div className="ur-spinner" />
            <span>Lade Einträge …</span>
          </div>
        ) : urkunden.length === 0 ? (
          <div className="ur-empty">
            <Scroll size={40} className="ur-empty-icon" />
            <h4>Keine Einträge</h4>
            <p>Noch keine Urkunden eingetragen{search || filterArt ? ' — Filter anpassen' : ''}.</p>
            <button className="ur-btn-create" onClick={openCreate}>
              <Plus size={15} /> Ersten Eintrag anlegen
            </button>
          </div>
        ) : (
          <table className="ur-table">
            <thead>
              <tr>
                <th>Nummer</th>
                <th>Art</th>
                <th>Name</th>
                <th>Grad</th>
                <th>Ausgestellt am</th>
                <th>Aussteller</th>
                <th>Prüfer</th>
                <th className="ur-th-actions"></th>
              </tr>
            </thead>
            <tbody>
              {urkunden.map(u => (
                <tr key={u.id} className="ur-row">
                  <td className="ur-cell-nummer">
                    {u.urkundennummer
                      ? <code className="ur-nummer">{u.urkundennummer}</code>
                      : <span className="ur-no-nummer">—</span>}
                  </td>
                  <td><ArtBadge art={u.art} /></td>
                  <td className="ur-cell-name">
                    <strong>{u.nachname}</strong>, {u.vorname}
                    {u.ort && <span className="ur-cell-ort"><MapPin size={11} /> {u.plz} {u.ort}</span>}
                  </td>
                  <td>
                    {u.grad
                      ? <span className="ur-grad-badge">{u.grad}</span>
                      : '—'}
                  </td>
                  <td className="ur-cell-date">
                    {u.ausstellungsdatum
                      ? new Date(u.ausstellungsdatum).toLocaleDateString('de-DE')
                      : '—'}
                  </td>
                  <td>{u.ausgestellt_von || '—'}</td>
                  <td className="ur-cell-pruefer">
                    {(() => {
                      const list = u.pruefer
                        ? (typeof u.pruefer === 'string' ? JSON.parse(u.pruefer) : u.pruefer)
                        : [];
                      return list.length
                        ? list.map((p, i) => <span key={i} className="ur-pruefer-tag">{p}</span>)
                        : <span className="ur-no-nummer">—</span>;
                    })()}
                  </td>
                  <td className="ur-cell-actions">
                    {u.art === 'board_of_black_belts' && (
                      <button
                        className="ur-action-btn ur-action-btn--print"
                        onClick={() => druckeBoB(u)}
                        title="Board of Black Belts drucken"
                      >
                        <Printer size={14} />
                      </button>
                    )}
                    {u.art === 'kickboxen_schuelergrad' && (
                      <button
                        className="ur-action-btn ur-action-btn--print"
                        onClick={() => druckeKickboxSchuelergrad(u)}
                        title="Kickboxen Schülergrad drucken"
                      >
                        <Printer size={14} />
                      </button>
                    )}
                    {u.art === 'aikido_schuelergrad' && (
                      <button
                        className="ur-action-btn ur-action-btn--print"
                        onClick={() => druckeAikidoSchuelergrad(u)}
                        title="Aikido Schülergrad drucken"
                      >
                        <Printer size={14} />
                      </button>
                    )}
                    <button
                      className="ur-action-btn"
                      onClick={() => setPreviewEntry(u)}
                      title="Vorschau"
                    >
                      <Eye size={14} />
                    </button>
                    <button
                      className="ur-action-btn"
                      onClick={() => openEdit(u)}
                      title="Bearbeiten"
                    >
                      <Edit3 size={14} />
                    </button>
                    <button
                      className="ur-action-btn ur-action-btn--danger"
                      onClick={() => handleDelete(u.id, `${u.vorname} ${u.nachname}`)}
                      title="Löschen"
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Paginierung */}
      {totalPages > 1 && (
        <div className="ur-pagination">
          <button
            className="ur-page-btn"
            onClick={() => setPage(p => Math.max(0, p - 1))}
            disabled={page === 0}
          >
            <ChevronLeft size={16} />
          </button>
          <span className="ur-page-info">
            Seite {page + 1} von {totalPages} · {total} Einträge
          </span>
          <button
            className="ur-page-btn"
            onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
          >
            <ChevronRight size={16} />
          </button>
        </div>
      )}

      {/* Ende Register-Tab */}
      </>}

      {/* ── TAB: NACH PERSON ── */}
      {activeTab === 'personen' && (() => {
        // Gruppierung nach Person
        const grouped = {};
        personenUrkunden.forEach(u => {
          const key = `${u.nachname}||${u.vorname}`;
          if (!grouped[key]) grouped[key] = { nachname: u.nachname, vorname: u.vorname, dojo_schule: u.dojo_schule, urkunden: [] };
          grouped[key].urkunden.push(u);
        });
        const personen = Object.values(grouped).sort((a, b) => a.nachname.localeCompare(b.nachname, 'de'));
        const filtered = personenSearch.trim()
          ? personen.filter(p => `${p.nachname} ${p.vorname}`.toLowerCase().includes(personenSearch.toLowerCase()))
          : personen;

        return (
          <div>
            {/* Suche */}
            <div className="ur-filter-bar" style={{ marginBottom: '20px' }}>
              <div className="ur-search-wrap">
                <Search size={15} className="ur-search-icon" />
                <input type="text" className="ur-search-input" placeholder="Name suchen …"
                  value={personenSearch} onChange={e => setPersonenSearch(e.target.value)} />
                {personenSearch && <button className="ur-search-clear" onClick={() => setPersonenSearch('')}><X size={14} /></button>}
              </div>
              <span style={{ fontSize: '14px', color: '#94a3b8', marginLeft: 'auto', alignSelf: 'center' }}>
                {filtered.length} Person{filtered.length !== 1 ? 'en' : ''}
              </span>
            </div>

            {/* Personen-Cards (klickbar) */}
            {personenLoading ? (
              <div className="ur-loading"><div className="ur-spinner" /><span>Lade …</span></div>
            ) : filtered.length === 0 ? (
              <div className="ur-empty"><User size={36} className="ur-empty-icon" /><h4>Keine Personen gefunden</h4></div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: '14px' }}>
                {filtered.map(p => {
                  const initials = `${(p.vorname||'')[0]||''}${(p.nachname||'')[0]||''}`.toUpperCase();
                  return (
                    <div key={`${p.nachname}||${p.vorname}`}
                      onClick={() => setPersonenModal(p)}
                      style={{
                        background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)',
                        borderRadius: '14px', padding: '22px 20px', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: '16px',
                        transition: 'all 0.15s', position: 'relative',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background='rgba(99,102,241,0.08)'; e.currentTarget.style.borderColor='rgba(99,102,241,0.35)'; e.currentTarget.style.transform='translateY(-2px)'; }}
                      onMouseLeave={e => { e.currentTarget.style.background='rgba(255,255,255,0.04)'; e.currentTarget.style.borderColor='rgba(255,255,255,0.09)'; e.currentTarget.style.transform='translateY(0)'; }}
                    >
                      {/* Avatar mit Initialen */}
                      <div style={{ width: '52px', height: '52px', borderRadius: '50%', background: 'linear-gradient(135deg,rgba(99,102,241,0.35),rgba(139,92,246,0.35))', border: '1.5px solid rgba(99,102,241,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '18px', fontWeight: 700, color: '#a5b4fc', letterSpacing: '0.5px' }}>
                        {initials || <User size={20} color="#818cf8" />}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, color: '#e2e8f0', fontSize: '16px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.nachname}, {p.vorname}</div>
                        {p.dojo_schule && <div style={{ fontSize: '12px', color: '#64748b', marginTop: '3px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.dojo_schule}</div>}
                      </div>
                      <div style={{ flexShrink: 0, fontSize: '13px', fontWeight: 700, color: '#818cf8', background: 'rgba(99,102,241,0.14)', border: '1px solid rgba(99,102,241,0.3)', padding: '4px 10px', borderRadius: '20px', minWidth: '44px', textAlign: 'center' }}>
                        {p.urkunden.length}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })()}

      {/* ── PERSONEN-DETAIL-MODAL ── */}
      {personenModal && (() => {
        const p = personenModal;
        const initials = `${(p.vorname||'')[0]||''}${(p.nachname||'')[0]||''}`.toUpperCase();
        return (
          <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', backdropFilter:'blur(4px)', zIndex:9000, display:'flex', alignItems:'center', justifyContent:'center', padding:'20px' }}
            onClick={() => setPersonenModal(null)}>
            <div style={{ background:'#1a1f2e', border:'1px solid rgba(255,255,255,0.12)', borderRadius:'18px', width:'100%', maxWidth:'680px', maxHeight:'88vh', display:'flex', flexDirection:'column', overflow:'hidden', boxShadow:'0 24px 60px rgba(0,0,0,0.6)' }}
              onClick={e => e.stopPropagation()}>

              {/* Modal-Header */}
              <div style={{ padding:'28px 32px 24px', borderBottom:'1px solid rgba(255,255,255,0.08)', display:'flex', alignItems:'center', gap:'18px', flexShrink:0 }}>
                <div style={{ width:'64px', height:'64px', borderRadius:'50%', background:'linear-gradient(135deg,rgba(99,102,241,0.4),rgba(139,92,246,0.4))', border:'2px solid rgba(99,102,241,0.5)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'24px', fontWeight:700, color:'#a5b4fc', letterSpacing:'0.5px', flexShrink:0 }}>
                  {initials || <User size={28} color="#818cf8" />}
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:'24px', fontWeight:700, color:'#f1f5f9', letterSpacing:'-0.3px' }}>{p.vorname} {p.nachname}</div>
                  {p.dojo_schule && <div style={{ fontSize:'14px', color:'#64748b', marginTop:'4px' }}>{p.dojo_schule}</div>}
                </div>
                <div style={{ flexShrink:0, textAlign:'right' }}>
                  <div style={{ fontSize:'28px', fontWeight:800, color:'#818cf8' }}>{p.urkunden.length}</div>
                  <div style={{ fontSize:'11px', color:'#64748b', textTransform:'uppercase', letterSpacing:'0.8px' }}>Urkunde{p.urkunden.length !== 1 ? 'n' : ''}</div>
                </div>
                <button onClick={() => setPersonenModal(null)} style={{ background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)', color:'#94a3b8', cursor:'pointer', borderRadius:'8px', padding:'8px', display:'flex', alignItems:'center', flexShrink:0, marginLeft:'4px' }}>
                  <X size={18} />
                </button>
              </div>

              {/* Urkunden-Liste im Modal */}
              <div style={{ overflowY:'auto', padding:'24px 32px', display:'flex', flexDirection:'column', gap:'12px' }}>
                {p.urkunden.sort((a,b) => new Date(b.ausstellungsdatum||0) - new Date(a.ausstellungsdatum||0)).map(u => {
                  const art = ARTEN[u.art] || ARTEN.sonstiges;
                  const Icon = art.icon;
                  const datum = u.ausstellungsdatum
                    ? new Date(u.ausstellungsdatum).toLocaleDateString('de-DE', { day:'2-digit', month:'long', year:'numeric' })
                    : '—';
                  const canPrint = ['board_of_black_belts','kickboxen_schuelergrad','aikido_schuelergrad'].includes(u.art);
                  return (
                    <div key={u.id} style={{ background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)', borderLeft:`4px solid ${art.color}`, borderRadius:'12px', padding:'18px 20px' }}>
                      {/* Type + Actions */}
                      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'12px' }}>
                        <span style={{ display:'inline-flex', alignItems:'center', gap:'6px', padding:'5px 12px', borderRadius:'6px', fontSize:'13px', fontWeight:700, background:`${art.color}22`, color:art.color, border:`1px solid ${art.color}44` }}>
                          <Icon size={13} />{art.label}
                        </span>
                        <div style={{ display:'flex', gap:'8px' }}>
                          {canPrint && (
                            <button onClick={() => {
                              setPersonenModal(null);
                              setTimeout(() => {
                                if (u.art === 'board_of_black_belts') druckeBoB(u);
                                else if (u.art === 'kickboxen_schuelergrad') druckeKickboxSchuelergrad(u);
                                else druckeAikidoSchuelergrad(u);
                              }, 100);
                            }} style={{ display:'inline-flex', alignItems:'center', gap:'6px', padding:'7px 14px', borderRadius:'8px', background:'rgba(99,102,241,0.15)', border:'1px solid rgba(99,102,241,0.35)', color:'#818cf8', cursor:'pointer', fontSize:'13px', fontWeight:600 }}>
                              <Printer size={14} />Drucken
                            </button>
                          )}
                          <button onClick={() => { setPersonenModal(null); setTimeout(() => setPreviewEntry(u), 100); }} style={{ display:'inline-flex', alignItems:'center', gap:'6px', padding:'7px 14px', borderRadius:'8px', background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.12)', color:'#94a3b8', cursor:'pointer', fontSize:'13px', fontWeight:600 }}>
                            <Eye size={14} />Vorschau
                          </button>
                          <button onClick={() => { setPersonenModal(null); setTimeout(() => openEdit(u), 100); }} style={{ display:'inline-flex', alignItems:'center', gap:'6px', padding:'7px 14px', borderRadius:'8px', background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.12)', color:'#94a3b8', cursor:'pointer', fontSize:'13px', fontWeight:600 }}>
                            <Edit3 size={14} />Bearbeiten
                          </button>
                        </div>
                      </div>
                      {/* Details */}
                      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px 24px' }}>
                        {u.grad && (
                          <div>
                            <div style={{ fontSize:'11px', color:'#64748b', textTransform:'uppercase', letterSpacing:'0.7px', marginBottom:'2px' }}>Grad / Stufe</div>
                            <div style={{ fontSize:'16px', fontWeight:600, color:'#e2e8f0' }}>{u.grad}</div>
                          </div>
                        )}
                        <div>
                          <div style={{ fontSize:'11px', color:'#64748b', textTransform:'uppercase', letterSpacing:'0.7px', marginBottom:'2px' }}>Ausgestellt am</div>
                          <div style={{ fontSize:'16px', fontWeight:600, color:'#e2e8f0' }}>{datum}</div>
                        </div>
                        {u.urkundennummer && (
                          <div>
                            <div style={{ fontSize:'11px', color:'#64748b', textTransform:'uppercase', letterSpacing:'0.7px', marginBottom:'2px' }}>Urkundennummer</div>
                            <div style={{ fontSize:'15px', fontWeight:600, color:'#a5b4fc', fontFamily:'monospace', letterSpacing:'1px' }}>{u.urkundennummer}</div>
                          </div>
                        )}
                        {u.disziplin && (
                          <div>
                            <div style={{ fontSize:'11px', color:'#64748b', textTransform:'uppercase', letterSpacing:'0.7px', marginBottom:'2px' }}>Disziplin</div>
                            <div style={{ fontSize:'15px', fontWeight:600, color:'#cbd5e1' }}>{u.disziplin}</div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })()}

      {/* =====================================================================
          MODAL: Erstellen / Bearbeiten
         ===================================================================== */}
      {showModal && (
        <div className="ur-overlay" onClick={closeModal}>
          <div className="ur-modal" onClick={e => e.stopPropagation()}>

            <div className="ur-modal-header">
              <h2>
                <Scroll size={18} />
                {editEntry ? 'Eintrag bearbeiten' : 'Neue Urkunde / Lizenz eintragen'}
              </h2>
              <button className="ur-close-btn" onClick={closeModal}><X size={18} /></button>
            </div>

            <div className="ur-modal-body">
              <div className="ur-modal-cols">

                {/* ══════════════════════════════════════
                    LINKE SPALTE — Urkunden-Details
                    ══════════════════════════════════════ */}
                <div className="ur-modal-col">
                  <div className="ur-section-title">Urkunden-Details</div>

                  <div className="ur-field">
                    <label>Art der Urkunde *</label>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '6px', marginTop: '4px' }}>
                      {Object.entries(ARTEN).map(([k, v]) => {
                        const sel = form.art === k;
                        const Icon = v.icon;
                        return (
                          <button key={k} type="button"
                            onClick={() => handleArtChange(k)}
                            title={v.label}
                            style={{
                              background: sel ? `${v.color}22` : 'rgba(255,255,255,0.04)',
                              border: `2px solid ${sel ? v.color : 'rgba(255,255,255,0.1)'}`,
                              borderRadius: '7px', padding: '5px 4px', cursor: 'pointer',
                              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px',
                              transition: 'all 0.15s', position: 'relative',
                            }}>
                            {/* Thumbnail oder Icon */}
                            <div style={{
                              width: '100%', aspectRatio: '297/210', borderRadius: '4px',
                              overflow: 'hidden', position: 'relative',
                              background: v.img ? 'transparent' : `${v.color}18`,
                              border: `1px solid ${v.img ? 'rgba(255,255,255,0.08)' : 'transparent'}`,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}>
                              {v.img
                                ? <img src={v.img} alt={v.label} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                                : <Icon size={14} color={v.color} />
                              }
                              {sel && (
                                <div style={{ position: 'absolute', top: '2px', right: '2px', background: v.color, borderRadius: '50%', width: '12px', height: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '8px', color: '#fff', lineHeight: 1 }}>✓</div>
                              )}
                            </div>
                            <span style={{ fontSize: '9px', color: sel ? '#e2e8f0' : '#94a3b8', fontWeight: sel ? 600 : 400, textAlign: 'center', lineHeight: 1.2, wordBreak: 'break-word' }}>
                              {v.label}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="ur-field">
                    <label>Urkundennummer / Lizenznummer</label>
                    <input
                      type="text"
                      className="ur-input"
                      value={form.urkundennummer}
                      onChange={e => setForm(f => ({ ...f, urkundennummer: e.target.value }))}
                      placeholder="z.B. TDA-DAN-2026-0001"
                    />
                  </div>

                  <div className="ur-field">
                    <label>Stil / Disziplin</label>
                    <select
                      className="ur-select"
                      value={modalStilId}
                      onChange={e => handleStilChange(e.target.value)}
                    >
                      <option value="">— frei eintragen —</option>
                      {stile.map(s => (
                        <option key={s.stil_id} value={String(s.stil_id)}>{s.name}</option>
                      ))}
                    </select>
                  </div>

                  {!modalStilId && (
                    <div className="ur-field">
                      <label>Disziplin / Sportart (manuell)</label>
                      <input
                        type="text"
                        className="ur-input"
                        value={form.disziplin}
                        onChange={e => setForm(f => ({ ...f, disziplin: e.target.value }))}
                        placeholder="z.B. Karate, Judo"
                      />
                    </div>
                  )}

                  <div className="ur-field">
                    <label>Grad / Rang</label>
                    <select
                      className="ur-select"
                      value={form.grad}
                      onChange={e => setForm(f => ({ ...f, grad: e.target.value }))}
                    >
                      {modalStilId && stilGrads[modalStilId]
                        ? <>
                            <option value="">— nicht angegeben —</option>
                            {[...stilGrads[modalStilId]]
                              .sort((a, b) => a.reihenfolge - b.reihenfolge)
                              .map(g => (
                                <option key={g.graduierung_id} value={g.name}>{g.name}</option>
                              ))}
                          </>
                        : GRADE.map(g => <option key={g} value={g}>{g || '— nicht angegeben —'}</option>)
                      }
                    </select>
                  </div>

                  <div className="ur-form-row">
                    <div className="ur-field">
                      <label>Ausstellungsdatum *</label>
                      <input
                        type="date"
                        className="ur-input"
                        value={form.ausstellungsdatum}
                        onChange={e => setForm(f => ({ ...f, ausstellungsdatum: e.target.value }))}
                      />
                    </div>
                    <div className="ur-field">
                      <label>Ausgestellt von</label>
                      <input
                        type="text"
                        className="ur-input"
                        value={form.ausgestellt_von}
                        onChange={e => setForm(f => ({ ...f, ausgestellt_von: e.target.value }))}
                        placeholder="Name des Unterzeichners"
                      />
                    </div>
                  </div>

                  <div className="ur-field">
                    <label>Dojo / Schule des Kandidaten</label>
                    <input
                      type="text"
                      className="ur-input"
                      value={form.dojo_schule}
                      onChange={e => setForm(f => ({ ...f, dojo_schule: e.target.value }))}
                      placeholder="z.B. Kampfkunstschule Muster"
                    />
                  </div>

                  {/* Prüfer */}
                  <div className="ur-field">
                    <div className="ur-pruefer-header">
                      <label>Prüfer ({form.pruefer.length}/5)</label>
                      {form.pruefer.length < 5 && (
                        <button
                          type="button"
                          className="ur-pruefer-add"
                          onClick={() => setForm(f => ({ ...f, pruefer: [...f.pruefer, ''] }))}
                        >
                          <Plus size={13} /> hinzufügen
                        </button>
                      )}
                    </div>
                    <div className="ur-pruefer-list">
                      {form.pruefer.map((p, i) => (
                        <div key={i} className="ur-pruefer-row">
                          <span className="ur-pruefer-num">{i + 1}.</span>
                          <input
                            type="text"
                            className="ur-input"
                            value={p}
                            onChange={e => {
                              const next = [...form.pruefer];
                              next[i] = e.target.value;
                              setForm(f => ({ ...f, pruefer: next }));
                            }}
                            placeholder={`Prüfer ${i + 1}`}
                          />
                          {form.pruefer.length > 1 && (
                            <button
                              type="button"
                              className="ur-pruefer-remove"
                              onClick={() => setForm(f => ({
                                ...f,
                                pruefer: f.pruefer.filter((_, idx) => idx !== i)
                              }))}
                              title="Entfernen"
                            >
                              <X size={14} />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* ══════════════════════════════════════
                    RECHTE SPALTE — Person + Adresse
                    ══════════════════════════════════════ */}
                <div className="ur-modal-col">

                  {/* Mitgliedersuche */}
                  <div className="ur-section-title">Mitglied aus Dojo suchen</div>

                  <div className="ur-field">
                    <label>Dojo auswählen</label>
                    <select
                      className="ur-select"
                      value={modalDojoId}
                      onChange={e => {
                        const id = e.target.value;
                        setModalDojoId(id);
                        setMitgliedSearch('');
                        setForm(f => ({ ...f, dojo_id: id ? parseInt(id) : null, mitglied_id: null }));
                        loadDojoMitglieder(id);
                      }}
                    >
                      <option value="">— Dojo wählen —</option>
                      {allDojos.map(d => (
                        <option key={d.id || d.dojo_id} value={String(d.id || d.dojo_id)}>
                          {d.name || d.dojoname}
                        </option>
                      ))}
                    </select>
                  </div>

                  {modalDojoId && (
                    <div className="ur-mitglied-search-wrap">
                      <div className="ur-field">
                        <label>
                          Name suchen
                          {mitgliedLoading && <span className="ur-mitglied-loading"> (lade…)</span>}
                        </label>
                        <div className="ur-mitglied-input-wrap">
                          <Search size={14} className="ur-mitglied-icon" />
                          <input
                            type="text"
                            className="ur-input ur-mitglied-input"
                            placeholder={dojoMitglieder.length ? `Aus ${dojoMitglieder.length} Mitgliedern suchen …` : 'Name eingeben …'}
                            value={mitgliedSearch}
                            disabled={!!form.mitglied_id}
                            onChange={e => {
                              setMitgliedSearch(e.target.value);
                              if (form.mitglied_id) setForm(f => ({ ...f, mitglied_id: null }));
                            }}
                          />
                        </div>
                      </div>

                      {mitgliedResults.length > 0 && (
                        <div className="ur-mitglied-dropdown">
                          {mitgliedResults.map(m => (
                            <div
                              key={m.mitglied_id}
                              className="ur-mitglied-item"
                              onClick={() => handleMitgliedSelect(m)}
                            >
                              <span className="ur-mitglied-name">{m.nachname}, {m.vorname}</span>
                              <span className="ur-mitglied-sub">{m.plz} {m.ort}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {form.mitglied_id && (
                        <div className="ur-mitglied-linked">
                          <CheckCircle size={13} />
                          <span>Mitglied verknüpft (ID {form.mitglied_id})</span>
                          <button
                            type="button"
                            className="ur-mitglied-unlink"
                            onClick={() => { setForm(f => ({ ...f, mitglied_id: null })); setMitgliedSearch(''); }}
                          >
                            Lösen
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="ur-section-title" style={{ marginTop: '0.25rem' }}>Person</div>

                  <div className="ur-form-row">
                    <div className="ur-field">
                      <label>Vorname *</label>
                      <input
                        type="text"
                        className="ur-input"
                        value={form.vorname}
                        onChange={e => setForm(f => ({ ...f, vorname: e.target.value }))}
                        placeholder="Vorname"
                      />
                    </div>
                    <div className="ur-field">
                      <label>Nachname *</label>
                      <input
                        type="text"
                        className="ur-input"
                        value={form.nachname}
                        onChange={e => setForm(f => ({ ...f, nachname: e.target.value }))}
                        placeholder="Nachname"
                      />
                    </div>
                  </div>

                  <div className="ur-form-row">
                    <div className="ur-field">
                      <label>Geburtsdatum</label>
                      <input
                        type="date"
                        className="ur-input"
                        value={form.geburtsdatum}
                        onChange={e => setForm(f => ({ ...f, geburtsdatum: e.target.value }))}
                      />
                    </div>
                    <div className="ur-field">
                      <label>E-Mail</label>
                      <input
                        type="email"
                        className="ur-input"
                        value={form.email}
                        onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                        placeholder="name@beispiel.de"
                      />
                    </div>
                  </div>

                  <div className="ur-field">
                    <label>Telefon</label>
                    <input
                      type="tel"
                      className="ur-input"
                      value={form.telefon}
                      onChange={e => setForm(f => ({ ...f, telefon: e.target.value }))}
                      placeholder="+49 …"
                    />
                  </div>

                  <div className="ur-section-title" style={{ marginTop: '0.75rem' }}>Adresse</div>

                  <div className="ur-field">
                    <label>Straße & Hausnummer</label>
                    <input
                      type="text"
                      className="ur-input"
                      value={form.strasse}
                      onChange={e => setForm(f => ({ ...f, strasse: e.target.value }))}
                      placeholder="Musterstraße 12"
                    />
                  </div>

                  <div className="ur-form-row">
                    <div className="ur-field">
                      <label>PLZ</label>
                      <input
                        type="text"
                        className="ur-input"
                        value={form.plz}
                        onChange={e => setForm(f => ({ ...f, plz: e.target.value }))}
                        placeholder="12345"
                      />
                    </div>
                    <div className="ur-field">
                      <label>Ort</label>
                      <input
                        type="text"
                        className="ur-input"
                        value={form.ort}
                        onChange={e => setForm(f => ({ ...f, ort: e.target.value }))}
                        placeholder="Musterstadt"
                      />
                    </div>
                  </div>

                  <div className="ur-field">
                    <label>Land</label>
                    <input
                      type="text"
                      className="ur-input"
                      value={form.land}
                      onChange={e => setForm(f => ({ ...f, land: e.target.value }))}
                      placeholder="Deutschland"
                    />
                  </div>
                </div>

              </div>{/* /ur-modal-cols */}

              {/* Notizen — volle Breite */}
              <div className="ur-field">
                <label>Notizen</label>
                <textarea
                  className="ur-textarea"
                  rows={2}
                  value={form.notizen}
                  onChange={e => setForm(f => ({ ...f, notizen: e.target.value }))}
                  placeholder="Zusätzliche Informationen …"
                />
              </div>

            </div>{/* /modal-body */}

            <div className="ur-modal-footer">
              <button className="ur-btn-cancel" onClick={closeModal} disabled={saving}>
                Abbrechen
              </button>
              <button className="ur-btn-save" onClick={handleSave} disabled={saving}>
                {saving ? 'Wird gespeichert …' : (editEntry ? 'Speichern' : 'Eintragen')}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* =====================================================================
          VORSCHAU-MODAL
         ===================================================================== */}
      {previewEntry && (() => {
        const u = previewEntry;
        const name   = `${u.vorname} ${u.nachname}`;
        const grad   = u.grad || '';
        const nr     = u.urkundennummer || '';
        const datum  = u.ausstellungsdatum
          ? new Date(u.ausstellungsdatum).toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' })
          : '';
        const isBoB     = u.art === 'board_of_black_belts';
        const isKB      = u.art === 'kickboxen_schuelergrad';
        const isAikido  = u.art === 'aikido_schuelergrad';

        return (
          <div className="ur-overlay" onClick={() => setPreviewEntry(null)}>
            <div className="ur-modal" style={{ maxWidth: '680px' }} onClick={e => e.stopPropagation()}>

              <div className="ur-modal-header">
                <h2><Eye size={18} /> Vorschau — {ARTEN[u.art]?.label || u.art}</h2>
                <button className="ur-close-btn" onClick={() => setPreviewEntry(null)}><X size={18} /></button>
              </div>

              <div className="ur-modal-body" style={{ padding: '1.25rem' }}>

                {/* BoB: Hintergrundbild mit Texten */}
                {isBoB && (
                  <div style={{ position: 'relative', width: '100%', paddingBottom: '70.7%', overflow: 'hidden', borderRadius: '6px' }}>
                    <img src="/assets/urkunde_bobb.jpg" alt="BoB Urkunde"
                      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                    <div style={{ position: 'absolute', top: '23.2%', left: '1.9%', width: '32.4%', textAlign: 'center',
                      fontFamily: "'Great Vibes', cursive", fontSize: 'clamp(10pt,2.8vw,22pt)', color: '#1a0f08', lineHeight: 1 }}>
                      {name}
                    </div>
                    <div style={{ position: 'absolute', top: '56.6%', left: '6.7%',
                      fontFamily: 'serif', fontSize: 'clamp(7pt,1.5vw,11pt)', color: '#1a0f08' }}>
                      {nr}
                    </div>
                    <div style={{ position: 'absolute', top: '60.6%', left: '4.5%',
                      fontFamily: 'serif', fontSize: 'clamp(7pt,1.5vw,11pt)', color: '#1a0f08' }}>
                      {datum}
                    </div>
                  </div>
                )}

                {/* Aikido Schülergrad: Hintergrundbild mit Texten */}
                {isAikido && (
                  <div style={{ position: 'relative', width: '100%', paddingBottom: '70.7%', overflow: 'hidden', borderRadius: '6px' }}>
                    <img src="/assets/urkunde_aikido.jpg" alt="Aikido Urkunde"
                      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                    {/* Name ~35% von oben, rechte Hälfte */}
                    <div style={{ position: 'absolute', top: '35%', left: '45.5%', width: '49.5%', textAlign: 'center',
                      fontFamily: "'Times New Roman', Georgia, serif", fontSize: 'clamp(9pt,2.2vw,16pt)', color: '#1a1a1a' }}>
                      {name}
                    </div>
                    {/* Grad ~52% von oben */}
                    <div style={{ position: 'absolute', top: '52%', left: '45.5%', width: '49.5%', textAlign: 'center',
                      fontFamily: "'Times New Roman', Georgia, serif", fontSize: 'clamp(8pt,2vw,14pt)', color: '#1a1a1a' }}>
                      {grad || <em style={{ opacity: 0.4 }}>Grad nicht angegeben</em>}
                    </div>
                    {/* Urkundennummer ~77% von oben, mittig über TDA-Logo (~78% von links) */}
                    {nr && (
                      <div style={{ position: 'absolute', top: '82.9%', left: '6.7%', width: '38.7%', textAlign: 'center',
                        fontFamily: "'Times New Roman', Georgia, serif", fontSize: 'clamp(7pt,1.4vw,13pt)', color: '#1a1a1a', letterSpacing: '0.5px' }}>
                        {nr}
                      </div>
                    )}
                  </div>
                )}

                {/* Kickboxen Schülergrad: A4-Querformat-Rahmen */}
                {isKB && (
                  <div style={{ position: 'relative', width: '100%', paddingBottom: '70.7%',
                    background: '#faf7f0', border: '6px double #8b7355', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ position: 'absolute', top: '30.5%', width: '100%', textAlign: 'center',
                      fontFamily: "'Times New Roman', Georgia, serif", fontSize: 'clamp(10pt,3vw,20pt)',
                      fontStyle: 'italic', color: '#000' }}>
                      {name}
                    </div>
                    <div style={{ position: 'absolute', top: '48.6%', width: '100%', textAlign: 'center',
                      fontFamily: "'Times New Roman', Georgia, serif", fontSize: 'clamp(10pt,3vw,20pt)',
                      fontStyle: 'italic', color: '#000' }}>
                      {grad || <em style={{ opacity: 0.4 }}>Grad nicht angegeben</em>}
                    </div>
                    {nr && (
                      <div style={{ position: 'absolute', top: '78.6%', width: '100%', textAlign: 'center',
                        fontFamily: "'Times New Roman', Georgia, serif", fontSize: 'clamp(7pt,1.3vw,10pt)',
                        color: '#000', letterSpacing: '1px' }}>
                        {nr}
                      </div>
                    )}
                    <div style={{ position: 'absolute', top: '82.4%', width: '100%', textAlign: 'center',
                      fontFamily: "'Times New Roman', Georgia, serif", fontSize: 'clamp(7pt,1.3vw,10pt)', color: '#000' }}>
                      {datum}
                    </div>
                  </div>
                )}

                {/* Alle anderen Typen: Info-Karte */}
                {!isBoB && !isKB && !isAikido && (
                  <div style={{ background: 'var(--bg-secondary,#1e2330)', borderRadius: '8px', padding: '1.5rem', lineHeight: 2 }}>
                    {[
                      ['Name', name],
                      ['Art', ARTEN[u.art]?.label || u.art],
                      ['Grad / Rang', grad],
                      ['Disziplin', u.disziplin],
                      ['Urkundennummer', nr],
                      ['Ausstellungsdatum', datum],
                      ['Ausgestellt von', u.ausgestellt_von],
                      ['Schule / Dojo', u.dojo_schule],
                    ].filter(([, v]) => v).map(([label, val]) => (
                      <div key={label} style={{ display: 'flex', gap: '1rem', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '0.25rem' }}>
                        <span style={{ minWidth: '160px', opacity: 0.6, fontSize: '13px' }}>{label}</span>
                        <span style={{ fontWeight: 500 }}>{val}</span>
                      </div>
                    ))}
                  </div>
                )}

              </div>

              <div className="ur-modal-footer">
                {(isBoB || isKB || isAikido) && (
                  <button className="ur-btn-save" onClick={() => {
                    if (isBoB) druckeBoB(u);
                    else if (isKB) druckeKickboxSchuelergrad(u);
                    else druckeAikidoSchuelergrad(u);
                    setPreviewEntry(null);
                  }}>
                    <Printer size={14} /> Drucken
                  </button>
                )}
                <button className="ur-btn-cancel" onClick={() => { setPreviewEntry(null); openEdit(u); }}>
                  <Edit3 size={14} /> Bearbeiten
                </button>
                <button className="ur-btn-cancel" onClick={() => setPreviewEntry(null)}>
                  Schließen
                </button>
              </div>

            </div>
          </div>
        );
      })()}

    </div>
  );
}
