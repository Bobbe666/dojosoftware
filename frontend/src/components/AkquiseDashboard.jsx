// ============================================================================
// AKQUISE & PARTNER — CRM für Schulen- und Verbandsgewinnung
// Pipeline, E-Mail/Brief-Versand, Protokoll, TDA-Events-Import
// ============================================================================

import React, { useState, useEffect, useCallback } from 'react';
import {
  Target, Plus, Search, Filter, Mail, FileText, Phone, Users,
  ChevronRight, ArrowLeft, RefreshCw, Loader2, AlertTriangle,
  Check, X, Edit3, Trash2, Save, Clock, Star, Globe, Building2,
  TrendingUp, BarChart3, Calendar, Send, Printer, Download,
  ExternalLink, Trophy, UserCheck, MessageSquare, Zap, Flag,
  CheckCircle, XCircle, HelpCircle, Info, Eye, PenLine, Tag
} from 'lucide-react';
import config from '../config/config';
import { fetchWithAuth } from '../utils/fetchWithAuth';

const API = `${config.apiBaseUrl}/admin/akquise`;

// ── Konstanten ────────────────────────────────────────────────────────────────

const STATUS_PIPELINE = [
  { id: 'neu',          label: 'Neu',           color: '#6b7280', bg: 'rgba(107,114,128,0.12)' },
  { id: 'kontaktiert',  label: 'Kontaktiert',   color: '#3b82f6', bg: 'rgba(59,130,246,0.12)'  },
  { id: 'interessiert', label: 'Interessiert',  color: '#8b5cf6', bg: 'rgba(139,92,246,0.12)'  },
  { id: 'angebot',      label: 'Angebot',       color: '#f59e0b', bg: 'rgba(245,158,11,0.12)'  },
  { id: 'gewonnen',     label: 'Gewonnen ✓',   color: '#22c55e', bg: 'rgba(34,197,94,0.12)'   },
  { id: 'abgelehnt',    label: 'Abgelehnt',     color: '#ef4444', bg: 'rgba(239,68,68,0.12)'   },
  { id: 'pausiert',     label: 'Pausiert',      color: '#9ca3af', bg: 'rgba(156,163,175,0.12)' },
];

const ART_ICONS = {
  email:       <Mail size={14} />,
  brief:       <FileText size={14} />,
  telefon:     <Phone size={14} />,
  persoenlich: <Users size={14} />,
  nachricht:   <MessageSquare size={14} />,
  sonstiges:   <PenLine size={14} />,
};

const ERGEBNIS_CONFIG = {
  ausstehend:   { color: '#f59e0b', icon: <Clock size={13} />,     label: 'Ausstehend'   },
  positiv:      { color: '#22c55e', icon: <CheckCircle size={13}/>, label: 'Positiv'      },
  negativ:      { color: '#ef4444', icon: <XCircle size={13}/>,    label: 'Negativ'      },
  keine_antwort:{ color: '#6b7280', icon: <HelpCircle size={13}/>, label: 'Keine Antwort'},
};

const PRIORITAET_COLORS = { hoch: '#ef4444', mittel: '#f59e0b', niedrig: '#6b7280' };

// ── Helper ────────────────────────────────────────────────────────────────────

const StatusBadge = ({ status, small }) => {
  const s = STATUS_PIPELINE.find(x => x.id === status) || STATUS_PIPELINE[0];
  return (
    <span style={{
      display: 'inline-block', padding: small ? '1px 8px' : '3px 10px',
      borderRadius: 20, fontSize: small ? 11 : 12, fontWeight: 600,
      background: s.bg, color: s.color, border: `1px solid ${s.color}40`
    }}>{s.label}</span>
  );
};

const FlashMsg = ({ msg, type, onClose }) => {
  if (!msg) return null;
  const c = type === 'error'
    ? { bg: 'rgba(239,68,68,0.1)', border: 'rgba(239,68,68,0.4)', color: '#ef4444', icon: <AlertTriangle size={15}/> }
    : { bg: 'rgba(34,197,94,0.1)', border: 'rgba(34,197,94,0.4)', color: '#22c55e', icon: <Check size={15}/> };
  return (
    <div style={{ display:'flex', alignItems:'center', gap:8, padding:'9px 14px',
      background: c.bg, border: `1px solid ${c.border}`, borderRadius:8, marginBottom:14, color: c.color, fontSize:13 }}>
      {c.icon} {msg}
      <button onClick={onClose} style={{ marginLeft:'auto', background:'none', border:'none', cursor:'pointer', color:'inherit' }}><X size={14}/></button>
    </div>
  );
};

// ── Haupt-Komponente ──────────────────────────────────────────────────────────

