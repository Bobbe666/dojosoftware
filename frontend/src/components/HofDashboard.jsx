/**
 * HofDashboard.jsx
 * Hall of Fame Tab im Admin-Dashboard.
 * Zeigt alle Nominierungen dieses Dojos + Neue-Nominierung-Button.
 */

import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useDojoContext } from '../context/DojoContext';
import HofNominierungModal from './HofNominierungModal';

const S = {
  wrap: { padding: '8px 0' },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' },
  title: { margin: 0, fontSize: '1.1rem', fontWeight: 700, color: 'var(--warning, #d4af37)', display: 'flex', alignItems: 'center', gap: '8px' },
  btnNeu: {
    padding: '10px 20px', background: '#d4af37', border: 'none', borderRadius: '8px',
    color: '#0f0f1e', fontWeight: 700, fontSize: '14px', cursor: 'pointer',
    display: 'flex', alignItems: 'center', gap: '6px',
  },
  filterRow: { display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center' },
  yearSelect: {
    background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: '8px', padding: '8px 12px', color: '#fff', fontSize: '13px', cursor: 'pointer',
  },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { textAlign: 'left', padding: '10px 12px', fontSize: '11px', fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid rgba(255,255,255,0.08)' },
  td: { padding: '12px', fontSize: '13px', color: 'rgba(255,255,255,0.85)', borderBottom: '1px solid rgba(255,255,255,0.05)', verticalAlign: 'middle' },
  badge: (color) => ({
    display: 'inline-block', padding: '2px 8px', borderRadius: '100px',
    fontSize: '11px', fontWeight: 700, background: color + '22', color: color,
    border: `1px solid ${color}44`,
  }),
  empty: { textAlign: 'center', padding: '48px 20px', color: 'rgba(255,255,255,0.3)', fontSize: '14px' },
  errorBox: { background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', padding: '12px 16px', color: '#fca5a5', fontSize: '13px', marginBottom: '16px' },
  successToast: {
    position: 'fixed', bottom: '24px', right: '24px', zIndex: 99998,
    background: '#16a34a', color: '#fff', padding: '12px 20px', borderRadius: '10px',
    fontWeight: 600, fontSize: '14px', boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
  },
};

const ZAHLER_LABEL = { verein: '🏟️ Verein', nominierter: '👤 Person' };
const ZAHLER_COLOR = { verein: '#60a5fa', nominierter: '#a78bfa' };

export default function HofDashboard() {
  const { activeDojo } = useDojoContext();
  const dojoId = activeDojo?.id || null;

  const [nominierungen, setNominierungen] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [toast, setToast] = useState('');
  const [jahr, setJahr] = useState(String(new Date().getFullYear()));
  const [syncing, setSyncing] = useState(false);

  const jahre = [];
  for (let y = new Date().getFullYear(); y >= 2020; y--) jahre.push(String(y));

  const load = useCallback(async () => {
    if (!dojoId) return; // Kein Dojo ausgewählt — nichts laden
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (jahr) params.set('jahr', jahr);
      params.set('dojo_id', dojoId);
      const res = await axios.get(`/hof/nominierungen?${params.toString()}`);
      setNominierungen(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      setError(err.response?.data?.message || 'Nominierungen konnten nicht geladen werden.');
    } finally {
      setLoading(false);
    }
  }, [jahr, dojoId]);

  useEffect(() => { load(); }, [load]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await axios.post('/hof/sync-sportler');
      const d = res.data;
      setToast(`🔄 Sync: ${d.added} neu, ${d.linked} verknüpft, ${d.skipped} vorhanden`);
      setTimeout(() => setToast(''), 5000);
    } catch (e) {
      setToast('❌ Sync fehlgeschlagen: ' + (e.response?.data?.message || e.message));
      setTimeout(() => setToast(''), 5000);
    } finally {
      setSyncing(false);
    }
  };

  const handleSuccess = (data) => {
    setToast(`🏆 Nominierung ${data.nominierungsnummer} erfolgreich!`);
    setTimeout(() => setToast(''), 4000);
    load();
  };

  if (!dojoId) {
    return (
      <div style={S.wrap}>
        <div style={S.header}>
          <h2 style={S.title}>🏛️ Hall of Fame — Nominierungen</h2>
        </div>
        <div style={S.empty}>
          <div style={{ fontSize: '2rem', marginBottom: '12px' }}>🏟️</div>
          <div>Bitte wähle oben ein Dojo aus, um dessen Nominierungen zu sehen.</div>
        </div>
      </div>
    );
  }

  return (
    <div style={S.wrap}>
      {/* Header */}
      <div style={S.header}>
        <h2 style={S.title}>🏛️ Hall of Fame — Nominierungen</h2>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            style={{ ...S.btnNeu, background: syncing ? 'rgba(255,255,255,0.1)' : 'rgba(212,175,55,0.15)', color: syncing ? 'rgba(255,255,255,0.4)' : '#d4af37', border: '1px solid rgba(212,175,55,0.35)', cursor: syncing ? 'not-allowed' : 'pointer' }}
            onClick={handleSync}
            disabled={syncing}
            title="Aktive Mitglieder aus Dojosoftware in HOF-Sportlerliste importieren"
          >
            {syncing ? '⏳ Sync…' : '🔄 Mitglieder sync'}
          </button>
          <button style={S.btnNeu} onClick={() => setShowModal(true)}>
            + Neue Nominierung
          </button>
        </div>
      </div>

      {/* Filter */}
      <div style={S.filterRow}>
        <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px' }}>Jahr:</span>
        <select style={S.yearSelect} value={jahr} onChange={e => setJahr(e.target.value)}>
          <option value="">Alle Jahre</option>
          {jahre.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        {!loading && (
          <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '12px' }}>
            {nominierungen.length} Nominierung{nominierungen.length !== 1 ? 'en' : ''}
          </span>
        )}
      </div>

      {error && <div style={S.errorBox}>{error}</div>}

      {/* Tabelle */}
      {loading ? (
        <div style={S.empty}>Lade Nominierungen…</div>
      ) : nominierungen.length === 0 ? (
        <div style={S.empty}>
          <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>🏛️</div>
          <div>Noch keine Nominierungen{jahr ? ` für ${jahr}` : ''}.</div>
          <div style={{ marginTop: '8px', fontSize: '12px' }}>
            Klicke auf „+ Neue Nominierung" um loszulegen.
          </div>
        </div>
      ) : (
        <table style={S.table}>
          <thead>
            <tr>
              <th style={S.th}>Nummer</th>
              <th style={S.th}>Person</th>
              <th style={S.th}>Kategorie</th>
              <th style={S.th}>Jahr</th>
              <th style={S.th}>Zahler</th>
              <th style={S.th}>Zahlung</th>
              <th style={S.th}>Genehmigung</th>
              <th style={S.th}>Nominiert durch</th>
            </tr>
          </thead>
          <tbody>
            {nominierungen.map(n => (
              <tr key={n.id}>
                <td style={{ ...S.td, fontFamily: 'monospace', fontSize: '12px', color: '#d4af37' }}>
                  {n.nominierungsnummer || '—'}
                </td>
                <td style={S.td}>
                  <strong>{n.vorname} {n.nachname}</strong>
                </td>
                <td style={{ ...S.td, color: 'rgba(255,255,255,0.6)' }}>{n.kategorie || '—'}</td>
                <td style={S.td}>{n.jahr}</td>
                <td style={S.td}>
                  {n.zahler ? (
                    <span style={S.badge(ZAHLER_COLOR[n.zahler] || '#888')}>
                      {ZAHLER_LABEL[n.zahler] || n.zahler}
                    </span>
                  ) : '—'}
                </td>
                <td style={S.td}>
                  <span style={S.badge(n.bezahlt ? '#4ade80' : '#fb923c')}>
                    {n.bezahlt ? '✓ Bezahlt' : 'Offen'}
                  </span>
                </td>
                <td style={S.td}>
                  <span style={S.badge(n.genehmigt ? '#d4af37' : 'rgba(255,255,255,0.3)')}>
                    {n.genehmigt ? '🏆 Genehmigt' : 'Ausstehend'}
                  </span>
                </td>
                <td style={{ ...S.td, color: 'rgba(255,255,255,0.4)', fontSize: '12px' }}>
                  {n.nominiert_durch || '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Modal */}
      {showModal && (
        <HofNominierungModal
          onClose={() => setShowModal(false)}
          onSuccess={handleSuccess}
        />
      )}

      {/* Toast */}
      {toast && <div style={S.successToast}>{toast}</div>}
    </div>
  );
}
