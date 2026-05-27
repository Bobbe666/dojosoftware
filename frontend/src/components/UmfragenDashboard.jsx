import { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useDojoContext } from '../context/DojoContext';

const fmt     = (d) => d ? new Date(d).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';
const fmtWday = (d) => d ? new Date(d + 'T12:00:00').toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' }) : '';
const fmtIn   = (d) => d ? (d instanceof Date ? d.toISOString().split('T')[0] : String(d).split('T')[0]) : '';

const STATUS_L = { entwurf: 'Entwurf', aktiv: 'Aktiv', beendet: 'Beendet' };
const STATUS_C = { entwurf: '#94a3b8', aktiv: '#4ade80', beendet: '#f87171' };
const TYP_L    = { ja_nein: 'Ja / Nein', kommentar: 'Nur Kommentar', beides: 'Ja/Nein + Kommentar', datum_auswahl: 'Datumsabfrage' };
const EMPTY    = { titel: '', beschreibung: '', typ: 'ja_nein', status: 'entwurf', als_popup: false, gueltig_bis: '', daten: [] };

const card = { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, overflow: 'hidden' };
const inp  = { width: '100%', padding: '0.5rem 0.75rem', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 6, color: '#e2e8f0', fontSize: '0.88rem', boxSizing: 'border-box' };
const lbl  = { display: 'block', fontSize: '0.78rem', color: 'rgba(255,255,255,0.5)', marginBottom: 4 };

