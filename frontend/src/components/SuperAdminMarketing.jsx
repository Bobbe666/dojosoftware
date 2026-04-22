/**
 * SuperAdminMarketing.jsx
 * Marketing KI für Super-Admin: TDA Dojo, Verband, Lizenzen
 */

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { Sparkles, Save, Copy, Check, Trash2, Loader2, Mail, Send, Users, Gift, RefreshCw, LayoutTemplate, CheckCircle, AlertCircle } from 'lucide-react';
import '../styles/MarketingZentrale.css';

const KONTEXTE = [
  { id: 'dojo',    label: '🥋 TDA Dojo',    name: 'TDA Kampfkunstschule' },
  { id: 'verband', label: '🏆 TDA Verband',  name: 'TDA Int\'l Org – Verband' },
  { id: 'lizenz',  label: '📜 Lizenzen',     name: 'TDA Int\'l Org – Lizenzprogramm' },
];

const TONALITAETEN = [
  { value: 'freundlich',    label: '😊 Freundlich & einladend' },
  { value: 'motivierend',   label: '💪 Motivierend & energetisch' },
  { value: 'professionell', label: '🎯 Professionell & seriös' },
  { value: 'humorvoll',     label: '😄 Locker & humorvoll' },
];

const PLATTFORMEN = [
  { value: 'beide',     label: '📱 Facebook + Instagram' },
  { value: 'facebook',  label: '📘 Nur Facebook' },
  { value: 'instagram', label: '📷 Nur Instagram' },
  { value: 'story',     label: '⚡ Story' },
];

const ANLAESSE = [
  'Training / Kurs', 'Prüfung bestanden', 'Neues Angebot', 'Veranstaltung / Event',
  'Trainingstipp', 'Motivation', 'Hinter den Kulissen', 'Mitglieder-Erfolg', 'Saisonstart', 'Feiertag'
];

const KATEGORIEN = [
  { value: 'allgemein', label: 'Allgemein' },
  { value: 'training',  label: 'Training' },
  { value: 'pruefung',  label: 'Prüfung' },
  { value: 'angebot',   label: 'Angebot' },
  { value: 'event',     label: 'Event' },
  { value: 'tipp',      label: 'Tipp' },
  { value: 'geburtstag', label: 'Geburtstag' },
];

