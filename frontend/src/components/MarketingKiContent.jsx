/**
 * MarketingKiContent.jsx
 * KI-gestützter Content-Generator für Social Media Posts
 * inkl. Template-Verwaltung
 */

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useDojoContext } from '../context/DojoContext';
import { Sparkles, Save, Copy, Check, Trash2, Loader2, ChevronDown, ChevronUp, LayoutTemplate } from 'lucide-react';

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
  { value: 'story',     label: '⚡ Instagram Story' },
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

export default function MarketingKiContent() {
  const { activeDojo } = useDojoContext();

  // Generator
  const [thema, setThema]           = useState('');
  const [plattform, setPlattform]   = useState('beide');
  const [tonalitaet, setTon]        = useState('freundlich');
  const [anlass, setAnlass]         = useState('');
  const [zusatz, setZusatz]         = useState('');
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated]   = useState('');
  const [copied, setCopied]         = useState(false);
  const [error, setError]           = useState('');

  // Template speichern
  const [showSaveForm, setShowSaveForm] = useState(false);
  const [tplName, setTplName]       = useState('');
  const [tplKat, setTplKat]         = useState('allgemein');
  const [saving, setSaving]         = useState(false);
  const [saveMsg, setSaveMsg]       = useState('');

  // Templates
  const [templates, setTemplates]   = useState([]);
  const [showTemplates, setShowTemplates] = useState(false);
  const [loadingTpl, setLoadingTpl] = useState(false);

  const dojoParam = activeDojo ? `?dojo_id=${activeDojo}` : '';

  useEffect(() => {
    if (showTemplates) loadTemplates();
  }, [showTemplates, activeDojo]);

  const loadTemplates = async () => {
    setLoadingTpl(true);
    try {
      const res = await axios.get(`/marketing-ki/templates${dojoParam}`);
      setTemplates(Array.isArray(res.data) ? res.data : []);
    } catch { setTemplates([]); }
    finally { setLoadingTpl(false); }
  };

  const generate = async () => {
    if (!thema.trim()) { setError('Bitte ein Thema eingeben.'); return; }
    setError(''); setGenerating(true); setGenerated('');
    try {
      const res = await axios.post(`/marketing-ki/generate${dojoParam}`, {
        thema, plattform, tonalitaet, anlass, zusatzinfos: zusatz
      });
      setGenerated(res.data.content || '');
    } catch (e) {
      setError(e.response?.data?.error || 'Generierung fehlgeschlagen');
    } finally { setGenerating(false); }
  };

  const copy = () => {
    navigator.clipboard.writeText(generated);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const saveTemplate = async () => {
    if (!tplName.trim()) { setSaveMsg('Bitte einen Namen eingeben.'); return; }
    setSaving(true); setSaveMsg('');
    try {
      await axios.post(`/marketing-ki/templates${dojoParam}`, {
        name: tplName, kategorie: tplKat, plattform, content: generated, tonalitaet
      });
      setSaveMsg('✅ Template gespeichert!');
      setTplName(''); setShowSaveForm(false);
      if (showTemplates) loadTemplates();
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

  const useTemplate = (tpl) => {
    setGenerated(tpl.content);
    setPlattform(tpl.plattform || 'beide');
    setTon(tpl.tonalitaet || 'freundlich');
    setShowTemplates(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div style={{ maxWidth: 780, margin: '0 auto' }}>

      {/* ── Generator ── */}
      <div className="mz-card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
          <Sparkles size={20} color="#d4a017" />
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>KI-Content Generator</h3>
        </div>

        <div style={{ display: 'grid', gap: 14 }}>
          {/* Thema */}
          <div>
            <label style={labelStyle}>Thema *</label>
            <input
              style={inputStyle}
              placeholder="z.B. Neuer Anfänger-Kurs startet im September"
              value={thema}
              onChange={e => setThema(e.target.value)}
            />
          </div>

          {/* Anlass */}
          <div>
            <label style={labelStyle}>Anlass / Kategorie</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {ANLAESSE.map(a => (
                <button key={a} onClick={() => setAnlass(anlass === a ? '' : a)}
                  style={{ ...pillStyle, ...(anlass === a ? pillActive : {}) }}>
                  {a}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            {/* Plattform */}
            <div>
              <label style={labelStyle}>Plattform</label>
              <select style={inputStyle} value={plattform} onChange={e => setPlattform(e.target.value)}>
                {PLATTFORMEN.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>
            {/* Tonalität */}
            <div>
              <label style={labelStyle}>Tonalität</label>
              <select style={inputStyle} value={tonalitaet} onChange={e => setTon(e.target.value)}>
                {TONALITAETEN.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
          </div>

          {/* Zusatz */}
          <div>
            <label style={labelStyle}>Zusatzinfos (optional)</label>
            <input
              style={inputStyle}
              placeholder="z.B. Freitagabend 19 Uhr, für Erwachsene ab 18 Jahren, Probetraining kostenlos"
              value={zusatz}
              onChange={e => setZusatz(e.target.value)}
            />
          </div>
        </div>

        {error && <div style={errStyle}>{error}</div>}

        <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
          <button onClick={generate} disabled={generating} style={btnPrimary}>
            {generating ? <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> : <Sparkles size={15} />}
            {generating ? 'Generiere…' : 'Post generieren'}
          </button>
          <button onClick={() => setShowTemplates(v => !v)} style={btnSecondary}>
            <LayoutTemplate size={15} />
            Meine Templates
          </button>
        </div>
      </div>

      {/* ── Ergebnis ── */}
      {generated && (
        <div className="mz-card" style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Generierter Content</h3>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={copy} style={btnSecondary}>
                {copied ? <><Check size={14} /> Kopiert!</> : <><Copy size={14} /> Kopieren</>}
              </button>
              <button onClick={() => setShowSaveForm(v => !v)} style={btnSecondary}>
                <Save size={14} /> Als Template speichern
              </button>
            </div>
          </div>

          <textarea
            style={{ ...inputStyle, minHeight: 200, resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.6 }}
            value={generated}
            onChange={e => setGenerated(e.target.value)}
          />

          {showSaveForm && (
            <div style={{ marginTop: 14, padding: 14, background: 'var(--bg-secondary, #f8f9fa)', borderRadius: 8, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div style={{ flex: 1, minWidth: 160 }}>
                <label style={labelStyle}>Template-Name</label>
                <input style={inputStyle} placeholder="z.B. Anfänger-Kurs Post" value={tplName} onChange={e => setTplName(e.target.value)} />
              </div>
              <div style={{ minWidth: 130 }}>
                <label style={labelStyle}>Kategorie</label>
                <select style={inputStyle} value={tplKat} onChange={e => setTplKat(e.target.value)}>
                  {KATEGORIEN.map(k => <option key={k.value} value={k.value}>{k.label}</option>)}
                </select>
              </div>
              <button onClick={saveTemplate} disabled={saving} style={btnPrimary}>
                {saving ? 'Speichert…' : 'Speichern'}
              </button>
            </div>
          )}
          {saveMsg && <div style={{ marginTop: 8, fontSize: 13, color: saveMsg.startsWith('✅') ? '#38a169' : '#e53e3e' }}>{saveMsg}</div>}
        </div>
      )}

      {/* ── Templates ── */}
      {showTemplates && (
        <div className="mz-card">
          <h3 style={{ margin: '0 0 14px', fontSize: 15, fontWeight: 700 }}>
            <LayoutTemplate size={16} style={{ verticalAlign: 'middle', marginRight: 6 }} />
            Gespeicherte Templates
          </h3>
          {loadingTpl ? (
            <div style={{ textAlign: 'center', padding: 20, color: '#888' }}><Loader2 size={18} /> Lädt…</div>
          ) : templates.length === 0 ? (
            <div style={{ color: '#888', fontSize: 14, textAlign: 'center', padding: 20 }}>
              Noch keine Templates gespeichert. Generiere einen Post und speichere ihn als Template.
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 10 }}>
              {templates.map(t => (
                <div key={t.id} style={{ border: '1px solid var(--border, #e2e8f0)', borderRadius: 8, padding: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                    <div>
                      <strong style={{ fontSize: 14 }}>{t.name}</strong>
                      <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                        <span style={tagStyle}>{KATEGORIEN.find(k => k.value === t.kategorie)?.label || t.kategorie}</span>
                        <span style={tagStyle}>{PLATTFORMEN.find(p => p.value === t.plattform)?.label || t.plattform}</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => useTemplate(t)} style={btnSecondary}>Verwenden</button>
                      <button onClick={() => deleteTemplate(t.id)} style={{ ...btnSecondary, color: '#e53e3e' }}>
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                  <div style={{ fontSize: 13, color: '#666', whiteSpace: 'pre-wrap', maxHeight: 80, overflow: 'hidden', lineHeight: 1.5 }}>
                    {t.content}
                  </div>
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

const labelStyle = { display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 5, color: 'var(--text-muted, #666)' };
const inputStyle = {
  width: '100%', padding: '8px 12px', borderRadius: 7, fontSize: 14, boxSizing: 'border-box',
  border: '1px solid var(--border, #d1d5db)', background: 'var(--bg-input, #fff)', color: 'var(--text, #1a1a2e)',
  outline: 'none', fontFamily: 'inherit'
};
const pillStyle = {
  padding: '4px 10px', borderRadius: 16, fontSize: 12, border: '1px solid var(--border, #d1d5db)',
  background: 'transparent', cursor: 'pointer', color: 'var(--text-muted, #666)', transition: 'all 0.15s'
};
const pillActive = { background: '#d4a017', color: '#fff', borderColor: '#d4a017' };
const btnPrimary = {
  display: 'flex', alignItems: 'center', gap: 6, padding: '8px 18px', borderRadius: 8, border: 'none',
  background: '#d4a017', color: '#fff', fontWeight: 600, fontSize: 14, cursor: 'pointer'
};
const btnSecondary = {
  display: 'flex', alignItems: 'center', gap: 5, padding: '7px 14px', borderRadius: 8,
  border: '1px solid var(--border, #d1d5db)', background: 'transparent', fontSize: 13,
  color: 'var(--text, #1a1a2e)', cursor: 'pointer'
};
const errStyle = { marginTop: 10, padding: '8px 12px', borderRadius: 7, background: '#fff5f5', color: '#e53e3e', fontSize: 13 };
const tagStyle = { fontSize: 11, padding: '2px 7px', borderRadius: 10, background: 'var(--bg-secondary, #f0f4f8)', color: 'var(--text-muted, #666)' };
