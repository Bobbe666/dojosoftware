import React, { useState, useEffect, useCallback } from 'react';
import { fetchWithAuth } from '../utils/fetchWithAuth';
import config from '../config/config.js';
import { useDojoContext } from '../context/DojoContext';

const WIDGET_URL = 'https://dojo.tda-intl.org/api/visitor-chat/widget.js';

export default function KiChatEinstellungen() {
  const { activeDojo } = useDojoContext();
  const [featureAktiv, setFeatureAktiv] = useState(false);
  const [planType, setPlanType] = useState('trial');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState({ type: '', text: '' });
  const [copied, setCopied] = useState(false);

  const [form, setForm] = useState({
    assistent_name: 'Assistent',
    begruessung: 'Hallo! Wie kann ich dir helfen?',
    akzentfarbe: '#ef4444',
    ki_aktiv: true,
    zusatz_kontext: '',
  });

  const dojoId = activeDojo?.id;

  const load = useCallback(async () => {
    if (!dojoId) return;
    setLoading(true);
    try {
      const dojoParam = `?dojo_id=${dojoId}`;
      const res = await fetchWithAuth(`${config.apiBaseUrl}/visitor-chat/config${dojoParam}`);
      const data = await res.json();
      if (data.success) {
        setFeatureAktiv(data.feature_aktiv);
        setPlanType(data.plan_type);
        if (data.config) {
          setForm({
            assistent_name: data.config.assistent_name || 'Assistent',
            begruessung: data.config.begruessung || 'Hallo! Wie kann ich dir helfen?',
            akzentfarbe: data.config.akzentfarbe || '#ef4444',
            ki_aktiv: !!data.config.ki_aktiv,
            zusatz_kontext: data.config.zusatz_kontext || '',
          });
        }
      }
    } catch {}
    finally { setLoading(false); }
  }, [dojoId]);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    setSaving(true);
    setMsg({ type: '', text: '' });
    try {
      const dojoParam = `?dojo_id=${dojoId}`;
      const res = await fetchWithAuth(`${config.apiBaseUrl}/visitor-chat/config${dojoParam}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Fehler');
      setMsg({ type: 'success', text: 'Einstellungen gespeichert.' });
    } catch (e) {
      setMsg({ type: 'error', text: e.message });
    } finally { setSaving(false); }
  };

  const embedCode = `<script src="${WIDGET_URL}" data-dojo-id="${dojoId}" async></script>`;

  const copyEmbed = () => {
    navigator.clipboard.writeText(embedCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };

  const s = {
    container: { maxWidth: 760, margin: '0 auto', padding: '1.5rem 1rem' },
    card: { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 14, padding: '1.5rem', marginBottom: '1.25rem' },
    title: { fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' },
    label: { display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 4, marginTop: 12 },
    input: { width: '100%', borderRadius: 8, border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.05)', color: 'var(--text-primary)', padding: '0.5rem 0.75rem', fontSize: '0.9rem', boxSizing: 'border-box' },
    btn: { background: 'var(--primary, #ef4444)', color: 'var(--ds-text)', border: 'none', borderRadius: 8, padding: '0.55rem 1.5rem', fontWeight: 600, cursor: 'pointer', fontSize: '0.9rem' },
    codeBlock: { background: 'rgba(0,0,0,0.4)', borderRadius: 8, padding: '0.75rem 1rem', fontFamily: 'monospace', fontSize: '0.78rem', color: '#86efac', wordBreak: 'break-all', lineHeight: 1.6, border: '1px solid rgba(255,255,255,0.08)', marginTop: 8 },
    badge: (color) => ({ display: 'inline-block', padding: '2px 10px', borderRadius: 999, fontSize: '0.75rem', fontWeight: 700, background: color === 'green' ? 'rgba(74,222,128,0.15)' : 'rgba(239,68,68,0.15)', color: color === 'green' ? '#4ade80' : '#f87171', border: `1px solid ${color === 'green' ? 'rgba(74,222,128,0.3)' : 'rgba(239,68,68,0.3)'}` }),
  };

  if (loading) return <div style={{ padding: '2rem', color: 'var(--text-secondary)', textAlign: 'center' }}>Lade…</div>;

  const isEnterprise = ['enterprise', 'premium'].includes(planType);

  return (
    <div style={s.container}>
      <h2 style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>🤖 KI-Chat Widget</h2>
      <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
        Binde einen intelligenten KI-Assistenten auf deiner Homepage ein — er kennt eure Tarife, Trainingszeiten und Kampfkünste.
      </p>

      {/* Status */}
      <div style={s.card}>
        <div style={s.title}>Status</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <span style={s.badge(featureAktiv ? 'green' : 'red')}>
            {featureAktiv ? '✓ Freigeschaltet' : '✗ Nicht freigeschaltet'}
          </span>
          <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
            Lizenz: <strong style={{ color: 'var(--text-primary)' }}>{planType}</strong>
          </span>
        </div>
        {!featureAktiv && (
          <div style={{ marginTop: '0.75rem', padding: '0.65rem 1rem', background: 'rgba(239,68,68,0.08)', borderRadius: 8, border: '1px solid rgba(239,68,68,0.2)', fontSize: '0.85rem', color: '#f87171' }}>
            Das KI-Chat Widget ist ein Enterprise-Feature. Bitte kontaktiere uns zur Freischaltung.
          </div>
        )}
      </div>

      {featureAktiv && (
        <>
          {/* Einstellungen */}
          <div style={s.card}>
            <div style={s.title}>⚙️ Einstellungen</div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 1rem' }}>
              <div>
                <label style={s.label}>Name des Assistenten</label>
                <input style={s.input} value={form.assistent_name} onChange={e => setForm(f => ({ ...f, assistent_name: e.target.value }))} placeholder="z.B. Max, Lisa, KI-Assistent…" />
              </div>
              <div>
                <label style={s.label}>Akzentfarbe (Hex)</label>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input type="color" value={form.akzentfarbe} onChange={e => setForm(f => ({ ...f, akzentfarbe: e.target.value }))} style={{ width: 44, height: 36, borderRadius: 6, border: '1px solid rgba(255,255,255,0.15)', background: 'transparent', cursor: 'pointer', padding: 2 }} />
                  <input style={{ ...s.input, flex: 1 }} value={form.akzentfarbe} onChange={e => setForm(f => ({ ...f, akzentfarbe: e.target.value }))} placeholder="#ef4444" />
                </div>
              </div>
            </div>

            <label style={s.label}>Begrüßungstext</label>
            <input style={s.input} value={form.begruessung} onChange={e => setForm(f => ({ ...f, begruessung: e.target.value }))} placeholder="Hallo! Wie kann ich dir helfen?" />

            <label style={s.label}>Zusätzlicher Kontext für den KI-Assistenten (optional)</label>
            <textarea
              style={{ ...s.input, resize: 'vertical', lineHeight: 1.5 }}
              rows={4}
              value={form.zusatz_kontext}
              onChange={e => setForm(f => ({ ...f, zusatz_kontext: e.target.value }))}
              placeholder="z.B. Parkmöglichkeiten, Adresse, Ansprechpartner, besondere Angebote…"
            />

            <label style={{ ...s.label, marginTop: 14, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <input type="checkbox" checked={form.ki_aktiv} onChange={e => setForm(f => ({ ...f, ki_aktiv: e.target.checked }))} />
              KI-Antworten aktiv (deaktiviert = nur Staff-Modus)
            </label>

            {msg.text && (
              <div style={{ marginTop: '0.75rem', fontSize: '0.85rem', color: msg.type === 'success' ? '#4ade80' : '#f87171' }}>{msg.text}</div>
            )}

            <div style={{ marginTop: '1rem' }}>
              <button style={s.btn} onClick={save} disabled={saving}>
                {saving ? 'Speichert…' : '💾 Speichern'}
              </button>
            </div>
          </div>

          {/* Einbettungs-Snippet */}
          <div style={s.card}>
            <div style={s.title}>📋 Einbetten auf deiner Website</div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 4 }}>
              Füge diesen Code kurz vor <code style={{ color: '#86efac' }}>&lt;/body&gt;</code> auf deiner Website ein:
            </p>
            <div style={s.codeBlock}>{embedCode}</div>
            <button
              onClick={copyEmbed}
              style={{ marginTop: '0.75rem', background: copied ? 'rgba(74,222,128,0.15)' : 'rgba(255,255,255,0.08)', border: `1px solid ${copied ? 'rgba(74,222,128,0.3)' : 'rgba(255,255,255,0.15)'}`, color: copied ? '#4ade80' : 'var(--text-secondary)', borderRadius: 8, padding: '0.4rem 1rem', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}
            >
              {copied ? '✓ Kopiert!' : '📋 Code kopieren'}
            </button>
            <p style={{ fontSize: '0.78rem', color: 'var(--ds-text-faint)', marginTop: '0.75rem' }}>
              Das Widget lädt automatisch — kein weiteres Setup nötig. Es liest eure Daten (Tarife, Stundenplan) direkt aus der Dojosoftware.
            </p>
          </div>

          {/* Vorschau-Hinweis */}
          <div style={{ ...s.card, background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.2)' }}>
            <div style={{ fontSize: '0.9rem', color: '#60a5fa' }}>
              💡 <strong>Live-Test:</strong> Öffne deine Website — das Widget erscheint als Chat-Button unten rechts. Eingehende Gespräche siehst du im Dashboard unter <strong>Kommunikation → Besucher-Chat</strong>.
            </div>
          </div>
        </>
      )}
    </div>
  );
}
