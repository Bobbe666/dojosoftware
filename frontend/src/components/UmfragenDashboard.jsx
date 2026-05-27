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
const EMPTY    = { titel: '', beschreibung: '', typ: 'ja_nein', status: 'entwurf', gueltig_bis: '', daten: [] };

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

  const [umfragen,   setUmfragen]   = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState('');
  const [detailId,   setDetailId]   = useState(null);
  const [detail,     setDetail]     = useState(null);
  const [detailLoad, setDetailLoad] = useState(false);
  const [showModal,  setShowModal]  = useState(false);
  const [editId,     setEditId]     = useState(null);
  const [form,       setForm]       = useState(EMPTY);
  const [saving,     setSaving]     = useState(false);
  const [formErr,    setFormErr]    = useState('');
  const [deleteId,   setDeleteId]   = useState(null);
  const [deleting,   setDeleting]   = useState(false);
  const [newDatum,   setNewDatum]   = useState('');
  const [uploadId,   setUploadId]   = useState(null);
  const [uploading,  setUploading]  = useState(false);
  const fileRef = useRef();

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const r = await axios.get(`/umfragen${qp}`, { headers });
      setUmfragen(r.data.umfragen || []);
    } catch (e) { setError(e?.response?.data?.error || 'Fehler beim Laden'); }
    finally { setLoading(false); }
  }, [token, qp]); // eslint-disable-line
  useEffect(() => { load(); }, [load]);

  // Detail laden (Antworten oder Datum-Ergebnis)
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

  // Formular öffnen
  const openCreate = () => { setEditId(null); setForm(EMPTY); setFormErr(''); setShowModal(true); };
  const openEdit   = (u) => {
    setEditId(u.id);
    setForm({ titel: u.titel, beschreibung: u.beschreibung || '', typ: u.typ, status: u.status, gueltig_bis: fmtIn(u.gueltig_bis), daten: Array.isArray(u.daten) ? u.daten : [] });
    setFormErr(''); setShowModal(true);
  };

  // Speichern
  const save = async () => {
    if (!form.titel.trim()) { setFormErr('Titel ist erforderlich'); return; }
    if (form.typ === 'datum_auswahl' && form.daten.length === 0) { setFormErr('Mindestens ein Datum hinzufügen'); return; }
    setSaving(true); setFormErr('');
    try {
      const payload = { ...form, gueltig_bis: form.gueltig_bis || null, daten: form.typ === 'datum_auswahl' ? form.daten : null };
      if (editId) await axios.put(`/umfragen/${editId}${qp}`, payload, { headers });
      else        await axios.post(`/umfragen${qp}`, payload, { headers });
      setShowModal(false); load();
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

  // Bild hochladen
  const uploadBild = async (id, file) => {
    setUploadId(id); setUploading(true);
    try {
      const fd = new FormData(); fd.append('bild', file);
      const r  = await axios.post(`/umfragen/${id}/bild${qp}`, fd, { headers: { ...headers, 'Content-Type': 'multipart/form-data' } });
      setUmfragen(prev => prev.map(x => x.id === id ? { ...x, bild_url: r.data.bild_url } : x));
    } catch {} finally { setUploading(false); setUploadId(null); }
  };

  const removeBild = async (id) => {
    try {
      await axios.delete(`/umfragen/${id}/bild${qp}`, { headers });
      setUmfragen(prev => prev.map(x => x.id === id ? { ...x, bild_url: null } : x));
    } catch {}
  };

  // Datum zur Liste hinzufügen
  const addDatum = () => {
    if (!newDatum) return;
    if (form.daten.includes(newDatum)) return;
    setForm(p => ({ ...p, daten: [...p.daten, newDatum].sort() }));
    setNewDatum('');
  };

  const f = (k) => (e) => setForm(p => ({ ...p, [k]: e.target.value }));

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

            {/* Bild (wenn vorhanden) */}
            {u.bild_url && (
              <div style={{ position: 'relative' }}>
                <img src={u.bild_url} alt="" style={{ width: '100%', maxHeight: 200, objectFit: 'cover', display: 'block' }} />
                <button onClick={() => removeBild(u.id)} style={{ position: 'absolute', top: 6, right: 6, background: 'rgba(0,0,0,0.6)', border: 'none', borderRadius: 4, color: '#f87171', cursor: 'pointer', padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}>✕ Bild entfernen</button>
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem', padding: '1rem 1.25rem' }}>

              {/* Status-Chip */}
              <div style={{ paddingTop: 2, flexShrink: 0 }}>
                <select value={u.status} onChange={e => quickStatus(u, e.target.value)} style={{ background: 'rgba(0,0,0,0.3)', border: `1px solid ${STATUS_C[u.status]}40`, borderRadius: 6, color: STATUS_C[u.status], fontSize: '0.75rem', padding: '0.15rem 0.4rem', cursor: 'pointer', fontWeight: 600 }}>
                  {Object.entries(STATUS_L).map(([v,l]) => <option key={v} value={v} style={{ color: STATUS_C[v] }}>{l}</option>)}
                </select>
              </div>

              {/* Inhalt */}
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

              {/* Statistik */}
              <div style={{ textAlign: 'right', fontSize: '0.82rem', flexShrink: 0 }}>
                <div style={{ color: 'rgba(255,255,255,0.6)', marginBottom: 2 }}>{u.antworten_gesamt || 0} Antworten</div>
                {u.typ !== 'kommentar' && u.typ !== 'datum_auswahl' && (u.antworten_gesamt > 0) && (
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                    <span style={{ color: '#4ade80' }}>✓ {u.antworten_ja || 0}</span>
                    <span style={{ color: '#f87171' }}>✗ {u.antworten_nein || 0}</span>
                  </div>
                )}
              </div>

              {/* Aktionen */}
              <div style={{ display: 'flex', gap: 6, flexShrink: 0, paddingTop: 2 }}>
                {/* Bild hochladen */}
                <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { if (e.target.files[0]) uploadBild(u.id, e.target.files[0]); e.target.value = ''; }} />
                <button onClick={() => { setUploadId(u.id); fileRef.current?.click(); }} disabled={uploading && uploadId === u.id} title="Bild hochladen" style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 6, padding: '0.25rem 0.5rem', cursor: 'pointer', color: '#e2e8f0', fontSize: '0.8rem' }}>
                  {uploading && uploadId === u.id ? '⏳' : '🖼'}
                </button>
                <button onClick={() => openEdit(u)} style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 6, padding: '0.25rem 0.5rem', cursor: 'pointer', color: '#e2e8f0', fontSize: '0.8rem' }}>✏️</button>
                <button onClick={() => setDeleteId(u.id)} style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)', borderRadius: 6, padding: '0.25rem 0.5rem', cursor: 'pointer', color: '#f87171', fontSize: '0.8rem' }}>🗑</button>
                <button onClick={() => loadDetail(u)} style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 6, padding: '0.25rem 0.5rem', cursor: 'pointer', color: '#e2e8f0', fontSize: '0.8rem' }}>
                  {detailId === u.id ? '▲' : '▼'}
                </button>
              </div>
            </div>

            {/* Antworten-Bereich */}
            {detailId === u.id && (
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', padding: '1rem 1.25rem', background: 'rgba(0,0,0,0.15)' }}>
                {detailLoad ? (
                  <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.85rem' }}>Lade Ergebnisse…</div>
                ) : detail?.typ === 'datum' ? (
                  // Datum-Auswahl Ergebnisse
                  detail.ergebnis.length === 0 ? (
                    <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.85rem' }}>Noch keine Antworten.</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      {detail.ergebnis.map(e => (
                        <div key={e.datum} style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: '0.75rem 1rem' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                            <strong style={{ color: '#c8a44a', fontSize: '0.9rem' }}>{fmtWday(e.datum)}</strong>
                            <div style={{ display: 'flex', gap: 12, fontSize: '0.82rem' }}>
                              <span style={{ color: '#4ade80' }}>✓ {e.kommt.length} kommen</span>
                              <span style={{ color: '#f87171' }}>✗ {e.kommt_nicht.length} kommen nicht</span>
                            </div>
                          </div>
                          {e.kommt.length > 0 && (
                            <div style={{ fontSize: '0.78rem', color: '#cbd5e1', display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                              {e.kommt.map((p, i) => (
                                <span key={i} style={{ background: 'rgba(74,222,128,0.1)', border: '1px solid rgba(74,222,128,0.2)', borderRadius: 4, padding: '0.1rem 0.4rem' }}>{p.name}</span>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )
                ) : (
                  // Normale Antworten
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
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }} onClick={e => { if (e.target === e.currentTarget) setShowModal(false); }}>
          <div style={{ background: 'linear-gradient(135deg,rgba(26,26,46,0.99),rgba(15,15,35,0.99))', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 12, padding: '1.75rem', width: '100%', maxWidth: 540, maxHeight: '90vh', overflowY: 'auto' }}>
            <h3 style={{ margin: '0 0 1.25rem', color: '#e2e8f0', fontSize: '1rem' }}>
              {editId ? '✏️ Umfrage bearbeiten' : '📋 Neue Umfrage'}
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
              <div>
                <label style={lbl}>Titel *</label>
                <input style={inp} value={form.titel} onChange={f('titel')} placeholder="z. B. Wer kommt ins Sommer-Training?" maxLength={255} />
              </div>

              <div>
                <label style={lbl}>Beschreibung (optional)</label>
                <textarea style={{ ...inp, minHeight: 64, resize: 'vertical' }} value={form.beschreibung} onChange={f('beschreibung')} placeholder="Zusätzliche Infos für die Mitglieder…" />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={lbl}>Typ</label>
                  <select style={inp} value={form.typ} onChange={f('typ')}>
                    <option value="ja_nein">Ja / Nein</option>
                    <option value="kommentar">Nur Kommentar</option>
                    <option value="beides">Ja/Nein + Kommentar</option>
                    <option value="datum_auswahl">Datumsabfrage</option>
                  </select>
                </div>
                <div>
                  <label style={lbl}>Status</label>
                  <select style={inp} value={form.status} onChange={f('status')}>
                    <option value="entwurf">Entwurf</option>
                    <option value="aktiv">Aktiv</option>
                    <option value="beendet">Beendet</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={lbl}>Gültig bis (optional)</label>
                <input style={inp} type="date" value={form.gueltig_bis} onChange={f('gueltig_bis')} />
              </div>

              {/* Datumsabfrage: Termine hinzufügen */}
              {form.typ === 'datum_auswahl' && (
                <div>
                  <label style={lbl}>Termine *</label>
                  <div style={{ display: 'flex', gap: 6, marginBottom: '0.5rem' }}>
                    <input style={{ ...inp, flex: 1 }} type="date" value={newDatum} onChange={e => setNewDatum(e.target.value)} />
                    <button onClick={addDatum} disabled={!newDatum} style={{ background: 'rgba(200,164,74,0.15)', border: '1px solid rgba(200,164,74,0.3)', borderRadius: 6, padding: '0.5rem 0.75rem', cursor: newDatum ? 'pointer' : 'default', color: '#c8a44a', fontSize: '0.85rem', whiteSpace: 'nowrap' }}>
                      + Hinzufügen
                    </button>
                  </div>
                  {form.daten.length === 0 ? (
                    <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.8rem', fontStyle: 'italic' }}>Noch keine Termine hinzugefügt</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {form.daten.map((d, i) => (
                        <div key={d} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(200,164,74,0.08)', border: '1px solid rgba(200,164,74,0.2)', borderRadius: 6, padding: '0.3rem 0.6rem' }}>
                          <span style={{ color: '#e2e8f0', fontSize: '0.85rem' }}>{fmtWday(d)}</span>
                          <button onClick={() => setForm(p => ({ ...p, daten: p.daten.filter((_, j) => j !== i) }))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#f87171', fontSize: '0.8rem', padding: '0 0.25rem' }}>✕</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {!editId && (
                <div style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.35)', padding: '0.5rem 0.75rem', background: 'rgba(255,255,255,0.03)', borderRadius: 6 }}>
                  {isSuperAdmin && !dojoId ? '🌐 Erscheint für Mitglieder aller Dojos.' : '📍 Erscheint nur für Mitglieder deines Dojos.'}
                </div>
              )}

              {formErr && <div style={{ color: '#f87171', fontSize: '0.82rem' }}>{formErr}</div>}

              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: '0.25rem' }}>
                <button onClick={() => setShowModal(false)} style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 6, padding: '0.45rem 1rem', cursor: 'pointer', color: '#e2e8f0', fontSize: '0.85rem' }}>Abbrechen</button>
                <button onClick={save} disabled={saving} style={{ background: saving ? 'rgba(200,164,74,0.4)' : 'linear-gradient(135deg,#c8a44a,#a07c28)', border: 'none', borderRadius: 6, padding: '0.45rem 1.25rem', cursor: saving ? 'default' : 'pointer', color: '#fff', fontWeight: 600, fontSize: '0.85rem' }}>
                  {saving ? 'Speichern…' : (editId ? 'Speichern' : 'Erstellen')}
                </button>
              </div>
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
