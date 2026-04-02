import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const fmt = (d) => d ? new Date(d).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';

const STATUS_LABELS = { entwurf: 'Entwurf', aktiv: 'Aktiv', beendet: 'Beendet' };
const STATUS_COLORS = { entwurf: '#94a3b8', aktiv: '#4ade80', beendet: '#f87171' };
const TYP_LABELS = { ja_nein: 'Ja / Nein', kommentar: 'Kommentar', beides: 'Ja/Nein + Kommentar' };

export default function UmfragenDashboard() {
  const { token } = useAuth();
  const [umfragen, setUmfragen] = useState([]);
  const [loading, setLoading] = useState(true);
  const [detailId, setDetailId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const headers = { Authorization: `Bearer ${token}` };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await axios.get('/umfragen/dojo/aktiv', { headers });
      setUmfragen(r.data.umfragen || []);
    } catch {} finally { setLoading(false); }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const loadDetail = async (id) => {
    if (detailId === id) { setDetailId(null); return; }
    setDetailId(id); setDetailLoading(true); setDetail(null);
    try {
      const r = await axios.get(`/umfragen/${id}/antworten`, { headers });
      setDetail(r.data.antworten || []);
    } catch {} finally { setDetailLoading(false); }
  };

  return (
    <div style={{ padding: '1.5rem', maxWidth: 800 }}>
      <h2 style={{ marginBottom: '1.25rem', color: '#e2e8f0' }}>📋 Umfragen</h2>

      {loading ? (
        <div style={{ color: 'rgba(255,255,255,0.5)' }}>Lade Umfragen…</div>
      ) : umfragen.length === 0 ? (
        <div style={{ color: 'rgba(255,255,255,0.4)', padding: '2rem', textAlign: 'center' }}>
          Keine aktiven Umfragen vorhanden.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {umfragen.map(u => (
            <div key={u.id} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', padding: '1rem 1.25rem' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '0.78rem', color: STATUS_COLORS[u.status], fontWeight: 600, marginBottom: 4 }}>● {STATUS_LABELS[u.status]}</div>
                  <div style={{ fontWeight: 600, color: '#e2e8f0', marginBottom: 4 }}>{u.titel}</div>
                  {u.beschreibung && <div style={{ fontSize: '0.83rem', color: 'rgba(255,255,255,0.55)', marginBottom: 6 }}>{u.beschreibung}</div>}
                  <div style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.4)', display: 'flex', gap: 12 }}>
                    <span>{TYP_LABELS[u.typ]}</span>
                    {u.gueltig_bis && <span>bis {fmt(u.gueltig_bis)}</span>}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                  <div style={{ textAlign: 'right', fontSize: '0.82rem' }}>
                    <div style={{ color: 'rgba(255,255,255,0.5)' }}>{u.antworten_gesamt || 0} Antworten</div>
                    {u.typ !== 'kommentar' && (
                      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                        <span style={{ color: '#4ade80' }}>✓ {u.antworten_ja || 0}</span>
                        <span style={{ color: '#f87171' }}>✗ {u.antworten_nein || 0}</span>
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => loadDetail(u.id)}
                    style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 6, padding: '0.3rem 0.6rem', cursor: 'pointer', color: '#e2e8f0' }}>
                    {detailId === u.id ? '▲' : '▼'}
                  </button>
                </div>
              </div>

              {detailId === u.id && (
                <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', padding: '1rem 1.25rem', background: 'rgba(0,0,0,0.15)' }}>
                  {detailLoading ? (
                    <div style={{ color: 'rgba(255,255,255,0.4)' }}>Lade Antworten…</div>
                  ) : !detail?.length ? (
                    <div style={{ color: 'rgba(255,255,255,0.4)' }}>Noch keine Antworten.</div>
                  ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.83rem' }}>
                      <thead>
                        <tr>
                          {['Name', 'Antwort', 'Kommentar', 'Datum'].map(h => (
                            <th key={h} style={{ textAlign: 'left', color: 'rgba(255,255,255,0.4)', padding: '0.3rem 0.5rem', borderBottom: '1px solid rgba(255,255,255,0.08)', fontWeight: 500 }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {detail.map((a, i) => (
                          <tr key={i}>
                            <td style={{ padding: '0.4rem 0.5rem', color: '#cbd5e1' }}>{a.vorname} {a.nachname}</td>
                            <td style={{ padding: '0.4rem 0.5rem', color: a.antwort === 'ja' ? '#4ade80' : a.antwort === 'nein' ? '#f87171' : '#94a3b8' }}>
                              {a.antwort ? (a.antwort === 'ja' ? '✓ Ja' : '✗ Nein') : '—'}
                            </td>
                            <td style={{ padding: '0.4rem 0.5rem', color: '#94a3b8' }}>{a.kommentar || '—'}</td>
                            <td style={{ padding: '0.4rem 0.5rem', color: '#94a3b8' }}>{fmt(a.beantwortet_am)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
