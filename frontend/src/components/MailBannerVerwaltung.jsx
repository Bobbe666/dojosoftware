import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';

// Zentrale Verwaltung der Mail-Banner für alle Apps (HOF, Dojo, Events).
// Super-Admin lädt pro App + Anlass ein Banner (1200×400 / 3:1, PNG/JPG, <200KB).
// Backend: /api/mail-banners (siehe routes/mailBanners.js).

const APP_LABELS = { hof: 'Hall of Fame', dojo: 'Dojosoftware', events: 'TDA Events' };
const ANLASS_LABELS = { einladung: 'Einladung', begruessung: 'Begrüßung', rechnung: 'Rechnung', allgemein: 'Allgemein' };

export default function MailBannerVerwaltung() {
  const [data, setData] = useState(null);
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState('');         // `${app}-${anlass}` während Upload/Delete
  const fileInputs = useRef({});
  const token = localStorage.getItem('token');
  const authHeader = { Authorization: `Bearer ${token}` };

  const load = useCallback(async () => {
    try {
      const res = await axios.get('/mail-banners', { headers: authHeader });
      setData(res.data);
    } catch (e) {
      setMsg({ ok: false, text: 'Banner konnten nicht geladen werden: ' + (e.response?.data?.error || e.message) });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  const cell = (app, anlass) =>
    (data?.banners || []).find(b => b.app === app && b.anlass === anlass) || { app, anlass, vorhanden: false };

  const onPick = (app, anlass) => fileInputs.current[`${app}-${anlass}`]?.click();

  const onUpload = async (app, anlass, file) => {
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/jpg'].includes(file.type)) {
      setMsg({ ok: false, text: 'Nur PNG oder JPG (kein WebP — Outlook zeigt es nicht).' }); return;
    }
    if (file.size > 2 * 1024 * 1024) { setMsg({ ok: false, text: 'Datei zu groß (max. 2 MB).' }); return; }
    const key = `${app}-${anlass}`;
    setBusy(key); setMsg(null);
    try {
      const fd = new FormData();
      fd.append('banner', file);
      await axios.post(`/mail-banners/${app}/${anlass}`, fd, { headers: { ...authHeader, 'Content-Type': 'multipart/form-data' } });
      setMsg({ ok: true, text: `✅ Banner „${APP_LABELS[app]} – ${ANLASS_LABELS[anlass]}" gespeichert.` });
      await load();
    } catch (e) {
      setMsg({ ok: false, text: 'Upload fehlgeschlagen: ' + (e.response?.data?.error || e.message) });
    } finally { setBusy(''); }
  };

  const onDelete = async (app, anlass) => {
    if (!window.confirm(`Banner „${APP_LABELS[app]} – ${ANLASS_LABELS[anlass]}" wirklich löschen?`)) return;
    const key = `${app}-${anlass}`;
    setBusy(key); setMsg(null);
    try {
      await axios.delete(`/mail-banners/${app}/${anlass}`, { headers: authHeader });
      setMsg({ ok: true, text: 'Banner gelöscht.' });
      await load();
    } catch (e) {
      setMsg({ ok: false, text: 'Löschen fehlgeschlagen: ' + (e.response?.data?.error || e.message) });
    } finally { setBusy(''); }
  };

  const apps = data?.apps || ['hof', 'dojo', 'events'];
  const anlaesse = data?.anlaesse || ['einladung', 'begruessung', 'rechnung', 'allgemein'];

  return (
    <div className="section-card" style={{ marginTop: 20 }}>
      <h3 className="sad2-flex-align-05-mb">🖼️ Mail-Banner (alle Apps)</h3>
      <p className="sad2-text-secondary-mb">
        Banner-Kopf für die E-Mails — pro App und Anlass. Empfohlen: <strong>1200 × 400 px (3:1)</strong>, <strong>PNG oder JPG</strong> (kein WebP, Outlook!),
        unter ~200 KB. Ohne hochgeladenes Banner zeigt die Mail den schlichten Text-Header.
      </p>
      {msg && (
        <div className={`sad-feedback-box ${msg.ok ? 'sad-feedback-box--success' : 'sad-feedback-box--error'}`}>{msg.text}</div>
      )}
      {!data && <p>Lädt…</p>}

      {data && apps.map(app => (
        <div key={app} style={{ marginBottom: 22 }}>
          <h4 style={{ margin: '14px 0 10px', color: '#e2e8f0' }}>{APP_LABELS[app] || app}</h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 14 }}>
            {anlaesse.map(anlass => {
              const c = cell(app, anlass);
              const key = `${app}-${anlass}`;
              const isBusy = busy === key;
              return (
                <div key={anlass} style={{ border: '1px solid rgba(148,163,184,.25)', borderRadius: 10, overflow: 'hidden', background: 'rgba(15,23,42,.4)' }}>
                  <div style={{ aspectRatio: '3 / 1', background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {c.vorhanden
                      ? <img src={c.url} alt={anlass} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                      : <span style={{ color: '#64748b', fontSize: 13 }}>kein Banner</span>}
                  </div>
                  <div style={{ padding: '10px 12px' }}>
                    <div style={{ fontWeight: 600, marginBottom: 8 }}>{ANLASS_LABELS[anlass] || anlass}</div>
                    <input
                      type="file" accept="image/png,image/jpeg" style={{ display: 'none' }}
                      ref={el => { fileInputs.current[key] = el; }}
                      onChange={e => { onUpload(app, anlass, e.target.files?.[0]); e.target.value = ''; }}
                    />
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className="btn-secondary" style={{ flex: 1, fontSize: 13 }} disabled={isBusy} onClick={() => onPick(app, anlass)}>
                        {isBusy ? '…' : (c.vorhanden ? 'Ersetzen' : 'Hochladen')}
                      </button>
                      {c.vorhanden && (
                        <button className="btn-secondary" style={{ fontSize: 13 }} disabled={isBusy} onClick={() => onDelete(app, anlass)} title="Löschen">🗑️</button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
