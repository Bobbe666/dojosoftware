// ============================================================================
// KAMPAGNEN DASHBOARD
// E-Mail-Kampagnen an Akquise-Kontakte, Dojo-Lizenzinhaber
// oder importierte CSV-Kontakte
// ============================================================================

import React, { useState, useEffect, useRef } from 'react';
import {
  Send, Users, Filter, RefreshCw, CheckCircle, XCircle,
  ChevronDown, ChevronUp, Clock, AlertTriangle, Mail,
  Building2, FileText, Eye, Loader2, Info,
  Upload, ArrowRight, X
} from 'lucide-react';
import { fetchWithAuth } from '../utils/fetchWithAuth';
import config from '../config/config';

const API = `${config.apiBaseUrl}/admin/kampagnen`;

const STATUS_FARBEN = {
  neu:          '#6b7280',
  kontaktiert:  '#3b82f6',
  interessiert: '#8b5cf6',
  angebot:      '#f59e0b',
  pausiert:     '#9ca3af',
};

const PLAN_LABELS = {
  trial:        { label: 'Trial',        color: '#6b7280' },
  basic:        { label: 'Basic',        color: '#3b82f6' },
  professional: { label: 'Professional', color: '#8b5cf6' },
  enterprise:   { label: 'Enterprise',   color: '#f59e0b' },
};

const CARD = {
  padding: '20px 22px', borderRadius: 14,
  background: 'var(--bg-secondary)', border: '1px solid var(--border)',
};

const INP = {
  width: '100%', padding: '10px 12px', borderRadius: 8,
  border: '1px solid var(--border)', background: 'var(--bg)',
  color: 'var(--text)', fontSize: 14,
};

const SECTION_TITLE = {
  fontWeight: 700, fontSize: 14, marginBottom: 14,
  display: 'flex', alignItems: 'center', gap: 7, color: 'var(--text)',
};

