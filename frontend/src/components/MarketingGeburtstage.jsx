/**
 * MarketingGeburtstage.jsx
 * Geburtstage der nächsten 30 Tage mit KI-Post-Generator
 */

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useDojoContext } from '../context/DojoContext';
import { Gift, Sparkles, Copy, Check, Loader2, RefreshCw } from 'lucide-react';

const PLATTFORMEN = [
  { value: 'beide',     label: '📱 Facebook + Instagram' },
  { value: 'instagram', label: '📷 Instagram' },
  { value: 'facebook',  label: '📘 Facebook' },
  { value: 'story',     label: '⚡ Story' },
];

function TageBadge({ tage }) {
  if (tage === 0) return <span style={{ background: '#38a169', color: '#fff', borderRadius: 12, padding: '2px 9px', fontSize: 11, fontWeight: 700 }}>🎂 Heute!</span>;
  if (tage <= 3)  return <span style={{ background: '#d69e2e', color: '#fff', borderRadius: 12, padding: '2px 9px', fontSize: 11, fontWeight: 700 }}>in {tage} Tag{tage > 1 ? 'en' : ''}</span>;
  return <span style={{ background: 'var(--bg-secondary, #1e1e2e)', color: 'var(--text-muted, #aaa)', borderRadius: 12, padding: '2px 9px', fontSize: 11 }}>in {tage} Tagen</span>;
}

export default function MarketingGeburtstage() {
  const { activeDojo } = useDojoContext();
  const [geburtstage, setGeburtstage] = useState([]);
  const [loading, setLoading]         = useState(true);
  const [activeId, setActiveId]       = useState(null);
  const [plattform, setPlattform]     = useState('beide');
  const [generating, setGenerating]   = useState(false);
  const [results, setResults]         = useState({}); // id -> generated text
  const [copied, setCopied]           = useState(null);

  const dojoParam = activeDojo ? `?dojo_id=${activeDojo}` : '';

  useEffect(() => { load(); }, [activeDojo]);

  const load = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`/marketing-ki/geburtstage${dojoParam}`);
      setGeburtstage(Array.isArray(res.data) ? res.data : []);
    } catch { setGeburtstage([]); }
    finally { setLoading(false); }
  };

  const generatePost = async (m) => {
    setGenerating(true); setActiveId(m.mitglied_id);
    try {
      const res = await axios.post(`/marketing-ki/geburtstage/generate${dojoParam}`, {
        vorname: m.vorname, alter: m.alter_jahre + 1, plattform
      });
      setResults(prev => ({ ...prev, [m.mitglied_id]: res.data.content || '' }));
    } catch { setResults(prev => ({ ...prev, [m.mitglied_id]: '❌ Fehler bei der Generierung' })); }
    finally { setGenerating(false); setActiveId(null); }
  };

  const copy = (id, text) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  if (loading) return <div style={{ textAlign: 'center', padding: 40, color: '#888' }}><Loader2 size={20} /> Lädt Geburtstage…</div>;

  return (
    <div style={{ maxWidth: 780, margin: '0 auto' }}>
      <div className="mz-card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Gift size={20} color="#d4a017" />
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Geburtstage – nächste 30 Tage</h3>
            <span style={{ background: 'var(--bg-secondary, #1e1e2e)', borderRadius: 12, padding: '2px 9px', fontSize: 12 }}>
              {geburtstage.length} Mitglieder
            </span>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <select
              style={{ padding: '6px 10px', borderRadius: 7, border: '1px solid var(--border, #3a3a4a)', fontSize: 13, background: 'var(--bg-input, #1e1e2e)', color: 'var(--text-primary, #eee)' }}
              value={plattform} onChange={e => setPlattform(e.target.value)}
            >
              {PLATTFORMEN.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
            <button onClick={load} style={{ padding: '6px 10px', borderRadius: 7, border: '1px solid var(--border, #3a3a4a)', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 13 }}>
              <RefreshCw size={13} /> Aktualisieren
            </button>
          </div>
        </div>

        {geburtstage.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 30, color: '#888', fontSize: 14 }}>
            🎉 Keine Geburtstage in den nächsten 30 Tagen.
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 12 }}>
            {geburtstage.map(m => (
              <div key={m.mitglied_id} style={{ border: '1px solid var(--border, #e2e8f0)', borderRadius: 10, overflow: 'hidden' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{
                      width: 38, height: 38, borderRadius: '50%', background: '#d4a01722',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18
                    }}>🎂</div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 15 }}>{m.vorname} {m.nachname}</div>
                      <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>
                        wird {m.alter_jahre + 1} Jahre · {new Date(m.geburtsdatum).toLocaleDateString('de-DE', { day: '2-digit', month: 'long' })}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <TageBadge tage={m.tage_bis} />
                    <button
                      onClick={() => generatePost(m)}
                      disabled={generating && activeId === m.mitglied_id}
                      style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 8, border: 'none', background: '#d4a017', color: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}
                    >
                      {generating && activeId === m.mitglied_id
                        ? <><Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> Generiere…</>
                        : <><Sparkles size={13} /> Post erstellen</>}
                    </button>
                  </div>
                </div>

                {results[m.mitglied_id] && (
                  <div style={{ borderTop: '1px solid var(--border, #e2e8f0)', padding: '12px 16px', background: 'var(--bg-secondary, #1a1a2e)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: '#888' }}>Generierter Post</span>
                      <button
                        onClick={() => copy(m.mitglied_id, results[m.mitglied_id])}
                        style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border, #3a3a4a)', background: 'transparent', fontSize: 12, cursor: 'pointer' }}
                      >
                        {copied === m.mitglied_id ? <><Check size={12} /> Kopiert!</> : <><Copy size={12} /> Kopieren</>}
                      </button>
                    </div>
                    <textarea
                      style={{ width: '100%', minHeight: 100, padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border, #3a3a4a)', fontSize: 13, fontFamily: 'inherit', lineHeight: 1.6, resize: 'vertical', boxSizing: 'border-box', background: 'var(--bg-input, #1e1e2e)', color: 'var(--text-primary, #eee)' }}
                      value={results[m.mitglied_id]}
                      onChange={e => setResults(prev => ({ ...prev, [m.mitglied_id]: e.target.value }))}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
