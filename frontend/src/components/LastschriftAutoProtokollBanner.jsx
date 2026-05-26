import React, { useState, useEffect, useCallback } from 'react';
import { CheckCircle, AlertTriangle, Download, X } from 'lucide-react';

const fmt = (dateStr) => new Date(dateStr).toLocaleString('de-DE', {
  day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
});

const fmtEur = (cent) => (cent / 100).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });

const LastschriftAutoProtokollBanner = ({ dojoId }) => {
  const [entries, setEntries] = useState([]);

  const load = useCallback(async () => {
    if (!dojoId) return;
    try {
      const token = localStorage.getItem('dojo_auth_token');
      const url = dojoId === 'all'
        ? '/api/lastschriftlauf/auto-protokoll'
        : `/api/lastschriftlauf/auto-protokoll?dojo_id=${dojoId}`;
      const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      const d = await r.json();
      if (d.success) setEntries(d.entries || []);
    } catch (_) {}
  }, [dojoId]);

  useEffect(() => { load(); }, [load]);

  const dismiss = async (id) => {
    try {
      const token = localStorage.getItem('dojo_auth_token');
      await fetch(`/api/lastschriftlauf/auto-protokoll/${id}/lesen`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` }
      });
      setEntries(prev => prev.filter(e => e.id !== id));
    } catch (_) {}
  };

  const downloadCsv = (id) => {
    const token = localStorage.getItem('dojo_auth_token');
    const a = document.createElement('a');
    a.href = `/api/lastschriftlauf/auto-protokoll/${id}/csv?dojo_id=${dojoId}`;
    a.click();
  };

  if (!entries.length) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '0.75rem' }}>
      {entries.map(e => (
        <div key={e.id} style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          padding: '0.6rem 0.9rem',
          borderRadius: '9px',
          border: `1px solid ${e.status === 'fehler' ? 'rgba(239,68,68,0.3)' : 'rgba(34,197,94,0.3)'}`,
          background: e.status === 'fehler' ? 'rgba(239,68,68,0.06)' : 'rgba(34,197,94,0.06)',
          fontSize: '0.82rem',
        }}>
          {e.status === 'fehler'
            ? <AlertTriangle size={16} color="#f87171" style={{ flexShrink: 0 }} />
            : <CheckCircle size={16} color="#4ade80" style={{ flexShrink: 0 }} />
          }
          <div style={{ flex: 1, minWidth: 0 }}>
            {e.status === 'fehler' ? (
              <span style={{ color: '#f87171' }}>
                Auto-Lastschrift fehlgeschlagen ({fmt(e.erstellt_am)}): {e.fehler_meldung}
              </span>
            ) : (
              <span style={{ color: '#e0e0e0' }}>
                <strong style={{ color: '#4ade80' }}>Auto-Lastschrift{e.dojoname ? ` (${e.dojoname})` : ''}:</strong>{' '}
                {e.anzahl_verkaeufe} Artikelverkäufe über{' '}
                <strong>{fmtEur(e.gesamt_betrag_cent)}</strong>{' '}
                wurden am {fmt(e.erstellt_am)} automatisch zum Einzug vorgemerkt.
              </span>
            )}
          </div>
          {e.status !== 'fehler' && (
            <button onClick={() => downloadCsv(e.id)} title="SEPA-CSV herunterladen" style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
              padding: '0.25rem 0.6rem', borderRadius: '6px',
              background: 'rgba(124,106,247,0.1)', border: '1px solid rgba(124,106,247,0.3)',
              color: '#a78bfa', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer',
              flexShrink: 0
            }}>
              <Download size={12} /> CSV
            </button>
          )}
          <button onClick={() => dismiss(e.id)} title="Bestätigen" style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: '22px', height: '22px', borderRadius: '5px',
            background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
            color: '#888', cursor: 'pointer', flexShrink: 0
          }}>
            <X size={12} />
          </button>
        </div>
      ))}
    </div>
  );
};

export default LastschriftAutoProtokollBanner;
