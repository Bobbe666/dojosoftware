import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';

// Zentrale Verwaltung der Mail-Banner für alle Apps (HOF, Dojo, Events).
// Banner: 1200×400 / 3:1, PNG/JPG, <200KB. Backend: /api/mail-banners.
// Dojo: app-weites Standard-Banner (dojo_id 0) + pro Dojo eigene (Enterprise-Feature).

const APP_LABELS = { hof: 'Hall of Fame', dojo: 'Dojosoftware', events: 'TDA Events' };
const ANLASS_LABELS = { einladung: 'Einladung', begruessung: 'Begrüßung', rechnung: 'Rechnung', allgemein: 'Allgemein' };

export default function MailBannerVerwaltung() {
  const [data, setData] = useState(null);
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState('');
  const [dojoSel, setDojoSel] = useState(0); // 0 = Standard (alle Dojos)
  const fileInputs = useRef({});
  const defaultedRef = useRef(false);
  const token = localStorage.getItem('token');
  const authHeader = { Authorization: `Bearer ${token}` };

  const load = useCallback(async () => {
    try {
      const res = await axios.get('/mail-banners', { headers: authHeader });
      setData(res.data);
      // Standard-Auswahl beim ersten Laden: Kampfkunstschule Schreiner (falls vorhanden)
      if (!defaultedRef.current) {
        defaultedRef.current = true;
        const schreiner = (res.data?.dojos || []).find(d => /schreiner/i.test(d.dojoname || ''));
        if (schreiner) setDojoSel(schreiner.id);
      }
    } catch (e) {
      setMsg({ ok: false, text: 'Banner konnten nicht geladen werden: ' + (e.response?.data?.error || e.message) });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  const find = (app, anlass, dojoId) =>
    (data?.banners || []).find(b => b.app === app && b.anlass === anlass && b.dojo_id === dojoId) || null;

  const onUpload = async (app, anlass, dojoId, file) => {
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/jpg'].includes(file.type)) {
      setMsg({ ok: false, text: 'Nur PNG oder JPG (kein WebP — Outlook zeigt es nicht).' }); return;
    }
    if (file.size > 2 * 1024 * 1024) { setMsg({ ok: false, text: 'Datei zu groß (max. 2 MB).' }); return; }
    const key = `${app}-${anlass}-${dojoId}`;
    setBusy(key); setMsg(null);
    try {
      const fd = new FormData();
      fd.append('banner', file);
      await axios.post(`/mail-banners/${app}/${anlass}?dojo_id=${dojoId}`, fd, { headers: { ...authHeader, 'Content-Type': 'multipart/form-data' } });
      setMsg({ ok: true, text: `✅ Banner gespeichert.` });
      await load();
    } catch (e) {
      setMsg({ ok: false, text: 'Upload fehlgeschlagen: ' + (e.response?.data?.error || e.message) });
    } finally { setBusy(''); }
  };

  const onDelete = async (app, anlass, dojoId) => {
    if (!window.confirm('Banner wirklich löschen?')) return;
    const key = `${app}-${anlass}-${dojoId}`;
    setBusy(key); setMsg(null);
    try {
      await axios.delete(`/mail-banners/${app}/${anlass}?dojo_id=${dojoId}`, { headers: authHeader });
      setMsg({ ok: true, text: 'Banner gelöscht.' });
      await load();
    } catch (e) {
      setMsg({ ok: false, text: 'Löschen fehlgeschlagen: ' + (e.response?.data?.error || e.message) });
    } finally { setBusy(''); }
  };

  const anlaesse = data?.anlaesse || ['einladung', 'begruessung', 'rechnung', 'allgemein'];

  // Ein Banner-Kärtchen. fallbackUrl = Standard-Banner (wird genutzt wenn kein eigenes), locked = Enterprise gesperrt
  const card = (app, anlass, dojoId, { fallbackUrl = null, locked = false } = {}) => {
    const c = find(app, anlass, dojoId);
    const key = `${app}-${anlass}-${dojoId}`;
    const isBusy = busy === key;
    const shownUrl = c?.url || fallbackUrl;
    return (
      <div key={anlass} style={{ border: '1px solid rgba(148,163,184,.25)', borderRadius: 10, overflow: 'hidden', background: 'rgba(15,23,42,.4)', opacity: locked ? 0.55 : 1 }}>
        <div style={{ aspectRatio: '3 / 1', background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {shownUrl
            ? <img src={shownUrl} alt={anlass} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            : <span style={{ color: '#64748b', fontSize: 13 }}>kein Banner</span>}
        </div>
        <div style={{ padding: '10px 12px' }}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>{ANLASS_LABELS[anlass] || anlass}</div>
          {!c && fallbackUrl && <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 6 }}>nutzt Standard-Banner</div>}
          <input type="file" accept="image/png,image/jpeg" style={{ display: 'none' }}
            ref={el => { fileInputs.current[key] = el; }}
            onChange={e => { onUpload(app, anlass, dojoId, e.target.files?.[0]); e.target.value = ''; }} />
          {locked ? (
            <div style={{ fontSize: 12, color: '#f59e0b' }}>🔒 Enterprise-Feature</div>
          ) : (
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn-secondary" style={{ flex: 1, fontSize: 13 }} disabled={isBusy} onClick={() => fileInputs.current[key]?.click()}>
                {isBusy ? '…' : (c ? 'Ersetzen' : 'Hochladen')}
              </button>
              {c && <button className="btn-secondary" style={{ fontSize: 13 }} disabled={isBusy} onClick={() => onDelete(app, anlass, dojoId)} title="Löschen">🗑️</button>}
            </div>
          )}
        </div>
      </div>
    );
  };

  const grid = (children) => (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 14 }}>{children}</div>
  );

  const selectedDojo = (data?.dojos || []).find(d => d.id === dojoSel);
  const dojoLocked = dojoSel > 0 && !(selectedDojo?.darf_branden);

  return (
    <div className="section-card" style={{ marginTop: 20 }}>
      <h3 className="sad2-flex-align-05-mb">🖼️ Mail-Banner (alle Apps)</h3>
      <p className="sad2-text-secondary-mb">
        Banner-Kopf für die E-Mails — pro App und Anlass. Empfohlen: <strong>1200 × 400 px (3:1)</strong>, <strong>PNG/JPG</strong> (kein WebP, Outlook!),
        unter ~200 KB. Ohne Banner zeigt die Mail den schlichten Text-Header.
      </p>
      {msg && <div className={`sad-feedback-box ${msg.ok ? 'sad-feedback-box--success' : 'sad-feedback-box--error'}`}>{msg.text}</div>}
      {!data && <p>Lädt…</p>}

      {data && (
        <>
          {/* HOF */}
          <h4 style={{ margin: '14px 0 10px', color: '#e2e8f0' }}>{APP_LABELS.hof}</h4>
          {grid(anlaesse.map(a => card('hof', a, 0)))}

          {/* Events */}
          <h4 style={{ margin: '22px 0 10px', color: '#e2e8f0' }}>{APP_LABELS.events}</h4>
          {grid(anlaesse.map(a => card('events', a, 0)))}

          {/* Dojo — mit Dojo-Wähler */}
          <h4 style={{ margin: '22px 0 8px', color: '#e2e8f0' }}>{APP_LABELS.dojo}</h4>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
            <label style={{ fontSize: 13, color: '#94a3b8' }}>Banner für:</label>
            <select value={dojoSel} onChange={e => setDojoSel(parseInt(e.target.value, 10))}
              style={{ padding: '6px 10px', borderRadius: 6, background: '#0f172a', color: '#e2e8f0', border: '1px solid rgba(148,163,184,.3)' }}>
              <option value={0}>★ Standard (alle Dojos)</option>
              {(data.dojos || []).map(d => (
                <option key={d.id} value={d.id}>{d.dojoname}{d.darf_branden ? '' : ' (kein Enterprise)'}</option>
              ))}
            </select>
            {dojoSel === 0
              ? <span style={{ fontSize: 12, color: '#94a3b8' }}>Gilt für alle Dojos, die kein eigenes Banner haben.</span>
              : dojoLocked
                ? <span style={{ fontSize: 12, color: '#f59e0b' }}>🔒 Eigene Banner sind ein Enterprise-Feature — dieses Dojo hat keinen Enterprise-Plan.</span>
                : <span style={{ fontSize: 12, color: '#94a3b8' }}>Überschreibt das Standard-Banner nur für dieses Dojo.</span>}
          </div>
          {grid(anlaesse.map(a => card('dojo', a, dojoSel, {
            fallbackUrl: dojoSel > 0 ? (find('dojo', a, 0)?.url || null) : null,
            locked: dojoLocked,
          })))}
        </>
      )}
    </div>
  );
}