const AkquiseDashboard = () => {
  const [view, setView] = useState('overview');      // overview | liste | detail | form | email | brief | vorlagen | tda-import
  const [kontakte, setKontakte] = useState([]);
  const [selectedKontakt, setSelectedKontakt] = useState(null);
  const [aktivitaeten, setAktivitaeten] = useState([]);
  const [vorlagen, setVorlagen] = useState([]);
  const [stats, setStats] = useState(null);
  const [tdaVereine, setTdaVereine] = useState([]);
  const [selectedVereine, setSelectedVereine] = useState(new Set());

  const [loading, setLoading] = useState(false);
  const [subLoading, setSubLoading] = useState(false);
  const [flash, setFlash] = useState({ msg: '', type: '' });
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typFilter, setTypFilter] = useState('');

  // Formulare
  const [kontaktForm, setKontaktForm] = useState(emptyKontaktForm());
  const [editingKontakt, setEditingKontakt] = useState(null);
  const [emailForm, setEmailForm] = useState({ betreff: '', html: '', vorlage_name: '' });
  const [briefForm, setBriefForm] = useState({ html: '', betreff: '', vorlage_name: '' });
  const [briefHtml, setBriefHtml] = useState('');          // Ergebnis-HTML zum Drucken
  const [aktivitaetForm, setAktivitaetForm] = useState({ art: 'telefon', betreff: '', inhalt: '', ergebnis: 'ausstehend', ergebnis_notiz: '' });
  const [showAktivitaetForm, setShowAktivitaetForm] = useState(false);
  const [vorlageForm, setVorlageForm] = useState({ name: '', typ: 'email', kategorie: 'erstanschreiben', betreff: '', html: '' });
  const [editingVorlage, setEditingVorlage] = useState(null);
  const [vorlageEditMode, setVorlageEditMode] = useState(false);

  function emptyKontaktForm() {
    return {
      organisation: '', typ: 'schule', ansprechpartner: '', position: '',
      email: '', telefon: '', webseite: '', strasse: '', plz: '', ort: '',
      land: 'Deutschland', sportart: '', mitglieder_anzahl: '', gegründet_jahr: '',
      status: 'neu', prioritaet: 'mittel', quelle: 'manuell',
      naechste_aktion: '', naechste_aktion_info: '', notiz: '',
    };
  }

  function showSuccess(msg) { setFlash({ msg, type: 'success' }); setTimeout(() => setFlash({ msg:'', type:'' }), 4000); }
  function showError(msg)   { setFlash({ msg, type: 'error'   }); }

  // ── API Calls ───────────────────────────────────────────────────────────────

  const loadKontakte = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.append('status', statusFilter);
      if (typFilter) params.append('typ', typFilter);
      if (searchTerm) params.append('search', searchTerm);
      const r = await fetchWithAuth(`${API}/kontakte?${params}`);
      const d = await r.json();
      setKontakte(d.kontakte || []);
    } catch (e) { showError('Fehler beim Laden der Kontakte'); }
    finally { setLoading(false); }
  }, [statusFilter, typFilter, searchTerm]);

  const loadStats = useCallback(async () => {
    try {
      const r = await fetchWithAuth(`${API}/stats`);
      const d = await r.json();
      if (d.success) setStats(d);
    } catch (_) {}
  }, []);

  const loadVorlagen = useCallback(async () => {
    try {
      const r = await fetchWithAuth(`${API}/vorlagen`);
      const d = await r.json();
      setVorlagen(d.vorlagen || []);
    } catch (_) {}
  }, []);

  const loadAktivitaeten = useCallback(async (id) => {
    try {
      const r = await fetchWithAuth(`${API}/kontakte/${id}/aktivitaeten`);
      const d = await r.json();
      setAktivitaeten(d.aktivitaeten || []);
    } catch (_) {}
  }, []);

  const loadTdaVereine = useCallback(async () => {
    setSubLoading(true);
    try {
      const r = await fetchWithAuth(`${API}/tda-events/vereine`);
      const d = await r.json();
      setTdaVereine(d.vereine || []);
    } catch (e) { showError('TDA-Events API nicht erreichbar'); }
    finally { setSubLoading(false); }
  }, []);

  useEffect(() => { loadKontakte(); }, [loadKontakte]);
  useEffect(() => { loadStats(); loadVorlagen(); }, []);

  useEffect(() => {
    if (view === 'detail' && selectedKontakt) {
      loadAktivitaeten(selectedKontakt.id);
    }
    if (view === 'tda-import' && tdaVereine.length === 0) {
      loadTdaVereine();
    }
  }, [view, selectedKontakt]);

  // ── Kontakt öffnen ──────────────────────────────────────────────────────────

  const openKontakt = (k) => {
    setSelectedKontakt(k);
    setView('detail');
  };

  // ── Kontakt speichern ───────────────────────────────────────────────────────

  const handleKontaktSubmit = async (e) => {
    e.preventDefault();
    setSubLoading(true);
    try {
      const method = editingKontakt ? 'PUT' : 'POST';
      const url = editingKontakt ? `${API}/kontakte/${editingKontakt.id}` : `${API}/kontakte`;
      const r = await fetchWithAuth(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(kontaktForm) });
      const d = await r.json();
      if (d.success) {
        showSuccess(editingKontakt ? 'Gespeichert' : 'Kontakt angelegt');
        setEditingKontakt(null);
        setKontaktForm(emptyKontaktForm());
        setView('liste');
        loadKontakte();
        loadStats();
      } else { showError(d.message); }
    } catch (e) { showError('Fehler'); }
    finally { setSubLoading(false); }
  };

  const handleKontaktDelete = async (k) => {
    if (!confirm(`"${k.organisation}" wirklich löschen inkl. Protokoll?`)) return;
    try {
      await fetchWithAuth(`${API}/kontakte/${k.id}`, { method: 'DELETE' });
      showSuccess('Gelöscht');
      if (selectedKontakt?.id === k.id) { setSelectedKontakt(null); setView('liste'); }
      loadKontakte(); loadStats();
    } catch (e) { showError('Fehler beim Löschen'); }
  };

  const handleStatusChange = async (k, newStatus) => {
    try {
      const r = await fetchWithAuth(`${API}/kontakte/${k.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...k, status: newStatus })
      });
      const d = await r.json();
      if (d.success) {
        if (selectedKontakt?.id === k.id) setSelectedKontakt(d.kontakt);
        loadKontakte(); loadStats();
        loadAktivitaeten(k.id);
        showSuccess(`Status → ${newStatus}`);
      }
    } catch (e) { showError('Fehler'); }
  };

  // ── E-Mail senden ───────────────────────────────────────────────────────────

  const handleEmailSend = async () => {
    if (!emailForm.betreff || !emailForm.html) return showError('Betreff und Inhalt sind Pflichtfelder');
    setSubLoading(true);
    try {
      const r = await fetchWithAuth(`${API}/kontakte/${selectedKontakt.id}/email`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ betreff_raw: emailForm.betreff, html_raw: emailForm.html, vorlage_name: emailForm.vorlage_name })
      });
      const d = await r.json();
      if (d.success) {
        showSuccess(d.message);
        setEmailForm({ betreff: '', html: '', vorlage_name: '' });
        setView('detail');
        loadAktivitaeten(selectedKontakt.id);
        // Kontakt neu laden
        const kr = await fetchWithAuth(`${API}/kontakte/${selectedKontakt.id}`);
        const kd = await kr.json();
        if (kd.kontakt) setSelectedKontakt(kd.kontakt);
        loadKontakte(); loadStats();
      } else { showError(d.message); }
    } catch (e) { showError('Fehler beim Versand'); }
    finally { setSubLoading(false); }
  };

  // ── Brief erstellen ─────────────────────────────────────────────────────────

  const handleBriefErstellen = async () => {
    if (!briefForm.html) return showError('Inhalt ist leer');
    setSubLoading(true);
    try {
      const r = await fetchWithAuth(`${API}/kontakte/${selectedKontakt.id}/brief`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ html_raw: briefForm.html, betreff_raw: briefForm.betreff, vorlage_name: briefForm.vorlage_name })
      });
      const d = await r.json();
      if (d.success) {
        setBriefHtml(d.html);
        showSuccess('Brief erstellt — bereit zum Drucken');
        loadAktivitaeten(selectedKontakt.id);
      } else { showError(d.message); }
    } catch (e) { showError('Fehler beim Erstellen'); }
    finally { setSubLoading(false); }
  };

  const printBrief = () => {
    const w = window.open('', '_blank');
    w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Brief</title>
    <style>body{font-family:Arial,sans-serif;font-size:12pt;line-height:1.6;max-width:700px;margin:40px auto;color:#000}
    @media print{body{margin:2cm}}</style></head><body>${briefHtml}</body></html>`);
    w.document.close();
    w.print();
  };

  // ── Aktivität loggen ────────────────────────────────────────────────────────

  const handleAktivitaetSave = async () => {
    if (!aktivitaetForm.art) return;
    try {
      await fetchWithAuth(`${API}/kontakte/${selectedKontakt.id}/aktivitaet`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(aktivitaetForm)
      });
      showSuccess('Aktivität protokolliert');
      setAktivitaetForm({ art: 'telefon', betreff: '', inhalt: '', ergebnis: 'ausstehend', ergebnis_notiz: '' });
      setShowAktivitaetForm(false);
      loadAktivitaeten(selectedKontakt.id);
      loadKontakte(); loadStats();
    } catch (e) { showError('Fehler'); }
  };

  // ── Vorlage in E-Mail/Brief laden ──────────────────────────────────────────

  const vorlageInEmail = (v) => {
    setEmailForm({ betreff: v.betreff || '', html: v.html || '', vorlage_name: v.name });
    setView('email');
  };

  const vorlageInBrief = (v) => {
    setBriefForm({ betreff: v.betreff || '', html: v.html || '', vorlage_name: v.name });
    setBriefHtml('');
    setView('brief');
  };

  // ── TDA-Events Import ───────────────────────────────────────────────────────

  const handleTdaImport = async () => {
    const liste = tdaVereine.filter(v => selectedVereine.has(v.name) && !v.bereits_importiert);
    if (liste.length === 0) return showError('Keine neuen Vereine ausgewählt');
    try {
      const r = await fetchWithAuth(`${API}/tda-events/importieren`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vereine: liste })
      });
      const d = await r.json();
      if (d.success) {
        showSuccess(d.message);
        setSelectedVereine(new Set());
        setView('liste');
        loadKontakte(); loadStats();
        loadTdaVereine();
      }
    } catch (e) { showError('Fehler beim Import'); }
  };

  // ── Vorlage CRUD ────────────────────────────────────────────────────────────

  const handleVorlageSave = async () => {
    if (!vorlageForm.name || !vorlageForm.html) return showError('Name und Inhalt sind Pflicht');
    try {
      const method = editingVorlage ? 'PUT' : 'POST';
      const url = editingVorlage ? `${API}/vorlagen/${editingVorlage.id}` : `${API}/vorlagen`;
      await fetchWithAuth(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(vorlageForm) });
      showSuccess('Vorlage gespeichert');
      setEditingVorlage(null);
      setVorlageForm({ name:'', typ:'email', kategorie:'erstanschreiben', betreff:'', html:'' });
      setVorlageEditMode(false);
      loadVorlagen();
    } catch (e) { showError('Fehler beim Speichern'); }
  };

  const handleVorlageDelete = async (v) => {
    if (!confirm(`Vorlage "${v.name}" löschen?`)) return;
    try {
      await fetchWithAuth(`${API}/vorlagen/${v.id}`, { method: 'DELETE' });
      showSuccess('Gelöscht');
      loadVorlagen();
    } catch (e) { showError('Fehler'); }
  };

  // ── Filter-Kontakte ─────────────────────────────────────────────────────────

  const filteredKontakte = kontakte.filter(k => {
    if (!searchTerm) return true;
    const s = searchTerm.toLowerCase();
    return (k.organisation + k.ansprechpartner + k.ort + k.email).toLowerCase().includes(s);
  });

  // ══════════════════════════════════════════════════════════════════════════
  // VIEWS
  // ══════════════════════════════════════════════════════════════════════════

  // ── OVERVIEW ───────────────────────────────────────────────────────────────
  const OverviewView = () => (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
        <h3 style={{ margin:0, display:'flex', alignItems:'center', gap:8 }}><Target size={20}/> Akquise & Partnerschaften</h3>
        <div style={{ display:'flex', gap:8 }}>
          <button className="btn-secondary" onClick={() => setView('tda-import')}><Zap size={15}/> TDA-Events Import</button>
          <button className="btn-secondary" onClick={() => setView('vorlagen')}><FileText size={15}/> Vorlagen</button>
          <button className="btn-primary" onClick={() => { setEditingKontakt(null); setKontaktForm(emptyKontaktForm()); setView('form'); }}>
            <Plus size={15}/> Neuer Kontakt
          </button>
        </div>
      </div>

      {/* Pipeline-Stats */}
      {stats && (
        <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:20 }}>
          {STATUS_PIPELINE.map(s => (
            <div key={s.id} onClick={() => { setStatusFilter(s.id); setView('liste'); }}
              style={{ flex:'1 0 100px', minWidth:90, padding:'12px 14px', borderRadius:10, cursor:'pointer',
                background: s.bg, border:`1px solid ${s.color}40`, textAlign:'center',
                transition:'transform 0.1s' }}
              onMouseEnter={e => e.currentTarget.style.transform='scale(1.03)'}
              onMouseLeave={e => e.currentTarget.style.transform='scale(1)'}>
              <div style={{ fontSize:24, fontWeight:800, color:s.color }}>{stats.pipeline?.[s.id] || 0}</div>
              <div style={{ fontSize:11, color:s.color, opacity:0.85 }}>{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* KPIs */}
      {stats && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(180px,1fr))', gap:12, marginBottom:20 }}>
          <div className="verband-stat-card success">
            <div className="stat-icon"><CheckCircle size={22}/></div>
            <div className="stat-content">
              <span className="stat-value">{stats.gewonnen}</span>
              <span className="stat-label">Gewonnen</span>
            </div>
          </div>
          <div className="verband-stat-card warning">
            <div className="stat-icon"><Clock size={22}/></div>
            <div className="stat-content">
              <span className="stat-value">{stats.followUp_faellig}</span>
              <span className="stat-label">Follow-Up fällig</span>
            </div>
          </div>
          <div className="verband-stat-card gold">
            <div className="stat-icon"><Target size={22}/></div>
            <div className="stat-content">
              <span className="stat-value">{stats.gesamt}</span>
              <span className="stat-label">Kontakte gesamt</span>
            </div>
          </div>
          <div className="verband-stat-card info">
            <div className="stat-icon"><TrendingUp size={22}/></div>
            <div className="stat-content">
              <span className="stat-value">
                {stats.gesamt > 0 ? Math.round((stats.gewonnen / stats.gesamt) * 100) : 0}%
              </span>
              <span className="stat-label">Conversion-Rate</span>
            </div>
          </div>
        </div>
      )}

      {/* Schnellzugriff: Follow-Up fällig */}
      {kontakte.filter(k => k.naechste_aktion && new Date(k.naechste_aktion) <= new Date() && !['gewonnen','abgelehnt'].includes(k.status)).length > 0 && (
        <div className="verband-panel" style={{ marginBottom:16 }}>
          <div className="panel-header">
            <h4 style={{ margin:0, display:'flex', alignItems:'center', gap:6, color:'var(--warning,#f59e0b)' }}>
              <Clock size={16}/> Follow-Up fällig
            </h4>
          </div>
          <div className="panel-content">
            {kontakte.filter(k => k.naechste_aktion && new Date(k.naechste_aktion) <= new Date() && !['gewonnen','abgelehnt'].includes(k.status))
              .slice(0, 5).map(k => (
              <div key={k.id} onClick={() => openKontakt(k)} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 0', borderBottom:'1px solid var(--border)', cursor:'pointer' }}>
                <Flag size={14} style={{ color:'var(--warning,#f59e0b)', flexShrink:0 }}/>
                <span style={{ flex:1, fontWeight:500 }}>{k.organisation}</span>
                <span style={{ fontSize:12, color:'var(--text-muted)' }}>{k.naechste_aktion_info || 'Follow-Up'}</span>
                <StatusBadge status={k.status} small />
                <ChevronRight size={14} style={{ color:'var(--text-muted)' }}/>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Letzte Kontakte */}
      <div className="verband-panel">
        <div className="panel-header">
          <h4 style={{ margin:0 }}><Users size={15}/> Alle Kontakte</h4>
          <button className="btn-link" onClick={() => setView('liste')}>Alle anzeigen <ChevronRight size={13}/></button>
        </div>
        <div className="panel-content">
          {kontakte.slice(0,8).map(k => (
            <div key={k.id} onClick={() => openKontakt(k)} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 0', borderBottom:'1px solid var(--border)', cursor:'pointer' }}>
              <div style={{ width:32, height:32, borderRadius:'50%', background:`${STATUS_PIPELINE.find(s=>s.id===k.status)?.bg||'var(--bg)'}`,
                border:`1px solid ${STATUS_PIPELINE.find(s=>s.id===k.status)?.color||'var(--border)'}40`,
                display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:700, flexShrink:0,
                color: STATUS_PIPELINE.find(s=>s.id===k.status)?.color }}>
                {k.organisation[0]}
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontWeight:600, fontSize:14, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{k.organisation}</div>
                <div style={{ fontSize:11, color:'var(--text-muted)' }}>
                  {k.ort && `${k.ort} · `}{k.sportart || k.typ}
                  {k.aktivitaeten_count > 0 && ` · ${k.aktivitaeten_count} Aktivität${k.aktivitaeten_count!==1?'en':''}`}
                </div>
              </div>
              <StatusBadge status={k.status} small />
              <ChevronRight size={14} style={{ color:'var(--text-muted)' }}/>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  // ── KONTAKT LISTE ───────────────────────────────────────────────────────────
  const ListeView = () => (
    <div>
      <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:16 }}>
        <button className="btn-icon" onClick={() => { setStatusFilter(''); setView('overview'); }}><ArrowLeft size={18}/></button>
        <h3 style={{ margin:0, flex:1 }}>Kontakte ({filteredKontakte.length})</h3>
        <button className="btn-primary" onClick={() => { setEditingKontakt(null); setKontaktForm(emptyKontaktForm()); setView('form'); }}>
          <Plus size={15}/> Neu
        </button>
      </div>

      {/* Filter-Leiste */}
      <div style={{ display:'flex', gap:8, marginBottom:14, flexWrap:'wrap' }}>
        <div style={{ position:'relative', flex:1, minWidth:180 }}>
          <Search size={14} style={{ position:'absolute', left:9, top:'50%', transform:'translateY(-50%)', color:'var(--text-muted)' }}/>
          <input type="text" placeholder="Organisation, Ansprechpartner, Ort…"
            value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
            style={{ width:'100%', paddingLeft:30, paddingRight:10, paddingTop:8, paddingBottom:8, borderRadius:8, border:'1px solid var(--border)', background:'var(--bg-secondary)', color:'var(--text)', fontSize:13 }}/>
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          style={{ padding:'8px 10px', borderRadius:8, border:'1px solid var(--border)', background:'var(--bg-secondary)', color:'var(--text)', fontSize:13 }}>
          <option value="">Alle Status</option>
          {STATUS_PIPELINE.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
        <select value={typFilter} onChange={e => setTypFilter(e.target.value)}
          style={{ padding:'8px 10px', borderRadius:8, border:'1px solid var(--border)', background:'var(--bg-secondary)', color:'var(--text)', fontSize:13 }}>
          <option value="">Alle Typen</option>
          <option value="schule">Schule</option>
          <option value="verband">Verband</option>
          <option value="verein">Verein</option>
          <option value="sonstige">Sonstige</option>
        </select>
      </div>

      {loading ? <div style={{ textAlign:'center', padding:40 }}><Loader2 size={28} className="spin"/></div>
        : filteredKontakte.length === 0 ? (
          <div className="empty-state large">
            <Target size={44}/>
            <h4>Keine Kontakte</h4>
            <p>Legen Sie Kontakte an oder importieren Sie Vereine aus TDA-Events.</p>
          </div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
            {filteredKontakte.map(k => (
              <div key={k.id} className="verband-panel" style={{ padding:'10px 14px', cursor:'default' }}>
                <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                  <div style={{ width:38, height:38, borderRadius:'50%', flexShrink:0,
                    background: STATUS_PIPELINE.find(s=>s.id===k.status)?.bg || 'var(--bg-secondary)',
                    display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700, fontSize:14,
                    color: STATUS_PIPELINE.find(s=>s.id===k.status)?.color }}>
                    {k.organisation[0]}
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
                      <strong style={{ fontSize:14 }}>{k.organisation}</strong>
                      <span style={{ fontSize:11, color:'var(--text-muted)', background:'var(--bg)', padding:'1px 7px', borderRadius:10, border:'1px solid var(--border)' }}>{k.typ}</span>
                      {k.sportart && <span style={{ fontSize:11, color:'var(--text-muted)' }}>{k.sportart}</span>}
                      {k.prioritaet === 'hoch' && <span style={{ fontSize:11, color:'#ef4444', fontWeight:700 }}>↑ Hoch</span>}
                    </div>
                    <div style={{ fontSize:12, color:'var(--text-muted)', marginTop:2 }}>
                      {k.ansprechpartner && `${k.ansprechpartner} · `}
                      {k.ort && `${k.ort} · `}
                      {k.email && `${k.email} · `}
                      {k.aktivitaeten_count > 0 ? `${k.aktivitaeten_count} Aktivität${k.aktivitaeten_count!==1?'en':''}` : 'Noch keine Aktivitäten'}
                      {k.letzte_aktivitaet && ` · zuletzt ${new Date(k.letzte_aktivitaet).toLocaleDateString('de-DE')}`}
                    </div>
                  </div>
                  <div style={{ display:'flex', alignItems:'center', gap:6, flexShrink:0 }}>
                    <StatusBadge status={k.status} small />
                    <button className="btn-secondary" style={{ padding:'4px 10px', fontSize:12 }} onClick={() => openKontakt(k)}>
                      Öffnen <ChevronRight size={13}/>
                    </button>
                    <button className="btn-icon" onClick={() => { setEditingKontakt(k); setKontaktForm({...k, tags: undefined}); setView('form'); }}>
                      <Edit3 size={14}/>
                    </button>
                    <button className="btn-icon btn-icon-danger" onClick={() => handleKontaktDelete(k)}>
                      <Trash2 size={14}/>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
    </div>
  );

  // ── KONTAKT DETAIL ──────────────────────────────────────────────────────────
  const DetailView = () => {
    if (!selectedKontakt) return null;
    const k = selectedKontakt;
    return (
      <div>
        {/* Header */}
        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:18 }}>
          <button className="btn-icon" onClick={() => { setView('liste'); setSelectedKontakt(null); }}><ArrowLeft size={18}/></button>
          <div style={{ flex:1 }}>
            <h3 style={{ margin:0 }}>{k.organisation}</h3>
            <div style={{ fontSize:13, color:'var(--text-muted)' }}>
              {k.typ} {k.sportart ? `· ${k.sportart}` : ''} {k.ort ? `· ${k.ort}` : ''}
            </div>
          </div>
          <select value={k.status} onChange={e => handleStatusChange(k, e.target.value)}
            style={{ padding:'6px 10px', borderRadius:8, border:`2px solid ${STATUS_PIPELINE.find(s=>s.id===k.status)?.color||'var(--border)'}`,
              background:'var(--bg-secondary)', color: STATUS_PIPELINE.find(s=>s.id===k.status)?.color, fontWeight:700, fontSize:13 }}>
            {STATUS_PIPELINE.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
          <button className="btn-icon" onClick={() => { setEditingKontakt(k); setKontaktForm({...k}); setView('form'); }}><Edit3 size={16}/></button>
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, marginBottom:16 }}>
          {/* Kontakt-Info */}
          <div className="verband-panel" style={{ padding:'14px 16px' }}>
            <div style={{ fontWeight:700, marginBottom:10, display:'flex', alignItems:'center', gap:6 }}><Building2 size={15}/> Kontaktdaten</div>
            {[
              ['Ansprechpartner', k.ansprechpartner],
              ['Position', k.position],
              ['E-Mail', k.email && <a href={`mailto:${k.email}`} style={{ color:'var(--primary,#DAA520)' }}>{k.email}</a>],
              ['Telefon', k.telefon && <a href={`tel:${k.telefon}`} style={{ color:'var(--primary,#DAA520)' }}>{k.telefon}</a>],
              ['Website', k.webseite && <a href={k.webseite} target="_blank" rel="noopener noreferrer" style={{ color:'var(--primary,#DAA520)', display:'flex', alignItems:'center', gap:4 }}>{k.webseite} <ExternalLink size={12}/></a>],
              ['Adresse', [k.strasse, `${k.plz} ${k.ort}`, k.land].filter(Boolean).join(', ')],
              ['Mitglieder ca.', k.mitglieder_anzahl],
              ['Gegründet', k.gegründet_jahr],
              ['Quelle', k.quelle],
            ].filter(([,v]) => v).map(([label, val]) => (
              <div key={label} style={{ display:'flex', gap:8, marginBottom:5, fontSize:13 }}>
                <span style={{ color:'var(--text-muted)', width:120, flexShrink:0 }}>{label}</span>
                <span>{val}</span>
              </div>
            ))}
          </div>

          {/* Status & Follow-Up */}
          <div className="verband-panel" style={{ padding:'14px 16px' }}>
            <div style={{ fontWeight:700, marginBottom:10, display:'flex', alignItems:'center', gap:6 }}><Flag size={15}/> Pipeline & Follow-Up</div>
            <div style={{ display:'flex', gap:6, marginBottom:12, flexWrap:'wrap' }}>
              <StatusBadge status={k.status}/>
              <span style={{ display:'inline-block', padding:'3px 10px', borderRadius:20, fontSize:12, fontWeight:600,
                background:'var(--bg)', border:`1px solid ${PRIORITAET_COLORS[k.prioritaet]}40`,
                color: PRIORITAET_COLORS[k.prioritaet] }}>Priorität: {k.prioritaet}</span>
            </div>
            {k.naechste_aktion && (
              <div style={{ padding:'8px 10px', borderRadius:8, background:'rgba(245,158,11,0.1)', border:'1px solid rgba(245,158,11,0.3)', marginBottom:10 }}>
                <div style={{ fontSize:12, color:'var(--warning,#f59e0b)', fontWeight:700, display:'flex', alignItems:'center', gap:5 }}>
                  <Calendar size={13}/> Nächste Aktion: {new Date(k.naechste_aktion).toLocaleDateString('de-DE')}
                </div>
                {k.naechste_aktion_info && <div style={{ fontSize:13, marginTop:3 }}>{k.naechste_aktion_info}</div>}
              </div>
            )}
            {k.notiz && <div style={{ fontSize:13, color:'var(--text-muted)', fontStyle:'italic', marginBottom:8 }}>"{k.notiz}"</div>}
            {/* Schnell-Aktionen */}
            <div style={{ display:'flex', flexDirection:'column', gap:6, marginTop:10 }}>
              {k.email && (
                <button className="btn-primary" style={{ justifyContent:'flex-start', gap:6 }}
                  onClick={() => { setEmailForm({ betreff:'', html:'', vorlage_name:'' }); setView('email'); }}>
                  <Mail size={15}/> E-Mail senden
                </button>
              )}
              <button className="btn-secondary" style={{ justifyContent:'flex-start', gap:6 }}
                onClick={() => { setBriefForm({ betreff:'', html:'', vorlage_name:'' }); setBriefHtml(''); setView('brief'); }}>
                <Printer size={15}/> Brief erstellen
              </button>
              <button className="btn-secondary" style={{ justifyContent:'flex-start', gap:6 }}
                onClick={() => { setShowAktivitaetForm(true); }}>
                <PenLine size={15}/> Aktivität protokollieren
              </button>
            </div>
          </div>
        </div>

        {/* Aktivität protokollieren */}
        {showAktivitaetForm && (
          <div className="verband-panel" style={{ padding:'14px 16px', marginBottom:14 }}>
            <div style={{ fontWeight:700, marginBottom:10 }}>Aktivität protokollieren</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:10 }}>
              <div>
                <label style={{ display:'block', fontSize:12, marginBottom:4 }}>Art</label>
                <select value={aktivitaetForm.art} onChange={e => setAktivitaetForm(p=>({...p,art:e.target.value}))}
                  style={{ width:'100%', padding:'7px 9px', borderRadius:7, border:'1px solid var(--border)', background:'var(--bg-secondary)', color:'var(--text)', fontSize:13 }}>
                  <option value="telefon">Telefonat</option>
                  <option value="email">E-Mail</option>
                  <option value="brief">Brief</option>
                  <option value="persoenlich">Persönliches Gespräch</option>
                  <option value="nachricht">Nachricht</option>
                  <option value="sonstiges">Sonstiges</option>
                </select>
              </div>
              <div>
                <label style={{ display:'block', fontSize:12, marginBottom:4 }}>Ergebnis</label>
                <select value={aktivitaetForm.ergebnis} onChange={e => setAktivitaetForm(p=>({...p,ergebnis:e.target.value}))}
                  style={{ width:'100%', padding:'7px 9px', borderRadius:7, border:'1px solid var(--border)', background:'var(--bg-secondary)', color:'var(--text)', fontSize:13 }}>
                  <option value="ausstehend">Ausstehend</option>
                  <option value="positiv">Positiv</option>
                  <option value="negativ">Negativ</option>
                  <option value="keine_antwort">Keine Antwort</option>
                </select>
              </div>
            </div>
            <input type="text" placeholder="Betreff / Kurznotiz" value={aktivitaetForm.betreff}
              onChange={e => setAktivitaetForm(p=>({...p,betreff:e.target.value}))}
              style={{ width:'100%', padding:'7px 9px', borderRadius:7, border:'1px solid var(--border)', background:'var(--bg-secondary)', color:'var(--text)', fontSize:13, marginBottom:8 }}/>
            <textarea rows={3} placeholder="Details…" value={aktivitaetForm.inhalt}
              onChange={e => setAktivitaetForm(p=>({...p,inhalt:e.target.value}))}
              style={{ width:'100%', padding:'7px 9px', borderRadius:7, border:'1px solid var(--border)', background:'var(--bg-secondary)', color:'var(--text)', fontSize:13, marginBottom:8, resize:'vertical' }}/>
            <div style={{ display:'flex', gap:8 }}>
              <button className="btn-primary" onClick={handleAktivitaetSave}><Save size={14}/> Speichern</button>
              <button className="btn-secondary" onClick={() => setShowAktivitaetForm(false)}>Abbrechen</button>
            </div>
          </div>
        )}

        {/* Aktivitäten-Protokoll */}
        <div className="verband-panel">
          <div className="panel-header">
            <h4 style={{ margin:0, display:'flex', alignItems:'center', gap:6 }}><BarChart3 size={15}/> Aktivitäten-Protokoll</h4>
            <span style={{ fontSize:13, color:'var(--text-muted)' }}>{aktivitaeten.length} Einträge</span>
          </div>
          <div className="panel-content">
            {aktivitaeten.length === 0 ? (
              <div style={{ textAlign:'center', padding:'20px 0', color:'var(--text-muted)', fontSize:13 }}>Noch keine Aktivitäten protokolliert</div>
            ) : aktivitaeten.map(a => {
              const erg = ERGEBNIS_CONFIG[a.ergebnis] || ERGEBNIS_CONFIG.ausstehend;
              return (
                <div key={a.id} style={{ display:'flex', gap:12, padding:'10px 0', borderBottom:'1px solid var(--border)' }}>
                  <div style={{ width:32, height:32, borderRadius:'50%', background:'var(--bg-secondary)', border:'1px solid var(--border)',
                    display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, color:'var(--text-muted)' }}>
                    {ART_ICONS[a.art] || ART_ICONS.sonstiges}
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
                      <strong style={{ fontSize:13 }}>{a.art.charAt(0).toUpperCase()+a.art.slice(1)}</strong>
                      {a.betreff && <span style={{ fontSize:13, color:'var(--text-muted)' }}>— {a.betreff}</span>}
                      <span style={{ marginLeft:'auto', fontSize:11, color:'var(--text-muted)' }}>
                        {new Date(a.datum).toLocaleString('de-DE', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' })}
                      </span>
                    </div>
                    {a.status_nachher && a.status_vorher && (
                      <div style={{ fontSize:12, color:'var(--text-muted)', marginTop:2 }}>
                        Status: <StatusBadge status={a.status_vorher} small/> → <StatusBadge status={a.status_nachher} small/>
                      </div>
                    )}
                    {a.inhalt && <div style={{ fontSize:12, color:'var(--text-muted)', marginTop:3, maxHeight:60, overflow:'hidden' }}>{a.inhalt.substring(0,200)}{a.inhalt.length>200?'…':''}</div>}
                    {a.vorlage_name && <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:2 }}>Vorlage: {a.vorlage_name}</div>}
                  </div>
                  <div style={{ display:'flex', alignItems:'flex-start', gap:5, flexShrink:0, paddingTop:2 }}>
                    <span style={{ display:'inline-flex', alignItems:'center', gap:4, fontSize:11, color:erg.color, fontWeight:600 }}>
                      {erg.icon} {erg.label}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  // ── E-MAIL EDITOR ───────────────────────────────────────────────────────────
  const EmailView = () => (
    <div>
      <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:18 }}>
        <button className="btn-icon" onClick={() => setView('detail')}><ArrowLeft size={18}/></button>
        <h3 style={{ margin:0 }}>E-Mail senden an: <span style={{ color:'var(--primary,#DAA520)' }}>{selectedKontakt?.organisation}</span></h3>
      </div>
      {selectedKontakt?.email && (
        <div style={{ fontSize:13, color:'var(--text-muted)', marginBottom:12 }}><Mail size={13} style={{ verticalAlign:'middle' }}/> {selectedKontakt.email}</div>
      )}

      {/* Vorlage auswählen */}
      {vorlagen.filter(v=>v.typ==='email').length > 0 && (
        <div style={{ marginBottom:14 }}>
          <label style={{ display:'block', fontSize:12, marginBottom:6, fontWeight:600 }}>Vorlage laden:</label>
          <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
            {vorlagen.filter(v=>v.typ==='email').map(v => (
              <button key={v.id} className="btn-secondary" style={{ fontSize:12, padding:'4px 12px' }}
                onClick={() => vorlageInEmail(v)}>
                {v.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <div style={{ marginBottom:10 }}>
        <label style={{ display:'block', fontSize:12, marginBottom:4, fontWeight:600 }}>Betreff *</label>
        <input type="text" value={emailForm.betreff} onChange={e => setEmailForm(p=>({...p,betreff:e.target.value}))}
          placeholder="Betreff der E-Mail (Platzhalter: {{organisation}}, {{ansprechpartner}}…)"
          style={{ width:'100%', padding:'9px 12px', borderRadius:8, border:'1px solid var(--border)', background:'var(--bg-secondary)', color:'var(--text)', fontSize:14 }}/>
      </div>
      <div style={{ marginBottom:14 }}>
        <label style={{ display:'block', fontSize:12, marginBottom:4, fontWeight:600 }}>Inhalt (HTML) *</label>
        <div style={{ fontSize:11, color:'var(--text-muted)', marginBottom:6 }}>
          Verfügbare Platzhalter: <code style={{ background:'var(--bg)', padding:'1px 5px', borderRadius:4 }}>{'{{organisation}}'}</code> <code style={{ background:'var(--bg)', padding:'1px 5px', borderRadius:4 }}>{'{{anrede_persoenlich}}'}</code> <code style={{ background:'var(--bg)', padding:'1px 5px', borderRadius:4 }}>{'{{ansprechpartner}}'}</code> <code style={{ background:'var(--bg)', padding:'1px 5px', borderRadius:4 }}>{'{{absender_inhaber}}'}</code> <code style={{ background:'var(--bg)', padding:'1px 5px', borderRadius:4 }}>{'{{datum}}'}</code>
        </div>
        <textarea rows={14} value={emailForm.html} onChange={e => setEmailForm(p=>({...p,html:e.target.value}))}
          placeholder="HTML-Inhalt der E-Mail…"
          style={{ width:'100%', padding:'9px 12px', borderRadius:8, border:'1px solid var(--border)', background:'var(--bg-secondary)', color:'var(--text)', fontSize:13, fontFamily:'monospace', resize:'vertical' }}/>
      </div>
      <div style={{ display:'flex', gap:10 }}>
        <button className="btn-primary" onClick={handleEmailSend} disabled={subLoading}>
          {subLoading ? <Loader2 size={15} className="spin"/> : <Send size={15}/>} E-Mail senden
        </button>
        <button className="btn-secondary" onClick={() => setView('detail')}>Abbrechen</button>
      </div>
    </div>
  );

  // ── BRIEF EDITOR ────────────────────────────────────────────────────────────
  const BriefView = () => (
    <div>
      <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:18 }}>
        <button className="btn-icon" onClick={() => setView('detail')}><ArrowLeft size={18}/></button>
        <h3 style={{ margin:0 }}>Brief erstellen für: <span style={{ color:'var(--primary,#DAA520)' }}>{selectedKontakt?.organisation}</span></h3>
      </div>

      {/* Vorlage */}
      {vorlagen.filter(v=>v.typ==='brief').length > 0 && (
        <div style={{ marginBottom:14 }}>
          <label style={{ display:'block', fontSize:12, marginBottom:6, fontWeight:600 }}>Brief-Vorlage laden:</label>
          <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
            {vorlagen.filter(v=>v.typ==='brief').map(v => (
              <button key={v.id} className="btn-secondary" style={{ fontSize:12, padding:'4px 12px' }}
                onClick={() => vorlageInBrief(v)}>
                {v.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <div style={{ marginBottom:10 }}>
        <label style={{ display:'block', fontSize:12, marginBottom:4, fontWeight:600 }}>Betreffzeile</label>
        <input type="text" value={briefForm.betreff} onChange={e => setBriefForm(p=>({...p,betreff:e.target.value}))}
          placeholder="Betreff des Briefs"
          style={{ width:'100%', padding:'9px 12px', borderRadius:8, border:'1px solid var(--border)', background:'var(--bg-secondary)', color:'var(--text)', fontSize:14 }}/>
      </div>
      <div style={{ marginBottom:14 }}>
        <label style={{ display:'block', fontSize:12, marginBottom:4, fontWeight:600 }}>Inhalt (HTML) *</label>
        <textarea rows={16} value={briefForm.html} onChange={e => setBriefForm(p=>({...p,html:e.target.value}))}
          placeholder="HTML-Inhalt des Briefs…"
          style={{ width:'100%', padding:'9px 12px', borderRadius:8, border:'1px solid var(--border)', background:'var(--bg-secondary)', color:'var(--text)', fontSize:13, fontFamily:'monospace', resize:'vertical' }}/>
      </div>
      <div style={{ display:'flex', gap:10, marginBottom:16 }}>
        <button className="btn-primary" onClick={handleBriefErstellen} disabled={subLoading}>
          {subLoading ? <Loader2 size={15} className="spin"/> : <Eye size={15}/>} Brief erstellen
        </button>
        <button className="btn-secondary" onClick={() => setView('detail')}>Abbrechen</button>
      </div>

      {/* Vorschau + Druck */}
      {briefHtml && (
        <div>
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10 }}>
            <strong>Vorschau</strong>
            <button className="btn-primary" onClick={printBrief}><Printer size={14}/> Drucken / PDF</button>
          </div>
          <div style={{ border:'1px solid var(--border)', borderRadius:8, padding:24, background:'#fff', color:'#000',
            fontFamily:'Arial,sans-serif', fontSize:12, lineHeight:1.6, maxWidth:700 }}
            dangerouslySetInnerHTML={{ __html: briefHtml }}/>
        </div>
      )}
    </div>
  );

  // ── VORLAGEN VERWALTUNG ─────────────────────────────────────────────────────
  const VorlagenView = () => (
    <div>
      <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:18 }}>
        <button className="btn-icon" onClick={() => setView('overview')}><ArrowLeft size={18}/></button>
        <h3 style={{ margin:0, flex:1 }}>Vorlagen ({vorlagen.length})</h3>
        <button className="btn-primary" onClick={() => { setEditingVorlage(null); setVorlageForm({ name:'', typ:'email', kategorie:'erstanschreiben', betreff:'', html:'' }); setVorlageEditMode(true); }}>
          <Plus size={14}/> Neue Vorlage
        </button>
      </div>

      {vorlageEditMode && (
        <div className="verband-panel" style={{ padding:'16px 18px', marginBottom:16 }}>
          <div style={{ fontWeight:700, marginBottom:12 }}>{editingVorlage ? 'Vorlage bearbeiten' : 'Neue Vorlage'}</div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10, marginBottom:10 }}>
            <div>
              <label style={{ display:'block', fontSize:12, marginBottom:4 }}>Name *</label>
              <input type="text" value={vorlageForm.name} onChange={e=>setVorlageForm(p=>({...p,name:e.target.value}))}
                style={{ width:'100%', padding:'7px 9px', borderRadius:7, border:'1px solid var(--border)', background:'var(--bg-secondary)', color:'var(--text)', fontSize:13 }}/>
            </div>
            <div>
              <label style={{ display:'block', fontSize:12, marginBottom:4 }}>Typ</label>
              <select value={vorlageForm.typ} onChange={e=>setVorlageForm(p=>({...p,typ:e.target.value}))}
                style={{ width:'100%', padding:'7px 9px', borderRadius:7, border:'1px solid var(--border)', background:'var(--bg-secondary)', color:'var(--text)', fontSize:13 }}>
                <option value="email">E-Mail</option>
                <option value="brief">Brief</option>
              </select>
            </div>
            <div>
              <label style={{ display:'block', fontSize:12, marginBottom:4 }}>Kategorie</label>
              <select value={vorlageForm.kategorie} onChange={e=>setVorlageForm(p=>({...p,kategorie:e.target.value}))}
                style={{ width:'100%', padding:'7px 9px', borderRadius:7, border:'1px solid var(--border)', background:'var(--bg-secondary)', color:'var(--text)', fontSize:13 }}>
                <option value="erstanschreiben">Erstanschreiben</option>
                <option value="folgeanschreiben">Folgeanschreiben</option>
                <option value="angebot">Angebot</option>
                <option value="willkommen">Willkommen</option>
                <option value="sonstiges">Sonstiges</option>
              </select>
            </div>
          </div>
          {vorlageForm.typ === 'email' && (
            <div style={{ marginBottom:10 }}>
              <label style={{ display:'block', fontSize:12, marginBottom:4 }}>Betreff</label>
              <input type="text" value={vorlageForm.betreff} onChange={e=>setVorlageForm(p=>({...p,betreff:e.target.value}))}
                style={{ width:'100%', padding:'7px 9px', borderRadius:7, border:'1px solid var(--border)', background:'var(--bg-secondary)', color:'var(--text)', fontSize:13 }}/>
            </div>
          )}
          <div style={{ marginBottom:10 }}>
            <label style={{ display:'block', fontSize:12, marginBottom:4 }}>Inhalt (HTML) *</label>
            <textarea rows={10} value={vorlageForm.html} onChange={e=>setVorlageForm(p=>({...p,html:e.target.value}))}
              style={{ width:'100%', padding:'7px 9px', borderRadius:7, border:'1px solid var(--border)', background:'var(--bg-secondary)', color:'var(--text)', fontSize:12, fontFamily:'monospace', resize:'vertical' }}/>
          </div>
          <div style={{ display:'flex', gap:8 }}>
            <button className="btn-primary" onClick={handleVorlageSave}><Save size={14}/> Speichern</button>
            <button className="btn-secondary" onClick={() => { setVorlageEditMode(false); setEditingVorlage(null); }}>Abbrechen</button>
          </div>
        </div>
      )}

      {['email', 'brief'].map(typ => {
        const filtered = vorlagen.filter(v => v.typ === typ);
        if (filtered.length === 0) return null;
        return (
          <div key={typ} style={{ marginBottom:20 }}>
            <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:10, fontWeight:700, fontSize:14 }}>
              {typ === 'email' ? <Mail size={16}/> : <FileText size={16}/>}
              {typ === 'email' ? 'E-Mail-Vorlagen' : 'Brief-Vorlagen'}
              <span style={{ fontSize:12, color:'var(--text-muted)' }}>({filtered.length})</span>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {filtered.map(v => (
                <div key={v.id} className="verband-panel" style={{ padding:'12px 16px' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                    <div style={{ flex:1 }}>
                      <div style={{ fontWeight:600, fontSize:14 }}>{v.name}</div>
                      <div style={{ fontSize:12, color:'var(--text-muted)' }}>
                        {v.kategorie} {v.betreff && `· ${v.betreff.substring(0,60)}${v.betreff.length>60?'…':''}`}
                      </div>
                    </div>
                    <button className="btn-icon" title="Bearbeiten" onClick={() => {
                      setEditingVorlage(v); setVorlageForm({name:v.name,typ:v.typ,kategorie:v.kategorie,betreff:v.betreff||'',html:v.html}); setVorlageEditMode(true);
                    }}><Edit3 size={14}/></button>
                    <button className="btn-icon btn-icon-danger" title="Löschen" onClick={() => handleVorlageDelete(v)}><Trash2 size={14}/></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );

  // ── TDA EVENTS IMPORT ───────────────────────────────────────────────────────
  const TdaImportView = () => (
    <div>
      <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:18 }}>
        <button className="btn-icon" onClick={() => setView('overview')}><ArrowLeft size={18}/></button>
        <div style={{ flex:1 }}>
          <h3 style={{ margin:0, display:'flex', alignItems:'center', gap:8 }}><Zap size={18}/> TDA-Events Import</h3>
          <div style={{ fontSize:13, color:'var(--text-muted)' }}>Vereine aus events.tda-intl.org als Akquise-Kontakte importieren</div>
        </div>
        <button className="btn-secondary" onClick={loadTdaVereine} disabled={subLoading}>
          {subLoading ? <Loader2 size={14} className="spin"/> : <RefreshCw size={14}/>} Aktualisieren
        </button>
      </div>

      {subLoading ? (
        <div style={{ textAlign:'center', padding:50 }}>
          <Loader2 size={32} className="spin" style={{ color:'var(--primary,#DAA520)' }}/>
          <p style={{ marginTop:12, color:'var(--text-muted)' }}>Lade Vereine von events.tda-intl.org…</p>
        </div>
      ) : (
        <>
          <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:14, padding:'10px 14px', background:'rgba(var(--primary-rgb,218,165,32),0.08)', border:'1px solid var(--primary,#DAA520)40', borderRadius:8 }}>
            <Info size={16} style={{ color:'var(--primary,#DAA520)', flexShrink:0 }}/>
            <span style={{ fontSize:13 }}>
              <strong>{tdaVereine.length}</strong> Vereine aus TDA-Events-Turnieren gefunden.
              <strong style={{ color:'#22c55e', marginLeft:8 }}>{tdaVereine.filter(v=>!v.bereits_importiert).length}</strong> noch nicht importiert.
            </span>
            {selectedVereine.size > 0 && (
              <button className="btn-primary" style={{ marginLeft:'auto' }} onClick={handleTdaImport}>
                <Download size={14}/> {selectedVereine.size} importieren
              </button>
            )}
          </div>

          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
            {tdaVereine.map((v, i) => (
              <div key={i} style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 14px', borderRadius:8,
                background: v.bereits_importiert ? 'var(--bg)' : 'var(--bg-secondary)',
                border: '1px solid var(--border)', opacity: v.bereits_importiert ? 0.6 : 1 }}>
                <input type="checkbox" disabled={v.bereits_importiert}
                  checked={selectedVereine.has(v.name)} onChange={e => {
                    const s = new Set(selectedVereine);
                    if (e.target.checked) s.add(v.name); else s.delete(v.name);
                    setSelectedVereine(s);
                  }}
                  style={{ width:16, height:16, accentColor:'var(--primary,#DAA520)', flexShrink:0 }}/>
                <div style={{ width:36, height:36, borderRadius:'50%', flexShrink:0,
                  background:'rgba(var(--primary-rgb,218,165,32),0.12)',
                  display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700, fontSize:14,
                  color:'var(--primary,#DAA520)' }}>
                  {v.name[0]}
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontWeight:600, fontSize:14 }}>{v.name}</div>
                  <div style={{ fontSize:12, color:'var(--text-muted)', display:'flex', gap:10 }}>
                    <span><Trophy size={11} style={{ verticalAlign:'middle' }}/> {v.turnier_anzahl} Turnier{v.turnier_anzahl!==1?'e':''}</span>
                    <span><Users size={11} style={{ verticalAlign:'middle' }}/> {v.teilnehmer} Teilnahmen</span>
                    {v.turniere.slice(0,2).map(t => (
                      <span key={t.id}>· {t.name}{t.datum ? ` (${new Date(t.datum).toLocaleDateString('de-DE', {month:'short',year:'numeric'})})` : ''}</span>
                    ))}
                  </div>
                </div>
                {v.bereits_importiert ? (
                  <span style={{ fontSize:12, color:'#22c55e', display:'flex', alignItems:'center', gap:4, flexShrink:0 }}><Check size={13}/> Importiert</span>
                ) : (
                  <button className="btn-secondary" style={{ fontSize:12, padding:'3px 10px', flexShrink:0 }}
                    onClick={() => { setSelectedVereine(new Set([v.name])); setTimeout(handleTdaImport, 10); }}>
                    Importieren
                  </button>
                )}
              </div>
            ))}
          </div>

          {selectedVereine.size > 0 && (
            <div style={{ position:'sticky', bottom:0, marginTop:16, padding:'12px 0' }}>
              <button className="btn-primary" style={{ width:'100%', justifyContent:'center', padding:'12px' }} onClick={handleTdaImport}>
                <Download size={16}/> {selectedVereine.size} ausgewählte Vereine als Akquise-Kontakte importieren
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );

  // ── KONTAKT FORMULAR ────────────────────────────────────────────────────────
  const FormView = () => (
    <div style={{ maxWidth:640 }}>
      <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:20 }}>
        <button className="btn-icon" onClick={() => setView(editingKontakt ? 'detail' : 'overview')}><ArrowLeft size={18}/></button>
        <h3 style={{ margin:0 }}>{editingKontakt ? `Bearbeiten: ${editingKontakt.organisation}` : 'Neuer Kontakt'}</h3>
      </div>
      <form onSubmit={handleKontaktSubmit} style={{ display:'flex', flexDirection:'column', gap:14 }}>
        <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr 1fr', gap:10 }}>
          <div>
            <label style={{ display:'block', fontSize:12, marginBottom:4, fontWeight:600 }}>Organisation / Name *</label>
            <input required type="text" value={kontaktForm.organisation} onChange={e=>setKontaktForm(p=>({...p,organisation:e.target.value}))}
              style={{ width:'100%', padding:'9px 12px', borderRadius:8, border:'1px solid var(--border)', background:'var(--bg-secondary)', color:'var(--text)', fontSize:14 }}/>
          </div>
          <div>
            <label style={{ display:'block', fontSize:12, marginBottom:4, fontWeight:600 }}>Typ</label>
            <select value={kontaktForm.typ} onChange={e=>setKontaktForm(p=>({...p,typ:e.target.value}))}
              style={{ width:'100%', padding:'9px 12px', borderRadius:8, border:'1px solid var(--border)', background:'var(--bg-secondary)', color:'var(--text)', fontSize:14 }}>
              <option value="schule">Schule</option><option value="verband">Verband</option>
              <option value="verein">Verein</option><option value="sonstige">Sonstige</option>
            </select>
          </div>
          <div>
            <label style={{ display:'block', fontSize:12, marginBottom:4, fontWeight:600 }}>Priorität</label>
            <select value={kontaktForm.prioritaet} onChange={e=>setKontaktForm(p=>({...p,prioritaet:e.target.value}))}
              style={{ width:'100%', padding:'9px 12px', borderRadius:8, border:'1px solid var(--border)', background:'var(--bg-secondary)', color:'var(--text)', fontSize:14 }}>
              <option value="hoch">Hoch</option><option value="mittel">Mittel</option><option value="niedrig">Niedrig</option>
            </select>
          </div>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
          {[['ansprechpartner','Ansprechpartner'],['position','Position/Funktion'],['email','E-Mail'],['telefon','Telefon'],['webseite','Website'],['sportart','Sportart/Stil']].map(([field,label]) => (
            <div key={field}>
              <label style={{ display:'block', fontSize:12, marginBottom:4 }}>{label}</label>
              <input type={field==='email'?'email':'text'} value={kontaktForm[field]} onChange={e=>setKontaktForm(p=>({...p,[field]:e.target.value}))}
                style={{ width:'100%', padding:'8px 10px', borderRadius:7, border:'1px solid var(--border)', background:'var(--bg-secondary)', color:'var(--text)', fontSize:13 }}/>
            </div>
          ))}
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr 1fr', gap:10 }}>
          {[['strasse','Straße'],['plz','PLZ'],['ort','Ort']].map(([field,label]) => (
            <div key={field}>
              <label style={{ display:'block', fontSize:12, marginBottom:4 }}>{label}</label>
              <input type="text" value={kontaktForm[field]} onChange={e=>setKontaktForm(p=>({...p,[field]:e.target.value}))}
                style={{ width:'100%', padding:'8px 10px', borderRadius:7, border:'1px solid var(--border)', background:'var(--bg-secondary)', color:'var(--text)', fontSize:13 }}/>
            </div>
          ))}
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10 }}>
          <div>
            <label style={{ display:'block', fontSize:12, marginBottom:4 }}>Status</label>
            <select value={kontaktForm.status} onChange={e=>setKontaktForm(p=>({...p,status:e.target.value}))}
              style={{ width:'100%', padding:'8px 10px', borderRadius:7, border:'1px solid var(--border)', background:'var(--bg-secondary)', color:'var(--text)', fontSize:13 }}>
              {STATUS_PIPELINE.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </div>
          <div>
            <label style={{ display:'block', fontSize:12, marginBottom:4 }}>Quelle</label>
            <select value={kontaktForm.quelle} onChange={e=>setKontaktForm(p=>({...p,quelle:e.target.value}))}
              style={{ width:'100%', padding:'8px 10px', borderRadius:7, border:'1px solid var(--border)', background:'var(--bg-secondary)', color:'var(--text)', fontSize:13 }}>
              <option value="manuell">Manuell</option><option value="tda_events">TDA-Events</option>
              <option value="empfehlung">Empfehlung</option><option value="messe">Messe</option>
              <option value="internet">Internet</option><option value="sonstige">Sonstige</option>
            </select>
          </div>
          <div>
            <label style={{ display:'block', fontSize:12, marginBottom:4 }}>Mitglieder ca.</label>
            <input type="number" value={kontaktForm.mitglieder_anzahl} onChange={e=>setKontaktForm(p=>({...p,mitglieder_anzahl:e.target.value}))}
              style={{ width:'100%', padding:'8px 10px', borderRadius:7, border:'1px solid var(--border)', background:'var(--bg-secondary)', color:'var(--text)', fontSize:13 }}/>
          </div>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 2fr', gap:10 }}>
          <div>
            <label style={{ display:'block', fontSize:12, marginBottom:4 }}>Nächste Aktion</label>
            <input type="date" value={kontaktForm.naechste_aktion} onChange={e=>setKontaktForm(p=>({...p,naechste_aktion:e.target.value}))}
              style={{ width:'100%', padding:'8px 10px', borderRadius:7, border:'1px solid var(--border)', background:'var(--bg-secondary)', color:'var(--text)', fontSize:13 }}/>
          </div>
          <div>
            <label style={{ display:'block', fontSize:12, marginBottom:4 }}>Aktion Beschreibung</label>
            <input type="text" value={kontaktForm.naechste_aktion_info} onChange={e=>setKontaktForm(p=>({...p,naechste_aktion_info:e.target.value}))}
              placeholder="z.B. Anruf vereinbaren, Angebot senden…"
              style={{ width:'100%', padding:'8px 10px', borderRadius:7, border:'1px solid var(--border)', background:'var(--bg-secondary)', color:'var(--text)', fontSize:13 }}/>
          </div>
        </div>
        <div>
          <label style={{ display:'block', fontSize:12, marginBottom:4 }}>Notiz</label>
          <textarea rows={3} value={kontaktForm.notiz} onChange={e=>setKontaktForm(p=>({...p,notiz:e.target.value}))}
            style={{ width:'100%', padding:'8px 10px', borderRadius:7, border:'1px solid var(--border)', background:'var(--bg-secondary)', color:'var(--text)', fontSize:13, resize:'vertical' }}/>
        </div>
        <div style={{ display:'flex', gap:10 }}>
          <button type="submit" className="btn-primary" disabled={subLoading}>
            {subLoading ? <Loader2 size={14} className="spin"/> : <Save size={14}/>} {editingKontakt ? 'Speichern' : 'Anlegen'}
          </button>
          <button type="button" className="btn-secondary" onClick={() => setView(editingKontakt ? 'detail' : 'overview')}>Abbrechen</button>
        </div>
      </form>
    </div>
  );

  // ── RENDER ──────────────────────────────────────────────────────────────────
  return (
    <div style={{ padding:4 }}>
      <FlashMsg msg={flash.msg} type={flash.type} onClose={() => setFlash({ msg:'', type:'' })}/>
      {view === 'overview'   && <OverviewView />}
      {view === 'liste'      && <ListeView />}
      {view === 'detail'     && <DetailView />}
      {view === 'email'      && <EmailView />}
      {view === 'brief'      && <BriefView />}
      {view === 'vorlagen'   && <VorlagenView />}
      {view === 'tda-import' && <TdaImportView />}
      {view === 'form'       && <FormView />}
    </div>
  );
};

export default AkquiseDashboard;