// ── KI Content Generator ──────────────────────────────────────────────────────
function KiContentTab({ dojoId, orgName }) {
  const [thema, setThema]         = useState('');
  const [plattform, setPlattform] = useState('beide');
  const [tonalitaet, setTon]      = useState('freundlich');
  const [anlass, setAnlass]       = useState('');
  const [zusatz, setZusatz]       = useState('');
  const [generating, setGen]      = useState(false);
  const [generated, setGenerated] = useState('');
  const [copied, setCopied]       = useState(false);
  const [error, setError]         = useState('');
  const [showSaveForm, setShowSF] = useState(false);
  const [tplName, setTplName]     = useState('');
  const [tplKat, setTplKat]       = useState('allgemein');
  const [saving, setSaving]       = useState(false);
  const [saveMsg, setSaveMsg]     = useState('');
  const [templates, setTemplates] = useState([]);
  const [showTpl, setShowTpl]     = useState(false);
  const [loadingTpl, setLoadTpl]  = useState(false);

  const dojoParam = dojoId ? `?dojo_id=${dojoId}` : '';

  useEffect(() => { if (showTpl) loadTemplates(); }, [showTpl, dojoId]);

  const loadTemplates = async () => {
    setLoadTpl(true);
    try {
      const res = await axios.get(`/marketing-ki/templates${dojoParam}`);
      setTemplates(Array.isArray(res.data) ? res.data : []);
    } catch { setTemplates([]); }
    finally { setLoadTpl(false); }
  };

  const generate = async () => {
    if (!thema.trim()) { setError('Bitte ein Thema eingeben.'); return; }
    setError(''); setGen(true); setGenerated('');
    try {
      const res = await axios.post(`/marketing-ki/generate${dojoParam}`, {
        thema, plattform, tonalitaet, anlass, zusatzinfos: zusatz, orgName
      });
      setGenerated(res.data.content || '');
    } catch (e) {
      setError(e.response?.data?.error || 'Generierung fehlgeschlagen');
    } finally { setGen(false); }
  };

  const copy = () => { navigator.clipboard.writeText(generated); setCopied(true); setTimeout(() => setCopied(false), 2000); };

  const saveTemplate = async () => {
    if (!tplName.trim()) { setSaveMsg('Bitte einen Namen eingeben.'); return; }
    setSaving(true); setSaveMsg('');
    try {
      await axios.post(`/marketing-ki/templates${dojoParam}`, {
        name: tplName, kategorie: tplKat, plattform, content: generated, tonalitaet
      });
      setSaveMsg('✅ Template gespeichert!');
      setTplName(''); setShowSF(false);
      if (showTpl) loadTemplates();
    } catch { setSaveMsg('❌ Speichern fehlgeschlagen'); }
    finally { setSaving(false); }
  };

  const deleteTemplate = async (id) => {
    if (!window.confirm('Template löschen?')) return;
    try {
      await axios.delete(`/marketing-ki/templates/${id}${dojoParam}`);
      setTemplates(prev => prev.filter(t => t.id !== id));
    } catch {}
  };

  return (
    <div>
      <div className="mz-card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
          <Sparkles size={18} color="#d4a017" />
          <strong style={{ fontSize: 15 }}>KI-Content Generator</strong>
          <span style={{ fontSize: 12, color: '#888', marginLeft: 4 }}>für: {orgName}</span>
        </div>
        <div style={{ display: 'grid', gap: 12 }}>
          <div>
            <label style={lbl}>Thema *</label>
            <input style={inp} placeholder="z.B. Neuer Anfänger-Kurs startet im September" value={thema} onChange={e => setThema(e.target.value)} />
          </div>
          <div>
            <label style={lbl}>Anlass</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
              {ANLAESSE.map(a => (
                <button key={a} onClick={() => setAnlass(anlass === a ? '' : a)}
                  style={{ ...pill, ...(anlass === a ? pillAct : {}) }}>{a}</button>
              ))}
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={lbl}>Plattform</label>
              <select style={inp} value={plattform} onChange={e => setPlattform(e.target.value)}>
                {PLATTFORMEN.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>
            <div>
              <label style={lbl}>Tonalität</label>
              <select style={inp} value={tonalitaet} onChange={e => setTon(e.target.value)}>
                {TONALITAETEN.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label style={lbl}>Zusatzinfos (optional)</label>
            <input style={inp} placeholder="z.B. Freitagabend 19 Uhr, für alle Altersgruppen" value={zusatz} onChange={e => setZusatz(e.target.value)} />
          </div>
        </div>
        {error && (
          <div style={{ marginTop: 10, padding: '10px 14px', borderRadius: 7, background: '#2d1010', color: '#fc8181', fontSize: 13, border: '1px solid #742a2a' }}>
            ⚠️ {error}
          </div>
        )}
        <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
          <button onClick={generate} disabled={generating} style={btnP}>
            {generating ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Sparkles size={14} />}
            {generating ? 'Generiere…' : 'Post generieren'}
          </button>
          <button onClick={() => setShowTpl(v => !v)} style={btnS}>
            <LayoutTemplate size={14} /> Meine Templates
          </button>
        </div>
      </div>

      {generated && (
        <div className="mz-card" style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <strong style={{ fontSize: 14 }}>Generierter Content</strong>
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={copy} style={btnS}>
                {copied ? <><Check size={13} /> Kopiert!</> : <><Copy size={13} /> Kopieren</>}
              </button>
              <button onClick={() => setShowSF(v => !v)} style={btnS}>
                <Save size={13} /> Als Template
              </button>
            </div>
          </div>
          <textarea style={{ ...inp, minHeight: 180, resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.6 }}
            value={generated} onChange={e => setGenerated(e.target.value)} />
          {showSaveForm && (
            <div style={{ marginTop: 12, padding: 12, background: 'var(--bg-secondary, #1a1a2e)', borderRadius: 8, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div style={{ flex: 1, minWidth: 140 }}>
                <label style={lbl}>Template-Name</label>
                <input style={inp} placeholder="z.B. Verbands-Post Motivation" value={tplName} onChange={e => setTplName(e.target.value)} />
              </div>
              <div style={{ minWidth: 120 }}>
                <label style={lbl}>Kategorie</label>
                <select style={inp} value={tplKat} onChange={e => setTplKat(e.target.value)}>
                  {KATEGORIEN.map(k => <option key={k.value} value={k.value}>{k.label}</option>)}
                </select>
              </div>
              <button onClick={saveTemplate} disabled={saving} style={btnP}>{saving ? 'Speichert…' : 'Speichern'}</button>
            </div>
          )}
          {saveMsg && <div style={{ marginTop: 6, fontSize: 13, color: saveMsg.startsWith('✅') ? '#38a169' : '#e53e3e' }}>{saveMsg}</div>}
        </div>
      )}

      {showTpl && (
        <div className="mz-card">
          <strong style={{ fontSize: 14, display: 'block', marginBottom: 12 }}>
            <LayoutTemplate size={15} style={{ verticalAlign: 'middle', marginRight: 5 }} />
            Gespeicherte Templates
          </strong>
          {loadingTpl ? <div style={{ color: '#888', textAlign: 'center', padding: 16 }}>Lädt…</div>
            : templates.length === 0 ? <div style={{ color: '#888', fontSize: 13, textAlign: 'center', padding: 16 }}>Noch keine Templates gespeichert.</div>
            : (
              <div style={{ display: 'grid', gap: 8 }}>
                {templates.map(t => (
                  <div key={t.id} style={{ border: '1px solid var(--border, #e2e8f0)', borderRadius: 8, padding: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                      <strong style={{ fontSize: 13 }}>{t.name}</strong>
                      <div style={{ display: 'flex', gap: 5 }}>
                        <button onClick={() => { setGenerated(t.content); setPlattform(t.plattform || 'beide'); setTon(t.tonalitaet || 'freundlich'); setShowTpl(false); }} style={btnS}>Verwenden</button>
                        <button onClick={() => deleteTemplate(t.id)} style={{ ...btnS, color: '#e53e3e' }}><Trash2 size={12} /></button>
                      </div>
                    </div>
                    <div style={{ fontSize: 12, color: '#666', whiteSpace: 'pre-wrap', maxHeight: 60, overflow: 'hidden', lineHeight: 1.5 }}>{t.content}</div>
                  </div>
                ))}
              </div>
            )}
        </div>
      )}
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ── Newsletter ────────────────────────────────────────────────────────────────
function NewsletterTab({ dojoId, orgName }) {
  const [betreff, setBetreff]       = useState('');
  const [content, setContent]       = useState('');
  const [geschlecht, setGeschlecht] = useState('alle');
  const [empfAn, setEmpfAn]         = useState(null);
  const [loadingAnz, setLoadAnz]    = useState(false);
  const [kiThema, setKiThema]       = useState('');
  const [kiTon, setKiTon]           = useState('freundlich');
  const [genKi, setGenKi]           = useState(false);
  const [sending, setSending]       = useState(false);
  const [msg, setMsg]               = useState(null);
  const [showPrev, setShowPrev]     = useState(false);

  const dojoParam = dojoId ? `?dojo_id=${dojoId}` : '';

  useEffect(() => { loadEmpfaenger(); }, [geschlecht, dojoId]);

  const loadEmpfaenger = async () => {
    setLoadAnz(true);
    try {
      const res = await axios.post(`/marketing-ki/newsletter/preview-empfaenger${dojoParam}`, { filter: { geschlecht } });
      setEmpfAn(res.data.anzahl);
    } catch { setEmpfAn(null); }
    finally { setLoadAnz(false); }
  };

  const generateKiText = async () => {
    if (!kiThema.trim()) { setMsg({ ok: false, text: 'Bitte ein Thema eingeben.' }); return; }
    setGenKi(true); setMsg(null);
    try {
      const res = await axios.post(`/marketing-ki/newsletter/ki-text${dojoParam}`, { thema: kiThema, tonalitaet: kiTon, orgName });
      setContent(res.data.content || '');
    } catch { setMsg({ ok: false, text: 'KI-Generierung fehlgeschlagen.' }); }
    finally { setGenKi(false); }
  };

  const send = async () => {
    if (!betreff.trim() || !content.trim()) { setMsg({ ok: false, text: 'Betreff und Inhalt sind erforderlich.' }); return; }
    if (!window.confirm(`Newsletter an ${empfAn} Mitglieder senden?`)) return;
    setSending(true); setMsg(null);
    try {
      const res = await axios.post(`/marketing-ki/newsletter/send${dojoParam}`, { betreff, content, filter: { geschlecht } });
      setMsg({ ok: true, text: `✅ Newsletter an ${res.data.gesendet} von ${res.data.gesamt} Empfängern gesendet.` });
      setBetreff(''); setContent(''); setKiThema('');
    } catch (e) {
      setMsg({ ok: false, text: e.response?.data?.error || 'Versand fehlgeschlagen.' });
    } finally { setSending(false); }
  };

  return (
    <div className="mz-card">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <Mail size={18} color="#d4a017" />
        <strong style={{ fontSize: 15 }}>Newsletter</strong>
        <span style={{ fontSize: 12, color: '#888', marginLeft: 4 }}>für: {orgName}</span>
      </div>

      <div style={{ marginBottom: 12 }}>
        <label style={lbl}>Empfänger</label>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          {['alle', 'männlich', 'weiblich'].map(g => (
            <button key={g} onClick={() => setGeschlecht(g)} style={{ ...pill, ...(geschlecht === g ? pillAct : {}) }}>
              {g === 'alle' ? '👥 Alle' : g === 'männlich' ? '♂ Männlich' : '♀ Weiblich'}
            </button>
          ))}
          <span style={{ fontSize: 12, color: '#888' }}>
            {loadingAnz ? '…' : empfAn !== null ? <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><Users size={12} /> <strong>{empfAn}</strong></span> : ''}
          </span>
        </div>
      </div>

      <div style={{ marginBottom: 12 }}>
        <label style={lbl}>Betreff *</label>
        <input style={inp} placeholder="z.B. Neuigkeiten aus dem TDA Verband" value={betreff} onChange={e => setBetreff(e.target.value)} />
      </div>

      <div style={{ marginBottom: 12, padding: 12, background: 'var(--bg-secondary, #1a1a2e)', borderRadius: 8, border: '1px dashed var(--border, #3a3a4a)' }}>
        <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 5 }}>
          <Sparkles size={13} color="#d4a017" /> KI-Textgenerator
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <input style={{ ...inp, flex: 1, minWidth: 160 }} placeholder="Thema für KI" value={kiThema} onChange={e => setKiThema(e.target.value)} />
          <select style={{ ...inp, width: 'auto' }} value={kiTon} onChange={e => setKiTon(e.target.value)}>
            <option value="freundlich">😊 Freundlich</option>
            <option value="motivierend">💪 Motivierend</option>
            <option value="professionell">🎯 Professionell</option>
            <option value="humorvoll">😄 Locker</option>
          </select>
          <button onClick={generateKiText} disabled={genKi} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 12px', borderRadius: 7, border: 'none', background: '#553c9a', color: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap' }}>
            {genKi ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Sparkles size={13} />}
            {genKi ? 'Generiere…' : 'Text erstellen'}
          </button>
        </div>
      </div>

      <div style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <label style={lbl}>Newsletter-Text *</label>
          {content && <button onClick={() => setShowPrev(v => !v)} style={{ fontSize: 12, color: '#888', background: 'none', border: 'none', cursor: 'pointer' }}>{showPrev ? 'Vorschau verbergen' : 'Vorschau'}</button>}
        </div>
        <textarea style={{ ...inp, minHeight: 180, resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.6 }}
          placeholder={'Liebe Mitglieder,\n\n…\n\nMit sportlichem Gruß\nEuer Team'}
          value={content} onChange={e => setContent(e.target.value)} />
      </div>

      {showPrev && content && (
        <div style={{ marginBottom: 12, border: '1px solid var(--border, #e2e8f0)', borderRadius: 8, overflow: 'hidden' }}>
          <div style={{ background: '#1a1a2e', padding: '10px 16px', color: '#fff', fontWeight: 700, fontSize: 13 }}>Vorschau: {betreff || '(kein Betreff)'}</div>
          <div style={{ padding: 16, fontSize: 14, lineHeight: 1.7, whiteSpace: 'pre-wrap', color: '#333' }}>{content}</div>
        </div>
      )}

      {msg && (
        <div style={{ marginBottom: 12, padding: '10px 14px', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 8, background: msg.ok ? '#f0fff4' : '#fff5f5', color: msg.ok ? '#276749' : '#9b2c2c', fontSize: 13 }}>
          {msg.ok ? <CheckCircle size={14} /> : <AlertCircle size={14} />} {msg.text}
        </div>
      )}

      <button onClick={send} disabled={sending || !betreff.trim() || !content.trim() || empfAn === 0}
        style={{ ...btnP, opacity: (sending || !betreff.trim() || !content.trim() || empfAn === 0) ? 0.6 : 1 }}>
        {sending ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Send size={14} />}
        {sending ? 'Wird gesendet…' : `Newsletter senden${empfAn ? ` (${empfAn})` : ''}`}
      </button>
    </div>
  );
}

// ── Geburtstage ───────────────────────────────────────────────────────────────
function GeburtstageTab({ dojoId }) {
  const [geburtstage, setGeb]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [plattform, setPlattform] = useState('beide');
  const [generating, setGen]    = useState(false);
  const [activeId, setActiveId] = useState(null);
  const [results, setResults]   = useState({});
  const [copied, setCopied]     = useState(null);

  const dojoParam = dojoId ? `?dojo_id=${dojoId}` : '';

  useEffect(() => { load(); }, [dojoId]);

  const load = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`/marketing-ki/geburtstage${dojoParam}`);
      setGeb(Array.isArray(res.data) ? res.data : []);
    } catch { setGeb([]); }
    finally { setLoading(false); }
  };

  const generatePost = async (m) => {
    setGen(true); setActiveId(m.mitglied_id);
    try {
      const res = await axios.post(`/marketing-ki/geburtstage/generate${dojoParam}`, { vorname: m.vorname, alter: m.alter_jahre + 1, plattform });
      setResults(prev => ({ ...prev, [m.mitglied_id]: res.data.content || '' }));
    } catch { setResults(prev => ({ ...prev, [m.mitglied_id]: '❌ Fehler' })); }
    finally { setGen(false); setActiveId(null); }
  };

  const copy = (id, text) => { navigator.clipboard.writeText(text); setCopied(id); setTimeout(() => setCopied(null), 2000); };

  if (loading) return <div style={{ textAlign: 'center', padding: 30, color: '#888' }}><Loader2 size={18} /> Lädt…</div>;

  return (
    <div className="mz-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Gift size={18} color="#d4a017" />
          <strong style={{ fontSize: 15 }}>Geburtstage – nächste 30 Tage</strong>
          <span style={{ background: 'var(--bg-secondary, #1e1e2e)', borderRadius: 10, padding: '2px 8px', fontSize: 12 }}>{geburtstage.length}</span>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <select style={{ padding: '5px 8px', borderRadius: 6, border: '1px solid var(--border, #3a3a4a)', fontSize: 12, background: 'var(--bg-input, #1e1e2e)', color: 'var(--text-primary, #eee)' }}
            value={plattform} onChange={e => setPlattform(e.target.value)}>
            <option value="beide">📱 Facebook + Instagram</option>
            <option value="instagram">📷 Instagram</option>
            <option value="facebook">📘 Facebook</option>
            <option value="story">⚡ Story</option>
          </select>
          <button onClick={load} style={{ padding: '5px 8px', borderRadius: 6, border: '1px solid var(--border, #3a3a4a)', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--text-primary, #eee)' }}>
            <RefreshCw size={12} /> Aktualisieren
          </button>
        </div>
      </div>
      {geburtstage.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 24, color: '#888', fontSize: 13 }}>🎉 Keine Geburtstage in den nächsten 30 Tagen.</div>
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {geburtstage.map(m => (
            <div key={m.mitglied_id} style={{ border: '1px solid var(--border, #e2e8f0)', borderRadius: 8, overflow: 'hidden' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 34, height: 34, borderRadius: '50%', background: '#d4a01722', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>🎂</div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{m.vorname} {m.nachname}</div>
                    <div style={{ fontSize: 12, color: '#888' }}>wird {m.alter_jahre + 1} · {new Date(m.geburtsdatum).toLocaleDateString('de-DE', { day: '2-digit', month: 'long' })}
                      {m.tage_bis === 0 ? <span style={{ marginLeft: 6, background: '#38a169', color: '#fff', borderRadius: 10, padding: '1px 7px', fontSize: 11, fontWeight: 700 }}>🎂 Heute!</span>
                        : m.tage_bis <= 3 ? <span style={{ marginLeft: 6, background: '#d69e2e', color: '#fff', borderRadius: 10, padding: '1px 7px', fontSize: 11 }}>in {m.tage_bis} Tag{m.tage_bis > 1 ? 'en' : ''}</span>
                        : <span style={{ marginLeft: 6, color: '#666', fontSize: 11 }}>in {m.tage_bis} Tagen</span>}
                    </div>
                  </div>
                </div>
                <button onClick={() => generatePost(m)} disabled={generating && activeId === m.mitglied_id}
                  style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', borderRadius: 7, border: 'none', background: '#d4a017', color: '#fff', fontWeight: 600, fontSize: 12, cursor: 'pointer' }}>
                  {generating && activeId === m.mitglied_id ? <><Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> Generiere…</> : <><Sparkles size={12} /> Post erstellen</>}
                </button>
              </div>
              {results[m.mitglied_id] && (
                <div style={{ borderTop: '1px solid var(--border, #e2e8f0)', padding: '10px 14px', background: 'var(--bg-secondary, #1a1a2e)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <span style={{ fontSize: 11, color: '#888', fontWeight: 600 }}>Generierter Post</span>
                    <button onClick={() => copy(m.mitglied_id, results[m.mitglied_id])} style={{ display: 'flex', alignItems: 'center', gap: 3, padding: '3px 8px', borderRadius: 5, border: '1px solid var(--border, #3a3a4a)', background: 'transparent', fontSize: 11, cursor: 'pointer', color: 'var(--text-primary, #eee)' }}>
                      {copied === m.mitglied_id ? <><Check size={11} /> Kopiert!</> : <><Copy size={11} /> Kopieren</>}
                    </button>
                  </div>
                  <textarea style={{ width: '100%', minHeight: 90, padding: '6px 10px', borderRadius: 5, border: '1px solid var(--border, #3a3a4a)', fontSize: 12, fontFamily: 'inherit', lineHeight: 1.5, resize: 'vertical', boxSizing: 'border-box', background: 'var(--bg-input, #1e1e2e)', color: 'var(--text-primary, #eee)' }}
                    value={results[m.mitglied_id]} onChange={e => setResults(prev => ({ ...prev, [m.mitglied_id]: e.target.value }))} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function SuperAdminMarketing() {
  const { token } = useAuth();
  const [dojos, setDojos]       = useState([]);
  const [selectedDojoId, setSel] = useState(null);
  const [kontext, setKontext]   = useState('dojo');
  const [activeTab, setTab]     = useState('ki-content');

  useEffect(() => {
    if (!token) return;
    axios.get('/dojos?filter=managed')
      .then(res => {
        const list = Array.isArray(res.data) ? res.data : [];
        setDojos(list);
        if (list.length > 0 && !selectedDojoId) setSel(list[0].id);
      })
      .catch(() => {});
  }, [token]);

  const kontextInfo = KONTEXTE.find(k => k.id === kontext) || KONTEXTE[0];
  // For Verband/Lizenzen, use same dojo_id but override org name in prompts
  const dojoId = selectedDojoId;
  const orgName = kontext === 'dojo'
    ? (dojos.find(d => d.id === selectedDojoId)?.dojoname || 'TDA Kampfkunstschule')
    : kontextInfo.name;

  const tabs = [
    { id: 'ki-content',  label: '✨ KI-Content' },
    { id: 'newsletter',  label: '📧 Newsletter' },
    { id: 'geburtstage', label: '🎂 Geburtstage' },
  ];

  return (
    <div style={{ maxWidth: 820, margin: '0 auto' }}>
      {/* Kontext + Dojo Selector */}
      <div className="sad-card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <Sparkles size={16} color="#d4a017" />
          <strong style={{ fontSize: 14 }}>Marketing KI</strong>
          <div style={{ display: 'flex', gap: 6 }}>
            {KONTEXTE.map(k => (
              <button key={k.id} onClick={() => setKontext(k.id)}
                style={{ padding: '5px 12px', borderRadius: 16, fontSize: 12, border: `1px solid ${kontext === k.id ? '#d4a017' : 'var(--border, #3a3a4a)'}`, background: kontext === k.id ? '#d4a017' : 'transparent', color: kontext === k.id ? '#fff' : 'var(--text-muted, #aaa)', cursor: 'pointer', transition: 'all 0.15s' }}>
                {k.label}
              </button>
            ))}
          </div>
          {dojos.length > 1 && kontext === 'dojo' && (
            <select style={{ ...inp, width: 'auto', fontSize: 12, marginLeft: 'auto' }} value={selectedDojoId || ''} onChange={e => setSel(Number(e.target.value))}>
              {dojos.map(d => <option key={d.id} value={d.id}>{d.dojoname}</option>)}
            </select>
          )}
        </div>
        <div style={{ marginTop: 8, fontSize: 12, color: '#888' }}>
          Kontext für KI: <strong style={{ color: 'var(--text-primary, #eee)' }}>{orgName}</strong>
          {!selectedDojoId && <span style={{ color: '#e53e3e', marginLeft: 8 }}>⚠️ Kein Dojo ausgewählt</span>}
        </div>
      </div>

      {/* Sub-Tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{ padding: '7px 16px', borderRadius: 8, fontSize: 13, fontWeight: activeTab === t.id ? 700 : 400, border: `1px solid ${activeTab === t.id ? '#d4a017' : 'var(--border, #3a3a4a)'}`, background: activeTab === t.id ? '#d4a01722' : 'transparent', color: activeTab === t.id ? '#d4a017' : 'var(--text-primary, #eee)', cursor: 'pointer', transition: 'all 0.15s' }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {activeTab === 'ki-content'  && <KiContentTab  dojoId={dojoId} orgName={orgName} />}
      {activeTab === 'newsletter'  && <NewsletterTab  dojoId={dojoId} orgName={orgName} />}
      {activeTab === 'geburtstage' && <GeburtstageTab dojoId={dojoId} />}
    </div>
  );
}

// Styles
const lbl = { display: 'block', fontSize: 11, fontWeight: 600, marginBottom: 4, color: 'var(--text-muted, #aaa)' };
const inp = {
  width: '100%', padding: '7px 10px', borderRadius: 6, fontSize: 13, boxSizing: 'border-box',
  border: '1px solid var(--border, #3a3a4a)', background: 'var(--bg-input, #1e1e2e)', color: 'var(--text-primary, #eee)',
  outline: 'none', fontFamily: 'inherit'
};
const pill = { padding: '3px 9px', borderRadius: 14, fontSize: 11, border: '1px solid var(--border, #3a3a4a)', background: 'transparent', cursor: 'pointer', color: 'var(--text-muted, #aaa)', transition: 'all 0.15s' };
const pillAct = { background: '#d4a017', color: '#fff', borderColor: '#d4a017' };
const btnP = { display: 'flex', alignItems: 'center', gap: 5, padding: '7px 16px', borderRadius: 8, border: 'none', background: '#d4a017', color: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer' };
const btnS = { display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px', borderRadius: 7, border: '1px solid var(--border, #3a3a4a)', background: 'transparent', fontSize: 12, color: 'var(--text-primary, #eee)', cursor: 'pointer' };