function formatDatum(ts) {
  return new Date(ts).toLocaleString('de-DE', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

// ── Vorlage-Picker (wird in beiden Views genutzt) ─────────────────────────────
const VorlagenPicker = ({ vorlagen, gewaehlte, onWaehlen, betreff, onBetreff, html, onHtml, modus }) => (
  <div style={CARD}>
    <div style={SECTION_TITLE}><Mail size={16}/> E-Mail-Inhalt</div>

    <div style={{ marginBottom: 14 }}>
      <label style={{ fontSize: 13, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Vorlage laden (optional)</label>
      <select value={gewaehlte} onChange={e => onWaehlen(e.target.value)} style={INP}>
        <option value="">— Vorlage auswählen —</option>
        {vorlagen.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
      </select>
    </div>

    <div style={{ marginBottom: 14 }}>
      <label style={{ fontSize: 13, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Betreff *</label>
      <input value={betreff} onChange={e => onBetreff(e.target.value)}
        placeholder="z.B. Einladung zur TDA-Mitgliedschaft — {{organisation}}"
        style={INP} />
    </div>

    <div style={{ marginBottom: 14 }}>
      <label style={{ fontSize: 13, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>E-Mail-Text (HTML) *</label>
      <textarea value={html} onChange={e => onHtml(e.target.value)}
        rows={9}
        placeholder={'<p>{{anrede_persoenlich}},</p>\n<p>...</p>\n<p>Mit freundlichen Grüßen<br>{{absender_inhaber}}</p>'}
        style={{ ...INP, fontFamily: 'monospace', fontSize: 12, lineHeight: 1.5, resize: 'vertical' }} />
    </div>

    <div style={{ padding: '10px 14px', borderRadius: 8, background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)', fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}>
      <strong style={{ color: '#3b82f6' }}>Platzhalter: </strong>
      {modus === 'csv'
        ? '{{organisation}} {{ansprechpartner}} {{anrede_persoenlich}} {{ort}} {{datum}}'
        : modus === 'lizenzinhaber'
          ? '{{dojoname}} {{inhaber}} {{anrede_persoenlich}} {{plan}} {{ort}} {{datum}}'
          : '{{organisation}} {{ansprechpartner}} {{anrede_persoenlich}} {{ort}} {{sportart}} {{datum}}'
      }
      <br />{'+ {{absender_name}} {{absender_inhaber}} {{absender_email}} {{absender_internet}}'}
    </div>
  </div>
);

// ── Senden-Panel (wird in beiden Views genutzt) ───────────────────────────────
const SendenPanel = ({ anzahl, betreff, html, onSenden, loading, ergebnis, fehler }) => {
  const [konfirm, setKonfirm] = useState(false);
  const bereit = anzahl > 0 && betreff && html;

  // Reset Konfirmation wenn Empfänger wegfallen
  useEffect(() => { if (!anzahl) setKonfirm(false); }, [anzahl]);

  return (
    <div style={CARD}>
      <div style={SECTION_TITLE}><Send size={16}/> Kampagne starten</div>

      {ergebnis && (
        <div style={{ padding: '14px', borderRadius: 10, marginBottom: 14,
          background: ergebnis.fehler === 0 ? 'rgba(34,197,94,0.1)' : 'rgba(245,158,11,0.1)',
          border: `1px solid ${ergebnis.fehler === 0 ? 'rgba(34,197,94,0.3)' : 'rgba(245,158,11,0.3)'}` }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: ergebnis.fehler === 0 ? '#22c55e' : '#f59e0b', marginBottom: 4 }}>
            {ergebnis.fehler === 0
              ? <><CheckCircle size={15} style={{ marginRight: 6 }}/>Erfolgreich gesendet!</>
              : <><AlertTriangle size={15} style={{ marginRight: 6 }}/>Teilweise gesendet</>}
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            ✓ {ergebnis.gesendet} gesendet{ergebnis.fehler > 0 && ` · ✗ ${ergebnis.fehler} Fehler`} · {ergebnis.gesamt} gesamt
          </div>
        </div>
      )}

      {fehler && (
        <div style={{ padding: '10px 14px', borderRadius: 8, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', fontSize: 13, marginBottom: 14 }}>
          <XCircle size={13} style={{ marginRight: 6 }}/>{fehler}
        </div>
      )}

      {!konfirm ? (
        <button onClick={() => bereit && setKonfirm(true)} disabled={!bereit || loading}
          style={{
            width: '100%', padding: '13px', borderRadius: 10, border: 'none', cursor: bereit ? 'pointer' : 'default',
            background: bereit ? '#3b82f6' : 'var(--bg)', color: bereit ? '#fff' : 'var(--text-muted)',
            fontSize: 15, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            opacity: bereit ? 1 : 0.5,
          }}>
          <Send size={16}/>
          {!anzahl ? 'Erst Empfänger laden' : !betreff || !html ? 'Betreff und Text ausfüllen' : `An ${anzahl} Empfänger senden`}
        </button>
      ) : (
        <div style={{ padding: 16, borderRadius: 10, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)' }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8 }}>
            <AlertTriangle size={14} style={{ color: '#ef4444', marginRight: 6 }}/>
            Wirklich {anzahl} E-Mails senden?
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 14 }}>
            Betreff: „{betreff}"<br/>Diese Aktion kann nicht rückgängig gemacht werden.
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => setKonfirm(false)}
              style={{ flex: 1, padding: '10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>
              Abbrechen
            </button>
            <button onClick={() => { setKonfirm(false); onSenden(); }} disabled={loading}
              style={{ flex: 1, padding: '10px', borderRadius: 8, border: 'none', background: '#ef4444', color: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              {loading ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }}/>Wird gesendet…</> : <><Send size={14}/>Jetzt senden</>}
            </button>
          </div>
        </div>
      )}

      {bereit && !konfirm && !ergebnis && (
        <div style={{ marginTop: 10, fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'flex-start', gap: 5 }}>
          <Info size={12} style={{ flexShrink: 0, marginTop: 1 }}/>
          Jede E-Mail wird personalisiert versendet. Kurze Pause zwischen den Empfängern.
        </div>
      )}
    </div>
  );
};

// ════════════════════════════════════════════════════════════════════════════
// HAUPT-KOMPONENTE
// ════════════════════════════════════════════════════════════════════════════

const KampagnenDashboard = () => {
  const [view, setView] = useState('erstellen'); // 'erstellen' | 'importieren' | 'verlauf'

  // ── Kampagnen-View State ──────────────────────────────────────────────────
  const [modus, setModus] = useState('akquise');
  const [filterStatus, setFilterStatus] = useState([]);
  const [filterTypen, setFilterTypen]   = useState([]);
  const [filterPlan, setFilterPlan]     = useState([]);
  const [vorschauLaden, setVorschauLaden] = useState(false);
  const [empfaenger, setEmpfaenger]       = useState(null);
  const [vorschauExpanded, setVorschauExpanded] = useState(false);
  const [vorlagen, setVorlagen]         = useState([]);
  const [gewaehlteVorlage, setGewaehlteVorlage] = useState('');
  const [betreff, setBetreff] = useState('');
  const [htmlText, setHtmlText] = useState('');
  const [sendenLoading, setSendenLoading] = useState(false);
  const [ergebnis, setErgebnis] = useState(null);
  const [fehlerMsg, setFehlerMsg] = useState('');

  // ── Import-View State ─────────────────────────────────────────────────────
  const fileInputRef = useRef(null);
  const [csvText, setCsvText]               = useState('');
  const [importVorschau, setImportVorschau] = useState(null);
  const [importGesamt, setImportGesamt]     = useState(0);
  const [importLoading, setImportLoading]   = useState(false);
  const [importErgebnis, setImportErgebnis] = useState(null);
  const [importFehler, setImportFehler]     = useState('');
  const [nachImportSenden, setNachImportSenden] = useState(false);
  const [importBetreff, setImportBetreff]   = useState('');
  const [importHtml, setImportHtml]         = useState('');
  const [importVorlage, setImportVorlage]   = useState('');
  const [importSendenLoading, setImportSendenLoading] = useState(false);
  const [importSendErgebnis, setImportSendErgebnis]   = useState(null);

  // ── Verlauf State ─────────────────────────────────────────────────────────
  const [verlauf, setVerlauf] = useState([]);
  const [verlaufLoading, setVerlaufLoading] = useState(false);

  // Vorlagen laden
  useEffect(() => {
    fetchWithAuth(`${API}/vorlagen`).then(r => r.json())
      .then(d => { if (d.success) setVorlagen(d.vorlagen); }).catch(() => {});
  }, []);

  useEffect(() => { if (view === 'verlauf') loadVerlauf(); }, [view]);
  useEffect(() => { setEmpfaenger(null); setErgebnis(null); setFehlerMsg(''); setBetreff(''); setHtmlText(''); setGewaehlteVorlage(''); }, [modus]);

  const loadVerlauf = async () => {
    setVerlaufLoading(true);
    const r = await fetchWithAuth(`${API}/verlauf`).catch(() => null);
    if (r) { const d = await r.json(); if (d.success) setVerlauf(d.verlauf); }
    setVerlaufLoading(false);
  };

  const ladeVorschau = async () => {
    setVorschauLaden(true); setEmpfaenger(null); setFehlerMsg('');
    const params = new URLSearchParams({ typ: modus });
    if (modus === 'akquise') {
      if (filterStatus.length) params.set('status', filterStatus.join(','));
      if (filterTypen.length)  params.set('typen', filterTypen.join(','));
    } else {
      if (filterPlan.length) params.set('plan_typen', filterPlan.join(','));
    }
    const r = await fetchWithAuth(`${API}/empfaenger-vorschau?${params}`).catch(() => null);
    if (r) { const d = await r.json(); if (d.success) setEmpfaenger(d.empfaenger); else setFehlerMsg(d.message); }
    setVorschauLaden(false);
  };

  const handleVorlageWaehlen = (id, setBetref, setHtml) => {
    if (!id) return;
    const v = vorlagen.find(x => x.id === parseInt(id));
    if (v) { setBetref(v.betreff || ''); setHtml(v.html || ''); }
  };

  const handleSenden = async () => {
    setSendenLoading(true); setErgebnis(null); setFehlerMsg('');
    const filter = modus === 'akquise' ? { status: filterStatus, typen: filterTypen } : { plan_typen: filterPlan };
    const r = await fetchWithAuth(`${API}/senden`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ typ: modus, filter, betreff, html: htmlText }),
    }).catch(() => null);
    if (r) {
      const d = await r.json();
      if (d.success) { setErgebnis({ gesendet: d.gesendet, fehler: d.fehler, gesamt: d.gesamt }); setEmpfaenger(null); setBetreff(''); setHtmlText(''); setGewaehlteVorlage(''); }
      else setFehlerMsg(d.message);
    }
    setSendenLoading(false);
  };

  const toggleFilter = (list, setList, val) => {
    setList(prev => prev.includes(val) ? prev.filter(x => x !== val) : [...prev, val]);
    setEmpfaenger(null);
  };

  // ── CSV Import ────────────────────────────────────────────────────────────
  const handleFileRead = (file) => {
    const reader = new FileReader();
    reader.onload = e => { setCsvText(e.target.result); setImportVorschau(null); setImportErgebnis(null); setImportFehler(''); };
    reader.readAsText(file, 'windows-1252');
  };

  const ladeImportVorschau = async () => {
    if (!csvText.trim()) return;
    setImportLoading(true); setImportVorschau(null); setImportFehler('');
    const r = await fetchWithAuth(`${API}/outlook-import`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ csv: csvText, preview: true }),
    }).catch(() => null);
    if (r) {
      const d = await r.json();
      if (d.success) { setImportVorschau(d.preview); setImportGesamt(d.gesamt); }
      else setImportFehler(d.message);
    }
    setImportLoading(false);
  };

  const handleImport = async () => {
    setImportLoading(true); setImportErgebnis(null); setImportFehler('');
    const r = await fetchWithAuth(`${API}/outlook-import`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ csv: csvText, preview: false }),
    }).catch(() => null);
    if (r) {
      const d = await r.json();
      if (d.success) { setImportErgebnis(d); setImportVorschau(null); setCsvText(''); }
      else setImportFehler(d.message);
    }
    setImportLoading(false);
  };

  const handleImportVorlageWaehlen = (id) => {
    setImportVorlage(id);
    handleVorlageWaehlen(id, setImportBetreff, setImportHtml);
  };

  const handleImportSenden = async () => {
    if (!importErgebnis?.importiert) return;
    setImportSendenLoading(true); setImportSendErgebnis(null);
    const r = await fetchWithAuth(`${API}/senden`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ typ: 'akquise', filter: { typen: ['sonstige'] }, betreff: importBetreff, html: importHtml }),
    }).catch(() => null);
    if (r) { const d = await r.json(); if (d.success) setImportSendErgebnis(d); }
    setImportSendenLoading(false);
  };

  // ── Render ────────────────────────────────────────────────────────────────

  const NavBtn = ({ id, icon, label }) => (
    <button onClick={() => setView(id)}
      style={{
        padding: '9px 20px', borderRadius: 9, border: 'none', cursor: 'pointer',
        fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 7,
        background: view === id ? 'var(--primary, #8b5cf6)' : 'var(--bg-secondary)',
        color: view === id ? '#fff' : 'var(--text)',
      }}>
      {icon} {label}
    </button>
  );

  return (
    <div style={{ maxWidth: 1200 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 42, height: 42, borderRadius: 12, background: 'rgba(59,130,246,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Send size={20} style={{ color: '#3b82f6' }}/>
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: 19, fontWeight: 700 }}>E-Mail Kampagnen</h3>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>Serienmail an Kontakte, Akquise oder Lizenzinhaber</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <NavBtn id="erstellen" icon={<Send size={14}/>} label="Neue Kampagne"/>
          <NavBtn id="importieren" icon={<Upload size={14}/>} label="Kontakte importieren"/>
          <NavBtn id="verlauf" icon={<Clock size={14}/>} label="Verlauf"/>
        </div>
      </div>

      {/* ════ VERLAUF ════ */}
      {view === 'verlauf' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
            <button onClick={loadVerlauf} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 5, fontSize: 13 }}>
              <RefreshCw size={14}/> Aktualisieren
            </button>
          </div>
          {verlaufLoading ? (
            <div style={{ textAlign: 'center', padding: 40 }}><Loader2 size={28} style={{ animation: 'spin 1s linear infinite', color: 'var(--text-muted)' }}/></div>
          ) : verlauf.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 48, color: 'var(--text-muted)' }}>
              <Mail size={40} style={{ opacity: 0.25, marginBottom: 12 }}/><br/>Noch keine Kampagnen gesendet
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {verlauf.map(k => (
                <div key={k.id} style={{ padding: '16px 20px', borderRadius: 12, background: 'var(--bg-secondary)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 12, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: k.typ === 'akquise' ? 'rgba(139,92,246,0.15)' : 'rgba(59,130,246,0.15)',
                    color: k.typ === 'akquise' ? '#8b5cf6' : '#3b82f6' }}>
                    {k.typ === 'akquise' ? <Users size={20}/> : <Building2 size={20}/>}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{k.betreff}</div>
                    <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 3 }}>
                      {k.typ === 'akquise' ? 'Akquise-Kontakte' : 'Lizenzinhaber'} · {formatDatum(k.erstellt_am)}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 18, alignItems: 'center', flexShrink: 0 }}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 20, fontWeight: 800, color: '#22c55e' }}>{k.ok || k.gesendet_anzahl || 0}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Gesendet</div>
                    </div>
                    {(k.fehler || k.fehler_anzahl || 0) > 0 && (
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 20, fontWeight: 800, color: '#ef4444' }}>{k.fehler || k.fehler_anzahl}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Fehler</div>
                      </div>
                    )}
                    <div style={{ padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700,
                      background: k.status === 'gesendet' ? 'rgba(34,197,94,0.15)' : k.status === 'teilweise' ? 'rgba(245,158,11,0.15)' : 'rgba(239,68,68,0.15)',
                      color: k.status === 'gesendet' ? '#22c55e' : k.status === 'teilweise' ? '#f59e0b' : '#ef4444' }}>
                      {k.status === 'gesendet' ? '✓ Erfolgreich' : k.status === 'teilweise' ? '⚠ Teilweise' : '✗ Fehler'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ════ IMPORTIEREN ════ */}
      {view === 'importieren' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>

          {/* Linke Spalte: Upload + Vorschau */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            <div style={CARD}>
              <div style={SECTION_TITLE}><Upload size={16}/> CSV-Datei hochladen</div>
              <div style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 14, lineHeight: 1.5 }}>
                Unterstützt werden CSV-Dateien aus Outlook, Google Contacts oder anderen Programmen.
                Erkannte Spalten: <em>Name, Vorname, Nachname, Firma, E-Mail, Telefon, Straße, PLZ, Ort</em>
              </div>

              {/* Drop-Zone */}
              <div
                onClick={() => fileInputRef.current?.click()}
                onDragOver={e => { e.preventDefault(); e.currentTarget.style.borderColor = '#3b82f6'; }}
                onDragLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; }}
                onDrop={e => { e.preventDefault(); e.currentTarget.style.borderColor = 'var(--border)'; const f = e.dataTransfer.files[0]; if (f) handleFileRead(f); }}
                style={{
                  border: '2px dashed var(--border)', borderRadius: 12, padding: '28px 20px',
                  textAlign: 'center', cursor: 'pointer', marginBottom: 12, transition: 'border-color 0.2s',
                }}>
                <Upload size={28} style={{ color: 'var(--text-muted)', marginBottom: 8 }}/>
                <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>CSV hier ablegen oder klicken</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>CSV-Format, Trennzeichen , oder ;</div>
              </div>
              <input ref={fileInputRef} type="file" accept=".csv,.txt" style={{ display: 'none' }}
                onChange={e => { if (e.target.files[0]) handleFileRead(e.target.files[0]); }} />

              {csvText && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderRadius: 8, background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.3)', marginBottom: 12 }}>
                  <span style={{ fontSize: 13, color: '#22c55e', fontWeight: 600 }}>✓ Datei geladen · {csvText.split('\n').length} Zeilen</span>
                  <button onClick={() => { setCsvText(''); setImportVorschau(null); setImportErgebnis(null); }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={14}/></button>
                </div>
              )}

              <button onClick={ladeImportVorschau} disabled={!csvText || importLoading}
                style={{ width: '100%', padding: '11px', borderRadius: 9, border: 'none', cursor: csvText ? 'pointer' : 'default',
                  background: csvText ? 'var(--bg)' : 'var(--bg)', border: '1px solid var(--border)',
                  color: 'var(--text)', fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  opacity: csvText ? 1 : 0.4 }}>
                {importLoading ? <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }}/> : <Eye size={15}/>}
                Vorschau laden
              </button>
            </div>

            {/* Vorschau-Tabelle */}
            {importVorschau && (
              <div style={CARD}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>
                    <span style={{ color: '#22c55e', fontSize: 22, marginRight: 8 }}>{importGesamt}</span>
                    Kontakte erkannt (mit E-Mail)
                  </div>
                </div>
                <div style={{ maxHeight: 280, overflowY: 'auto', fontSize: 13 }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid var(--border)' }}>
                        {['Organisation', 'Ansprechpartner', 'E-Mail', 'Ort'].map(h => (
                          <th key={h} style={{ textAlign: 'left', padding: '6px 8px', color: 'var(--text-muted)', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.3 }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {importVorschau.map((k, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ padding: '7px 8px', fontWeight: 600 }}>{k.organisation}</td>
                          <td style={{ padding: '7px 8px', color: 'var(--text-muted)' }}>{k.ansprechpartner}</td>
                          <td style={{ padding: '7px 8px', color: '#3b82f6', fontSize: 12 }}>{k.email}</td>
                          <td style={{ padding: '7px 8px', color: 'var(--text-muted)' }}>{k.ort}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {importGesamt > 20 && <div style={{ padding: '8px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>… und {importGesamt - 20} weitere</div>}
                </div>

                {importFehler && <div style={{ padding: '10px', borderRadius: 8, background: 'rgba(239,68,68,0.1)', color: '#ef4444', fontSize: 13, marginTop: 12 }}>{importFehler}</div>}

                <button onClick={handleImport} disabled={importLoading}
                  style={{ marginTop: 14, width: '100%', padding: '12px', borderRadius: 10, border: 'none', cursor: 'pointer',
                    background: '#22c55e', color: '#fff', fontSize: 15, fontWeight: 700,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  {importLoading ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }}/> : <CheckCircle size={16}/>}
                  {importGesamt} Kontakte importieren
                </button>
              </div>
            )}

            {/* Import-Ergebnis */}
            {importErgebnis && (
              <div style={{ ...CARD, borderLeft: '4px solid #22c55e' }}>
                <div style={{ fontWeight: 700, fontSize: 16, color: '#22c55e', marginBottom: 8 }}>
                  <CheckCircle size={16} style={{ marginRight: 6 }}/> Import abgeschlossen!
                </div>
                <div style={{ fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.8 }}>
                  ✓ <strong>{importErgebnis.importiert}</strong> importiert
                  {importErgebnis.duplikate > 0 && <> · ⟳ <strong>{importErgebnis.duplikate}</strong> bereits vorhanden (übersprungen)</>}
                  {importErgebnis.fehler?.length > 0 && <> · ✗ <strong>{importErgebnis.fehler.length}</strong> Fehler</>}
                </div>
                <button onClick={() => setNachImportSenden(v => !v)}
                  style={{ marginTop: 14, padding: '10px 18px', borderRadius: 9, border: 'none', cursor: 'pointer',
                    background: 'rgba(59,130,246,0.15)', color: '#3b82f6', fontWeight: 700, fontSize: 14,
                    display: 'flex', alignItems: 'center', gap: 7 }}>
                  <Send size={15}/> Jetzt Kampagne an diese Kontakte senden
                  {nachImportSenden ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}
                </button>
              </div>
            )}
          </div>

          {/* Rechte Spalte: Vorlage + Senden (nach Import) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {importErgebnis && nachImportSenden ? (
              <>
                <VorlagenPicker
                  vorlagen={vorlagen}
                  gewaehlte={importVorlage}
                  onWaehlen={handleImportVorlageWaehlen}
                  betreff={importBetreff}
                  onBetreff={setImportBetreff}
                  html={importHtml}
                  onHtml={setImportHtml}
                  modus="csv"
                />
                <SendenPanel
                  anzahl={importErgebnis.importiert}
                  betreff={importBetreff}
                  html={importHtml}
                  onSenden={handleImportSenden}
                  loading={importSendenLoading}
                  ergebnis={importSendErgebnis ? { gesendet: importSendErgebnis.gesendet, fehler: importSendErgebnis.fehler, gesamt: importSendErgebnis.gesamt } : null}
                  fehler=""
                />
              </>
            ) : (
              <div style={{ ...CARD, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 260, color: 'var(--text-muted)', textAlign: 'center' }}>
                <ArrowRight size={36} style={{ opacity: 0.2, marginBottom: 12 }}/>
                <div style={{ fontSize: 14, lineHeight: 1.6 }}>
                  Nach dem Import kannst du direkt eine Kampagne an die neuen Kontakte senden.
                  <br/><br/>
                  Die importierten Kontakte werden auch unter <strong>Neue Kampagne → Akquise</strong> verfügbar.
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ════ NEUE KAMPAGNE ════ */}
      {view === 'erstellen' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>

          {/* Linke Spalte */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Zielgruppe */}
            <div style={CARD}>
              <div style={SECTION_TITLE}><Users size={16}/> Zielgruppe</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {[
                  { id: 'akquise',      icon: <Users size={18}/>,    label: 'Akquise-Kontakte',  sub: 'Schulen, Vereine, Verbände', color: '#8b5cf6' },
                  { id: 'lizenzinhaber',icon: <Building2 size={18}/>, label: 'Dojo-Lizenzinhaber', sub: 'Aktive Dojo-Admins',          color: '#3b82f6' },
                ].map(m => (
                  <button key={m.id} onClick={() => setModus(m.id)}
                    style={{ padding: '14px', borderRadius: 12, cursor: 'pointer', textAlign: 'left',
                      border: `2px solid ${modus === m.id ? m.color : 'var(--border)'}`,
                      background: modus === m.id ? `${m.color}18` : 'var(--bg)', transition: 'all 0.15s' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: modus === m.id ? m.color : 'var(--text)', marginBottom: 4 }}>
                      {m.icon} <span style={{ fontWeight: 700, fontSize: 14 }}>{m.label}</span>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{m.sub}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Filter */}
            <div style={CARD}>
              <div style={SECTION_TITLE}><Filter size={16}/> Filter</div>

              {modus === 'akquise' && (
                <>
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 700, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>Status (leer = alle außer Gewonnen/Abgelehnt)</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                      {[
                        { id:'neu', label:'Neu', color:'#6b7280' }, { id:'kontaktiert', label:'Kontaktiert', color:'#3b82f6' },
                        { id:'interessiert', label:'Interessiert', color:'#8b5cf6' }, { id:'angebot', label:'Angebot', color:'#f59e0b' },
                        { id:'pausiert', label:'Pausiert', color:'#9ca3af' },
                      ].map(s => (
                        <button key={s.id} onClick={() => toggleFilter(filterStatus, setFilterStatus, s.id)}
                          style={{ padding: '5px 14px', borderRadius: 20, cursor: 'pointer', fontSize: 13, fontWeight: 600,
                            border: `1.5px solid ${filterStatus.includes(s.id) ? s.color : 'var(--border)'}`,
                            background: filterStatus.includes(s.id) ? `${s.color}22` : 'transparent',
                            color: filterStatus.includes(s.id) ? s.color : 'var(--text-muted)' }}>
                          {s.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 700, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>Typ (leer = alle)</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                      {['schule','verband','verein','sonstige'].map(t => (
                        <button key={t} onClick={() => toggleFilter(filterTypen, setFilterTypen, t)}
                          style={{ padding: '5px 14px', borderRadius: 20, cursor: 'pointer', fontSize: 13, fontWeight: 600, textTransform: 'capitalize',
                            border: `1.5px solid ${filterTypen.includes(t) ? '#3b82f6' : 'var(--border)'}`,
                            background: filterTypen.includes(t) ? 'rgba(59,130,246,0.15)' : 'transparent',
                            color: filterTypen.includes(t) ? '#3b82f6' : 'var(--text-muted)' }}>
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {modus === 'lizenzinhaber' && (
                <div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 700, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>Plan (leer = alle)</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                    {Object.entries(PLAN_LABELS).map(([id, cfg]) => (
                      <button key={id} onClick={() => toggleFilter(filterPlan, setFilterPlan, id)}
                        style={{ padding: '5px 14px', borderRadius: 20, cursor: 'pointer', fontSize: 13, fontWeight: 600,
                          border: `1.5px solid ${filterPlan.includes(id) ? cfg.color : 'var(--border)'}`,
                          background: filterPlan.includes(id) ? `${cfg.color}22` : 'transparent',
                          color: filterPlan.includes(id) ? cfg.color : 'var(--text-muted)' }}>
                        {cfg.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <button onClick={ladeVorschau} disabled={vorschauLaden}
                style={{ marginTop: 16, width: '100%', padding: '10px', borderRadius: 9, cursor: 'pointer',
                  border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)',
                  fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                {vorschauLaden ? <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }}/> : <Eye size={15}/>}
                Empfänger laden
              </button>
            </div>

            {/* E-Mail-Inhalt */}
            <VorlagenPicker
              vorlagen={vorlagen}
              gewaehlte={gewaehlteVorlage}
              onWaehlen={(id) => { setGewaehlteVorlage(id); handleVorlageWaehlen(id, setBetreff, setHtmlText); }}
              betreff={betreff}
              onBetreff={setBetreff}
              html={htmlText}
              onHtml={setHtmlText}
              modus={modus}
            />
          </div>

          {/* Rechte Spalte */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Empfänger-Vorschau */}
            <div style={CARD}>
              <div style={SECTION_TITLE}><Users size={16}/> Empfänger-Vorschau</div>

              {empfaenger === null && !vorschauLaden && (
                <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-muted)' }}>
                  <Eye size={32} style={{ opacity: 0.2, display: 'block', margin: '0 auto 10px' }}/>
                  <div style={{ fontSize: 14 }}>Filter setzen und „Empfänger laden" klicken</div>
                </div>
              )}
              {vorschauLaden && (
                <div style={{ textAlign: 'center', padding: '32px 0' }}>
                  <Loader2 size={24} style={{ animation: 'spin 1s linear infinite', color: 'var(--text-muted)' }}/>
                </div>
              )}
              {empfaenger !== null && !vorschauLaden && (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                    <div>
                      <span style={{ fontSize: 28, fontWeight: 800, color: empfaenger.length > 0 ? '#22c55e' : '#f59e0b' }}>{empfaenger.length}</span>
                      <span style={{ fontSize: 14, color: 'var(--text-muted)', marginLeft: 8 }}>Empfänger</span>
                    </div>
                    {empfaenger.length > 0 && (
                      <button onClick={() => setVorschauExpanded(v => !v)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4, fontSize: 13 }}>
                        {vorschauExpanded ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}
                        {vorschauExpanded ? 'Einklappen' : 'Liste anzeigen'}
                      </button>
                    )}
                  </div>
                  {vorschauExpanded && empfaenger.length > 0 && (
                    <div style={{ maxHeight: 300, overflowY: 'auto', borderTop: '1px solid var(--border)' }}>
                      {empfaenger.map((e, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: '1px solid var(--border)' }}>
                          <div style={{ width: 34, height: 34, borderRadius: 9, background: 'rgba(59,130,246,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 800, color: '#3b82f6', flexShrink: 0 }}>
                            {(e.organisation || e.dojoname || '?')[0].toUpperCase()}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 600, fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.organisation || e.dojoname}</div>
                            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{e.email}</div>
                          </div>
                          {e.status && <span style={{ fontSize: 11, padding: '2px 9px', borderRadius: 12, background: `${STATUS_FARBEN[e.status]||'#6b7280'}22`, color: STATUS_FARBEN[e.status]||'#6b7280', fontWeight: 600, textTransform: 'capitalize' }}>{e.status}</span>}
                          {e.plan_type && <span style={{ fontSize: 11, padding: '2px 9px', borderRadius: 12, background: `${PLAN_LABELS[e.plan_type]?.color||'#6b7280'}22`, color: PLAN_LABELS[e.plan_type]?.color||'#6b7280', fontWeight: 600 }}>{PLAN_LABELS[e.plan_type]?.label||e.plan_type}</span>}
                        </div>
                      ))}
                    </div>
                  )}
                  {empfaenger.length === 0 && (
                    <div style={{ color: 'var(--text-muted)', fontSize: 14 }}><AlertTriangle size={14} style={{ marginRight: 6, color: '#f59e0b' }}/>Keine Empfänger mit diesen Filtern</div>
                  )}
                </>
              )}
            </div>

            <SendenPanel
              anzahl={empfaenger?.length || 0}
              betreff={betreff}
              html={htmlText}
              onSenden={handleSenden}
              loading={sendenLoading}
              ergebnis={ergebnis}
              fehler={fehlerMsg}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default KampagnenDashboard;
