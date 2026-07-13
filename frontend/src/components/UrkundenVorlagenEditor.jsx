// ============================================================================
// URKUNDEN-VORLAGEN-EDITOR (Enterprise)
// Eigene Urkunden pro Dojo: Design hochladen → Felder per Drag & Drop platzieren
// → Live-Vorschau → speichern. Backend: /api/urkunden-vorlagen
// ============================================================================
import React, { useEffect, useRef, useState, useCallback } from 'react';
import axios from 'axios';
import { useDojoContext } from '../context/DojoContext';

const FELD_TYPEN = [
  { key: 'name',     label: 'Name',         sample: 'Max Mustermann' },
  { key: 'grad',     label: 'Grad',         sample: '8. Kyu (Gelbgurt)' },
  { key: 'datum',    label: 'Datum',        sample: '28. Juni 2026' },
  { key: 'ort',      label: 'Ort',          sample: 'Musterstadt' },
  { key: 'nummer',   label: 'Urkunden-Nr.', sample: '20260628-00001' },
  { key: 'pruefer1', label: 'Prüfer 1',     sample: 'Max Mustermann' },
  { key: 'pruefer2', label: 'Prüfer 2',     sample: 'Erika Musterfrau' },
  { key: 'freitext', label: 'Freitext',     sample: 'Freitext' },
];
const feldLabel = (k) => (FELD_TYPEN.find(f => f.key === k) || {}).label || k;
const MM = { a4_hoch: { w: 210, h: 297 }, a4_quer: { w: 297, h: 210 } };
const PT2MM = 0.352778;

const authHeader = () => ({ Authorization: `Bearer ${localStorage.getItem('dojo_auth_token') || localStorage.getItem('authToken')}` });

const leerVorlage = () => ({
  id: null, name: '', seitenformat: 'a4_quer', bg_image_path: null,
  schriftart: 'Georgia, serif', extra_font_url: '',
  felder: [], optionen: { gradKyuOnly: false, datumLang: true, nummerPrefix: '' },
});