export default function UmfragenDashboard() {
  const { token }     = useAuth();
  const { activeDojo} = useDojoContext();
  const headers       = { Authorization: `Bearer ${token}` };
  const isSuperAdmin  = activeDojo === 'super-admin' || activeDojo === null ||
    (typeof activeDojo === 'object' && activeDojo?.rolle === 'admin' && !activeDojo?.dojo_id);
  const dojoId  = typeof activeDojo === 'object' && activeDojo?.id ? activeDojo.id : null;
  const qp      = dojoId ? `?dojo_id=${dojoId}` : '';

  const [umfragen,          setUmfragen]          = useState([]);
  const [loading,           setLoading]           = useState(true);
  const [error,             setError]             = useState('');
  const [detailId,          setDetailId]          = useState(null);
  const [detail,            setDetail]            = useState(null);
  const [detailLoad,        setDetailLoad]        = useState(false);
  const [showModal,         setShowModal]         = useState(false);
  const [editId,            setEditId]            = useState(null);
  const [form,              setForm]              = useState(EMPTY);
  const [saving,            setSaving]            = useState(false);
  const [formErr,           setFormErr]           = useState('');
  const [deleteId,          setDeleteId]          = useState(null);
  const [deleting,          setDeleting]          = useState(false);
  const [newDatum,          setNewDatum]          = useState('');
  const [uploadId,          setUploadId]          = useState(null);
  const [uploading,         setUploading]         = useState(false);
  // Modal Steps
  const [modalStep,         setModalStep]         = useState(1);
  const [existingBildUrl,   setExistingBildUrl]   = useState(null);
  const [pendingBild,       setPendingBild]       = useState(null);
  const [pendingBildPrev,   setPendingBildPrev]   = useState(null);

  const fileRef      = useRef(); // Schnell-Upload in der Liste
  const modalBildRef = useRef(); // Bild in Modal

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const r = await axios.get(`/umfragen${qp}`, { headers });
      setUmfragen(r.data.umfragen || []);
    } catch (e) { setError(e?.response?.data?.error || 'Fehler beim Laden'); }
    finally { setLoading(false); }
  }, [token, qp]); // eslint-disable-line
  useEffect(() => { load(); }, [load]);

  // Detail laden
  const loadDetail = async (u) => {
    if (detailId === u.id) { setDetailId(null); return; }
    setDetailId(u.id); setDetailLoad(true); setDetail(null);
    try {
      if (u.typ === 'datum_auswahl') {
        const r = await axios.get(`/umfragen/${u.id}/datum-ergebnis${qp}`, { headers });
        setDetail({ typ: 'datum', ergebnis: r.data.ergebnis || [] });
      } else {
        const r = await axios.get(`/umfragen/${u.id}/antworten${qp}`, { headers });
        setDetail({ typ: 'normal', antworten: r.data.antworten || [] });
      }
    } catch {} finally { setDetailLoad(false); }
  };

  // Modal öffnen
  const resetModalBild = () => { setPendingBild(null); setPendingBildPrev(null); };

  const openCreate = () => {
    setEditId(null); setForm(EMPTY); setFormErr('');
    setModalStep(1); setExistingBildUrl(null); resetModalBild();
    setShowModal(true);
  };
  const openEdit = (u) => {
    setEditId(u.id);
    setForm({ titel: u.titel, beschreibung: u.beschreibung || '', typ: u.typ, status: u.status, als_popup: !!u.als_popup, gueltig_bis: fmtIn(u.gueltig_bis), daten: Array.isArray(u.daten) ? u.daten : [] });
    setFormErr(''); setModalStep(1);
    setExistingBildUrl(u.bild_url || null); resetModalBild();
    setShowModal(true);
  };
  const closeModal = () => { setShowModal(false); resetModalBild(); };

  // Bild in Modal auswählen
  const onModalBildSelect = (file) => {
    if (!file) return;
    setPendingBild(file);
    const reader = new FileReader();
    reader.onload = e => setPendingBildPrev(e.target.result);
    reader.readAsDataURL(file);
  };
  const clearPendingBild = () => { setPendingBild(null); setPendingBildPrev(null); };

  // Bild in Modal entfernen (nur bei Edit)
  const removeBildInModal = async () => {
    if (!editId) { clearPendingBild(); return; }
    try {
      await axios.delete(`/umfragen/${editId}/bild${qp}`, { headers });
      setExistingBildUrl(null);
      setUmfragen(prev => prev.map(x => x.id === editId ? { ...x, bild_url: null } : x));
    } catch {}
  };

  // Steps: 3 für datum_auswahl, 2 sonst
  const totalSteps   = form.typ === 'datum_auswahl' ? 3 : 2;
  const stepTitles   = form.typ === 'datum_auswahl'
    ? ['Grunddaten', 'Termine', 'Einstellungen & Bild']
    : ['Grunddaten', 'Einstellungen & Bild'];

  const goNext = () => {
    setFormErr('');
    if (modalStep === 1 && !form.titel.trim()) { setFormErr('Titel ist erforderlich'); return; }
    if (modalStep === 2 && form.typ === 'datum_auswahl' && form.daten.length === 0) { setFormErr('Mindestens ein Datum hinzufügen'); return; }
    setModalStep(s => Math.min(s + 1, totalSteps));
  };
  const goBack = () => { setFormErr(''); setModalStep(s => Math.max(s - 1, 1)); };

  // Speichern (letzter Step)
  const save = async () => {
    if (!form.titel.trim()) { setFormErr('Titel ist erforderlich'); setModalStep(1); return; }
    if (form.typ === 'datum_auswahl' && form.daten.length === 0) { setFormErr('Mindestens ein Datum hinzufügen'); setModalStep(form.typ === 'datum_auswahl' ? 2 : 1); return; }
    setSaving(true); setFormErr('');
    try {
      const payload = { ...form, gueltig_bis: form.gueltig_bis || null, daten: form.typ === 'datum_auswahl' ? form.daten : null };
      let umfrageId = editId;
      if (editId) {
        await axios.put(`/umfragen/${editId}${qp}`, payload, { headers });
      } else {
        const r = await axios.post(`/umfragen${qp}`, payload, { headers });
        umfrageId = r.data.id;
      }
      if (pendingBild && umfrageId) {
        const fd = new FormData(); fd.append('bild', pendingBild);
        await axios.post(`/umfragen/${umfrageId}/bild${qp}`, fd, { headers: { ...headers, 'Content-Type': 'multipart/form-data' } });
      }
      closeModal(); load();
    } catch (e) { setFormErr(e?.response?.data?.error || 'Fehler beim Speichern'); }
    finally { setSaving(false); }
  };

  // Status-Schnellwechsel
  const quickStatus = async (u, newStatus) => {
    try {
      await axios.put(`/umfragen/${u.id}${qp}`, { ...u, gueltig_bis: u.gueltig_bis || null, status: newStatus, daten: u.daten || null }, { headers });
      setUmfragen(prev => prev.map(x => x.id === u.id ? { ...x, status: newStatus } : x));
    } catch {}
  };

  // Löschen
  const confirmDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await axios.delete(`/umfragen/${deleteId}${qp}`, { headers });
      setUmfragen(prev => prev.filter(x => x.id !== deleteId));
      setDeleteId(null);
    } catch {} finally { setDeleting(false); }
  };

  // Bild-Schnellupload in Liste
  const uploadBildInList = async (id, file) => {
    setUploadId(id); setUploading(true);
    try {
      const fd = new FormData(); fd.append('bild', file);
      const r  = await axios.post(`/umfragen/${id}/bild${qp}`, fd, { headers: { ...headers, 'Content-Type': 'multipart/form-data' } });
      setUmfragen(prev => prev.map(x => x.id === id ? { ...x, bild_url: r.data.bild_url } : x));
    } catch {} finally { setUploading(false); setUploadId(null); }
  };

  const removeBildInList = async (id) => {
    try {
      await axios.delete(`/umfragen/${id}/bild${qp}`, { headers });
      setUmfragen(prev => prev.map(x => x.id === id ? { ...x, bild_url: null } : x));
    } catch {}
  };

  // Datum zur Liste
  const addDatum = () => {
    if (!newDatum || form.daten.includes(newDatum)) return;
    setForm(p => ({ ...p, daten: [...p.daten, newDatum].sort() }));
    setNewDatum('');
  };

  const f = (k) => (e) => setForm(p => ({ ...p, [k]: e.target.value }));

  // ── Step-Inhalt ──────────────────────────────────────────────────────────────
  const renderStep = () => {
    // Schritt 1: Grunddaten (immer)
    if (modalStep === 1) return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
        <div>
          <label style={lbl}>Titel *</label>
          <input style={inp} value={form.titel} onChange={f('titel')} placeholder="z. B. Wer kommt ins Sommer-Training?" maxLength={255} autoFocus />
        </div>
        <div>
          <label style={lbl}>Beschreibung (optional)</label>
          <textarea style={{ ...inp, minHeight: 72, resize: 'vertical' }} value={form.beschreibung} onChange={f('beschreibung')} placeholder="Zusätzliche Infos für die Mitglieder…" />
        </div>
        <div>
          <label style={lbl}>Typ</label>
          <select style={inp} value={form.typ} onChange={f('typ')}>
            <option value="ja_nein">✓/✗  Ja / Nein</option>
            <option value="kommentar">💬  Nur Kommentar</option>
            <option value="beides">✓/✗ + 💬  Ja/Nein + Kommentar</option>
            <option value="datum_auswahl">📅  Datumsabfrage (Wer kommt wann?)</option>
          </select>
        </div>
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 6, padding: '0.6rem 0.75rem', fontSize: '0.79rem', color: 'rgba(255,255,255,0.4)', lineHeight: 1.5 }}>
          {form.typ === 'ja_nein'      && '✓/✗ Mitglieder wählen Ja oder Nein'}
          {form.typ === 'kommentar'    && '💬 Mitglieder schreiben einen freien Kommentar'}
          {form.typ === 'beides'       && '✓/✗ + 💬 Ja/Nein mit optionalem Kommentar'}
          {form.typ === 'datum_auswahl'&& '📅 Mitglieder geben für mehrere Termine an, ob sie kommen'}
        </div>
      </div>
    );

    // Schritt 2 (datum_auswahl): Termine
    if (modalStep === 2 && form.typ === 'datum_auswahl') return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
        <div style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.5)' }}>
          Füge die Termine hinzu, für die Mitglieder abstimmen sollen.
        </div>
        <div>
          <label style={lbl}>Neues Datum *</label>
          <div style={{ display: 'flex', gap: 6 }}>
            <input style={{ ...inp, flex: 1 }} type="date" value={newDatum} onChange={e => setNewDatum(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addDatum()} />
            <button onClick={addDatum} disabled={!newDatum}
              style={{ background: newDatum ? 'rgba(200,164,74,0.18)' : 'rgba(255,255,255,0.05)', border: `1px solid ${newDatum ? 'rgba(200,164,74,0.4)' : 'rgba(255,255,255,0.1)'}`, borderRadius: 6, padding: '0.5rem 0.9rem', cursor: newDatum ? 'pointer' : 'default', color: newDatum ? '#c8a44a' : 'rgba(255,255,255,0.3)', fontSize: '0.85rem', whiteSpace: 'nowrap', transition: 'all 0.15s' }}>
              + Hinzufügen
            </button>
          </div>
        </div>
        {form.daten.length === 0 ? (
          <div style={{ color: 'rgba(255,255,255,0.25)', fontSize: '0.8rem', fontStyle: 'italic', textAlign: 'center', padding: '1.5rem 0' }}>
            Noch keine Termine — bitte mindestens einen hinzufügen
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {form.daten.map((d, i) => (
              <div key={d} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(200,164,74,0.07)', border: '1px solid rgba(200,164,74,0.2)', borderRadius: 7, padding: '0.45rem 0.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <span style={{ color: '#c8a44a', fontSize: '0.8rem', opacity: 0.7 }}>#{i + 1}</span>
                  <span style={{ color: '#e2e8f0', fontSize: '0.9rem' }}>{fmtWday(d)}</span>
                </div>
                <button onClick={() => setForm(p => ({ ...p, daten: p.daten.filter((_, j) => j !== i) }))}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#f87171', fontSize: '0.85rem', padding: '0.1rem 0.35rem', borderRadius: 4, lineHeight: 1 }}>✕</button>
              </div>
            ))}
          </div>
        )}
      </div>
    );

    // Letzter Schritt: Einstellungen + Bild
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
          <div>
            <label style={lbl}>Status</label>
            <select style={inp} value={form.status} onChange={f('status')}>
              <option value="entwurf">Entwurf</option>
              <option value="aktiv">Aktiv</option>
              <option value="beendet">Beendet</option>
            </select>
          </div>
          <div>
            <label style={lbl}>Gültig bis (optional)</label>
            <input style={inp} type="date" value={form.gueltig_bis} onChange={f('gueltig_bis')} />
          </div>
        </div>

        {/* Popup Toggle */}
        <label style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0.65rem 0.85rem',
          background: form.als_popup ? 'rgba(239,68,68,0.08)' : 'rgba(255,255,255,0.03)',
          border: `1px solid ${form.als_popup ? 'rgba(239,68,68,0.35)' : 'rgba(255,255,255,0.1)'}`,
          borderRadius: 8, cursor: 'pointer',
        }}>
          <span>
            <span style={{ display: 'block', fontWeight: 600, fontSize: '0.9rem', color: form.als_popup ? '#ef4444' : 'rgba(255,255,255,0.85)' }}>
              🔔 Als Popup auf Startseite anzeigen
            </span>
            <span style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.45)' }}>
              Erscheint als Hinweis-Popup beim Öffnen der Mitglieder-App
            </span>
          </span>
          <input type="checkbox" checked={form.als_popup}
            onChange={e => setForm(p => ({ ...p, als_popup: e.target.checked }))}
            style={{ width: 18, height: 18, cursor: 'pointer', accentColor: '#ef4444' }}
          />
        </label>

        {/* Bild-Upload */}
        <div>
          <label style={lbl}>Bild (optional)</label>
          {(pendingBildPrev || existingBildUrl) ? (
            <div style={{ position: 'relative', borderRadius: 8, overflow: 'hidden' }}>
              <img
                src={pendingBildPrev || existingBildUrl}
                alt="Vorschau"
                style={{ width: '100%', maxHeight: 180, objectFit: 'cover', display: 'block' }}
              />
              <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', opacity: 0, transition: 'opacity 0.2s' }}
                onMouseEnter={e => e.currentTarget.style.opacity = 1}
                onMouseLeave={e => e.currentTarget.style.opacity = 0}>
                <button onClick={() => modalBildRef.current?.click()}
                  style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 6, padding: '0.4rem 0.8rem', color: '#fff', cursor: 'pointer', fontSize: '0.82rem' }}>
                  🔄 Ersetzen
                </button>
                <button onClick={removeBildInModal}
                  style={{ background: 'rgba(248,113,113,0.2)', border: '1px solid rgba(248,113,113,0.4)', borderRadius: 6, padding: '0.4rem 0.8rem', color: '#f87171', cursor: 'pointer', fontSize: '0.82rem' }}>
                  ✕ Entfernen
                </button>
              </div>
            </div>
          ) : (
            <div onClick={() => modalBildRef.current?.click()}
              style={{ border: '2px dashed rgba(255,255,255,0.15)', borderRadius: 8, padding: '1.5rem', textAlign: 'center', cursor: 'pointer', transition: 'border-color 0.15s', color: 'rgba(255,255,255,0.35)', fontSize: '0.85rem' }}
              onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(200,164,74,0.4)'}
              onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)'}>
              <div style={{ fontSize: '1.8rem', marginBottom: '0.35rem' }}>🖼</div>
              <div>Klicken zum Auswählen</div>
              <div style={{ fontSize: '0.76rem', marginTop: 4, color: 'rgba(255,255,255,0.25)' }}>JPG, PNG, WebP — max. 5 MB</div>
            </div>
          )}
          <input ref={modalBildRef} type="file" accept="image/*" style={{ display: 'none' }}
            onChange={e => { if (e.target.files[0]) onModalBildSelect(e.target.files[0]); e.target.value = ''; }} />
        </div>

        <div style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.35)', padding: '0.5rem 0.75rem', background: 'rgba(255,255,255,0.03)', borderRadius: 6 }}>
          {isSuperAdmin && !dojoId ? '🌐 Erscheint für Mitglieder aller Dojos.' : '📍 Erscheint nur für Mitglieder deines Dojos.'}
        </div>
      </div>
    );
  };

  return (
    <div style={{ padding: '1.5rem', maxWidth: 880 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <div>
          <h2 style={{ margin: 0, color: '#e2e8f0' }}>📋 Umfragen</h2>
          <p style={{ margin: '0.25rem 0 0', fontSize: '0.82rem', color: 'rgba(255,255,255,0.4)' }}>
            {isSuperAdmin && !dojoId ? 'Plattformweite Umfragen' : 'Umfragen für dein Dojo'}
          </p>
        </div>
        <button onClick={openCreate} style={{ background: 'linear-gradient(135deg,#c8a44a,#a07c28)', color: '#fff', border: 'none', borderRadius: 8, padding: '0.5rem 1.1rem', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem' }}>
          + Neue Umfrage
        </button>
      </div>

      {error && <div style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', borderRadius: 8, padding: '0.75rem 1rem', marginBottom: '1rem', color: '#f87171', fontSize: '0.85rem' }}>{error}</div>}
      {loading && <div style={{ color: 'rgba(255,255,255,0.5)' }}>Lade Umfragen…</div>}

      {!loading && !umfragen.length && !error && (
        <div style={{ ...card, padding: '3rem', textAlign: 'center', color: 'rgba(255,255,255,0.35)' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>📋</div>
          <div style={{ fontWeight: 600, marginBottom: '0.35rem' }}>Noch keine Umfragen</div>
          <div style={{ fontSize: '0.83rem' }}>Erstelle deine erste Umfrage — Mitglieder sehen sie beim nächsten Login als Popup.</div>
        </div>
      )}

      {/* Liste */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {umfragen.map(u => (
          <div key={u.id} style={card}>

            {u.bild_url && (
              <div style={{ position: 'relative' }}>
                <img src={u.bild_url} alt="" style={{ width: '100%', maxHeight: 200, objectFit: 'cover', display: 'block' }} />
                <button onClick={() => removeBildInList(u.id)} style={{ position: 'absolute', top: 6, right: 6, background: 'rgba(0,0,0,0.6)', border: 'none', borderRadius: 4, color: '#f87171', cursor: 'pointer', padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}>✕ Bild entfernen</button>
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem', padding: '1rem 1.25rem' }}>
              <div style={{ paddingTop: 2, flexShrink: 0 }}>
                <select value={u.status} onChange={e => quickStatus(u, e.target.value)} style={{ background: 'rgba(0,0,0,0.3)', border: `1px solid ${STATUS_C[u.status]}40`, borderRadius: 6, color: STATUS_C[u.status], fontSize: '0.75rem', padding: '0.15rem 0.4rem', cursor: 'pointer', fontWeight: 600 }}>
                  {Object.entries(STATUS_L).map(([v,l]) => <option key={v} value={v} style={{ color: STATUS_C[v] }}>{l}</option>)}
                </select>
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, color: '#e2e8f0', marginBottom: 2 }}>{u.titel}</div>
                {u.beschreibung && <div style={{ fontSize: '0.83rem', color: 'rgba(255,255,255,0.5)', marginBottom: 4, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{u.beschreibung}</div>}
                <div style={{ display: 'flex', gap: 10, fontSize: '0.77rem', color: 'rgba(255,255,255,0.4)', flexWrap: 'wrap' }}>
                  <span>{TYP_L[u.typ]}</span>
                  {u.typ === 'datum_auswahl' && u.daten?.length && <span style={{ color: '#c8a44a' }}>{u.daten.length} Termine</span>}
                  {u.gueltig_bis && <span>bis {fmt(u.gueltig_bis)}</span>}
                  {u.dojo_name && <span style={{ color: 'rgba(200,164,74,0.7)' }}>📍 {u.dojo_name}</span>}
                  {!u.dojo_id && <span style={{ color: 'rgba(100,180,255,0.7)' }}>🌐 Plattformweit</span>}
                </div>
              </div>

              <div style={{ textAlign: 'right', fontSize: '0.82rem', flexShrink: 0 }}>
                <div style={{ color: 'rgba(255,255,255,0.6)', marginBottom: 2 }}>{u.antworten_gesamt || 0} Antworten</div>
                {u.typ !== 'kommentar' && u.typ !== 'datum_auswahl' && (u.antworten_gesamt > 0) && (
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                    <span style={{ color: '#4ade80' }}>✓ {u.antworten_ja || 0}</span>
                    <span style={{ color: '#f87171' }}>✗ {u.antworten_nein || 0}</span>
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: 6, flexShrink: 0, paddingTop: 2 }}>
                <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }}
                  onChange={e => { if (e.target.files[0]) uploadBildInList(uploadId, e.target.files[0]); e.target.value = ''; }} />
                <button onClick={() => { setUploadId(u.id); fileRef.current?.click(); }} disabled={uploading && uploadId === u.id} title="Bild hochladen"
                  style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 6, padding: '0.25rem 0.5rem', cursor: 'pointer', color: '#e2e8f0', fontSize: '0.8rem' }}>
                  {uploading && uploadId === u.id ? '⏳' : '🖼'}
                </button>
                <button onClick={() => openEdit(u)} style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 6, padding: '0.25rem 0.5rem', cursor: 'pointer', color: '#e2e8f0', fontSize: '0.8rem' }}>✏️</button>
                <button onClick={() => setDeleteId(u.id)} style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)', borderRadius: 6, padding: '0.25rem 0.5rem', cursor: 'pointer', color: '#f87171', fontSize: '0.8rem' }}>🗑</button>
                <button onClick={() => loadDetail(u)} style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 6, padding: '0.25rem 0.5rem', cursor: 'pointer', color: '#e2e8f0', fontSize: '0.8rem' }}>
                  {detailId === u.id ? '▲' : '▼'}
                </button>
              </div>
            </div>

            {detailId === u.id && (
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', padding: '1rem 1.25rem', background: 'rgba(0,0,0,0.15)' }}>
                {detailLoad ? (
                  <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.85rem' }}>Lade Ergebnisse…</div>
                ) : detail?.typ === 'datum' ? (
                  detail.ergebnis.length === 0 ? (
                    <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.85rem' }}>Noch keine Antworten.</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      {detail.ergebnis.map(e => (
                        <div key={e.datum} style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: '0.75rem 1rem' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                            <strong style={{ color: '#c8a44a', fontSize: '0.9rem' }}>{fmtWday(e.datum)}</strong>
                            <div style={{ display: 'flex', gap: 12, fontSize: '0.82rem' }}>
                              <span style={{ color: '#4ade80' }}>✓ {e.kommt.length}</span>
                              <span style={{ color: '#f87171' }}>✗ {e.kommt_nicht.length}</span>
                            </div>
                          </div>
                          {e.kommt.length > 0 && (
                            <div style={{ fontSize: '0.78rem', color: '#cbd5e1', display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                              {e.kommt.map((p, i) => (
                                <span key={i} style={{ background: 'rgba(74,222,128,0.1)', border: '1px solid rgba(74,222,128,0.2)', borderRadius: 4, padding: '0.1rem 0.4rem' }}>{p.name}</span>
                              ))}
                            </div>
                          )}
                          {e.kommt_nicht.length > 0 && (
                            <div style={{ fontSize: '0.78rem', color: '#cbd5e1', display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginTop: 4 }}>
                              {e.kommt_nicht.map((p, i) => (
                                <span key={i} style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)', borderRadius: 4, padding: '0.1rem 0.4rem', color: '#fca5a5' }}>{p.name}</span>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )
                ) : (
                  !detail?.antworten?.length ? (
                    <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.85rem' }}>Noch keine Antworten.</div>
                  ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                      <thead>
                        <tr>{['Name','Dojo','Antwort','Kommentar','Datum'].map(h => (
                          <th key={h} style={{ textAlign: 'left', color: 'rgba(255,255,255,0.4)', padding: '0.25rem 0.5rem', borderBottom: '1px solid rgba(255,255,255,0.08)', fontWeight: 500, whiteSpace: 'nowrap' }}>{h}</th>
                        ))}</tr>
                      </thead>
                      <tbody>
                        {detail.antworten.map((a, i) => (
                          <tr key={i}>
                            <td style={{ padding: '0.35rem 0.5rem', color: '#cbd5e1', whiteSpace: 'nowrap' }}>{a.vorname} {a.nachname}</td>
                            <td style={{ padding: '0.35rem 0.5rem', color: 'rgba(200,164,74,0.8)', fontSize: '0.78rem' }}>{a.dojoname || '—'}</td>
                            <td style={{ padding: '0.35rem 0.5rem', color: a.antwort === 'ja' ? '#4ade80' : a.antwort === 'nein' ? '#f87171' : '#94a3b8', whiteSpace: 'nowrap' }}>
                              {a.antwort ? (a.antwort === 'ja' ? '✓ Ja' : '✗ Nein') : '—'}
                            </td>
                            <td style={{ padding: '0.35rem 0.5rem', color: '#94a3b8', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.kommentar || '—'}</td>
                            <td style={{ padding: '0.35rem 0.5rem', color: '#94a3b8', whiteSpace: 'nowrap' }}>{fmt(a.beantwortet_am)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* ── Create/Edit Modal ───────────────────────────────────────────────── */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
          onClick={e => { if (e.target === e.currentTarget) closeModal(); }}>
          <div style={{ background: 'linear-gradient(135deg,rgba(26,26,46,0.99),rgba(15,15,35,0.99))', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 14, padding: '1.75rem', width: '100%', maxWidth: 520, maxHeight: '92vh', overflowY: 'auto' }}>

            {/* Modal-Titel */}
            <h3 style={{ margin: '0 0 1.25rem', color: '#e2e8f0', fontSize: '1rem' }}>
              {editId ? '✏️ Umfrage bearbeiten' : '📋 Neue Umfrage'}
            </h3>

            {/* Step-Indikator */}
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '1.5rem' }}>
              {stepTitles.map((title, i) => {
                const s = i + 1;
                const active  = modalStep === s;
                const done    = modalStep > s;
                return (
                  <div key={s} style={{ display: 'flex', alignItems: 'center', flex: i < stepTitles.length - 1 ? 1 : 'none' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                      <div style={{
                        width: 30, height: 30, borderRadius: '50%',
                        background: active ? 'linear-gradient(135deg,#c8a44a,#a07c28)' : done ? 'rgba(200,164,74,0.2)' : 'rgba(255,255,255,0.07)',
                        border: `2px solid ${active ? '#c8a44a' : done ? 'rgba(200,164,74,0.5)' : 'rgba(255,255,255,0.12)'}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '0.72rem', fontWeight: 700, flexShrink: 0,
                        color: active ? '#fff' : done ? '#c8a44a' : 'rgba(255,255,255,0.35)',
                      }}>
                        {done ? '✓' : s}
                      </div>
                      <span style={{ fontSize: '0.68rem', color: active ? '#c8a44a' : done ? 'rgba(200,164,74,0.6)' : 'rgba(255,255,255,0.3)', whiteSpace: 'nowrap', fontWeight: active ? 600 : 400 }}>
                        {title}
                      </span>
                    </div>
                    {i < stepTitles.length - 1 && (
                      <div style={{ flex: 1, height: 1, background: done ? 'rgba(200,164,74,0.4)' : 'rgba(255,255,255,0.1)', margin: '0 0.5rem', marginBottom: 16 }} />
                    )}
                  </div>
                );
              })}
            </div>

            {/* Step-Inhalt */}
            {renderStep()}

            {/* Fehler */}
            {formErr && <div style={{ color: '#f87171', fontSize: '0.82rem', marginTop: '0.75rem' }}>{formErr}</div>}

            {/* Buttons */}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between', marginTop: '1.25rem' }}>
              <button onClick={modalStep === 1 ? closeModal : goBack}
                style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 6, padding: '0.45rem 1rem', cursor: 'pointer', color: '#e2e8f0', fontSize: '0.85rem' }}>
                {modalStep === 1 ? 'Abbrechen' : '← Zurück'}
              </button>
              {modalStep < totalSteps ? (
                <button onClick={goNext}
                  style={{ background: 'linear-gradient(135deg,#c8a44a,#a07c28)', border: 'none', borderRadius: 6, padding: '0.45rem 1.25rem', cursor: 'pointer', color: '#fff', fontWeight: 600, fontSize: '0.85rem' }}>
                  Weiter →
                </button>
              ) : (
                <button onClick={save} disabled={saving}
                  style={{ background: saving ? 'rgba(200,164,74,0.4)' : 'linear-gradient(135deg,#c8a44a,#a07c28)', border: 'none', borderRadius: 6, padding: '0.45rem 1.25rem', cursor: saving ? 'default' : 'pointer', color: '#fff', fontWeight: 600, fontSize: '0.85rem' }}>
                  {saving ? 'Speichern…' : (editId ? '✓ Speichern' : '✓ Erstellen')}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Löschen-Bestätigung */}
      {deleteId && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ background: 'linear-gradient(135deg,rgba(26,26,46,0.99),rgba(15,15,35,0.99))', border: '1px solid rgba(248,113,113,0.3)', borderRadius: 12, padding: '1.75rem', maxWidth: 420, width: '100%' }}>
            <h3 style={{ margin: '0 0 0.75rem', color: '#f87171' }}>🗑 Umfrage löschen?</h3>
            <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.85rem', margin: '0 0 1.25rem' }}>Die Umfrage und alle Antworten werden unwiderruflich gelöscht.</p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setDeleteId(null)} style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 6, padding: '0.45rem 1rem', cursor: 'pointer', color: '#e2e8f0', fontSize: '0.85rem' }}>Abbrechen</button>
              <button onClick={confirmDelete} disabled={deleting} style={{ background: 'rgba(248,113,113,0.15)', border: '1px solid rgba(248,113,113,0.4)', borderRadius: 6, padding: '0.45rem 1rem', cursor: 'pointer', color: '#f87171', fontSize: '0.85rem', fontWeight: 600 }}>
                {deleting ? 'Löschen…' : 'Ja, löschen'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
