/**
 * MarketingNewsletter.jsx
 * E-Mail Newsletter direkt an Mitglieder senden (mit KI-Unterstützung)
 */

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useDojoContext } from '../context/DojoContext';
import { Mail, Sparkles, Send, Users, Loader2, CheckCircle, AlertCircle, Eye } from 'lucide-react';

export default function MarketingNewsletter() {
  const { activeDojo } = useDojoContext();

  const [betreff, setBetreff]       = useState('');
  const [content, setContent]       = useState('');
  const [geschlecht, setGeschlecht] = useState('alle');
  const [empfaengerAnz, setEmpfAn]  = useState(null);
  const [loadingAnz, setLoadingAnz] = useState(false);
  const [kiThema, setKiThema]       = useState('');
  const [kiTon, setKiTon]           = useState('freundlich');
  const [generatingKi, setGenKi]    = useState(false);
  const [sending, setSending]       = useState(false);
  const [msg, setMsg]               = useState(null);
  const [history, setHistory]       = useState([]);
  const [loadingHistory, setLoadH]  = useState(false);
  const [showHistory, setShowHist]  = useState(false);
  const [showPreview, setShowPrev]  = useState(false);

  const dojoParam = activeDojo ? `?dojo_id=${activeDojo}` : '';

  useEffect(() => { loadEmpfaenger(); }, [geschlecht, activeDojo]);
  useEffect(() => { if (showHistory) loadHistory(); }, [showHistory, activeDojo]);

  const loadEmpfaenger = async () => {
    setLoadingAnz(true);
    try {
      const res = await axios.post(`/marketing-ki/newsletter/preview-empfaenger${dojoParam}`, { filter: { geschlecht } });
      setEmpfAn(res.data.anzahl);
    } catch { setEmpfAn(null); }
    finally { setLoadingAnz(false); }
  };

  const loadHistory = async () => {
    setLoadH(true);
    try {
      const res = await axios.get(`/marketing-ki/newsletter${dojoParam}`);
      setHistory(Array.isArray(res.data) ? res.data : []);
    } catch { setHistory([]); }
    finally { setLoadH(false); }
  };

  const generateKiText = async () => {
    if (!kiThema.trim()) { setMsg({ ok: false, text: 'Bitte ein Thema für den KI-Text eingeben.' }); return; }
    setGenKi(true); setMsg(null);
    try {
      const res = await axios.post(`/marketing-ki/newsletter/ki-text${dojoParam}`, { thema: kiThema, tonalitaet: kiTon });
      setContent(res.data.content || '');
    } catch { setMsg({ ok: false, text: 'KI-Generierung fehlgeschlagen.' }); }
    finally { setGenKi(false); }
  };

  const send = async () => {
    if (!betreff.trim() || !content.trim()) { setMsg({ ok: false, text: 'Betreff und Inhalt sind erforderlich.' }); return; }
    if (!window.confirm(`Newsletter an ${empfaengerAnz} Mitglieder senden?`)) return;
    setSending(true); setMsg(null);
    try {
      const res = await axios.post(`/marketing-ki/newsletter/send${dojoParam}`, {
        betreff, content, filter: { geschlecht }
      });
      setMsg({ ok: true, text: `✅ Newsletter erfolgreich an ${res.data.gesendet} von ${res.data.gesamt} Empfängern gesendet.` });
      setBetreff(''); setContent(''); setKiThema('');
      if (showHistory) loadHistory();
    } catch (e) {
      setMsg({ ok: false, text: e.response?.data?.error || 'Versand fehlgeschlagen.' });
    } finally { setSending(false); }
  };

  return (
    <div style={{ maxWidth: 780, margin: '0 auto', display: 'grid', gap: 20 }}>

      {/* ── Neuer Newsletter ── */}
      <div className="mz-card">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
          <Mail size={20} color="#d4a017" />
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Newsletter erstellen & senden</h3>
        </div>

        {/* Empfänger */}
        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>Empfänger</label>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            {['alle', 'männlich', 'weiblich'].map(g => (
              <button key={g} onClick={() => setGeschlecht(g)}
                style={{ ...pillStyle, ...(geschlecht === g ? pillActive : {}) }}>
                {g === 'alle' ? '👥 Alle Mitglieder' : g === 'männlich' ? '♂ Männlich' : '♀ Weiblich'}
              </button>
            ))}
            <span style={{ fontSize: 13, color: '#888', marginLeft: 4 }}>
              {loadingAnz ? '…' : empfaengerAnz !== null ? (
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Users size={13} /> <strong>{empfaengerAnz}</strong> Empfänger
                </span>
              ) : ''}
            </span>
          </div>
        </div>

        {/* Betreff */}
        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>Betreff *</label>
          <input style={inputStyle} placeholder="z.B. Neuigkeiten aus dem Dojo – September 2025" value={betreff} onChange={e => setBetreff(e.target.value)} />
        </div>

        {/* KI-Hilfe */}
        <div style={{ marginBottom: 14, padding: 14, background: 'var(--bg-secondary, #1a1a2e)', borderRadius: 10, border: '1px dashed var(--border, #3a3a4a)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, fontSize: 13, fontWeight: 600 }}>
            <Sparkles size={14} color="#d4a017" /> KI-Textgenerator
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <input
              style={{ ...inputStyle, flex: 1, minWidth: 180 }}
              placeholder="Thema für KI (z.B. Sommer-Probetraining)"
              value={kiThema}
              onChange={e => setKiThema(e.target.value)}
            />
            <select style={{ ...inputStyle, width: 'auto' }} value={kiTon} onChange={e => setKiTon(e.target.value)}>
              <option value="freundlich">😊 Freundlich</option>
              <option value="motivierend">💪 Motivierend</option>
              <option value="professionell">🎯 Professionell</option>
              <option value="humorvoll">😄 Locker</option>
            </select>
            <button onClick={generateKiText} disabled={generatingKi} style={btnKi}>
              {generatingKi ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Sparkles size={14} />}
              {generatingKi ? 'Generiere…' : 'Text erstellen'}
            </button>
          </div>
        </div>

        {/* Inhalt */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
            <label style={labelStyle}>Newsletter-Text *</label>
            {content && (
              <button onClick={() => setShowPrev(v => !v)} style={{ fontSize: 12, color: '#666', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                <Eye size={12} /> {showPreview ? 'Vorschau verbergen' : 'Vorschau'}
              </button>
            )}
          </div>
          <textarea
            style={{ ...inputStyle, minHeight: 200, resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.6 }}
            placeholder={'Liebe Mitglieder,\n\nhier könnt ihr euren Newsletter-Text eingeben oder von der KI erstellen lassen.\n\nMit sportlichem Gruß\nEuer Team'}
            value={content}
            onChange={e => setContent(e.target.value)}
          />
        </div>

        {/* E-Mail Vorschau */}
        {showPreview && content && (
          <div style={{ marginBottom: 14, border: '1px solid var(--border, #e2e8f0)', borderRadius: 10, overflow: 'hidden' }}>
            <div style={{ background: '#1a1a2e', padding: '12px 20px' }}>
              <div style={{ color: '#fff', fontWeight: 700, fontSize: 14 }}>Vorschau: {betreff || '(kein Betreff)'}</div>
            </div>
            <div style={{ padding: 20, fontSize: 14, lineHeight: 1.7, whiteSpace: 'pre-wrap', color: '#333' }}>
              {content}
            </div>
          </div>
        )}

        {msg && (
          <div style={{ marginBottom: 14, padding: '10px 14px', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 8, background: msg.ok ? '#f0fff4' : '#fff5f5', color: msg.ok ? '#276749' : '#9b2c2c', fontSize: 14 }}>
            {msg.ok ? <CheckCircle size={15} /> : <AlertCircle size={15} />}
            {msg.text}
          </div>
        )}

        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={send} disabled={sending || !betreff.trim() || !content.trim() || empfaengerAnz === 0} style={{ ...btnPrimary, opacity: (sending || !betreff.trim() || !content.trim() || empfaengerAnz === 0) ? 0.6 : 1 }}>
            {sending ? <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> : <Send size={15} />}
            {sending ? 'Wird gesendet…' : `Newsletter senden${empfaengerAnz ? ` (${empfaengerAnz})` : ''}`}
          </button>
        </div>
      </div>

      {/* ── Versand-Historie ── */}
      <div className="mz-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }} onClick={() => setShowHist(v => !v)}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Mail size={16} />
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Versand-Historie</h3>
          </div>
          <span style={{ fontSize: 12, color: '#888' }}>{showHistory ? '▲ ausblenden' : '▼ anzeigen'}</span>
        </div>

        {showHistory && (
          <div style={{ marginTop: 14 }}>
            {loadingHistory ? (
              <div style={{ textAlign: 'center', padding: 20, color: '#888' }}>Lädt…</div>
            ) : history.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 20, color: '#888', fontSize: 14 }}>Noch keine Newsletter versandt.</div>
            ) : (
              <div style={{ display: 'grid', gap: 8 }}>
                {history.map(h => (
                  <div key={h.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', border: '1px solid var(--border, #e2e8f0)', borderRadius: 8 }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{h.betreff}</div>
                      <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>
                        {h.gesendet_at ? new Date(h.gesendet_at).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '–'}
                        {' · '}{h.empfaenger_anzahl} Empfänger
                      </div>
                    </div>
                    <span style={{ fontSize: 12, padding: '3px 10px', borderRadius: 10, background: h.status === 'sent' ? '#f0fff4' : '#fff5f5', color: h.status === 'sent' ? '#276749' : '#9b2c2c', fontWeight: 600 }}>
                      {h.status === 'sent' ? '✓ Gesendet' : h.status === 'failed' ? '✗ Fehler' : 'Entwurf'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

const labelStyle = { display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 5, color: 'var(--text-muted, #aaa)' };
const inputStyle = {
  width: '100%', padding: '8px 12px', borderRadius: 7, fontSize: 14, boxSizing: 'border-box',
  border: '1px solid var(--border, #3a3a4a)', background: 'var(--bg-input, #1e1e2e)', color: 'var(--text-primary, #eee)',
  outline: 'none', fontFamily: 'inherit'
};
const pillStyle = { padding: '5px 12px', borderRadius: 16, fontSize: 13, border: '1px solid var(--border, #3a3a4a)', background: 'transparent', cursor: 'pointer', color: 'var(--text-muted, #aaa)', transition: 'all 0.15s' };
const pillActive = { background: '#d4a017', color: '#fff', borderColor: '#d4a017' };
const btnPrimary = { display: 'flex', alignItems: 'center', gap: 6, padding: '9px 20px', borderRadius: 8, border: 'none', background: '#d4a017', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer' };
const btnKi = { display: 'flex', alignItems: 'center', gap: 5, padding: '8px 14px', borderRadius: 7, border: 'none', background: '#553c9a', color: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap' };
