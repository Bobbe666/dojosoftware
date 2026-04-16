// ============================================================================
// AKQUISE & PARTNER — CRM für Schulen- und Verbandsgewinnung
// Pipeline, E-Mail/Brief-Versand, Protokoll, TDA-Events-Import,
// CSV-Import, Kanban, Bulk-Aktionen, Tags, Duplikat-Check, Dojo-Wizard,
// Trial-Lizenzen Integration
// ============================================================================

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Target, Plus, Search, Filter, Mail, FileText, Phone, Users,
  ChevronRight, ArrowLeft, RefreshCw, Loader2, AlertTriangle,
  Check, X, Edit3, Trash2, Save, Clock, Star, Globe, Building2,
  TrendingUp, BarChart3, Calendar, Send, Printer, Download,
  ExternalLink, Trophy, UserCheck, MessageSquare, Zap, Flag,
  CheckCircle, XCircle, HelpCircle, Info, Eye, PenLine, Tag,
  LayoutList, Columns, Upload, AlertCircle, CreditCard, Sparkles,
  ChevronDown, ChevronUp, Square, CheckSquare
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
  ausstehend:   { color: '#f59e0b', icon: <Clock size={13} />,      label: 'Ausstehend'    },
  positiv:      { color: '#22c55e', icon: <CheckCircle size={13}/>,  label: 'Positiv'       },
  negativ:      { color: '#ef4444', icon: <XCircle size={13}/>,     label: 'Negativ'       },
  keine_antwort:{ color: '#6b7280', icon: <HelpCircle size={13}/>,  label: 'Keine Antwort' },
};

const PRIORITAET_COLORS = { hoch: '#ef4444', mittel: '#f59e0b', niedrig: '#6b7280' };

const INP = {
  width:'100%', padding:'8px 10px', borderRadius:7,
  border:'1px solid var(--border)', background:'var(--bg-secondary)',
  color:'var(--text)', fontSize:13
};

// ── Helper-Komponenten ────────────────────────────────────────────────────────

const StatusBadge = ({ status, small }) => {
  const s = STATUS_PIPELINE.find(x => x.id === status) || STATUS_PIPELINE[0];
  return (
    <span style={{
      display:'inline-block', padding: small ? '1px 8px' : '3px 10px',
      borderRadius:20, fontSize: small ? 11 : 12, fontWeight:600,
      background: s.bg, color: s.color, border:`1px solid ${s.color}40`
    }}>{s.label}</span>
  );
};

const FlashMsg = ({ msg, type, onClose }) => {
  if (!msg) return null;
  const c = type === 'error'
    ? { bg:'rgba(239,68,68,0.1)', border:'rgba(239,68,68,0.4)', color:'#ef4444', icon:<AlertTriangle size={15}/> }
    : { bg:'rgba(34,197,94,0.1)',  border:'rgba(34,197,94,0.4)',  color:'#22c55e', icon:<Check size={15}/> };
  return (
    <div style={{ display:'flex', alignItems:'center', gap:8, padding:'9px 14px',
      background:c.bg, border:`1px solid ${c.border}`, borderRadius:8, marginBottom:14, color:c.color, fontSize:13 }}>
      {c.icon} {msg}
      <button onClick={onClose} style={{ marginLeft:'auto', background:'none', border:'none', cursor:'pointer', color:'inherit' }}><X size={14}/></button>
    </div>
  );
};

// ── Haupt-Komponente ──────────────────────────────────────────────────────────