export default function UrkundenVorlagenEditor() {
  const { activeDojo } = useDojoContext();
  const dojoParam = activeDojo?.id ? `?dojo_id=${activeDojo.id}` : '';

  const [liste, setListe] = useState([]);
  const [loading, setLoading] = useState(true);
  const [edit, setEdit] = useState(null);        // null = Listenansicht, sonst Vorlage
  const [selIdx, setSelIdx] = useState(-1);       // ausgewähltes Feld
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const canvasRef = useRef(null);
  const dragRef = useRef(null);

  const flash = (t) => { setMsg(t); setTimeout(() => setMsg(''), 3000); };

  const load = useCallback(() => {
    setLoading(true);
    axios.get(`/urkunden-vorlagen${dojoParam}`, { headers: authHeader() })
      .then(r => setListe(r.data?.vorlagen || []))
      .catch(() => setListe([]))
      .finally(() => setLoading(false));
  }, [dojoParam]);

  useEffect(() => { load(); }, [load]);

  const seite = edit ? MM[edit.seitenformat] : MM.a4_quer;

  // --- Drag & Drop ---
  const onPointerDownFeld = (e, idx) => {
    e.preventDefault();
    setSelIdx(idx);
    const rect = canvasRef.current.getBoundingClientRect();
    const scale = rect.width / seite.w; // px pro mm
    dragRef.current = { idx, startX: e.clientX, startY: e.clientY, origTop: edit.felder[idx].top, origLeft: edit.felder[idx].left, scale };
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  };
  const onPointerMove = (e) => {
    const d = dragRef.current; if (!d) return;
    const dxMm = (e.clientX - d.startX) / d.scale;
    const dyMm = (e.clientY - d.startY) / d.scale;
    setEdit(prev => {
      const felder = prev.felder.slice();
      const f = { ...felder[d.idx] };
      f.left = Math.max(0, Math.min(seite.w - 5, Math.round((d.origLeft + dxMm) * 10) / 10));
      f.top = Math.max(0, Math.min(seite.h - 3, Math.round((d.origTop + dyMm) * 10) / 10));
      felder[d.idx] = f;
      return { ...prev, felder };
    });
  };
  const onPointerUp = () => {
    dragRef.current = null;
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);
  };

  const addFeld = (key) => {
    setEdit(prev => {
      const f = { key, top: prev.seitenformat === 'a4_hoch' ? 100 : 80, left: 60, width: 90, align: 'center', size: 16, bold: false };
      if (key === 'freitext') f.text = 'Freitext';
      return { ...prev, felder: [...prev.felder, f] };
    });
    setSelIdx((edit?.felder?.length) || 0);
  };
  const updFeld = (idx, patch) => setEdit(prev => {
    const felder = prev.felder.slice(); felder[idx] = { ...felder[idx], ...patch }; return { ...prev, felder };
  });
  const delFeld = (idx) => { setEdit(prev => ({ ...prev, felder: prev.felder.filter((_, i) => i !== idx) })); setSelIdx(-1); };

  const uploadBg = async (file) => {
    const fd = new FormData(); fd.append('bild', file);
    setBusy(true);
    try {
      const r = await axios.post(`/urkunden-vorlagen/bild${dojoParam}`, fd, { headers: { ...authHeader(), 'Content-Type': 'multipart/form-data' } });
      setEdit(prev => ({ ...prev, bg_image_path: r.data.path }));
      flash('Hintergrund hochgeladen.');
    } catch (e) { flash('Upload fehlgeschlagen.'); } finally { setBusy(false); }
  };

  const speichern = async () => {
    if (!edit.name.trim()) { flash('Bitte einen Namen vergeben.'); return; }
    setBusy(true);
    const body = { name: edit.name, seitenformat: edit.seitenformat, bg_image_path: edit.bg_image_path,
      felder: edit.felder, schriftart: edit.schriftart, extra_font_url: edit.extra_font_url || null, optionen: edit.optionen };
    try {
      if (edit.id) await axios.put(`/urkunden-vorlagen/${edit.id}${dojoParam}`, body, { headers: authHeader() });
      else await axios.post(`/urkunden-vorlagen${dojoParam}`, body, { headers: authHeader() });
      flash('Gespeichert ✅'); setEdit(null); load();
    } catch (e) { flash(e.response?.data?.error || 'Speichern fehlgeschlagen.'); } finally { setBusy(false); }
  };

  const loeschen = async (v) => {
    if (!window.confirm(`Vorlage „${v.name}" wirklich löschen?`)) return;
    try { await axios.delete(`/urkunden-vorlagen/${v.id}${dojoParam}`, { headers: authHeader() }); load(); }
    catch { flash('Löschen fehlgeschlagen.'); }
  };

  const sampleWert = (f) => {
    if (f.key === 'freitext') return f.text || 'Freitext';
    if (f.key === 'nummer') return (edit.optionen?.nummerPrefix || '') + '20260628-00001';
    if (f.key === 'grad') return edit.optionen?.gradKyuOnly ? '8.' : '8. Kyu (Gelbgurt)';
    return (FELD_TYPEN.find(t => t.key === f.key) || {}).sample || '';
  };

  // ---------- LISTENANSICHT ----------
  if (!edit) {
    return (
      <div style={{ padding: '24px', color: 'var(--ds-text, #e2e8f0)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <h1 style={{ margin: 0, fontSize: 22 }}>📜 Urkunden-Vorlagen</h1>
          <button onClick={() => { setEdit(leerVorlage()); setSelIdx(-1); }}
            style={btn('#6366f1')}>+ Neue Vorlage</button>
        </div>
        {msg && <div style={{ marginBottom: 12, padding: '10px 14px', background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.4)', borderRadius: 8 }}>{msg}</div>}
        {loading ? <p style={{ opacity: 0.6 }}>Lädt…</p>
          : liste.length === 0 ? <p style={{ opacity: 0.6 }}>Noch keine eigenen Urkunden-Vorlagen. Lege deine erste an — lade dein Urkunden-Design hoch und platziere die Felder.</p>
          : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: 14 }}>
              {liste.map(v => (
                <div key={v.id} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, overflow: 'hidden' }}>
                  <div style={{ aspectRatio: v.seitenformat === 'a4_hoch' ? '210/297' : '297/210', background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {v.bg_image_path ? <img src={v.bg_image_path} alt={v.name} style={{ width: '100%', height: '100%', objectFit: 'contain' }} /> : <span style={{ opacity: 0.4 }}>kein Design</span>}
                  </div>
                  <div style={{ padding: 12 }}>
                    <div style={{ fontWeight: 700, marginBottom: 2 }}>{v.name}</div>
                    <div style={{ fontSize: 12, opacity: 0.6, marginBottom: 10 }}>{v.seitenformat === 'a4_hoch' ? 'A4 hoch' : 'A4 quer'} · {(v.felder || []).length} Felder</div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => { setEdit({ ...leerVorlage(), ...v, optionen: v.optionen || {} }); setSelIdx(-1); }} style={btn('#6366f1', true)}>Bearbeiten</button>
                      <button onClick={() => loeschen(v)} style={btn('#ef4444', true)}>Löschen</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
      </div>
    );
  }

  // ---------- EDITOR ----------
  const sel = selIdx >= 0 ? edit.felder[selIdx] : null;
  return (
    <div style={{ padding: '20px', color: 'var(--ds-text, #e2e8f0)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <button onClick={() => setEdit(null)} style={btn('rgba(255,255,255,0.1)', true)}>‹ Zurück</button>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={speichern} disabled={busy} style={btn('#22c55e')}>{busy ? 'Speichert…' : 'Speichern'}</button>
        </div>
      </div>
      {msg && <div style={{ marginBottom: 12, padding: '10px 14px', background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.4)', borderRadius: 8 }}>{msg}</div>}

      <div style={{ display: 'flex', gap: 18, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        {/* Linke Spalte: Einstellungen */}
        <div style={{ width: 280, flex: '0 0 280px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Feldgruppe titel="Vorlage">
            <input placeholder="Name (z.B. Enso Karate)" value={edit.name} onChange={e => setEdit({ ...edit, name: e.target.value })} style={inp} />
            <select value={edit.seitenformat} onChange={e => setEdit({ ...edit, seitenformat: e.target.value })} style={inp}>
              <option value="a4_quer">A4 quer</option>
              <option value="a4_hoch">A4 hoch</option>
            </select>
            <input placeholder="Schriftart (CSS, z.B. Georgia, serif)" value={edit.schriftart} onChange={e => setEdit({ ...edit, schriftart: e.target.value })} style={inp} />
            <input placeholder="Web-Schrift-URL (optional, Google Fonts <link href>)" value={edit.extra_font_url || ''} onChange={e => setEdit({ ...edit, extra_font_url: e.target.value })} style={inp} />
          </Feldgruppe>

          <Feldgruppe titel="Hintergrund-Design">
            {edit.bg_image_path && <img src={edit.bg_image_path} alt="" style={{ width: '100%', borderRadius: 6, marginBottom: 8, border: '1px solid rgba(255,255,255,0.1)' }} />}
            <label style={{ ...btn('#334155', true), display: 'inline-block', textAlign: 'center', cursor: 'pointer' }}>
              {edit.bg_image_path ? 'Design ersetzen' : 'Design hochladen (JPG/PNG)'}
              <input type="file" accept="image/jpeg,image/png,image/webp" style={{ display: 'none' }} onChange={e => e.target.files[0] && uploadBg(e.target.files[0])} />
            </label>
          </Feldgruppe>

          <Feldgruppe titel="Feld hinzufügen">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {FELD_TYPEN.map(t => (
                <button key={t.key} onClick={() => addFeld(t.key)} style={{ ...btn('rgba(255,255,255,0.07)', true), fontSize: 12 }}>+ {t.label}</button>
              ))}
            </div>
          </Feldgruppe>

          <Feldgruppe titel="Optionen">
            <label style={chk}><input type="checkbox" checked={!!edit.optionen?.datumLang} onChange={e => setEdit({ ...edit, optionen: { ...edit.optionen, datumLang: e.target.checked } })} /> Datum ausgeschrieben (28. Juni 2026)</label>
            <label style={chk}><input type="checkbox" checked={!!edit.optionen?.gradKyuOnly} onChange={e => setEdit({ ...edit, optionen: { ...edit.optionen, gradKyuOnly: e.target.checked } })} /> Grad: nur Kyu-Nummer (z.B. „8.")</label>
            <input placeholder="Präfix vor Urkunden-Nr. (z.B. Urkunden-Nr.: )" value={edit.optionen?.nummerPrefix || ''} onChange={e => setEdit({ ...edit, optionen: { ...edit.optionen, nummerPrefix: e.target.value } })} style={inp} />
          </Feldgruppe>

          {sel && (
            <Feldgruppe titel={`Feld: ${feldLabel(sel.key)}`}>
              {sel.key === 'freitext' && <input placeholder="Text" value={sel.text || ''} onChange={e => updFeld(selIdx, { text: e.target.value })} style={inp} />}
              <div style={{ display: 'flex', gap: 8 }}>
                <label style={miniLbl}>Größe (pt)<input type="number" min="6" max="60" value={sel.size} onChange={e => updFeld(selIdx, { size: parseInt(e.target.value) || 16 })} style={inp} /></label>
                <label style={miniLbl}>Breite (mm)<input type="number" min="10" max="300" value={sel.width} onChange={e => updFeld(selIdx, { width: parseInt(e.target.value) || 90 })} style={inp} /></label>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <select value={sel.align} onChange={e => updFeld(selIdx, { align: e.target.value })} style={inp}>
                  <option value="left">links</option><option value="center">zentriert</option><option value="right">rechts</option>
                </select>
                <label style={{ ...chk, whiteSpace: 'nowrap' }}><input type="checkbox" checked={!!sel.bold} onChange={e => updFeld(selIdx, { bold: e.target.checked })} /> fett</label>
              </div>
              <div style={{ fontSize: 11, opacity: 0.5 }}>Position: {sel.left} / {sel.top} mm — per Drag&Drop verschieben</div>
              <button onClick={() => delFeld(selIdx)} style={{ ...btn('#ef4444', true), marginTop: 4 }}>Feld löschen</button>
            </Feldgruppe>
          )}
        </div>

        {/* Rechte Spalte: Canvas */}
        <div style={{ flex: 1, minWidth: 320 }}>
          {edit.extra_font_url && <link rel="stylesheet" href={edit.extra_font_url} />}
          <div style={{ fontSize: 12, opacity: 0.6, marginBottom: 8 }}>Felder per Drag &amp; Drop platzieren — Vorschau mit Beispieldaten:</div>
          <div ref={canvasRef} style={{
            position: 'relative', width: '100%', maxWidth: edit.seitenformat === 'a4_hoch' ? 460 : 640,
            aspectRatio: `${seite.w}/${seite.h}`, background: edit.bg_image_path ? `#fff url('${edit.bg_image_path}') center/100% 100% no-repeat` : '#fff',
            border: '1px solid rgba(255,255,255,0.2)', borderRadius: 6, margin: '0 auto', userSelect: 'none', touchAction: 'none',
          }}>
            {edit.felder.map((f, i) => (
              <div key={i} onPointerDown={e => onPointerDownFeld(e, i)}
                style={{
                  position: 'absolute', top: `${(f.top / seite.h) * 100}%`, left: `${(f.left / seite.w) * 100}%`,
                  width: `${(f.width / seite.w) * 100}%`, textAlign: f.align, cursor: 'move',
                  fontFamily: edit.schriftart, fontWeight: f.bold ? 700 : 400, color: '#1a1a1a',
                  fontSize: `calc(${f.size * PT2MM} / ${seite.w} * 100%)`, lineHeight: 1.1,
                  outline: i === selIdx ? '2px solid #6366f1' : '1px dashed rgba(99,102,241,0.5)',
                  background: i === selIdx ? 'rgba(99,102,241,0.12)' : 'transparent', whiteSpace: 'nowrap',
                }}>
                {sampleWert(f)}
              </div>
            ))}
          </div>
          <div style={{ fontSize: 11, opacity: 0.5, textAlign: 'center', marginTop: 8 }}>
            Hintergrund nur zur Ansicht — gedruckt werden später nur die Daten auf das vorgedruckte Papier.
          </div>
        </div>
      </div>
    </div>
  );
}

// --- kleine Style-Helfer ---
const btn = (bg, sm) => ({ background: bg, color: '#fff', border: 'none', borderRadius: 8, padding: sm ? '7px 12px' : '9px 16px', cursor: 'pointer', fontSize: sm ? 13 : 14, fontWeight: 600 });
const inp = { width: '100%', padding: '8px 10px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, color: '#e2e8f0', fontSize: 13, marginTop: 2 };
const chk = { display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' };
const miniLbl = { flex: 1, fontSize: 11, opacity: 0.7, display: 'flex', flexDirection: 'column' };

function Feldgruppe({ titel, children }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', opacity: 0.7 }}>{titel}</div>
      {children}
    </div>
  );
}