const AkquiseDashboard = () => {
  // Core state
  const [view, setView] = useState('overview');
  const [listMode, setListMode] = useState('list'); // 'list' | 'kanban'
  const [kontakte, setKontakte] = useState([]);
  const [selectedKontakt, setSelectedKontakt] = useState(null);
  const [aktivitaeten, setAktivitaeten] = useState([]);
  const [vorlagen, setVorlagen] = useState([]);
  const [stats, setStats] = useState(null);
  const [tdaVereine, setTdaVereine] = useState([]);
  const [selectedVereine, setSelectedVereine] = useState(new Set());
  const [trialDojos, setTrialDojos] = useState([]);
  const [selectedTrials, setSelectedTrials] = useState(new Set());

  // UI state
  const [loading, setLoading] = useState(false);
  const [subLoading, setSubLoading] = useState(false);
  const [flash, setFlash] = useState({ msg:'', type:'' });
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typFilter, setTypFilter] = useState('');
  const [tagFilter, setTagFilter] = useState('');

  // Bulk select
  const [bulkSelected, setBulkSelected] = useState(new Set());
  const [bulkStatus, setBulkStatus] = useState('');

  // Formulare
  const [kontaktForm, setKontaktForm] = useState(emptyKontaktForm());
  const [editingKontakt, setEditingKontakt] = useState(null);
  const [tagInput, setTagInput] = useState('');
  const [duplicateWarning, setDuplicateWarning] = useState([]);
  const [emailForm, setEmailForm] = useState({ betreff:'', html:'', vorlage_name:'' });
  const [briefForm, setBriefForm] = useState({ html:'', betreff:'', vorlage_name:'' });
  const [briefHtml, setBriefHtml] = useState('');
  const [aktivitaetForm, setAktivitaetForm] = useState({ art:'telefon', betreff:'', inhalt:'', ergebnis:'ausstehend', ergebnis_notiz:'' });
  const [showAktivitaetForm, setShowAktivitaetForm] = useState(false);
  const [vorlageForm, setVorlageForm] = useState({ name:'', typ:'email', kategorie:'erstanschreiben', betreff:'', html:'' });
  const [editingVorlage, setEditingVorlage] = useState(null);
  const [vorlageEditMode, setVorlageEditMode] = useState(false);

  // CSV Import
  const [csvText, setCsvText] = useState('');
  const [csvImporting, setCsvImporting] = useState(false);
  const [csvResult, setCsvResult] = useState(null);

  // Dojo-Wizard (Status → gewonnen)
  const [dojoWizard, setDojoWizard] = useState({ show:false, kontakt:null });
  const [dojoWizardForm, setDojoWizardForm] = useState({ dojoname:'', subdomain:'', inhaber:'', email:'' });
  const [dojoWizardLoading, setDojoWizardLoading] = useState(false);

  const dupCheckTimer = useRef(null);

  function emptyKontaktForm() {
    return {
      organisation:'', typ:'schule', ansprechpartner:'', position:'',
      email:'', telefon:'', webseite:'', strasse:'', plz:'', ort:'',
      land:'Deutschland', sportart:'', mitglieder_anzahl:'', gegruendet_jahr:'',
      status:'neu', prioritaet:'mittel', quelle:'manuell',
      naechste_aktion:'', naechste_aktion_info:'', notiz:'', tags:[],
    };
  }

  function showSuccess(msg) { setFlash({ msg, type:'success' }); setTimeout(() => setFlash({ msg:'', type:'' }), 4000); }
  function showError(msg)   { setFlash({ msg, type:'error' }); }

  // ── API Calls ───────────────────────────────────────────────────────────────

  const loadKontakte = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.append('status', statusFilter);
      if (typFilter)    params.append('typ', typFilter);
      if (searchTerm)   params.append('search', searchTerm);
      const r = await fetchWithAuth(`${API}/kontakte?${params}`);
      const d = await r.json();
      setKontakte(d.kontakte || []);
    } catch (e) { showError('Fehler beim Laden'); }
    finally { setLoading(false); }
  }, [statusFilter, typFilter, searchTerm]);

  const loadStats    = useCallback(async () => {
    try { const r = await fetchWithAuth(`${API}/stats`); const d = await r.json(); if (d.success) setStats(d); } catch (_) {}
  }, []);

  const loadVorlagen = useCallback(async () => {
    try { const r = await fetchWithAuth(`${API}/vorlagen`); const d = await r.json(); setVorlagen(d.vorlagen || []); } catch (_) {}
  }, []);

  const loadAktivitaeten = useCallback(async (id) => {
    try { const r = await fetchWithAuth(`${API}/kontakte/${id}/aktivitaeten`); const d = await r.json(); setAktivitaeten(d.aktivitaeten || []); } catch (_) {}
  }, []);

  const loadTdaVereine = useCallback(async () => {
    setSubLoading(true);
    try { const r = await fetchWithAuth(`${API}/tda-events/vereine`); const d = await r.json(); setTdaVereine(d.vereine || []); }
    catch (e) { showError('TDA-Events API nicht erreichbar'); }
    finally { setSubLoading(false); }
  }, []);

  const loadTrialDojos = useCallback(async () => {
    setSubLoading(true);
    try { const r = await fetchWithAuth(`${API}/trial-dojos`); const d = await r.json(); setTrialDojos(d.dojos || []); }
    catch (e) { showError('Fehler beim Laden der Trial-Dojos'); }
    finally { setSubLoading(false); }
  }, []);

  useEffect(() => { loadKontakte(); }, [loadKontakte]);
  useEffect(() => { loadStats(); loadVorlagen(); }, []);
  useEffect(() => {
    if (view === 'detail' && selectedKontakt) loadAktivitaeten(selectedKontakt.id);
    if (view === 'tda-import' && tdaVereine.length === 0) loadTdaVereine();
    if (view === 'trial-import') loadTrialDojos();
  }, [view, selectedKontakt]);

  // ── Duplicate check ─────────────────────────────────────────────────────────

  const checkDuplicate = (org) => {
    clearTimeout(dupCheckTimer.current);
    if (!org || org.length < 3) { setDuplicateWarning([]); return; }
    dupCheckTimer.current = setTimeout(async () => {
      try {
        const r = await fetchWithAuth(`${API}/kontakte/check-duplicate?organisation=${encodeURIComponent(org)}`);
        const d = await r.json();
        const filtered = (d.duplikate || []).filter(k => !editingKontakt || k.id !== editingKontakt.id);
        setDuplicateWarning(filtered);
      } catch (_) {}
    }, 500);
  };

  // ── Tags ────────────────────────────────────────────────────────────────────

  const addTag = (tag) => {
    const t = tag.trim();
    if (!t || (kontaktForm.tags || []).includes(t)) return;
    setKontaktForm(p => ({ ...p, tags: [...(p.tags || []), t] }));
    setTagInput('');
  };

  const removeTag = (tag) => {
    setKontaktForm(p => ({ ...p, tags: (p.tags || []).filter(t => t !== tag) }));
  };

  // ── Kontakt öffnen ──────────────────────────────────────────────────────────

  const openKontakt = (k) => { setSelectedKontakt(k); setView('detail'); };

  // ── Kontakt speichern ───────────────────────────────────────────────────────

  const handleKontaktSubmit = async (e) => {
    e.preventDefault();
    setSubLoading(true);
    try {
      const method = editingKontakt ? 'PUT' : 'POST';
      const url = editingKontakt ? `${API}/kontakte/${editingKontakt.id}` : `${API}/kontakte`;
      const payload = { ...kontaktForm, tags: JSON.stringify(kontaktForm.tags || []) };
      const r = await fetchWithAuth(url, { method, headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload) });
      const d = await r.json();
      if (d.success) {
        showSuccess(editingKontakt ? 'Gespeichert' : 'Kontakt angelegt');
        setEditingKontakt(null); setKontaktForm(emptyKontaktForm());
        setView('liste'); loadKontakte(); loadStats();
      } else showError(d.message);
    } catch (e) { showError('Fehler'); }
    finally { setSubLoading(false); }
  };

  const handleKontaktDelete = async (k) => {
    if (!confirm(`"${k.organisation}" wirklich löschen inkl. Protokoll?`)) return;
    try {
      await fetchWithAuth(`${API}/kontakte/${k.id}`, { method:'DELETE' });
      showSuccess('Gelöscht');
      if (selectedKontakt?.id === k.id) { setSelectedKontakt(null); setView('liste'); }
      loadKontakte(); loadStats();
    } catch (e) { showError('Fehler'); }
  };

  const handleStatusChange = async (k, newStatus) => {
    try {
      const r = await fetchWithAuth(`${API}/kontakte/${k.id}`, {
        method:'PUT', headers:{'Content-Type':'application/json'},
        body:JSON.stringify({ ...k, status:newStatus })
      });
      const d = await r.json();
      if (d.success) {
        if (selectedKontakt?.id === k.id) setSelectedKontakt(d.kontakt);
        loadKontakte(); loadStats(); loadAktivitaeten(k.id);
        showSuccess(`Status → ${newStatus}`);
        // Dojo-Wizard wenn gewonnen und noch kein Dojo angelegt
        if (newStatus === 'gewonnen' && !k.verbandsmitgliedschaft_id) {
          const slug = k.organisation.toLowerCase().replace(/[äöü]/g, c => ({ä:'ae',ö:'oe',ü:'ue'}[c]||c))
            .replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g,'');
          setDojoWizardForm({ dojoname:k.organisation, subdomain:slug, inhaber:k.ansprechpartner||'', email:k.email||'' });
          setDojoWizard({ show:true, kontakt:d.kontakt });
        }
      }
    } catch (e) { showError('Fehler'); }
  };

  // ── Bulk-Aktionen ───────────────────────────────────────────────────────────

  const toggleBulk = (id) => {
    const s = new Set(bulkSelected);
    if (s.has(id)) s.delete(id); else s.add(id);
    setBulkSelected(s);
  };

  const handleBulkUpdate = async () => {
    if (!bulkStatus || bulkSelected.size === 0) return showError('Status und Kontakte wählen');
    try {
      const r = await fetchWithAuth(`${API}/kontakte/bulk-update`, {
        method:'POST', headers:{'Content-Type':'application/json'},
        body:JSON.stringify({ ids:[...bulkSelected], status:bulkStatus })
      });
      const d = await r.json();
      if (d.success) {
        showSuccess(`${d.updated} Kontakte auf "${bulkStatus}" gesetzt`);
        setBulkSelected(new Set()); setBulkStatus('');
        loadKontakte(); loadStats();
      }
    } catch (e) { showError('Fehler'); }
  };

  // ── E-Mail ──────────────────────────────────────────────────────────────────

  const handleEmailSend = async () => {
    if (!emailForm.betreff || !emailForm.html) return showError('Betreff und Inhalt sind Pflichtfelder');
    setSubLoading(true);
    try {
      const r = await fetchWithAuth(`${API}/kontakte/${selectedKontakt.id}/email`, {
        method:'POST', headers:{'Content-Type':'application/json'},
        body:JSON.stringify({ betreff_raw:emailForm.betreff, html_raw:emailForm.html, vorlage_name:emailForm.vorlage_name })
      });
      const d = await r.json();
      if (d.success) {
        showSuccess(d.message); setEmailForm({ betreff:'', html:'', vorlage_name:'' }); setView('detail');
        loadAktivitaeten(selectedKontakt.id);
        const kr = await fetchWithAuth(`${API}/kontakte/${selectedKontakt.id}`); const kd = await kr.json();
        if (kd.kontakt) setSelectedKontakt(kd.kontakt);
        loadKontakte(); loadStats();
      } else showError(d.message);
    } catch (e) { showError('Fehler'); }
    finally { setSubLoading(false); }
  };

  // ── Brief ───────────────────────────────────────────────────────────────────

  const handleBriefErstellen = async () => {
    if (!briefForm.html) return showError('Inhalt ist leer');
    setSubLoading(true);
    try {
      const r = await fetchWithAuth(`${API}/kontakte/${selectedKontakt.id}/brief`, {
        method:'POST', headers:{'Content-Type':'application/json'},
        body:JSON.stringify({ html_raw:briefForm.html, betreff_raw:briefForm.betreff, vorlage_name:briefForm.vorlage_name })
      });
      const d = await r.json();
      if (d.success) { setBriefHtml(d.html); showSuccess('Brief erstellt'); loadAktivitaeten(selectedKontakt.id); }
      else showError(d.message);
    } catch (e) { showError('Fehler'); }
    finally { setSubLoading(false); }
  };

  const printBrief = () => {
    const w = window.open('', '_blank');
    w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8">
    <title>Brief — ${selectedKontakt?.organisation}</title>
    <style>
      *{box-sizing:border-box;margin:0;padding:0}
      body{font-family:Arial,sans-serif;font-size:11pt;line-height:1.6;color:#000;background:#fff}
      @page{size:A4;margin:2.5cm 2cm 2cm 2.5cm}
      @media print{body{margin:0}.toolbar{display:none!important}}
      @media screen{body{max-width:21cm;margin:1cm auto;padding:2.5cm 2cm 2cm 2.5cm;background:#fff;box-shadow:0 2px 20px rgba(0,0,0,0.15)}}
      p{margin-bottom:0.8em}ul,ol{margin-left:1.5em;margin-bottom:0.8em}
      h1,h2,h3{font-size:11pt;font-weight:bold}table{border-collapse:collapse}
      .toolbar{background:#1e3a5f;color:#fff;padding:10px 20px;display:flex;align-items:center;gap:12px;
        margin:-2.5cm -2cm 2cm -2.5cm;font-family:Arial,sans-serif;font-size:13px}
    </style></head><body>
    <div class="toolbar">
      <strong>Brief-Vorschau (DIN A4)</strong>
      <button onclick="window.print()" style="background:#DAA520;color:#000;border:none;padding:7px 16px;border-radius:4px;cursor:pointer;font-weight:bold;font-size:13px">🖨 Drucken / Als PDF speichern</button>
      <button onclick="window.close()" style="background:none;color:#fff;border:1px solid rgba(255,255,255,0.4);padding:7px 14px;border-radius:4px;cursor:pointer;font-size:13px">Schließen</button>
    </div>
    ${briefHtml}
    </body></html>`);
    w.document.close();
  };

  // ── Aktivität ───────────────────────────────────────────────────────────────

  const handleAktivitaetSave = async () => {
    if (!aktivitaetForm.art) return;
    try {
      await fetchWithAuth(`${API}/kontakte/${selectedKontakt.id}/aktivitaet`, {
        method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(aktivitaetForm)
      });
      showSuccess('Protokolliert');
      setAktivitaetForm({ art:'telefon', betreff:'', inhalt:'', ergebnis:'ausstehend', ergebnis_notiz:'' });
      setShowAktivitaetForm(false);
      loadAktivitaeten(selectedKontakt.id); loadKontakte(); loadStats();
    } catch (e) { showError('Fehler'); }
  };

  // ── CSV Import ──────────────────────────────────────────────────────────────

  const handleCsvImport = async () => {
    if (!csvText.trim()) return showError('Kein CSV-Inhalt');
    setCsvImporting(true); setCsvResult(null);
    try {
      const r = await fetchWithAuth(`${API}/kontakte/csv-import`, {
        method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ csv:csvText })
      });
      const d = await r.json();
      setCsvResult(d);
      if (d.success) { showSuccess(d.message); loadKontakte(); loadStats(); }
    } catch (e) { showError('Fehler beim Import'); }
    finally { setCsvImporting(false); }
  };

  // ── Dojo-Wizard ─────────────────────────────────────────────────────────────

  const handleCreateDojo = async () => {
    if (!dojoWizardForm.dojoname || !dojoWizardForm.inhaber) return showError('Dojoname und Inhaber sind Pflicht');
    setDojoWizardLoading(true);
    try {
      const r = await fetchWithAuth(`${API}/kontakte/${dojoWizard.kontakt.id}/create-dojo`, {
        method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(dojoWizardForm)
      });
      const d = await r.json();
      if (d.success) {
        showSuccess(d.message);
        setDojoWizard({ show:false, kontakt:null });
        loadKontakte();
      } else showError(d.message);
    } catch (e) { showError('Fehler beim Anlegen'); }
    finally { setDojoWizardLoading(false); }
  };

  // ── TDA-Events Import ───────────────────────────────────────────────────────

  const handleTdaImport = async () => {
    const liste = tdaVereine.filter(v => selectedVereine.has(v.name) && !v.bereits_importiert);
    if (liste.length === 0) return showError('Keine neuen Vereine ausgewählt');
    try {
      const r = await fetchWithAuth(`${API}/tda-events/importieren`, {
        method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ vereine:liste })
      });
      const d = await r.json();
      if (d.success) { showSuccess(d.message); setSelectedVereine(new Set()); setView('liste'); loadKontakte(); loadStats(); loadTdaVereine(); }
    } catch (e) { showError('Fehler'); }
  };

  // ── Trial-Dojos Import ──────────────────────────────────────────────────────

  const handleTrialImport = async () => {
    const ids = [...selectedTrials].map(Number);
    if (ids.length === 0) return showError('Keine Dojos ausgewählt');
    try {
      const r = await fetchWithAuth(`${API}/trial-dojos/importieren`, {
        method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ dojo_ids:ids })
      });
      const d = await r.json();
      if (d.success) { showSuccess(d.message); setSelectedTrials(new Set()); setView('liste'); loadKontakte(); loadStats(); loadTrialDojos(); }
    } catch (e) { showError('Fehler'); }
  };

  // ── Vorlage → Form ──────────────────────────────────────────────────────────

  const vorlageInEmail = (v) => { setEmailForm({ betreff:v.betreff||'', html:v.html||'', vorlage_name:v.name }); setView('email'); };
  const vorlageInBrief = (v) => { setBriefForm({ betreff:v.betreff||'', html:v.html||'', vorlage_name:v.name }); setBriefHtml(''); setView('brief'); };

  const handleVorlageSave = async () => {
    if (!vorlageForm.name || !vorlageForm.html) return showError('Name und Inhalt sind Pflicht');
    try {
      const method = editingVorlage ? 'PUT' : 'POST';
      const url = editingVorlage ? `${API}/vorlagen/${editingVorlage.id}` : `${API}/vorlagen`;
      await fetchWithAuth(url, { method, headers:{'Content-Type':'application/json'}, body:JSON.stringify(vorlageForm) });
      showSuccess('Gespeichert'); setEditingVorlage(null);
      setVorlageForm({ name:'', typ:'email', kategorie:'erstanschreiben', betreff:'', html:'' });
      setVorlageEditMode(false); loadVorlagen();
    } catch (e) { showError('Fehler'); }
  };

  const handleVorlageDelete = async (v) => {
    if (!confirm(`Vorlage "${v.name}" löschen?`)) return;
    try { await fetchWithAuth(`${API}/vorlagen/${v.id}`, { method:'DELETE' }); showSuccess('Gelöscht'); loadVorlagen(); }
    catch (e) { showError('Fehler'); }
  };

  // ── Filter ──────────────────────────────────────────────────────────────────

  const filteredKontakte = kontakte.filter(k => {
    if (tagFilter) {
      const tags = Array.isArray(k.tags) ? k.tags : (k.tags ? JSON.parse(k.tags) : []);
      if (!tags.includes(tagFilter)) return false;
    }
    return true;
  });

  // Alle verwendeten Tags sammeln
  const allTags = [...new Set(
    kontakte.flatMap(k => {
      try { return Array.isArray(k.tags) ? k.tags : (k.tags ? JSON.parse(k.tags) : []); }
      catch { return []; }
    })
  )];

  // ══════════════════════════════════════════════════════════════════════════
  // DOJO WIZARD MODAL
  // ══════════════════════════════════════════════════════════════════════════

  const DojoWizardModal = () => {
    if (!dojoWizard.show) return null;
    return (
      <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', zIndex:9999, display:'flex', alignItems:'center', justifyContent:'center' }}>
        <div style={{ background:'var(--bg-secondary)', borderRadius:14, padding:28, maxWidth:480, width:'90%', border:'1px solid var(--border)' }}>
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:20 }}>
            <Sparkles size={22} style={{ color:'#22c55e' }}/>
            <h3 style={{ margin:0 }}>Glückwunsch! Dojo anlegen?</h3>
          </div>
          <p style={{ fontSize:13, color:'var(--text-muted)', marginBottom:18 }}>
            <strong>{dojoWizard.kontakt?.organisation}</strong> wurde als gewonnen markiert.
            Möchten Sie direkt einen Dojo-Account in der Software anlegen?
          </p>
          <div style={{ display:'flex', flexDirection:'column', gap:10, marginBottom:18 }}>
            {[
              ['dojoname', 'Dojoname *', 'text'],
              ['subdomain', 'Subdomain (z.B. mein-dojo)', 'text'],
              ['inhaber', 'Inhaber / Ansprechpartner *', 'text'],
              ['email', 'E-Mail', 'email'],
            ].map(([field, label, type]) => (
              <div key={field}>
                <label style={{ display:'block', fontSize:12, marginBottom:3 }}>{label}</label>
                <input type={type} value={dojoWizardForm[field]}
                  onChange={e => setDojoWizardForm(p => ({ ...p, [field]:e.target.value }))}
                  style={INP}/>
              </div>
            ))}
          </div>
          <div style={{ display:'flex', gap:10 }}>
            <button className="btn-primary" onClick={handleCreateDojo} disabled={dojoWizardLoading} style={{ flex:1 }}>
              {dojoWizardLoading ? <Loader2 size={14} className="spin"/> : <Building2 size={14}/>} Dojo anlegen
            </button>
            <button className="btn-secondary" onClick={() => setDojoWizard({ show:false, kontakt:null })}>
              Später
            </button>
          </div>
        </div>
      </div>
    );
  };

  // ══════════════════════════════════════════════════════════════════════════
  // OVERVIEW VIEW
  // ══════════════════════════════════════════════════════════════════════════

  const OverviewView = () => (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
        <h3 style={{ margin:0, display:'flex', alignItems:'center', gap:8 }}><Target size={20}/> Akquise & Partnerschaften</h3>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
          <button className="btn-secondary" onClick={() => setView('trial-import')}><CreditCard size={15}/> Trial-Lizenzen</button>
          <button className="btn-secondary" onClick={() => setView('tda-import')}><Zap size={15}/> TDA-Events</button>
          <button className="btn-secondary" onClick={() => setView('csv-import')}><Upload size={15}/> CSV-Import</button>
          <button className="btn-secondary" onClick={() => setView('vorlagen')}><FileText size={15}/> Vorlagen</button>
          <button className="btn-primary" onClick={() => { setEditingKontakt(null); setKontaktForm(emptyKontaktForm()); setView('form'); }}>
            <Plus size={15}/> Neuer Kontakt
          </button>
        </div>
      </div>

      {/* Pipeline */}
      {stats && (
        <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:20 }}>
          {STATUS_PIPELINE.map(s => (
            <div key={s.id} onClick={() => { setStatusFilter(s.id); setView('liste'); }}
              style={{ flex:'1 0 90px', padding:'12px 14px', borderRadius:10, cursor:'pointer',
                background:s.bg, border:`1px solid ${s.color}40`, textAlign:'center', transition:'transform 0.1s' }}
              onMouseEnter={e => e.currentTarget.style.transform='scale(1.04)'}
              onMouseLeave={e => e.currentTarget.style.transform='scale(1)'}>
              <div style={{ fontSize:24, fontWeight:800, color:s.color }}>{stats.pipeline?.[s.id] || 0}</div>
              <div style={{ fontSize:11, color:s.color, opacity:0.85 }}>{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* KPIs */}
      {stats && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(170px,1fr))', gap:12, marginBottom:20 }}>
          <div className="verband-stat-card success">
            <div className="stat-icon"><CheckCircle size={22}/></div>
            <div className="stat-content"><span className="stat-value">{stats.gewonnen}</span><span className="stat-label">Gewonnen</span></div>
          </div>
          <div className="verband-stat-card warning">
            <div className="stat-icon"><Clock size={22}/></div>
            <div className="stat-content"><span className="stat-value">{stats.followUp_faellig}</span><span className="stat-label">Follow-Up fällig</span></div>
          </div>
          <div className="verband-stat-card gold">
            <div className="stat-icon"><Target size={22}/></div>
            <div className="stat-content"><span className="stat-value">{stats.gesamt}</span><span className="stat-label">Gesamt</span></div>
          </div>
          <div className="verband-stat-card info">
            <div className="stat-icon"><TrendingUp size={22}/></div>
            <div className="stat-content">
              <span className="stat-value">{stats.gesamt > 0 ? Math.round((stats.gewonnen / stats.gesamt) * 100) : 0}%</span>
              <span className="stat-label">Conversion</span>
            </div>
          </div>
        </div>
      )}

      {/* Follow-Up fällig */}
      {kontakte.filter(k => k.naechste_aktion && new Date(k.naechste_aktion) <= new Date() && !['gewonnen','abgelehnt'].includes(k.status)).length > 0 && (
        <div className="verband-panel" style={{ marginBottom:16 }}>
          <div className="panel-header">
            <h4 style={{ margin:0, display:'flex', alignItems:'center', gap:6, color:'var(--warning,#f59e0b)' }}>
              <Clock size={16}/> Follow-Up fällig
            </h4>
          </div>
          <div className="panel-content">
            {kontakte.filter(k => k.naechste_aktion && new Date(k.naechste_aktion) <= new Date() && !['gewonnen','abgelehnt'].includes(k.status))
              .slice(0,5).map(k => (
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
              <div style={{ width:32, height:32, borderRadius:'50%', background:STATUS_PIPELINE.find(s=>s.id===k.status)?.bg||'var(--bg)',
                border:`1px solid ${STATUS_PIPELINE.find(s=>s.id===k.status)?.color||'var(--border)'}40`,
                display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:700, flexShrink:0,
                color:STATUS_PIPELINE.find(s=>s.id===k.status)?.color }}>
                {k.organisation[0]}
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontWeight:600, fontSize:14, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{k.organisation}</div>
                <div style={{ fontSize:11, color:'var(--text-muted)' }}>
                  {k.ort && `${k.ort} · `}{k.sportart || k.typ}
                  {k.aktivitaeten_count > 0 && ` · ${k.aktivitaeten_count} Akt.`}
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

  // ══════════════════════════════════════════════════════════════════════════
  // LISTE + KANBAN
  // ══════════════════════════════════════════════════════════════════════════

  const ListeView = () => {
    const allIds = filteredKontakte.map(k => k.id);
    const allSelected = allIds.length > 0 && allIds.every(id => bulkSelected.has(id));
    const toggleAll = () => {
      if (allSelected) setBulkSelected(new Set());
      else setBulkSelected(new Set(allIds));
    };

    return (
      <div>
        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:16 }}>
          <button className="btn-icon" onClick={() => { setStatusFilter(''); setView('overview'); }}><ArrowLeft size={18}/></button>
          <h3 style={{ margin:0, flex:1 }}>Kontakte ({filteredKontakte.length})</h3>
          <div style={{ display:'flex', gap:6 }}>
            <button className={`btn-icon ${listMode==='list'?'active':''}`} title="Liste" onClick={() => setListMode('list')}><LayoutList size={16}/></button>
            <button className={`btn-icon ${listMode==='kanban'?'active':''}`} title="Kanban" onClick={() => setListMode('kanban')}><Columns size={16}/></button>
          </div>
          <button className="btn-primary" onClick={() => { setEditingKontakt(null); setKontaktForm(emptyKontaktForm()); setView('form'); }}>
            <Plus size={15}/> Neu
          </button>
        </div>

        {/* Filter-Leiste */}
        <div style={{ display:'flex', gap:8, marginBottom:10, flexWrap:'wrap' }}>
          <div style={{ position:'relative', flex:1, minWidth:180 }}>
            <Search size={14} style={{ position:'absolute', left:9, top:'50%', transform:'translateY(-50%)', color:'var(--text-muted)' }}/>
            <input type="text" placeholder="Organisation, Ansprechpartner, Ort…" value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              style={{ ...INP, paddingLeft:30 }}/>
          </div>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={INP}>
            <option value="">Alle Status</option>
            {STATUS_PIPELINE.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
          <select value={typFilter} onChange={e => setTypFilter(e.target.value)} style={INP}>
            <option value="">Alle Typen</option>
            <option value="schule">Schule</option><option value="verband">Verband</option>
            <option value="verein">Verein</option><option value="sonstige">Sonstige</option>
          </select>
          {allTags.length > 0 && (
            <select value={tagFilter} onChange={e => setTagFilter(e.target.value)} style={INP}>
              <option value="">Alle Tags</option>
              {allTags.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          )}
        </div>

        {/* Bulk-Aktionsleiste */}
        {bulkSelected.size > 0 && (
          <div style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 14px', marginBottom:10,
            background:'rgba(59,130,246,0.08)', border:'1px solid rgba(59,130,246,0.3)', borderRadius:8 }}>
            <CheckSquare size={16} style={{ color:'#3b82f6' }}/>
            <span style={{ fontSize:13, color:'#3b82f6', fontWeight:600 }}>{bulkSelected.size} ausgewählt</span>
            <select value={bulkStatus} onChange={e => setBulkStatus(e.target.value)}
              style={{ ...INP, width:'auto', flex:1, maxWidth:200 }}>
              <option value="">Status setzen…</option>
              {STATUS_PIPELINE.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
            <button className="btn-primary" style={{ padding:'6px 14px', fontSize:13 }} onClick={handleBulkUpdate}>
              Anwenden
            </button>
            <button className="btn-secondary" style={{ padding:'6px 12px', fontSize:13 }} onClick={() => setBulkSelected(new Set())}>
              Abwählen
            </button>
          </div>
        )}

        {loading ? <div style={{ textAlign:'center', padding:40 }}><Loader2 size={28} className="spin"/></div>
          : listMode === 'kanban' ? <KanbanView />
          : filteredKontakte.length === 0 ? (
            <div className="empty-state large"><Target size={44}/><h4>Keine Kontakte</h4></div>
          ) : (
            <div>
              {/* Alle auswählen */}
              <div style={{ display:'flex', alignItems:'center', gap:8, padding:'6px 4px', marginBottom:4 }}>
                <input type="checkbox" checked={allSelected} onChange={toggleAll}
                  style={{ width:15, height:15, accentColor:'#3b82f6', cursor:'pointer' }}/>
                <span style={{ fontSize:12, color:'var(--text-muted)' }}>Alle auswählen</span>
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                {filteredKontakte.map(k => {
                  const kTags = (() => { try { return Array.isArray(k.tags) ? k.tags : (k.tags ? JSON.parse(k.tags) : []); } catch { return []; } })();
                  return (
                    <div key={k.id} className="verband-panel" style={{ padding:'10px 14px' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                        <input type="checkbox" checked={bulkSelected.has(k.id)} onChange={() => toggleBulk(k.id)}
                          style={{ width:15, height:15, accentColor:'#3b82f6', cursor:'pointer', flexShrink:0 }}/>
                        <div style={{ width:36, height:36, borderRadius:'50%', flexShrink:0,
                          background:STATUS_PIPELINE.find(s=>s.id===k.status)?.bg||'var(--bg-secondary)',
                          display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700, fontSize:14,
                          color:STATUS_PIPELINE.find(s=>s.id===k.status)?.color }}>
                          {k.organisation[0]}
                        </div>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ display:'flex', alignItems:'center', gap:6, flexWrap:'wrap' }}>
                            <strong style={{ fontSize:14 }}>{k.organisation}</strong>
                            <span style={{ fontSize:11, color:'var(--text-muted)', background:'var(--bg)', padding:'1px 7px', borderRadius:10, border:'1px solid var(--border)' }}>{k.typ}</span>
                            {k.sportart && <span style={{ fontSize:11, color:'var(--text-muted)' }}>{k.sportart}</span>}
                            {k.prioritaet === 'hoch' && <span style={{ fontSize:11, color:'#ef4444', fontWeight:700 }}>↑ Hoch</span>}
                            {kTags.map(t => (
                              <span key={t} style={{ fontSize:10, background:'rgba(139,92,246,0.12)', color:'#8b5cf6', padding:'1px 6px', borderRadius:10, border:'1px solid rgba(139,92,246,0.3)' }}>
                                {t}
                              </span>
                            ))}
                          </div>
                          <div style={{ fontSize:12, color:'var(--text-muted)', marginTop:2 }}>
                            {k.ansprechpartner && `${k.ansprechpartner} · `}
                            {k.ort && `${k.ort} · `}
                            {k.aktivitaeten_count > 0 ? `${k.aktivitaeten_count} Akt.` : 'Keine Aktivitäten'}
                            {k.naechste_aktion && new Date(k.naechste_aktion) <= new Date() &&
                              <span style={{ color:'#f59e0b', marginLeft:6 }}><Clock size={11} style={{ verticalAlign:'middle' }}/> Follow-Up fällig</span>}
                          </div>
                        </div>
                        <div style={{ display:'flex', alignItems:'center', gap:6, flexShrink:0 }}>
                          <StatusBadge status={k.status} small />
                          <button className="btn-secondary" style={{ padding:'4px 10px', fontSize:12 }} onClick={() => openKontakt(k)}>
                            Öffnen <ChevronRight size={13}/>
                          </button>
                          <button className="btn-icon" onClick={() => { setEditingKontakt(k); setKontaktForm({...k, tags: (() => { try { return Array.isArray(k.tags) ? k.tags : (k.tags ? JSON.parse(k.tags) : []); } catch { return []; } })()}); setView('form'); }}>
                            <Edit3 size={14}/>
                          </button>
                          <button className="btn-icon btn-icon-danger" onClick={() => handleKontaktDelete(k)}>
                            <Trash2 size={14}/>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
      </div>
    );
  };

  // ── KANBAN VIEW ─────────────────────────────────────────────────────────────

  const KanbanView = () => (
    <div style={{ display:'flex', gap:10, overflowX:'auto', paddingBottom:8, minHeight:300 }}>
      {STATUS_PIPELINE.map(s => {
        const col = filteredKontakte.filter(k => k.status === s.id);
        return (
          <div key={s.id} style={{ minWidth:220, flex:'0 0 220px', background:'var(--bg)', borderRadius:10,
            border:`1px solid ${s.color}30`, display:'flex', flexDirection:'column' }}>
            <div style={{ padding:'10px 12px', borderBottom:`2px solid ${s.color}40`,
              display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <span style={{ fontWeight:700, fontSize:13, color:s.color }}>{s.label}</span>
              <span style={{ fontSize:12, background:s.bg, color:s.color, padding:'1px 8px', borderRadius:10 }}>{col.length}</span>
            </div>
            <div style={{ flex:1, padding:'8px', display:'flex', flexDirection:'column', gap:6, overflowY:'auto', maxHeight:420 }}>
              {col.map(k => (
                <div key={k.id} onClick={() => openKontakt(k)}
                  style={{ background:'var(--bg-secondary)', border:'1px solid var(--border)', borderRadius:8,
                    padding:'9px 11px', cursor:'pointer', transition:'border-color 0.15s' }}
                  onMouseEnter={e => e.currentTarget.style.borderColor=s.color}
                  onMouseLeave={e => e.currentTarget.style.borderColor='var(--border)'}>
                  <div style={{ fontWeight:600, fontSize:13, marginBottom:3, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{k.organisation}</div>
                  <div style={{ fontSize:11, color:'var(--text-muted)' }}>{k.ort || k.typ}</div>
                  {k.naechste_aktion && new Date(k.naechste_aktion) <= new Date() && (
                    <div style={{ fontSize:10, color:'#f59e0b', marginTop:4, display:'flex', alignItems:'center', gap:3 }}>
                      <Clock size={10}/> Follow-Up fällig
                    </div>
                  )}
                  {k.prioritaet === 'hoch' && <div style={{ fontSize:10, color:'#ef4444', marginTop:2, fontWeight:700 }}>↑ Hoch</div>}
                </div>
              ))}
              {col.length === 0 && (
                <div style={{ textAlign:'center', padding:'20px 0', color:'var(--text-muted)', fontSize:12 }}>Leer</div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );

  // ══════════════════════════════════════════════════════════════════════════
  // DETAIL VIEW
  // ══════════════════════════════════════════════════════════════════════════

  const DetailView = () => {
    if (!selectedKontakt) return null;
    const k = selectedKontakt;
    const kTags = (() => { try { return Array.isArray(k.tags) ? k.tags : (k.tags ? JSON.parse(k.tags) : []); } catch { return []; } })();
    return (
      <div>
        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:18 }}>
          <button className="btn-icon" onClick={() => { setView('liste'); setSelectedKontakt(null); }}><ArrowLeft size={18}/></button>
          <div style={{ flex:1 }}>
            <h3 style={{ margin:0 }}>{k.organisation}</h3>
            <div style={{ fontSize:13, color:'var(--text-muted)' }}>
              {k.typ} {k.sportart ? `· ${k.sportart}` : ''} {k.ort ? `· ${k.ort}` : ''}
            </div>
          </div>
          <select value={k.status} onChange={e => handleStatusChange(k, e.target.value)}
            style={{ padding:'6px 10px', borderRadius:8,
              border:`2px solid ${STATUS_PIPELINE.find(s=>s.id===k.status)?.color||'var(--border)'}`,
              background:'var(--bg-secondary)', color:STATUS_PIPELINE.find(s=>s.id===k.status)?.color, fontWeight:700, fontSize:13 }}>
            {STATUS_PIPELINE.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
          <button className="btn-icon" onClick={() => {
            setEditingKontakt(k);
            const tags = (() => { try { return Array.isArray(k.tags) ? k.tags : (k.tags ? JSON.parse(k.tags) : []); } catch { return []; } })();
            setKontaktForm({...k, tags}); setView('form');
          }}><Edit3 size={16}/></button>
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, marginBottom:16 }}>
          {/* Kontaktdaten */}
          <div className="verband-panel" style={{ padding:'14px 16px' }}>
            <div style={{ fontWeight:700, marginBottom:10, display:'flex', alignItems:'center', gap:6 }}><Building2 size={15}/> Kontaktdaten</div>
            {[
              ['Ansprechpartner', k.ansprechpartner],
              ['Position', k.position],
              ['E-Mail', k.email && <a href={`mailto:${k.email}`} style={{ color:'var(--primary,#DAA520)' }}>{k.email}</a>],
              ['Telefon', k.telefon && <a href={`tel:${k.telefon}`} style={{ color:'var(--primary,#DAA520)' }}>{k.telefon}</a>],
              ['Website', k.webseite && <a href={k.webseite} target="_blank" rel="noopener noreferrer" style={{ color:'var(--primary,#DAA520)', display:'flex', alignItems:'center', gap:4 }}>{k.webseite} <ExternalLink size={12}/></a>],
              ['Adresse', [k.strasse, `${k.plz||''} ${k.ort||''}`.trim(), k.land !== 'Deutschland' ? k.land : null].filter(Boolean).join(', ')],
              ['Mitglieder', k.mitglieder_anzahl],
              ['Quelle', k.quelle],
            ].filter(([,v]) => v).map(([label, val]) => (
              <div key={label} style={{ display:'flex', gap:8, marginBottom:5, fontSize:13 }}>
                <span style={{ color:'var(--text-muted)', width:120, flexShrink:0 }}>{label}</span>
                <span>{val}</span>
              </div>
            ))}
            {kTags.length > 0 && (
              <div style={{ display:'flex', gap:5, flexWrap:'wrap', marginTop:8 }}>
                {kTags.map(t => (
                  <span key={t} style={{ fontSize:11, background:'rgba(139,92,246,0.12)', color:'#8b5cf6',
                    padding:'2px 8px', borderRadius:10, border:'1px solid rgba(139,92,246,0.3)' }}>
                    {t}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Pipeline & Aktionen */}
          <div className="verband-panel" style={{ padding:'14px 16px' }}>
            <div style={{ fontWeight:700, marginBottom:10, display:'flex', alignItems:'center', gap:6 }}><Flag size={15}/> Pipeline & Follow-Up</div>
            <div style={{ display:'flex', gap:6, marginBottom:12, flexWrap:'wrap' }}>
              <StatusBadge status={k.status}/>
              <span style={{ display:'inline-block', padding:'3px 10px', borderRadius:20, fontSize:12, fontWeight:600,
                background:'var(--bg)', border:`1px solid ${PRIORITAET_COLORS[k.prioritaet]}40`, color:PRIORITAET_COLORS[k.prioritaet] }}>
                Priorität: {k.prioritaet}
              </span>
            </div>
            {k.naechste_aktion && (
              <div style={{ padding:'8px 10px', borderRadius:8, background:'rgba(245,158,11,0.1)', border:'1px solid rgba(245,158,11,0.3)', marginBottom:10 }}>
                <div style={{ fontSize:12, color:'var(--warning,#f59e0b)', fontWeight:700, display:'flex', alignItems:'center', gap:5 }}>
                  <Calendar size={13}/> {new Date(k.naechste_aktion).toLocaleDateString('de-DE')}
                </div>
                {k.naechste_aktion_info && <div style={{ fontSize:13, marginTop:3 }}>{k.naechste_aktion_info}</div>}
              </div>
            )}
            {k.verbandsmitgliedschaft_id && (
              <div style={{ padding:'6px 10px', borderRadius:7, background:'rgba(34,197,94,0.08)', border:'1px solid rgba(34,197,94,0.3)', marginBottom:10, fontSize:12, color:'#22c55e' }}>
                <Building2 size={12} style={{ verticalAlign:'middle' }}/> Dojo ID #{k.verbandsmitgliedschaft_id} angelegt
              </div>
            )}
            {k.notiz && <div style={{ fontSize:13, color:'var(--text-muted)', fontStyle:'italic', marginBottom:8 }}>"{k.notiz}"</div>}
            <div style={{ display:'flex', flexDirection:'column', gap:6, marginTop:10 }}>
              {k.email && (
                <button className="btn-primary" style={{ justifyContent:'flex-start', gap:6 }}
                  onClick={() => { setEmailForm({ betreff:'', html:'', vorlage_name:'' }); setView('email'); }}>
                  <Mail size={15}/> E-Mail senden
                </button>
              )}
              <button className="btn-secondary" style={{ justifyContent:'flex-start', gap:6 }}
                onClick={() => { setBriefForm({ betreff:'', html:'', vorlage_name:'' }); setBriefHtml(''); setView('brief'); }}>
                <Printer size={15}/> Brief erstellen (A4)
              </button>
              <button className="btn-secondary" style={{ justifyContent:'flex-start', gap:6 }}
                onClick={() => setShowAktivitaetForm(true)}>
                <PenLine size={15}/> Aktivität protokollieren
              </button>
              {k.status === 'gewonnen' && !k.verbandsmitgliedschaft_id && (
                <button className="btn-secondary" style={{ justifyContent:'flex-start', gap:6, color:'#22c55e', borderColor:'rgba(34,197,94,0.4)' }}
                  onClick={() => {
                    const slug = k.organisation.toLowerCase().replace(/[äöü]/g, c => ({ä:'ae',ö:'oe',ü:'ue'}[c]||c)).replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g,'');
                    setDojoWizardForm({ dojoname:k.organisation, subdomain:slug, inhaber:k.ansprechpartner||'', email:k.email||'' });
                    setDojoWizard({ show:true, kontakt:k });
                  }}>
                  <Sparkles size={15}/> Dojo-Account anlegen
                </button>
              )}
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
                <select value={aktivitaetForm.art} onChange={e => setAktivitaetForm(p=>({...p,art:e.target.value}))} style={INP}>
                  <option value="telefon">Telefonat</option><option value="email">E-Mail</option>
                  <option value="brief">Brief</option><option value="persoenlich">Persönlich</option>
                  <option value="nachricht">Nachricht</option><option value="sonstiges">Sonstiges</option>
                </select>
              </div>
              <div>
                <label style={{ display:'block', fontSize:12, marginBottom:4 }}>Ergebnis</label>
                <select value={aktivitaetForm.ergebnis} onChange={e => setAktivitaetForm(p=>({...p,ergebnis:e.target.value}))} style={INP}>
                  <option value="ausstehend">Ausstehend</option><option value="positiv">Positiv</option>
                  <option value="negativ">Negativ</option><option value="keine_antwort">Keine Antwort</option>
                </select>
              </div>
            </div>
            <input type="text" placeholder="Betreff / Kurznotiz" value={aktivitaetForm.betreff}
              onChange={e => setAktivitaetForm(p=>({...p,betreff:e.target.value}))} style={{ ...INP, marginBottom:8 }}/>
            <textarea rows={3} placeholder="Details…" value={aktivitaetForm.inhalt}
              onChange={e => setAktivitaetForm(p=>({...p,inhalt:e.target.value}))}
              style={{ ...INP, resize:'vertical', marginBottom:8 }}/>
            <div style={{ display:'flex', gap:8 }}>
              <button className="btn-primary" onClick={handleAktivitaetSave}><Save size={14}/> Speichern</button>
              <button className="btn-secondary" onClick={() => setShowAktivitaetForm(false)}>Abbrechen</button>
            </div>
          </div>
        )}

        {/* Aktivitäten-Protokoll */}
        <div className="verband-panel">
          <div className="panel-header">
            <h4 style={{ margin:0, display:'flex', alignItems:'center', gap:6 }}><BarChart3 size={15}/> Protokoll</h4>
            <span style={{ fontSize:13, color:'var(--text-muted)' }}>{aktivitaeten.length} Einträge</span>
          </div>
          <div className="panel-content">
            {aktivitaeten.length === 0 ? (
              <div style={{ textAlign:'center', padding:'20px 0', color:'var(--text-muted)', fontSize:13 }}>Noch keine Aktivitäten</div>
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
                        <StatusBadge status={a.status_vorher} small/> → <StatusBadge status={a.status_nachher} small/>
                      </div>
                    )}
                    {a.inhalt && <div style={{ fontSize:12, color:'var(--text-muted)', marginTop:3 }}>{a.inhalt.substring(0,200)}{a.inhalt.length>200?'…':''}</div>}
                    {a.vorlage_name && <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:2 }}>Vorlage: {a.vorlage_name}</div>}
                  </div>
                  <span style={{ display:'inline-flex', alignItems:'center', gap:4, fontSize:11, color:erg.color, fontWeight:600, flexShrink:0, paddingTop:2 }}>
                    {erg.icon} {erg.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  // ══════════════════════════════════════════════════════════════════════════
  // E-MAIL VIEW
  // ══════════════════════════════════════════════════════════════════════════

  const EmailView = () => (
    <div>
      <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:18 }}>
        <button className="btn-icon" onClick={() => setView('detail')}><ArrowLeft size={18}/></button>
        <h3 style={{ margin:0 }}>E-Mail an: <span style={{ color:'var(--primary,#DAA520)' }}>{selectedKontakt?.organisation}</span></h3>
      </div>
      {selectedKontakt?.email && <div style={{ fontSize:13, color:'var(--text-muted)', marginBottom:12 }}><Mail size={13} style={{ verticalAlign:'middle' }}/> {selectedKontakt.email}</div>}

      {vorlagen.filter(v=>v.typ==='email').length > 0 && (
        <div style={{ marginBottom:14 }}>
          <label style={{ display:'block', fontSize:12, marginBottom:6, fontWeight:600 }}>Vorlage laden:</label>
          <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
            {vorlagen.filter(v=>v.typ==='email').map(v => (
              <button key={v.id} className="btn-secondary" style={{ fontSize:12, padding:'4px 12px' }} onClick={() => vorlageInEmail(v)}>{v.name}</button>
            ))}
          </div>
        </div>
      )}

      <div style={{ marginBottom:10 }}>
        <label style={{ display:'block', fontSize:12, marginBottom:4, fontWeight:600 }}>Betreff *</label>
        <input type="text" value={emailForm.betreff} onChange={e => setEmailForm(p=>({...p,betreff:e.target.value}))}
          placeholder="Betreff (Platzhalter: {{organisation}}, {{ansprechpartner}}, {{datum}}…)"
          style={{ ...INP, fontSize:14 }}/>
      </div>
      <div style={{ marginBottom:14 }}>
        <label style={{ display:'block', fontSize:12, marginBottom:4, fontWeight:600 }}>Inhalt (HTML) *</label>
        <div style={{ fontSize:11, color:'var(--text-muted)', marginBottom:6, display:'flex', flexWrap:'wrap', gap:4 }}>
          {['{{organisation}}','{{anrede_persoenlich}}','{{ansprechpartner}}','{{sportart}}','{{absender_inhaber}}','{{absender_email}}','{{datum}}'].map(p => (
            <code key={p} style={{ background:'var(--bg)', padding:'1px 5px', borderRadius:4, cursor:'pointer' }}
              onClick={() => setEmailForm(f => ({ ...f, html: f.html + p }))}>{p}</code>
          ))}
        </div>
        <textarea rows={14} value={emailForm.html} onChange={e => setEmailForm(p=>({...p,html:e.target.value}))}
          placeholder="HTML-Inhalt…" style={{ ...INP, fontFamily:'monospace', fontSize:12, resize:'vertical' }}/>
      </div>
      <div style={{ display:'flex', gap:10 }}>
        <button className="btn-primary" onClick={handleEmailSend} disabled={subLoading}>
          {subLoading ? <Loader2 size={15} className="spin"/> : <Send size={15}/>} Senden
        </button>
        <button className="btn-secondary" onClick={() => setView('detail')}>Abbrechen</button>
      </div>
    </div>
  );

  // ══════════════════════════════════════════════════════════════════════════
  // BRIEF VIEW
  // ══════════════════════════════════════════════════════════════════════════

  const BriefView = () => (
    <div>
      <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:18 }}>
        <button className="btn-icon" onClick={() => setView('detail')}><ArrowLeft size={18}/></button>
        <h3 style={{ margin:0 }}>Brief (A4) für: <span style={{ color:'var(--primary,#DAA520)' }}>{selectedKontakt?.organisation}</span></h3>
      </div>

      {vorlagen.filter(v=>v.typ==='brief').length > 0 && (
        <div style={{ marginBottom:14 }}>
          <label style={{ display:'block', fontSize:12, marginBottom:6, fontWeight:600 }}>Vorlage laden:</label>
          <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
            {vorlagen.filter(v=>v.typ==='brief').map(v => (
              <button key={v.id} className="btn-secondary" style={{ fontSize:12, padding:'4px 12px' }} onClick={() => vorlageInBrief(v)}>{v.name}</button>
            ))}
          </div>
        </div>
      )}

      <div style={{ marginBottom:10 }}>
        <label style={{ display:'block', fontSize:12, marginBottom:4, fontWeight:600 }}>Betreffzeile</label>
        <input type="text" value={briefForm.betreff} onChange={e => setBriefForm(p=>({...p,betreff:e.target.value}))}
          placeholder="Betreff des Briefs" style={{ ...INP, fontSize:14 }}/>
      </div>
      <div style={{ marginBottom:14 }}>
        <label style={{ display:'block', fontSize:12, marginBottom:4, fontWeight:600 }}>Inhalt (HTML) *</label>
        <div style={{ fontSize:11, color:'var(--text-muted)', marginBottom:6, display:'flex', flexWrap:'wrap', gap:4 }}>
          {['{{organisation}}','{{anrede_persoenlich}}','{{ansprechpartner}}','{{strasse}}','{{plz}}','{{ort}}','{{absender_inhaber}}','{{datum}}'].map(p => (
            <code key={p} style={{ background:'var(--bg)', padding:'1px 5px', borderRadius:4, cursor:'pointer' }}
              onClick={() => setBriefForm(f => ({ ...f, html: f.html + p }))}>{p}</code>
          ))}
        </div>
        <textarea rows={16} value={briefForm.html} onChange={e => setBriefForm(p=>({...p,html:e.target.value}))}
          style={{ ...INP, fontFamily:'monospace', fontSize:12, resize:'vertical' }}/>
      </div>
      <div style={{ display:'flex', gap:10, marginBottom:16 }}>
        <button className="btn-primary" onClick={handleBriefErstellen} disabled={subLoading}>
          {subLoading ? <Loader2 size={15} className="spin"/> : <Eye size={15}/>} Brief erstellen
        </button>
        <button className="btn-secondary" onClick={() => setView('detail')}>Abbrechen</button>
      </div>

      {briefHtml && (
        <div>
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10 }}>
            <strong>Vorschau</strong>
            <button className="btn-primary" onClick={printBrief}><Printer size={14}/> Drucken / PDF (A4)</button>
          </div>
          <div style={{ border:'1px solid var(--border)', borderRadius:8, padding:28, background:'#fff', color:'#000',
            fontFamily:'Arial,sans-serif', fontSize:'11pt', lineHeight:1.6, maxWidth:'700px' }}
            dangerouslySetInnerHTML={{ __html: briefHtml }}/>
        </div>
      )}
    </div>
  );

  // ══════════════════════════════════════════════════════════════════════════
  // CSV IMPORT VIEW
  // ══════════════════════════════════════════════════════════════════════════

  const CsvImportView = () => (
    <div>
      <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:18 }}>
        <button className="btn-icon" onClick={() => setView('overview')}><ArrowLeft size={18}/></button>
        <div>
          <h3 style={{ margin:0, display:'flex', alignItems:'center', gap:8 }}><Upload size={18}/> CSV-Import</h3>
          <div style={{ fontSize:13, color:'var(--text-muted)' }}>Kontakte aus Vereinslisten, Landessportbund-Daten etc. importieren</div>
        </div>
      </div>

      <div className="verband-panel" style={{ padding:'14px 18px', marginBottom:14 }}>
        <div style={{ fontWeight:600, marginBottom:8 }}>Format</div>
        <div style={{ fontSize:12, color:'var(--text-muted)', marginBottom:8 }}>
          Erste Zeile = Spaltenüberschriften. Trennzeichen: Komma oder Semikolon. Pflichtfeld: <strong>organisation</strong> (oder: name, verein, schule).
        </div>
        <div style={{ background:'var(--bg)', borderRadius:6, padding:10, fontFamily:'monospace', fontSize:12, color:'var(--text-muted)' }}>
          organisation;email;ort;telefon;ansprechpartner;sportart<br/>
          Karate Dojo Musterstadt;info@karate-muster.de;Musterstadt;012345 6789;Max Muster;Karate<br/>
          TKD Verein Beispiel;vorstand@tkd-beispiel.de;Beispielstadt;;;Taekwondo
        </div>
      </div>

      <div style={{ marginBottom:14 }}>
        <label style={{ display:'block', fontSize:12, marginBottom:6, fontWeight:600 }}>CSV-Inhalt einfügen *</label>
        <textarea rows={12} value={csvText} onChange={e => setCsvText(e.target.value)}
          placeholder="Kopfzeile;Spalten&#10;Organisation1;email@org.de;Ort..."
          style={{ ...INP, fontFamily:'monospace', fontSize:12, resize:'vertical' }}/>
      </div>

      <div style={{ display:'flex', gap:10, marginBottom:16 }}>
        <button className="btn-primary" onClick={handleCsvImport} disabled={csvImporting || !csvText.trim()}>
          {csvImporting ? <Loader2 size={14} className="spin"/> : <Upload size={14}/>} Importieren
        </button>
        <button className="btn-secondary" onClick={() => { setCsvText(''); setCsvResult(null); }}>Leeren</button>
      </div>

      {csvResult && (
        <div style={{ padding:'14px 16px', borderRadius:8,
          background: csvResult.fehler?.length > 0 ? 'rgba(245,158,11,0.08)' : 'rgba(34,197,94,0.08)',
          border: `1px solid ${csvResult.fehler?.length > 0 ? 'rgba(245,158,11,0.3)' : 'rgba(34,197,94,0.3)'}` }}>
          <div style={{ fontWeight:600, marginBottom:8 }}>Ergebnis</div>
          <div style={{ fontSize:13, display:'flex', gap:16 }}>
            <span style={{ color:'#22c55e' }}><CheckCircle size={13} style={{ verticalAlign:'middle' }}/> {csvResult.importiert} importiert</span>
            {csvResult.duplikate > 0 && <span style={{ color:'#f59e0b' }}><Info size={13} style={{ verticalAlign:'middle' }}/> {csvResult.duplikate} bereits vorhanden</span>}
            {csvResult.fehler?.length > 0 && <span style={{ color:'#ef4444' }}><AlertTriangle size={13} style={{ verticalAlign:'middle' }}/> {csvResult.fehler.length} Fehler</span>}
          </div>
          {csvResult.fehler?.length > 0 && (
            <div style={{ marginTop:8, fontSize:12, color:'#ef4444' }}>
              {csvResult.fehler.slice(0,5).map((f, i) => <div key={i}>{f}</div>)}
            </div>
          )}
        </div>
      )}
    </div>
  );

  // ══════════════════════════════════════════════════════════════════════════
  // TRIAL-LIZENZEN IMPORT
  // ══════════════════════════════════════════════════════════════════════════

  const TrialImportView = () => {
    const noFollow = trialDojos.filter(d => !d.akquise_id);
    const withFollow = trialDojos.filter(d => d.akquise_id);
    return (
      <div>
        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:18 }}>
          <button className="btn-icon" onClick={() => setView('overview')}><ArrowLeft size={18}/></button>
          <div style={{ flex:1 }}>
            <h3 style={{ margin:0, display:'flex', alignItems:'center', gap:8 }}><CreditCard size={18}/> Trial-Lizenzen</h3>
            <div style={{ fontSize:13, color:'var(--text-muted)' }}>Neue Dojo-Accounts im Trial-Plan — als Akquise-Kontakte anlegen</div>
          </div>
          <button className="btn-secondary" onClick={loadTrialDojos} disabled={subLoading}>
            {subLoading ? <Loader2 size={14} className="spin"/> : <RefreshCw size={14}/>}
          </button>
        </div>

        {subLoading ? (
          <div style={{ textAlign:'center', padding:40 }}><Loader2 size={28} className="spin" style={{ color:'var(--primary,#DAA520)' }}/></div>
        ) : (
          <>
            {noFollow.length > 0 && (
              <>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
                  <div style={{ fontWeight:600, fontSize:14, display:'flex', alignItems:'center', gap:6 }}>
                    <AlertCircle size={15} style={{ color:'#f59e0b' }}/> Ohne Follow-up ({noFollow.length})
                  </div>
                  {selectedTrials.size > 0 && (
                    <button className="btn-primary" onClick={handleTrialImport}>
                      <Download size={14}/> {selectedTrials.size} als Akquise-Kontakt anlegen
                    </button>
                  )}
                </div>
                <div style={{ display:'flex', flexDirection:'column', gap:6, marginBottom:20 }}>
                  {noFollow.map(d => (
                    <div key={d.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 14px', borderRadius:8,
                      background:'var(--bg-secondary)', border:'1px solid var(--border)' }}>
                      <input type="checkbox" checked={selectedTrials.has(d.id)} onChange={e => {
                        const s = new Set(selectedTrials);
                        if (e.target.checked) s.add(d.id); else s.delete(d.id);
                        setSelectedTrials(s);
                      }} style={{ width:16, height:16, accentColor:'var(--primary,#DAA520)', flexShrink:0 }}/>
                      <div style={{ width:36, height:36, borderRadius:'50%', flexShrink:0,
                        background:'rgba(var(--primary-rgb,218,165,32),0.12)',
                        display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700,
                        color:'var(--primary,#DAA520)' }}>{(d.dojoname||'?')[0]}</div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontWeight:600, fontSize:14 }}>{d.dojoname}</div>
                        <div style={{ fontSize:12, color:'var(--text-muted)' }}>
                          {d.inhaber && `${d.inhaber} · `}
                          {d.ort && `${d.ort} · `}
                          {d.email}
                        </div>
                      </div>
                      <div style={{ textAlign:'right', fontSize:12, color:'var(--text-muted)', flexShrink:0 }}>
                        <div>Trial-Plan</div>
                        {d.trial_tage_verbleibend !== null && (
                          <div style={{ color: d.trial_tage_verbleibend < 5 ? '#ef4444' : '#f59e0b', fontWeight:600 }}>
                            {d.trial_tage_verbleibend > 0 ? `${d.trial_tage_verbleibend} Tage` : 'Abgelaufen'}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {withFollow.length > 0 && (
              <>
                <div style={{ fontWeight:600, fontSize:14, marginBottom:10, display:'flex', alignItems:'center', gap:6 }}>
                  <CheckCircle size={15} style={{ color:'#22c55e' }}/> Mit Follow-up ({withFollow.length})
                </div>
                <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                  {withFollow.map(d => (
                    <div key={d.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 14px', borderRadius:8,
                      background:'var(--bg)', border:'1px solid var(--border)', opacity:0.7 }}>
                      <div style={{ width:28, height:28, borderRadius:'50%', flexShrink:0, background:'rgba(34,197,94,0.12)',
                        display:'flex', alignItems:'center', justifyContent:'center' }}>
                        <Check size={14} style={{ color:'#22c55e' }}/>
                      </div>
                      <div style={{ flex:1 }}>
                        <div style={{ fontWeight:600, fontSize:13 }}>{d.dojoname}</div>
                        <div style={{ fontSize:12, color:'var(--text-muted)' }}>Status: <StatusBadge status={d.akquise_status} small/></div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {trialDojos.length === 0 && (
              <div className="empty-state large"><CreditCard size={44}/><h4>Keine Trial-Dojos</h4><p>Noch keine Dojos im Trial-Plan registriert.</p></div>
            )}
          </>
        )}
      </div>
    );
  };

  // ══════════════════════════════════════════════════════════════════════════
  // VORLAGEN VIEW
  // ══════════════════════════════════════════════════════════════════════════

  const VorlagenView = () => (
    <div>
      <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:18 }}>
        <button className="btn-icon" onClick={() => setView('overview')}><ArrowLeft size={18}/></button>
        <h3 style={{ margin:0, flex:1 }}>Vorlagen ({vorlagen.length})</h3>
        <button className="btn-primary" onClick={() => { setEditingVorlage(null); setVorlageForm({ name:'', typ:'email', kategorie:'erstanschreiben', betreff:'', html:'' }); setVorlageEditMode(true); }}>
          <Plus size={14}/> Neu
        </button>
      </div>

      {vorlageEditMode && (
        <div className="verband-panel" style={{ padding:'16px 18px', marginBottom:16 }}>
          <div style={{ fontWeight:700, marginBottom:12 }}>{editingVorlage ? 'Bearbeiten' : 'Neue Vorlage'}</div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10, marginBottom:10 }}>
            <div><label style={{ display:'block', fontSize:12, marginBottom:4 }}>Name *</label>
              <input type="text" value={vorlageForm.name} onChange={e=>setVorlageForm(p=>({...p,name:e.target.value}))} style={INP}/></div>
            <div><label style={{ display:'block', fontSize:12, marginBottom:4 }}>Typ</label>
              <select value={vorlageForm.typ} onChange={e=>setVorlageForm(p=>({...p,typ:e.target.value}))} style={INP}>
                <option value="email">E-Mail</option><option value="brief">Brief</option></select></div>
            <div><label style={{ display:'block', fontSize:12, marginBottom:4 }}>Kategorie</label>
              <select value={vorlageForm.kategorie} onChange={e=>setVorlageForm(p=>({...p,kategorie:e.target.value}))} style={INP}>
                <option value="erstanschreiben">Erstanschreiben</option><option value="folgeanschreiben">Folgeanschreiben</option>
                <option value="angebot">Angebot</option><option value="willkommen">Willkommen</option>
                <option value="sonstiges">Sonstiges</option></select></div>
          </div>
          {vorlageForm.typ === 'email' && (
            <div style={{ marginBottom:10 }}>
              <label style={{ display:'block', fontSize:12, marginBottom:4 }}>Betreff</label>
              <input type="text" value={vorlageForm.betreff} onChange={e=>setVorlageForm(p=>({...p,betreff:e.target.value}))} style={INP}/>
            </div>
          )}
          <div style={{ marginBottom:10 }}>
            <label style={{ display:'block', fontSize:12, marginBottom:4 }}>Inhalt (HTML) *</label>
            <textarea rows={10} value={vorlageForm.html} onChange={e=>setVorlageForm(p=>({...p,html:e.target.value}))}
              style={{ ...INP, fontFamily:'monospace', fontSize:12, resize:'vertical' }}/>
          </div>
          <div style={{ display:'flex', gap:8 }}>
            <button className="btn-primary" onClick={handleVorlageSave}><Save size={14}/> Speichern</button>
            <button className="btn-secondary" onClick={() => { setVorlageEditMode(false); setEditingVorlage(null); }}>Abbrechen</button>
          </div>
        </div>
      )}

      {['email','brief'].map(typ => {
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
                      <div style={{ fontSize:12, color:'var(--text-muted)' }}>{v.kategorie}{v.betreff && ` · ${v.betreff.substring(0,60)}${v.betreff.length>60?'…':''}`}</div>
                    </div>
                    <button className="btn-icon" onClick={() => { setEditingVorlage(v); setVorlageForm({name:v.name,typ:v.typ,kategorie:v.kategorie,betreff:v.betreff||'',html:v.html}); setVorlageEditMode(true); }}><Edit3 size={14}/></button>
                    <button className="btn-icon btn-icon-danger" onClick={() => handleVorlageDelete(v)}><Trash2 size={14}/></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );

  // ══════════════════════════════════════════════════════════════════════════
  // TDA EVENTS IMPORT
  // ══════════════════════════════════════════════════════════════════════════

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
        </div>
      ) : (
        <>
          <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:14, padding:'10px 14px',
            background:'rgba(var(--primary-rgb,218,165,32),0.08)', border:'1px solid var(--primary,#DAA520)40', borderRadius:8 }}>
            <Info size={16} style={{ color:'var(--primary,#DAA520)', flexShrink:0 }}/>
            <span style={{ fontSize:13, flex:1 }}>
              <strong>{tdaVereine.length}</strong> Vereine gefunden. &nbsp;
              <strong style={{ color:'#22c55e' }}>{tdaVereine.filter(v=>!v.bereits_importiert).length}</strong> noch nicht importiert.
            </span>
            {selectedVereine.size > 0 && (
              <button className="btn-primary" onClick={handleTdaImport}><Download size={14}/> {selectedVereine.size} importieren</button>
            )}
          </div>

          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
            {tdaVereine.map((v, i) => (
              <div key={i} style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 14px', borderRadius:8,
                background: v.bereits_importiert ? 'var(--bg)' : 'var(--bg-secondary)',
                border:'1px solid var(--border)', opacity: v.bereits_importiert ? 0.6 : 1 }}>
                <input type="checkbox" disabled={v.bereits_importiert}
                  checked={selectedVereine.has(v.name)} onChange={e => {
                    const s = new Set(selectedVereine);
                    if (e.target.checked) s.add(v.name); else s.delete(v.name);
                    setSelectedVereine(s);
                  }} style={{ width:16, height:16, accentColor:'var(--primary,#DAA520)', flexShrink:0 }}/>
                <div style={{ width:34, height:34, borderRadius:'50%', flexShrink:0,
                  background:'rgba(var(--primary-rgb,218,165,32),0.12)',
                  display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700,
                  color:'var(--primary,#DAA520)' }}>{v.name[0]}</div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontWeight:600, fontSize:14 }}>{v.name}</div>
                  <div style={{ fontSize:12, color:'var(--text-muted)', display:'flex', gap:10 }}>
                    <span><Trophy size={11} style={{ verticalAlign:'middle' }}/> {v.turnier_anzahl} Turnier{v.turnier_anzahl!==1?'e':''}</span>
                    <span><Users size={11} style={{ verticalAlign:'middle' }}/> {v.teilnehmer} Teilnahmen</span>
                  </div>
                </div>
                {v.bereits_importiert
                  ? <span style={{ fontSize:12, color:'#22c55e', display:'flex', alignItems:'center', gap:4, flexShrink:0 }}><Check size={13}/> Importiert</span>
                  : <button className="btn-secondary" style={{ fontSize:12, padding:'3px 10px', flexShrink:0 }}
                      onClick={() => { setSelectedVereine(new Set([v.name])); setTimeout(handleTdaImport, 10); }}>
                      Importieren
                    </button>}
              </div>
            ))}
          </div>

          {selectedVereine.size > 0 && (
            <div style={{ position:'sticky', bottom:0, marginTop:16, padding:'12px 0' }}>
              <button className="btn-primary" style={{ width:'100%', justifyContent:'center', padding:12 }} onClick={handleTdaImport}>
                <Download size={16}/> {selectedVereine.size} Vereine importieren
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );

  // ══════════════════════════════════════════════════════════════════════════
  // KONTAKT FORMULAR
  // ══════════════════════════════════════════════════════════════════════════

  const FormView = () => (
    <div style={{ maxWidth:640 }}>
      <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:20 }}>
        <button className="btn-icon" onClick={() => setView(editingKontakt ? 'detail' : 'overview')}><ArrowLeft size={18}/></button>
        <h3 style={{ margin:0 }}>{editingKontakt ? `Bearbeiten: ${editingKontakt.organisation}` : 'Neuer Kontakt'}</h3>
      </div>

      {/* Duplikat-Warnung */}
      {duplicateWarning.length > 0 && (
        <div style={{ padding:'10px 14px', marginBottom:14, background:'rgba(245,158,11,0.08)', border:'1px solid rgba(245,158,11,0.4)', borderRadius:8 }}>
          <div style={{ fontSize:13, color:'#f59e0b', fontWeight:600, marginBottom:6, display:'flex', alignItems:'center', gap:5 }}>
            <AlertCircle size={14}/> Ähnlicher Kontakt bereits vorhanden:
          </div>
          {duplicateWarning.map(d => (
            <div key={d.id} style={{ fontSize:12, color:'var(--text-muted)' }}>
              • {d.organisation} {d.ort ? `(${d.ort})` : ''} — <StatusBadge status={d.status} small/>
              <button className="btn-link" style={{ marginLeft:8, fontSize:11 }} onClick={() => { openKontakt(d); }}>Öffnen</button>
            </div>
          ))}
        </div>
      )}

      <form onSubmit={handleKontaktSubmit} style={{ display:'flex', flexDirection:'column', gap:14 }}>
        <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr 1fr', gap:10 }}>
          <div>
            <label style={{ display:'block', fontSize:12, marginBottom:4, fontWeight:600 }}>Organisation / Name *</label>
            <input required type="text" value={kontaktForm.organisation}
              onChange={e => { setKontaktForm(p=>({...p,organisation:e.target.value})); checkDuplicate(e.target.value); }}
              style={{ ...INP, fontSize:14 }}/>
          </div>
          <div>
            <label style={{ display:'block', fontSize:12, marginBottom:4, fontWeight:600 }}>Typ</label>
            <select value={kontaktForm.typ} onChange={e=>setKontaktForm(p=>({...p,typ:e.target.value}))} style={{ ...INP, fontSize:14 }}>
              <option value="schule">Schule</option><option value="verband">Verband</option>
              <option value="verein">Verein</option><option value="sonstige">Sonstige</option>
            </select>
          </div>
          <div>
            <label style={{ display:'block', fontSize:12, marginBottom:4, fontWeight:600 }}>Priorität</label>
            <select value={kontaktForm.prioritaet} onChange={e=>setKontaktForm(p=>({...p,prioritaet:e.target.value}))} style={{ ...INP, fontSize:14 }}>
              <option value="hoch">Hoch</option><option value="mittel">Mittel</option><option value="niedrig">Niedrig</option>
            </select>
          </div>
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
          {[['ansprechpartner','Ansprechpartner'],['position','Position/Funktion'],['email','E-Mail'],['telefon','Telefon'],['webseite','Website'],['sportart','Sportart/Stil']].map(([field,label]) => (
            <div key={field}>
              <label style={{ display:'block', fontSize:12, marginBottom:4 }}>{label}</label>
              <input type={field==='email'?'email':'text'} value={kontaktForm[field]||''}
                onChange={e=>setKontaktForm(p=>({...p,[field]:e.target.value}))} style={INP}/>
            </div>
          ))}
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr 1fr', gap:10 }}>
          {[['strasse','Straße'],['plz','PLZ'],['ort','Ort']].map(([field,label]) => (
            <div key={field}>
              <label style={{ display:'block', fontSize:12, marginBottom:4 }}>{label}</label>
              <input type="text" value={kontaktForm[field]||''} onChange={e=>setKontaktForm(p=>({...p,[field]:e.target.value}))} style={INP}/>
            </div>
          ))}
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10 }}>
          <div>
            <label style={{ display:'block', fontSize:12, marginBottom:4 }}>Status</label>
            <select value={kontaktForm.status} onChange={e=>setKontaktForm(p=>({...p,status:e.target.value}))} style={INP}>
              {STATUS_PIPELINE.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </div>
          <div>
            <label style={{ display:'block', fontSize:12, marginBottom:4 }}>Quelle</label>
            <select value={kontaktForm.quelle} onChange={e=>setKontaktForm(p=>({...p,quelle:e.target.value}))} style={INP}>
              <option value="manuell">Manuell</option><option value="tda_events">TDA-Events</option>
              <option value="empfehlung">Empfehlung</option><option value="messe">Messe</option>
              <option value="internet">Internet</option><option value="trial">Trial-Lizenz</option>
              <option value="sonstige">Sonstige</option>
            </select>
          </div>
          <div>
            <label style={{ display:'block', fontSize:12, marginBottom:4 }}>Mitglieder ca.</label>
            <input type="number" value={kontaktForm.mitglieder_anzahl||''} onChange={e=>setKontaktForm(p=>({...p,mitglieder_anzahl:e.target.value}))} style={INP}/>
          </div>
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'1fr 2fr', gap:10 }}>
          <div>
            <label style={{ display:'block', fontSize:12, marginBottom:4 }}>Nächste Aktion</label>
            <input type="date" value={kontaktForm.naechste_aktion||''} onChange={e=>setKontaktForm(p=>({...p,naechste_aktion:e.target.value}))} style={INP}/>
          </div>
          <div>
            <label style={{ display:'block', fontSize:12, marginBottom:4 }}>Aktion Beschreibung</label>
            <input type="text" value={kontaktForm.naechste_aktion_info||''} onChange={e=>setKontaktForm(p=>({...p,naechste_aktion_info:e.target.value}))}
              placeholder="z.B. Anruf, Angebot senden…" style={INP}/>
          </div>
        </div>

        {/* Tags */}
        <div>
          <label style={{ display:'block', fontSize:12, marginBottom:4 }}>Tags</label>
          <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:6 }}>
            {(kontaktForm.tags||[]).map(t => (
              <span key={t} style={{ display:'inline-flex', alignItems:'center', gap:4, fontSize:12,
                background:'rgba(139,92,246,0.12)', color:'#8b5cf6', padding:'2px 8px', borderRadius:10, border:'1px solid rgba(139,92,246,0.3)' }}>
                {t}
                <button type="button" onClick={() => removeTag(t)} style={{ background:'none', border:'none', cursor:'pointer', color:'#8b5cf6', padding:0, lineHeight:1 }}>×</button>
              </span>
            ))}
          </div>
          <div style={{ display:'flex', gap:6 }}>
            <input type="text" value={tagInput} onChange={e => setTagInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag(tagInput); } }}
              placeholder="Tag eingeben + Enter" style={{ ...INP, flex:1 }}/>
            <button type="button" className="btn-secondary" onClick={() => addTag(tagInput)}>
              <Tag size={14}/>
            </button>
          </div>
        </div>

        <div>
          <label style={{ display:'block', fontSize:12, marginBottom:4 }}>Notiz</label>
          <textarea rows={3} value={kontaktForm.notiz||''} onChange={e=>setKontaktForm(p=>({...p,notiz:e.target.value}))}
            style={{ ...INP, resize:'vertical' }}/>
        </div>

        <div style={{ display:'flex', gap:10 }}>
          <button type="submit" className="btn-primary" disabled={subLoading}>
            {subLoading ? <Loader2 size={14} className="spin"/> : <Save size={14}/>} {editingKontakt ? 'Speichern' : 'Anlegen'}
          </button>
          <button type="button" className="btn-secondary" onClick={() => { setDuplicateWarning([]); setView(editingKontakt ? 'detail' : 'overview'); }}>Abbrechen</button>
        </div>
      </form>
    </div>
  );

  // ══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════════════════════

  return (
    <div style={{ padding:4 }}>
      <DojoWizardModal />
      <FlashMsg msg={flash.msg} type={flash.type} onClose={() => setFlash({ msg:'', type:'' })}/>
      {view === 'overview'      && <OverviewView />}
      {view === 'liste'         && <ListeView />}
      {view === 'detail'        && <DetailView />}
      {view === 'email'         && <EmailView />}
      {view === 'brief'         && <BriefView />}
      {view === 'vorlagen'      && <VorlagenView />}
      {view === 'tda-import'    && <TdaImportView />}
      {view === 'trial-import'  && <TrialImportView />}
      {view === 'csv-import'    && <CsvImportView />}
      {view === 'form'          && <FormView />}
    </div>
  );
};

export default AkquiseDashboard;
